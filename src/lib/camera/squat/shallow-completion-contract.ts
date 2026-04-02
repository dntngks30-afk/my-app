/**
 * PR-CAM-CANONICAL-SHALLOW-CONTRACT-01 / PR-CAM-CANONICAL-SHALLOW-CLOSER-02
 * Canonical shallow completion contract — primary shallow truth derivation.
 *
 * Architecture (PR-B 이후):
 * - contract 자체는 pure derivation: completion state 를 직접 mutate 하지 않는다.
 * - downstream canonical closer(applyCanonicalShallowClosureFromContract)가
 *   이 contract 를 유일한 writer input 으로 사용해 official_shallow_cycle 을 연다.
 * - PR-A 문구("does not own completion")는 PR-B 이후 의미가 바뀌었다:
 *   contract 함수 자체는 mutation 없이 derivation 만 하되,
 *   downstream 에서 이 contract 결과가 shallow success 의 유일 근거가 된다.
 *
 * PR-CAM-POLICY-DRIFT-OBSERVABILITY-SEPARATION-03:
 * - product policy(applyUltraLowPolicyLock) 는 contract 내부에서 적용하지 않는다.
 * - evaluator boundary 에서 canonical closer → observability attach → product policy 순으로 실행된다.
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

  /** PR-B: guarded trajectory closure proof — reversal evidence OR 에 합류 허용. */
  guardedShallowTrajectoryClosureProofSatisfied?: boolean;
  /** PR-B: 현재 completion pass reason — split-brain 감지 보강용(입력 fact). */
  completionPassReason?: string;
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

  /**
   * PR-B: canonical contract 가 satisfied 일 때 어떤 경로로 닫혔는지.
   * 'canonical_guarded_trajectory' — guarded trajectory proof 가 reversal evidence 에 기여.
   * 'canonical_authoritative' — authoritative 경로.
   * 'none' — not satisfied.
   */
  closureSource: 'none' | 'canonical_authoritative' | 'canonical_guarded_trajectory';
  /** PR-B: satisfied === true 이면 true — canonical closer 가 official_shallow_cycle 을 열 수 있음. */
  closureWouldWriteOfficialShallowCycle: boolean;

  trace: string;
}

function reversalEvidenceFromInput(input: CanonicalShallowCompletionContractInput): boolean {
  return (
    input.ownerAuthoritativeReversalSatisfied === true ||
    input.officialShallowStreamBridgeApplied === true ||
    input.officialShallowAscentEquivalentSatisfied === true ||
    input.officialShallowClosureProofSatisfied === true ||
    input.officialShallowPrimaryDropClosureFallback === true ||
    input.guardedShallowTrajectoryClosureProofSatisfied === true
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

  /** PR-B: runtime closer vs contract 불일치 + completionPassReason 단독 불일치 감지. */
  const closerCanonicalMismatch =
    input.officialShallowPathAdmitted === true &&
    inZone &&
    (input.officialShallowPathClosed === true) !== satisfied;

  const passReasonMismatch =
    (input.officialShallowPathClosed === true && satisfied === false) ||
    (input.officialShallowPathClosed !== true &&
      input.completionPassReason === 'official_shallow_cycle' &&
      satisfied === false);

  const splitBrainDetected = baseSplitBrain || closerCanonicalMismatch || passReasonMismatch;

  /**
   * PR-B: satisfied 이고 shallow owner zone 에 있으며 standard path 가 아닌 경우 true.
   * (PR-A 의 officialShallowPathClosed mirror 에서 계약 기반으로 승격)
   */
  const authoritativeClosureWouldBeSatisfied =
    satisfied === true &&
    inZone &&
    input.completionPassReason !== 'standard_cycle';

  /**
   * PR-B: guarded trajectory proof 가 reversal evidence 에 기여해 contract 를 만족시켰으면
   * 'canonical_guarded_trajectory', 그 외 authoritative 이면 'canonical_authoritative', 미충족이면 'none'.
   */
  const closureSource: 'none' | 'canonical_authoritative' | 'canonical_guarded_trajectory' =
    !satisfied
      ? 'none'
      : input.guardedShallowTrajectoryClosureProofSatisfied === true
        ? 'canonical_guarded_trajectory'
        : 'canonical_authoritative';

  const closureWouldWriteOfficialShallowCycle = satisfied;

  const trace = [
    `eligible=${eligible ? 1 : 0}`,
    `admission=${admissionSatisfied ? 1 : 0}`,
    `attempt=${attemptSatisfied ? 1 : 0}`,
    `reversal=${reversalEvidenceSatisfied ? 1 : 0}`,
    `recovery=${recoveryEvidenceSatisfied ? 1 : 0}`,
    `anti=${antiFalsePassClear ? 1 : 0}`,
    `split=${splitBrainDetected ? 1 : 0}`,
    `authClosure=${authoritativeClosureWouldBeSatisfied ? 1 : 0}`,
    `closureSrc=${closureSource}`,
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
    closureSource,
    closureWouldWriteOfficialShallowCycle,
    trace,
  };
}
