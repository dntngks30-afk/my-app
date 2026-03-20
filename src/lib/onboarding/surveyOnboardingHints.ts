/**
 * PR-ONBOARDING-MIN-06 — 설문(v2) 답안에서 온보딩 프리필 힌트만 추출
 *
 * - 설문은 자세·패턴 체감(Likert)이지 “헬스클럽 경험”과 1:1 대응하지 않으므로
 *   exercise_experience_level 은 자동 추정하지 않는다.
 * - 통증/불편은 각 영역 q2(불편·피로 슬롯) 응답이 상대적으로 높을 때만 true 로 제안한다.
 *
 * @see movementTestSession:v2 (baseline page와 동일 키)
 */

import type { TestAnswerValue } from '@/features/movement-test/v2';

const SESSION_KEY = 'movementTestSession:v2';

/** v2 질문 중 “불편/피로” 슬롯(q2) id — questions.v2.ts 구조와 맞춤 */
const V2_Q2_IDS = [
  'v2_A2',
  'v2_B2',
  'v2_C2',
  'v2_D2',
  'v2_F2',
  'v2_G2',
] as const;

interface StoredSessionV2 {
  version?: string;
  isCompleted?: boolean;
  answersById?: Record<string, TestAnswerValue>;
}

/**
 * 로컬 설문이 완료되어 있으면 통증/불편 플래그를 보수적으로 추정한다.
 * - 평균이 충분히 낮으면 false
 * - 평균이 충분히 높으면 true
 * - 그 사이면 undefined (사용자 선택 유지)
 */
export function inferPainHintFromSurveyV2(): boolean | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return undefined;
    const data = JSON.parse(raw) as StoredSessionV2;
    if (data?.version !== 'v2' || !data.isCompleted || !data.answersById) return undefined;

    const vals: number[] = [];
    for (const id of V2_Q2_IDS) {
      const v = data.answersById[id];
      if (typeof v === 'number' && v >= 0 && v <= 4) vals.push(v);
    }
    if (vals.length === 0) return undefined;

    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    // 보수적 임계: 높은 체감 불편 → 통증 있음 쪽으로 안내
    if (avg >= 2.75) return true;
    if (avg <= 1.25) return false;
    return undefined;
  } catch {
    return undefined;
  }
}
