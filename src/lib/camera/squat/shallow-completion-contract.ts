/**
 * PR-CAM-CANONICAL-SHALLOW-CONTRACT-01
 * Canonical shallow completion contract — observability / SSOT view only.
 * Does not own completion; callers must not use this to overwrite completion truth in PR-A.
 */

/** Must stay aligned with `STANDARD_OWNER_FLOOR` in squat-completion-state.ts (0.4). */
export const CANONICAL_SHALLOW_OWNER_FLOOR = 0.4;

export type CanonicalShallowCompletionContractStage =
  | 'pre_attempt'
  | 'admission_blocked'
  | 'attempt_blocked'
  | 'reversal_blocked'
  | 'recovery_blocked'
  | 'anti_false_pass_blocked'
  | 'closed';

export type CanonicalShallowCompletionContractBlockedReason =
  | 'not_in_shallow_zone'
  | 'not_armed'
  | 'no_descend'
  | 'no_commitment'
  | 'attempt_not_meaningful'
  | 'authoritative_reversal_missing'
  | 'recovery_or_finalize_missing'
  | 'setup_motion_blocked'
  | 'peak_series_start_contamination'
  | 'insufficient_signal'
  | 'policy_or_unknown'
  | null;

export interface CanonicalShallowCompletionContractInput {
  relativeDepthPeak: number;
  officialShallowPathCandidate: boolean;
  officialShallowPathAdmitted: boolean;
  attemptStarted: boolean;
  descendConfirmed: boolean;
  downwardCommitmentReached: boolean;
  currentSquatPhase?: string;
  completionBlockedReason?: string | null;

  ownerAuthoritativeReversalSatisfied: boolean;
  ownerAuthoritativeRecoverySatisfied: boolean;

  officialShallowStreamBridgeApplied: boolean;
  officialShallowAscentEquivalentSatisfied: boolean;
  officialShallowClosureProofSatisfied: boolean;
  officialShallowPrimaryDropClosureFallback: boolean;

  provenanceReversalEvidencePresent: boolean;
  trajectoryReversalRescueApplied?: boolean;
  reversalTailBackfillApplied?: boolean;
  ultraShallowMeaningfulDownUpRescueApplied?: boolean;

  standingFinalizeSatisfied?: boolean;
  standingRecoveryFinalizeReason?: string | null;

  setupMotionBlocked?: boolean;
  peakLatchedAtIndex?: number | null;
  evidenceLabel?: string;

  /** 런타임 shallow 권위 종료 플래그 — contract vs closer 정렬용(입력 fact). */
  officialShallowPathClosed?: boolean;
}

export interface CanonicalShallowCompletionContract {
  eligible: boolean;
  admissionSatisfied: boolean;
  attemptSatisfied: boolean;
  reversalEvidenceSatisfied: boolean;
  recoveryEvidenceSatisfied: boolean;
  antiFalsePassClear: boolean;

  satisfied: boolean;
  stage: CanonicalShallowCompletionContractStage;
  blockedReason: CanonicalShallowCompletionContractBlockedReason;

  authoritativeClosureWouldBeSatisfied: boolean;
  provenanceOnlySignalPresent: boolean;
  splitBrainDetected: boolean;

  trace: string;
}

function reversalEvidenceFromInput(input: CanonicalShallowCompletionContractInput): boolean {
  return (
    input.ownerAuthoritativeReversalSatisfied === true ||
    input.officialShallowStreamBridgeApplied === true ||
    input.officialShallowAscentEquivalentSatisfied === true ||
    input.officialShallowClosureProofSatisfied === true ||
    input.officialShallowPrimaryDropClosureFallback === true
  );
}

function recoveryEvidenceFromInput(input: CanonicalShallowCompletionContractInput): boolean {
  return (
    input.ownerAuthoritativeRecoverySatisfied === true ||
    input.standingFinalizeSatisfied === true
  );
}

function antiFalsePassFromInput(input: CanonicalShallowCompletionContractInput): boolean {
  return (
    input.setupMotionBlocked !== true &&
    input.peakLatchedAtIndex !== 0 &&
    input.evidenceLabel !== 'insufficient_signal'
  );
}

function firstBlockedReason(input: CanonicalShallowCompletionContractInput): {
  reason: CanonicalShallowCompletionContractBlockedReason;
  stage: CanonicalShallowCompletionContractStage;
} {
  const inZone = input.relativeDepthPeak < CANONICAL_SHALLOW_OWNER_FLOOR;
  if (!inZone) {
    return { reason: 'not_in_shallow_zone', stage: 'admission_blocked' };
  }

  if (!input.officialShallowPathCandidate || !input.officialShallowPathAdmitted) {
    return { reason: 'policy_or_unknown', stage: 'admission_blocked' };
  }

  const br = input.completionBlockedReason ?? null;
  if (br === 'not_armed') {
    return { reason: 'not_armed', stage: 'attempt_blocked' };
  }

  if (!input.attemptStarted) {
    return { reason: 'attempt_not_meaningful', stage: 'attempt_blocked' };
  }
  if (!input.descendConfirmed) {
    return { reason: 'no_descend', stage: 'attempt_blocked' };
  }
  if (!input.downwardCommitmentReached) {
    return { reason: 'no_commitment', stage: 'attempt_blocked' };
  }

  if (!reversalEvidenceFromInput(input)) {
    return { reason: 'authoritative_reversal_missing', stage: 'reversal_blocked' };
  }

  if (!recoveryEvidenceFromInput(input)) {
    return { reason: 'recovery_or_finalize_missing', stage: 'recovery_blocked' };
  }

  if (input.setupMotionBlocked === true) {
    return { reason: 'setup_motion_blocked', stage: 'anti_false_pass_blocked' };
  }
  if (input.peakLatchedAtIndex === 0) {
    return { reason: 'peak_series_start_contamination', stage: 'anti_false_pass_blocked' };
  }
  if (input.evidenceLabel === 'insufficient_signal') {
    return { reason: 'insufficient_signal', stage: 'anti_false_pass_blocked' };
  }

  return { reason: null, stage: 'closed' };
}

/**
 * Squat completion state 에서 이미 계산된 fact 만으로 canonical shallow contract 를 정리한다.
 * completion 필드를 덮어쓰지 않는다(PR-A).
 */
export function deriveCanonicalShallowCompletionContract(
  input: CanonicalShallowCompletionContractInput
): CanonicalShallowCompletionContract {
  const inZone = input.relativeDepthPeak < CANONICAL_SHALLOW_OWNER_FLOOR;
  const eligible = inZone;

  const admissionSatisfied =
    input.officialShallowPathCandidate === true &&
    input.officialShallowPathAdmitted === true &&
    input.attemptStarted === true &&
    input.descendConfirmed === true &&
    input.downwardCommitmentReached === true;

  const attemptSatisfied = admissionSatisfied;

  const reversalEvidenceSatisfied = reversalEvidenceFromInput(input);
  const recoveryEvidenceSatisfied = recoveryEvidenceFromInput(input);
  const antiFalsePassClear = antiFalsePassFromInput(input);

  const satisfied =
    eligible &&
    admissionSatisfied &&
    attemptSatisfied &&
    reversalEvidenceSatisfied &&
    recoveryEvidenceSatisfied &&
    antiFalsePassClear;

  const { reason: blockedReason, stage: stageFromWalk } = firstBlockedReason(input);
  const stage: CanonicalShallowCompletionContractStage = satisfied ? 'closed' : stageFromWalk;

  const provenanceOnlySignalPresent =
    input.provenanceReversalEvidencePresent === true && reversalEvidenceSatisfied !== true;

  const baseSplitBrain =
    (input.officialShallowPathAdmitted === true &&
      satisfied === false &&
      provenanceOnlySignalPresent === true) ||
    (input.officialShallowPathAdmitted === true &&
      input.currentSquatPhase === 'standing_recovered' &&
      input.completionBlockedReason === 'no_reversal');

  /** 런타임 `officialShallowPathClosed` 와 canonical `satisfied` 불일치 — active closer vs contract 정렬용. */
  const closerCanonicalMismatch =
    input.officialShallowPathAdmitted === true &&
    inZone &&
    (input.officialShallowPathClosed === true) !== satisfied;

  const splitBrainDetected = baseSplitBrain || closerCanonicalMismatch;

  /** 런타임가 official shallow path 를 닫았다고 표시한 경우(입력 fact). */
  const authoritativeClosureWouldBeSatisfied = input.officialShallowPathClosed === true;

  const trace = [
    `eligible=${eligible ? 1 : 0}`,
    `admission=${admissionSatisfied ? 1 : 0}`,
    `attempt=${attemptSatisfied ? 1 : 0}`,
    `reversal=${reversalEvidenceSatisfied ? 1 : 0}`,
    `recovery=${recoveryEvidenceSatisfied ? 1 : 0}`,
    `anti=${antiFalsePassClear ? 1 : 0}`,
    `split=${splitBrainDetected ? 1 : 0}`,
    `closedPath=${authoritativeClosureWouldBeSatisfied ? 1 : 0}`,
    `stage=${stage}`,
    `blocked=${blockedReason ?? 'none'}`,
  ].join('|');

  return {
    eligible,
    admissionSatisfied,
    attemptSatisfied,
    reversalEvidenceSatisfied,
    recoveryEvidenceSatisfied,
    antiFalsePassClear,
    satisfied,
    stage,
    blockedReason: satisfied ? null : blockedReason,
    authoritativeClosureWouldBeSatisfied,
    provenanceOnlySignalPresent,
    splitBrainDetected,
    trace,
  };
}
