export interface PublicResultClaimedRowForSelection {
  id: string;
  user_id: string;
  result_stage: string;
  result_v2_json: unknown;
  claimed_at: string;
  created_at: string;
}

const BASELINE_FRESHNESS_OVERRIDE_WINDOW_MS = 1000 * 60 * 60 * 24 * 3; // 3 days

export interface RankedSelectionPolicySnapshot {
  baselineFreshnessGapMs: number | null;
  appliedStagePriority: 'baseline_overrides_stale_refined' | 'refined_within_window' | 'single_stage_only';
}

export interface RankedClaimedRowsForExecution {
  ranked: PublicResultClaimedRowForSelection[];
  policy: RankedSelectionPolicySnapshot;
}

function parseIsoToEpochMs(value: string): number {
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : Number.NEGATIVE_INFINITY;
}

function sortStageRowsByRecency(
  rows: PublicResultClaimedRowForSelection[]
): PublicResultClaimedRowForSelection[] {
  return [...rows].sort((a, b) => {
    const claimedDiff = parseIsoToEpochMs(b.claimed_at) - parseIsoToEpochMs(a.claimed_at);
    if (claimedDiff !== 0) return claimedDiff;
    const createdDiff = parseIsoToEpochMs(b.created_at) - parseIsoToEpochMs(a.created_at);
    if (createdDiff !== 0) return createdDiff;
    return b.id.localeCompare(a.id);
  });
}

export function rankClaimedRowsForExecution(
  rows: PublicResultClaimedRowForSelection[]
): RankedClaimedRowsForExecution {
  const refinedRows = sortStageRowsByRecency(rows.filter((row) => row.result_stage === 'refined'));
  const baselineRows = sortStageRowsByRecency(rows.filter((row) => row.result_stage === 'baseline'));
  const unknownStageRows = sortStageRowsByRecency(
    rows.filter((row) => row.result_stage !== 'baseline' && row.result_stage !== 'refined')
  );

  const bestRefined = refinedRows[0] ?? null;
  const bestBaseline = baselineRows[0] ?? null;

  if (bestBaseline && bestRefined) {
    const baselineFreshnessGapMs =
      parseIsoToEpochMs(bestBaseline.claimed_at) - parseIsoToEpochMs(bestRefined.claimed_at);
    const baselineOverridesRefined = baselineFreshnessGapMs > BASELINE_FRESHNESS_OVERRIDE_WINDOW_MS;
    return {
      ranked: baselineOverridesRefined
        ? [...baselineRows, ...refinedRows, ...unknownStageRows]
        : [...refinedRows, ...baselineRows, ...unknownStageRows],
      policy: {
        baselineFreshnessGapMs,
        appliedStagePriority: baselineOverridesRefined
          ? 'baseline_overrides_stale_refined'
          : 'refined_within_window',
      },
    };
  }

  return {
    ranked: [...refinedRows, ...baselineRows, ...unknownStageRows],
    policy: {
      baselineFreshnessGapMs: null,
      appliedStagePriority: 'single_stage_only',
    },
  };
}
