/**
 * 난이도·퀄리티 점수/라벨 순수 함수 (smoke 테스트 대상).
 */

/** overall_rpe 1~10 → 1~5 선형 */
export function rpe10ToDifficultyFive(rpe: number): number {
  const r = Math.min(10, Math.max(1, rpe));
  return ((r - 1) / 9) * 4 + 1;
}

export function difficultyLabelFromAvg(avg: number | null, sourceCount: number): string {
  if (sourceCount === 0 || avg == null || !Number.isFinite(avg)) return '기록 부족';
  if (avg < 2.4) return '쉬운 편';
  if (avg >= 2.4 && avg <= 3.6) return '적절함';
  return '어려운 편';
}

/** pain_after 0~10 → 안정성 1~5 (높을수록 좋음) */
export function painAfterToQualityFive(pain: number): number {
  const p = Math.min(10, Math.max(0, pain));
  return 5 - (p / 10) * 4;
}

export type QualityAggregate = {
  hasPainWorse: boolean;
  avgScore: number | null;
  sourceCount: number;
};

export function qualityLabelFromAggregate(q: QualityAggregate): string {
  if (q.hasPainWorse) return '주의 필요';
  if (q.sourceCount === 0 || q.avgScore == null || !Number.isFinite(q.avgScore)) return '기록 부족';
  const avg = q.avgScore;
  if (avg >= 3.7) return '안정적';
  if (avg >= 2.7) return '보통';
  return '불안정';
}
