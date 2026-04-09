import type {
  AttemptSnapshot,
  TraceMovementType,
  TraceOutcome,
  TraceQuickStats,
} from '../camera-trace';

export function computeTraceQuickStats(snapshots: AttemptSnapshot[]): TraceQuickStats {
  const byMovement: Record<TraceMovementType, number> = {
    squat: 0,
    overhead_reach: 0,
  };
  const byOutcome: Record<TraceOutcome, number> = {
    ok: 0,
    low: 0,
    invalid: 0,
    retry_required: 0,
    retry_optional: 0,
    failed: 0,
  };
  const reasonCounts: Record<string, number> = {};
  const flagCounts: Record<string, number> = {};
  const okLowInvalidByMovement: Record<
    TraceMovementType,
    { ok: number; low: number; invalid: number }
  > = {
    squat: { ok: 0, low: 0, invalid: 0 },
    overhead_reach: { ok: 0, low: 0, invalid: 0 },
  };

  for (const s of snapshots) {
    byMovement[s.movementType] = (byMovement[s.movementType] ?? 0) + 1;
    byOutcome[s.outcome] = (byOutcome[s.outcome] ?? 0) + 1;

    const dist = okLowInvalidByMovement[s.movementType];
    if (dist) {
      if (s.outcome === 'ok') dist.ok += 1;
      else if (
        s.outcome === 'low' ||
        s.outcome === 'retry_optional' ||
        s.outcome === 'retry_required'
      )
        dist.low += 1;
      else dist.invalid += 1;
    }

    for (const r of s.topReasons ?? []) {
      reasonCounts[r] = (reasonCounts[r] ?? 0) + 1;
    }
    for (const f of s.flags ?? []) {
      flagCounts[f] = (flagCounts[f] ?? 0) + 1;
    }
  }

  const topRetryReasons = Object.entries(reasonCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([reason, count]) => ({ reason, count }));

  const topFlags = Object.entries(flagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([flag, count]) => ({ flag, count }));

  return {
    byMovement,
    byOutcome,
    topRetryReasons,
    topFlags,
    okLowInvalidByMovement,
  };
}
