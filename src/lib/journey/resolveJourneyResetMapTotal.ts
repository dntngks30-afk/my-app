/**
 * Journey 탭 «리셋맵 진행도» 표시 정규화 전용.
 * 주당 빈도 → 총 세션 매핑은 하지 않음. truth는 activeLite.progress.total_sessions 등 서버 값.
 */

export type NormalizeJourneyResetMapInput = {
  total: number | null | undefined;
  completed: number | null | undefined;
};

export type NormalizeJourneyResetMapResult = {
  empty: boolean;
  totalSessions: number;
  completedSafe: number;
  pct: number;
};

export function normalizeJourneyResetMapProgress(
  input: NormalizeJourneyResetMapInput,
): NormalizeJourneyResetMapResult {
  const totalRaw = input.total;
  const total =
    totalRaw != null && Number.isFinite(Number(totalRaw)) && Number(totalRaw) > 0
      ? Math.floor(Number(totalRaw))
      : null;

  if (total == null || total <= 0) {
    return {
      empty: true,
      totalSessions: 0,
      completedSafe: 0,
      pct: 0,
    };
  }

  const completedRaw = input.completed;
  const completed =
    completedRaw != null && Number.isFinite(Number(completedRaw))
      ? Math.max(0, Math.floor(Number(completedRaw)))
      : 0;
  const completedSafe = Math.min(completed, total);
  const pct = Math.min(100, Math.round((completedSafe / total) * 100));

  return {
    empty: false,
    totalSessions: total,
    completedSafe,
    pct,
  };
}
