'use client';

import { supabaseBrowser as supabase } from '@/lib/supabase';

const SESSION_STORAGE_KEY = 'movementTestSession:v1';

type SessionData = {
  answers: Record<string, any>;
  questionIndex: number;
  updatedAt: number;
  isCompleted: boolean;
  result?: any;

  updatedAtByQid: Record<string, number>;
  dirtyQids: string[];
};

type ServerRow = {
  question_id: string;
  answer: string; // JSON string (Answer payload)
  updated_at: string | null; // timestamptz
};

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function loadSession(): SessionData {
  const parsed = safeParse<Partial<SessionData>>(localStorage.getItem(SESSION_STORAGE_KEY));

  // 레거시 대응(없으면 기본값)
  return {
    answers: parsed?.answers ?? {},
    questionIndex: typeof parsed?.questionIndex === 'number' ? parsed!.questionIndex : 0,
    updatedAt: typeof parsed?.updatedAt === 'number' ? parsed!.updatedAt : Date.now(),
    isCompleted: Boolean(parsed?.isCompleted),
    result: parsed?.result,

    updatedAtByQid: parsed?.updatedAtByQid ?? {},
    dirtyQids: parsed?.dirtyQids ?? [],
  };
}

function saveSession(session: SessionData) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

function normalizeQid(qid: string | number) {
  return String(qid);
}

function serverMs(updated_at: string | null) {
  return updated_at ? Date.parse(updated_at) : 0;
}

/**
 * 서버에서 내 설문 응답 rows 읽기
 */
async function fetchServerResponses(userId: string): Promise<ServerRow[]> {
  const { data, error } = await supabase
    .from('survey_responses')
    .select('question_id, answer, updated_at')
    .eq('user_id', userId);

  if (error) throw error;
  return (data ?? []) as ServerRow[];
}

/**
 * 서버 upsert (배치)
 */
async function upsertResponses(userId: string, rows: Array<{ question_id: string; answer: string }>) {
  if (rows.length === 0) return { saved: 0 };

  const payload = rows.map((r) => ({
    user_id: userId,
    question_id: r.question_id,
    answer: r.answer,
  }));

  const { error } = await supabase
    .from('survey_responses')
    .upsert(payload, { onConflict: 'user_id,question_id' });

  if (error) throw error;
  return { saved: payload.length };
}

/**
 * ✅ 핵심: 로그인 시 로컬 ↔ 서버 머지 + 로컬 최신분만 업서트 + dirty 정리
 *
 * 머지 규칙:
 * - 같은 question_id가 있으면
 *   - 로컬 updatedAtByQid[qid] >= 서버 updated_at => 로컬 채택 + 서버로 업서트 대상
 *   - 서버가 더 최신 => 서버 채택(로컬 덮어쓰기)
 * - 서버에만 있으면 => 로컬로 당겨옴
 * - 로컬에만 있으면 => 서버로 올림
 *
 * dirtyQids는:
 * - 업서트 성공한 qid는 제거
 * - 실패하면 유지(다음 로그인/재시도 때 다시 올림)
 */
export async function migrateLocalToServerOnLogin() {
  const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
  if (sessionErr) throw sessionErr;

  const user = sessionData.session?.user;
  if (!user) return { skipped: true, migrated: 0, pulledFromServer: 0 };

  const userId = user.id;

  // 1) 로컬 세션 로드
  const local = loadSession();

  // 2) 서버 rows 로드
  const serverRows = await fetchServerResponses(userId);

  const serverMap: Record<string, { answer: string; updatedAtMs: number }> = {};
  for (const r of serverRows) {
    serverMap[normalizeQid(r.question_id)] = {
      answer: r.answer,
      updatedAtMs: serverMs(r.updated_at),
    };
  }

  const localQids = Object.keys(local.answers).map(normalizeQid);
  const allQids = new Set<string>([...localQids, ...Object.keys(serverMap)]);

  const mergedAnswers: Record<string, any> = { ...local.answers };
  const mergedUpdatedAtByQid: Record<string, number> = { ...local.updatedAtByQid };

  const toUpsert: Array<{ question_id: string; answer: string }> = [];
  let pulledFromServer = 0;

  for (const qid of allQids) {
    const lAnswer = local.answers[qid];
    const lMs = local.updatedAtByQid[qid] ?? 0;

    const s = serverMap[qid];
    const sMs = s?.updatedAtMs ?? 0;

    if (lAnswer && !s) {
      // 로컬만 존재 -> 서버로 올림
      toUpsert.push({ question_id: qid, answer: JSON.stringify(lAnswer) });
      mergedAnswers[qid] = lAnswer;
      mergedUpdatedAtByQid[qid] = lMs || Date.now();
      continue;
    }

    if (!lAnswer && s) {
      // 서버만 존재 -> 로컬로 당김
      const decoded = safeParse<any>(s.answer);
      if (decoded) {
        mergedAnswers[qid] = decoded;
        mergedUpdatedAtByQid[qid] = sMs || Date.now();
        pulledFromServer++;
      }
      continue;
    }

    if (lAnswer && s) {
      if (lMs >= sMs) {
        // 로컬이 최신 -> 서버로 올림
        toUpsert.push({ question_id: qid, answer: JSON.stringify(lAnswer) });
        mergedAnswers[qid] = lAnswer;
        mergedUpdatedAtByQid[qid] = lMs || Date.now();
      } else {
        // 서버가 최신 -> 로컬 덮어쓰기
        const decoded = safeParse<any>(s.answer);
        if (decoded) {
          mergedAnswers[qid] = decoded;
          mergedUpdatedAtByQid[qid] = sMs || Date.now();
          pulledFromServer++;
        }
      }
    }
  }

  // 3) 서버 업서트 (로컬 최신분)
  let migrated = 0;
  if (toUpsert.length > 0) {
    const res = await upsertResponses(userId, toUpsert);
    migrated = res.saved;
  }

  // 4) dirtyQids 정리:
  // - 업서트 시도한 qid들 중 성공했다고 가정(단일 upsert가 실패하면 throw되므로 여기까지 오면 성공)
  const attempted = new Set(toUpsert.map((r) => normalizeQid(r.question_id)));
  const nextDirty = (local.dirtyQids ?? []).filter((qid) => !attempted.has(normalizeQid(qid)));

  // 5) 최종 로컬 세션 저장 (머지 결과 반영)
  const nextSession: SessionData = {
    ...local,
    answers: mergedAnswers,
    updatedAtByQid: mergedUpdatedAtByQid,
    dirtyQids: nextDirty,
    updatedAt: Date.now(),
  };
  saveSession(nextSession);

  return { skipped: false, migrated, pulledFromServer };
}

/**
 * (옵션) 로그인 상태에서 수동으로 "지금 dirtyQids만 업서트" 하고 싶을 때
 * - 결과 페이지에서 "저장됨" 버튼 같은 거에 연결 가능
 */
export async function flushDirtyToServer() {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) return { skipped: true, saved: 0 };

  const userId = user.id;
  const local = loadSession();

  const dirty = (local.dirtyQids ?? []).map(normalizeQid);
  const rows = dirty
    .map((qid) => local.answers[qid])
    .filter(Boolean)
    .map((a: any) => ({ question_id: normalizeQid(a.questionId ?? a.question_id ?? a.id ?? ''), answer: JSON.stringify(a) }))
    // 위 라인이 불안하면 아래처럼 확정적으로 만들자:
    // .map((a, idx) => ({ question_id: dirty[idx], answer: JSON.stringify(a) }))
    ;

  // 더 안전한 버전(권장): dirty 순서대로 매핑
  const safeRows = dirty
    .map((qid) => local.answers[qid])
    .map((a, idx) => ({ question_id: dirty[idx]!, answer: JSON.stringify(a) }));

  if (safeRows.length === 0) return { skipped: false, saved: 0 };

  const { saved } = await upsertResponses(userId, safeRows);

  // 성공하면 dirty 비우기
  const nextSession: SessionData = { ...local, dirtyQids: [], updatedAt: Date.now() };
  saveSession(nextSession);

  return { skipped: false, saved };
}
