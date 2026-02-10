"use client";

/**
 * localStorage에 Answer[]를 저장하되,
 * DB 머지/동기화를 위해 question별 updatedAt(ms) 메타를 같이 보관한다.
 */

export type AnyAnswer = {
  questionId: string | number;
  // 아래는 프로젝트에 따라 달라도 됨 (우리는 JSON으로 그대로 보관)
  [k: string]: any;
};

type LocalStateV1 = {
  version: 1;
  // 네가 기존에 쓰는 포맷: Answer[]
  answers: AnyAnswer[];
  // questionId별 마지막 수정 시각(ms)
  updatedAtByQid: Record<string, number>;
};

const STORAGE_KEY = "movementTest:answers:v1";

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function loadLocalAnswers(): { answers: AnyAnswer[]; updatedAtByQid: Record<string, number> } {
  const parsed = safeParse<LocalStateV1>(localStorage.getItem(STORAGE_KEY));

  // ✅ 기존에 Answer[]만 저장해둔 레거시 케이스 대응
  // (예: localStorage에 바로 []가 들어있던 경우)
  const legacy = safeParse<AnyAnswer[]>(localStorage.getItem(STORAGE_KEY));
  if (Array.isArray(legacy)) {
    const updatedAtByQid: Record<string, number> = {};
    for (const a of legacy) {
      const qid = String(a.questionId);
      updatedAtByQid[qid] = Date.now();
    }
    const upgraded: LocalStateV1 = { version: 1, answers: legacy, updatedAtByQid };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(upgraded));
    return { answers: legacy, updatedAtByQid };
  }

  if (!parsed || parsed.version !== 1) {
    return { answers: [], updatedAtByQid: {} };
  }

  return { answers: parsed.answers ?? [], updatedAtByQid: parsed.updatedAtByQid ?? {} };
}

export function saveLocalAnswers(nextAnswers: AnyAnswer[], updatedAtByQid: Record<string, number>) {
  const payload: LocalStateV1 = { version: 1, answers: nextAnswers, updatedAtByQid };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

/**
 * Answer[] 안에서 특정 question의 답을 교체/추가하고 메타 updatedAt 갱신
 */
export function upsertLocalAnswer(next: AnyAnswer) {
  const { answers, updatedAtByQid } = loadLocalAnswers();
  const qid = String(next.questionId);

  const idx = answers.findIndex((a) => String(a.questionId) === qid);
  const nextAnswers =
    idx >= 0 ? [...answers.slice(0, idx), next, ...answers.slice(idx + 1)] : [...answers, next];

  const nextMeta = { ...updatedAtByQid, [qid]: Date.now() };
  saveLocalAnswers(nextAnswers, nextMeta);
  return { answers: nextAnswers, updatedAtByQid: nextMeta };
}

export function clearLocalAnswers() {
  localStorage.removeItem(STORAGE_KEY);
}
