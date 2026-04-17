export interface PublicResultClaimedRowForSelection {
  id: string;
  user_id: string;
  result_stage: string;
  result_v2_json: unknown;
  claimed_at: string;
  created_at: string;
}

const BASELINE_FRESHNESS_OVERRIDE_WINDOW_MS = 1000 * 60 * 60 * 24 * 3; // 3 days
const SUITABILITY_TIMING_CLOSE_WINDOW_MS = 1000 * 60 * 60 * 6; // 6 hours

export interface RankedSelectionPolicySnapshot {
  baselineFreshnessGapMs: number | null;
  appliedStagePriority: 'baseline_overrides_stale_refined' | 'refined_within_window' | 'single_stage_only';
  suitabilityPolicy: {
    applied: boolean;
    timingCloseWindowMs: number;
    selectedReason: string | null;
    rejectedReasons: Array<{ id: string; reason: string }>;
  };
}

export interface RankedClaimedRowsForExecution {
  ranked: PublicResultClaimedRowForSelection[];
  policy: RankedSelectionPolicySnapshot;
}

function parseIsoToEpochMs(value: string): number {
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : Number.NEGATIVE_INFINITY;
}

/**
 * PR1-B timing law:
 * 1) claimed_at  (execution-path recency)
 * 2) created_at  (analysis-generation recency)
 * 3) id          (final deterministic stability)
 */
export function compareByDeterministicSelectionTimingLaw(
  a: PublicResultClaimedRowForSelection,
  b: PublicResultClaimedRowForSelection
): number {
  const claimedDiff = parseIsoToEpochMs(b.claimed_at) - parseIsoToEpochMs(a.claimed_at);
  if (claimedDiff !== 0) return claimedDiff;

  const createdDiff = parseIsoToEpochMs(b.created_at) - parseIsoToEpochMs(a.created_at);
  if (createdDiff !== 0) return createdDiff;

  return b.id.localeCompare(a.id);
}

function sortRowsByDeterministicSelectionTimingLaw(
  rows: PublicResultClaimedRowForSelection[]
): PublicResultClaimedRowForSelection[] {
  return [...rows].sort(compareByDeterministicSelectionTimingLaw);
}

function getEvidenceLevelSuitabilityScore(value: unknown): number {
  if (value === 'full') return 2;
  if (value === 'partial') return 1;
  return 0;
}

function getMissingSignalsCount(value: unknown): number {
  if (!Array.isArray(value)) return Number.POSITIVE_INFINITY;
  return value.length;
}

function computeExecutionSuitabilityTuple(
  row: PublicResultClaimedRowForSelection
): [number, number] {
  const result = row.result_v2_json as Record<string, unknown> | null;
  const evidenceLevelScore = getEvidenceLevelSuitabilityScore(result?.evidence_level);
  const missingSignalsCount = getMissingSignalsCount(result?.missing_signals);
  return [evidenceLevelScore, missingSignalsCount];
}

function compareByExecutionSuitability(
  a: PublicResultClaimedRowForSelection,
  b: PublicResultClaimedRowForSelection
): number {
  const [aEvidence, aMissing] = computeExecutionSuitabilityTuple(a);
  const [bEvidence, bMissing] = computeExecutionSuitabilityTuple(b);
  if (aEvidence !== bEvidence) return bEvidence - aEvidence;
  if (aMissing !== bMissing) return aMissing - bMissing;
  return compareByDeterministicSelectionTimingLaw(a, b);
}

function applyExecutionSuitabilityTieBreak(
  rows: PublicResultClaimedRowForSelection[]
): {
  rankedRows: PublicResultClaimedRowForSelection[];
  selectedReason: string | null;
  rejectedReasons: Array<{ id: string; reason: string }>;
  applied: boolean;
} {
  if (rows.length <= 1) {
    return { rankedRows: rows, selectedReason: null, rejectedReasons: [], applied: false };
  }

  const timingRanked = sortRowsByDeterministicSelectionTimingLaw(rows);
  const top = timingRanked[0];
  if (!top) {
    return { rankedRows: timingRanked, selectedReason: null, rejectedReasons: [], applied: false };
  }

  const topClaimedAtMs = parseIsoToEpochMs(top.claimed_at);
  const timingCloseCohort = timingRanked.filter((row) => {
    const gap = Math.abs(topClaimedAtMs - parseIsoToEpochMs(row.claimed_at));
    return gap <= SUITABILITY_TIMING_CLOSE_WINDOW_MS;
  });

  if (timingCloseCohort.length <= 1) {
    return { rankedRows: timingRanked, selectedReason: null, rejectedReasons: [], applied: false };
  }

  const suitabilityRanked = [...timingCloseCohort].sort(compareByExecutionSuitability);
  const suitabilityWinner = suitabilityRanked[0];
  if (!suitabilityWinner) {
    return { rankedRows: timingRanked, selectedReason: null, rejectedReasons: [], applied: false };
  }

  const timingWinner = top;
  const suitabilityChangedWinner = suitabilityWinner.id !== timingWinner.id;
  const [winnerEvidence, winnerMissing] = computeExecutionSuitabilityTuple(suitabilityWinner);
  const [timingEvidence, timingMissing] = computeExecutionSuitabilityTuple(timingWinner);
  const winnerOutranksTimingWinner =
    winnerEvidence > timingEvidence ||
    (winnerEvidence === timingEvidence && winnerMissing < timingMissing);

  if (!suitabilityChangedWinner || !winnerOutranksTimingWinner) {
    return {
      rankedRows: timingRanked,
      selectedReason: null,
      rejectedReasons: [],
      applied: false,
    };
  }

  const selectedReason = `timing_close_execution_suitability:evidence_level_or_missing_signals(id=${suitabilityWinner.id})`;
  const rejectedReasons = timingCloseCohort
    .filter((row) => row.id !== suitabilityWinner.id)
    .map((row) => ({
      id: row.id,
      reason:
        'timing_close_less_execution_suitable_than_winner(by_evidence_level_then_missing_signals)',
    }));

  const rankedRows = [
    suitabilityWinner,
    ...timingRanked.filter((row) => row.id !== suitabilityWinner.id),
  ];

  return {
    rankedRows,
    selectedReason,
    rejectedReasons,
    applied: true,
  };
}

export function rankClaimedRowsForExecution(
  rows: PublicResultClaimedRowForSelection[]
): RankedClaimedRowsForExecution {
  const refinedRows = sortRowsByDeterministicSelectionTimingLaw(
    rows.filter((row) => row.result_stage === 'refined')
  );
  const baselineRows = sortRowsByDeterministicSelectionTimingLaw(
    rows.filter((row) => row.result_stage === 'baseline')
  );
  const unknownStageRows = sortRowsByDeterministicSelectionTimingLaw(
    rows.filter((row) => row.result_stage !== 'baseline' && row.result_stage !== 'refined')
  );

  const bestRefined = refinedRows[0] ?? null;
  const bestBaseline = baselineRows[0] ?? null;

  // PR1-A: stage/currentness ownership remains first.
  if (bestBaseline && bestRefined) {
    const baselineFreshnessGapMs =
      parseIsoToEpochMs(bestBaseline.claimed_at) - parseIsoToEpochMs(bestRefined.claimed_at);
    const baselineOverridesRefined = baselineFreshnessGapMs > BASELINE_FRESHNESS_OVERRIDE_WINDOW_MS;
    const winningStageRows = baselineOverridesRefined ? baselineRows : refinedRows;
    const nonWinningStageRows = baselineOverridesRefined ? refinedRows : baselineRows;
    const suitability = applyExecutionSuitabilityTieBreak(winningStageRows);

    return {
      ranked: [...suitability.rankedRows, ...nonWinningStageRows, ...unknownStageRows],
      policy: {
        baselineFreshnessGapMs,
        appliedStagePriority: baselineOverridesRefined
          ? 'baseline_overrides_stale_refined'
          : 'refined_within_window',
        suitabilityPolicy: {
          applied: suitability.applied,
          timingCloseWindowMs: SUITABILITY_TIMING_CLOSE_WINDOW_MS,
          selectedReason: suitability.selectedReason,
          rejectedReasons: suitability.rejectedReasons,
        },
      },
    };
  }

  const stageOnlyRows = refinedRows.length > 0 ? refinedRows : baselineRows;
  const suitability = applyExecutionSuitabilityTieBreak(stageOnlyRows);
  const otherKnownStageRows = refinedRows.length > 0 ? baselineRows : refinedRows;

  return {
    ranked: [...suitability.rankedRows, ...otherKnownStageRows, ...unknownStageRows],
    policy: {
      baselineFreshnessGapMs: null,
      appliedStagePriority: 'single_stage_only',
      suitabilityPolicy: {
        applied: suitability.applied,
        timingCloseWindowMs: SUITABILITY_TIMING_CLOSE_WINDOW_MS,
        selectedReason: suitability.selectedReason,
        rejectedReasons: suitability.rejectedReasons,
      },
    },
  };
}
