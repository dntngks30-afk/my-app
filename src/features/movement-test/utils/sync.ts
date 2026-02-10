import { supabaseBrowser as supabase } from "@/lib/supabase";

export type DraftState = {
  version: 1;
  answers: Record<string, { question_id: string; answer: string; updatedAt: number }>;
  dirty: string[];
  lastSyncedAt?: number;
};

export async function upsertDirtyAnswers(draft: DraftState) {
  // 로그인 세션 확인
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) throw new Error("Not authenticated");

  const rows = draft.dirty
    .map((qid) => draft.answers[qid])
    .filter(Boolean)
    .map((a) => ({
      user_id: userId,
      question_id: a.question_id,
      answer: a.answer,
      // DB쪽 updated_at은 트리거로 갱신되지만,
      // "최신 비교"를 위해 created_at/updated_at 외에 클라 timestamp를 저장하고 싶으면 컬럼 추가 권장.
      // 여기서는 단순 업서트만.
    }));

  if (rows.length === 0) return { saved: 0 };

  const { error } = await supabase
    .from("survey_responses")
    .upsert(rows, { onConflict: "user_id,question_id" });

  if (error) throw error;

  return { saved: rows.length };
}
