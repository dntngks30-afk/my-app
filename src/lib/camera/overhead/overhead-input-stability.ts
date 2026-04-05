/**
 * PR-OH-INPUT-STABILITY-02A: overhead-only page-level terminal deferral vs adaptor fast-fail.
 *
 * Does NOT change readiness thresholds, auto-progression, motion, or hook quality.
 * Used by overhead-reach page and smoke fixtures — single source for grace constants.
 */

/** Upper bound for capture continuation after retry/fail when real dual support exists. */
export const OH_ACCUMULATION_GRACE_MAX_MS = 2800;

/**
 * Must stay aligned with `MIN_READY_VALID_FRAMES` in `live-readiness.ts` (currently 8).
 * Readiness contract is unchanged; this is only the "accumulation complete" gate for ending grace.
 */
export const OH_READINESS_MIN_VALID_FRAMES_FOR_GRACE = 8;

export type OverheadAttemptFailureType =
  | 'adaptor_no_input'
  | 'early_cutoff_valid_support'
  | 'insufficient_signal_other';

/** Compact diagnosis merged into attempt snapshot `diagnosisSummary.overhead.inputStability`. */
export interface OverheadInputStabilityDiag {
  overheadAttemptFailureType: OverheadAttemptFailureType;
  /** True when terminal was delayed for bounded accumulation (Category 2). */
  accumulationGraceApplied?: boolean;
  terminalReasonCategory?: string;
  terminalDecisionPhase?: string;
  accumulationGraceElapsedMs?: number;
  /** True when terminal fired before readiness min valid frames (honest under short capture). */
  terminalBeforeAccumulationComplete?: boolean;
  /** Any adaptor/landmark path failure observed this session (from hook stats). */
  adaptorFailureObserved?: boolean;
  firstHookAcceptedAtMs?: number | null;
  readinessMinValidFramesTarget?: number;
}

/**
 * Category 2 (early-cutoff): hook + guardrail both show ≥1 valid/support frame — eligible for bounded grace.
 * Category 1 (adaptor / no hook support): hook accepted count 0 — never grace.
 */
export function isOverheadAccumulationGraceEligible(
  hookAcceptedFrameCount: number,
  guardrailValidFrameCount: number
): boolean {
  return hookAcceptedFrameCount >= 1 && guardrailValidFrameCount >= 1;
}

export interface OverheadGraceState {
  /** Monotonic `performance.now()` when grace window started; null if not started. */
  graceStartedAtMs: number | null;
}

/**
 * While in retry/fail, returns whether terminal side effects (stop/snapshot) should be deferred.
 * Caller updates `graceStartedAtMs` when starting grace (set to `nowMs` if null).
 */
export function computeOverheadRetryFailDeferral(args: {
  graceStartedAtMs: number | null;
  nowMs: number;
  readinessValidFrameCount: number;
}): { deferTerminal: boolean; graceStartedAtMs: number | null } {
  let { graceStartedAtMs } = args;
  if (graceStartedAtMs === null) {
    graceStartedAtMs = args.nowMs;
  }
  const elapsed = args.nowMs - graceStartedAtMs;
  const readinessAccumulated =
    args.readinessValidFrameCount >= OH_READINESS_MIN_VALID_FRAMES_FOR_GRACE;
  const graceExpired = elapsed >= OH_ACCUMULATION_GRACE_MAX_MS;

  if (readinessAccumulated || graceExpired) {
    return { deferTerminal: false, graceStartedAtMs };
  }
  return { deferTerminal: true, graceStartedAtMs };
}
