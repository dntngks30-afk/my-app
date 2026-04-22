/**
 * PR-CAM-SQUAT-MEANINGFUL-SHALLOW-GATE-01
 *
 * 얕은 스쿼트는 "의미 있는 하강 -> 상승 -> 서기 복귀"가 확인될 때만 통과시킨다.
 * deep standard path는 건드리지 않고, shallow pass만 마지막 게이트에서 보수적으로 확정한다.
 *
 * PR-CAM-SHALLOW-LOW-ROM-SETUP-REARM-01
 *
 * setup/framing 이동 때문에 `setupMotionBlocked + not_armed + freeze_or_latch_missing`가 함께 남는 경우,
 * shallow low-rom 후보에 한해 later stable-standing window부터 tail을 다시 평가한다.
 * deep standard 경로는 재평가 대상에서 제외한다.
 */
import type { PoseLandmarks } from '@/lib/motion/pose-types';
import {
  buildPoseFeaturesFrames,
  getSquatRecoverySignal,
  type PoseFeaturesFrame,
} from '@/lib/camera/pose-features';
import type { EvaluatorResult } from './types';
import type { SquatCompletionState } from '../squat-completion-state';
import { SHALLOW_CURRENT_REP_REVERSAL_TO_STANDING_MAX_MS } from '../squat/shallow-completion-contract';
import { resolveProvisionalShallowTerminalAuthority } from '../squat/squat-completion-canonical';
import {
  computeSquatReadinessStableDwell,
  computeSquatSetupMotionBlock,
  evaluateSquatCompletionState,
} from '../squat-completion-state';
import {
  computeSquatCompletionArming,
  mergeArmingDepthObservability,
  type CompletionArmingState,
} from '../squat/squat-completion-arming';
import { getSquatHmmArmingAssistDecision } from '../squat/squat-arming-assist';
import { decodeSquatHmm } from '../squat/squat-hmm';
import { evaluateSquatFromPoseFrames } from './squat';

const LOW_ROM_LABEL_FLOOR = 0.07;
const STANDARD_OWNER_FLOOR = 0.4;
const MIN_DESCENT_TO_PEAK_MS_SHALLOW = 200;
const MIN_REVERSAL_TO_STANDING_MS_SHALLOW = 200;

const STANDING_DEPTH_MAX = 0.085;
const STABLE_ADJACENT_DELTA_MAX = 0.018;
const STANDING_INTERNAL_RANGE_MAX = 0.01;
const SETUP_REARM_STABLE_FRAMES = 4;
const SETUP_REARM_MIN_PEAK_INDEX = 2;
const SETUP_REARM_MIN_RETURN_CONTINUITY_FRAMES = 3;
const MIN_FRAMES_FOR_BASELINE_CAPTURE = 6;
const MIN_VALID_FRAMES = 8;

type SquatStateRecord = SquatCompletionState & Record<string, unknown>;

type ShallowLowRomRearmCandidate = {
  sliceStartIndex: number;
  stableFrames: number;
  baselineStandingDepthPrimary: number;
  baselineStandingDepthBlended: number;
  standingWindowRange: number;
};

function getPrimaryRelativePeak(state: SquatStateRecord): number | null {
  const rawPrimary = state.rawDepthPeakPrimary;
  if (typeof rawPrimary !== 'number' || !Number.isFinite(rawPrimary)) return null;
  const baseline =
    typeof state.baselineFrozenDepth === 'number' && Number.isFinite(state.baselineFrozenDepth)
      ? state.baselineFrozenDepth
      : typeof state.baselineStandingDepth === 'number' && Number.isFinite(state.baselineStandingDepth)
        ? state.baselineStandingDepth
        : 0;
  return Math.max(0, rawPrimary - baseline);
}

function readShallowRearmDepth(frame: PoseFeaturesFrame): number | null {
  const b = frame.derived.squatDepthProxyBlended;
  if (typeof b === 'number' && Number.isFinite(b)) return b;
  const p = frame.derived.squatDepthProxy;
  return typeof p === 'number' && Number.isFinite(p) ? p : null;
}

function readShallowRearmPrimaryDepth(frame: PoseFeaturesFrame): number | null {
  const p = frame.derived.squatDepthProxy;
  return typeof p === 'number' && Number.isFinite(p) ? p : null;
}

function isStableStandingRun(frames: PoseFeaturesFrame[], start: number, len: number): boolean {
  let dMin = Infinity;
  let dMax = -Infinity;
  for (let k = 0; k < len; k++) {
    const d = readShallowRearmDepth(frames[start + k]!);
    if (d == null || d >= STANDING_DEPTH_MAX) return false;
    if (k > 0) {
      const prev = readShallowRearmDepth(frames[start + k - 1]!);
      if (prev == null || Math.abs(d - prev) > STABLE_ADJACENT_DELTA_MAX) return false;
    }
    if (d < dMin) dMin = d;
    if (d > dMax) dMax = d;
  }
  return dMax - dMin <= STANDING_INTERNAL_RANGE_MAX;
}

function findPeakLocalIndex(frames: PoseFeaturesFrame[]): number {
  let bestIdx = -1;
  let bestDepth = -Infinity;
  for (let i = 0; i < frames.length; i++) {
    const d = readShallowRearmDepth(frames[i]!);
    if (d != null && d > bestDepth) {
      bestDepth = d;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function findShallowLowRomSetupRearmCandidate(
  valid: PoseFeaturesFrame[]
): ShallowLowRomRearmCandidate | null {
  if (valid.length < SETUP_REARM_STABLE_FRAMES + MIN_FRAMES_FOR_BASELINE_CAPTURE) {
    return null;
  }

  for (let end = valid.length - 2; end >= SETUP_REARM_STABLE_FRAMES - 1; end--) {
    const start = end - SETUP_REARM_STABLE_FRAMES + 1;
    if (start < 0) break;
    if (!isStableStandingRun(valid, start, SETUP_REARM_STABLE_FRAMES)) continue;

    const completionSliceStartIndex = end + 1;
    const completionFrames = valid.slice(completionSliceStartIndex);
    if (completionFrames.length < MIN_FRAMES_FOR_BASELINE_CAPTURE) continue;

    const baselineDepthsBlended = valid
      .slice(start, end + 1)
      .map(readShallowRearmDepth)
      .filter((d): d is number => d != null);
    const baselineDepthsPrimary = valid
      .slice(start, end + 1)
      .map(readShallowRearmPrimaryDepth)
      .filter((d): d is number => d != null);
    const motionDepthsBlended = completionFrames
      .map(readShallowRearmDepth)
      .filter((d): d is number => d != null);
    const motionDepthsPrimary = completionFrames
      .map(readShallowRearmPrimaryDepth)
      .filter((d): d is number => d != null);

    if (
      baselineDepthsBlended.length < SETUP_REARM_STABLE_FRAMES ||
      motionDepthsBlended.length === 0 ||
      motionDepthsPrimary.length === 0
    ) {
      continue;
    }

    const baseMinBlended = Math.min(...baselineDepthsBlended);
    const baseMinPrimary = baselineDepthsPrimary.length > 0 ? Math.min(...baselineDepthsPrimary) : baseMinBlended;
    const baseMaxBlended = Math.max(...baselineDepthsBlended);
    const motionMaxBlended = Math.max(...motionDepthsBlended);
    const motionMaxPrimary = Math.max(...motionDepthsPrimary);
    const relativePeakBlended = Math.max(0, motionMaxBlended - baseMinBlended);
    const relativePeakPrimary = Math.max(0, motionMaxPrimary - baseMinPrimary);

    if (
      relativePeakBlended < LOW_ROM_LABEL_FLOOR ||
      relativePeakBlended >= STANDARD_OWNER_FLOOR ||
      relativePeakPrimary < LOW_ROM_LABEL_FLOOR ||
      relativePeakPrimary >= STANDARD_OWNER_FLOOR
    ) {
      continue;
    }

    const peakLocalIndex = findPeakLocalIndex(completionFrames);
    if (peakLocalIndex < SETUP_REARM_MIN_PEAK_INDEX) continue;

    const recovery = getSquatRecoverySignal(completionFrames);
    const meaningfulRecovery = recovery.lowRomRecovered || recovery.recovered;
    if (!meaningfulRecovery) continue;
    if ((recovery.returnContinuityFrames ?? 0) < SETUP_REARM_MIN_RETURN_CONTINUITY_FRAMES) {
      continue;
    }

    return {
      sliceStartIndex: start,
      stableFrames: SETUP_REARM_STABLE_FRAMES,
      baselineStandingDepthPrimary: Math.round(baseMinPrimary * 1000) / 1000,
      baselineStandingDepthBlended: Math.round(baseMinBlended * 1000) / 1000,
      standingWindowRange: Math.round((baseMaxBlended - baseMinBlended) * 1000) / 1000,
    };
  }

  return null;
}

function isSetupAwareShallowLowRomRetryEligible(
  state: SquatCompletionState | undefined
): boolean {
  if (state == null) return false;
  if (state.completionSatisfied === true) return false;
  if (state.setupMotionBlocked !== true) return false;
  const blocked =
    state.completionBlockedReason ??
    state.postAssistCompletionBlockedReason ??
    state.ruleCompletionBlockedReason ??
    null;
  if (blocked !== 'not_armed' && blocked !== 'no_reversal') return false;
  if (!(state.relativeDepthPeak >= LOW_ROM_LABEL_FLOOR && state.relativeDepthPeak < STANDARD_OWNER_FLOOR)) {
    return false;
  }
  if (state.trajectoryReversalRescueApplied === true) return false;
  if (state.eventCyclePromoted === true) return false;
  return true;
}

function stripResolvedCompletionHints(hints: string[]): string[] {
  const blockedLike = new Set([
    'rep_phase_incomplete',
    'not_armed',
    'no_reversal',
    'not_standing_recovered',
    'recovery_hold_too_short',
    'low_rom_standing_finalize_not_satisfied',
    'ultra_low_rom_not_allowed',
  ]);
  return hints.filter((hint) => !blockedLike.has(hint));
}

function deriveDemotedCompletionMachinePhase(state: SquatStateRecord): string {
  if (state.recoveryConfirmedAfterReversal === true) return 'recovered';
  if (state.reversalConfirmedAfterDescend === true) return 'ascending_confirmed';
  if (state.descendConfirmed === true) return 'bottom_or_low_point';
  if (state.attemptStarted === true) return 'descending_confirmed';
  return 'idle';
}

function rerunShallowLowRomAfterSetupBlock(
  frames: PoseFeaturesFrame[],
  result: EvaluatorResult
): EvaluatorResult {
  const baseState = result.debug?.squatCompletionState as SquatCompletionState | undefined;
  if (!isSetupAwareShallowLowRomRetryEligible(baseState)) {
    return result;
  }

  const validRaw = frames.filter((frame) => frame.isValid);
  const dwell = computeSquatReadinessStableDwell(validRaw);
  if (!dwell.satisfied) return result;

  const valid = validRaw.slice(dwell.firstSliceStartIndexInValid);
  const candidate = findShallowLowRomSetupRearmCandidate(valid);
  if (candidate == null) return result;

  const rerunValid = valid.slice(candidate.sliceStartIndex);
  if (rerunValid.length < MIN_VALID_FRAMES) return result;

  const rerunSetupBlock = computeSquatSetupMotionBlock(rerunValid);
  const { arming: baseArming, completionFrames: naturalCompletionFrames } =
    computeSquatCompletionArming(rerunValid);

  const hmmOnValid = decodeSquatHmm(rerunValid);
  const armingAssistDec = getSquatHmmArmingAssistDecision(rerunValid, hmmOnValid, {
    armed: baseArming.armed,
  });
  const effectiveArmed = baseArming.armed || armingAssistDec.assistApplied;
  const completionFrames = !effectiveArmed
    ? []
    : baseArming.armed
      ? naturalCompletionFrames
      : rerunValid;
  const squatHmm = !effectiveArmed
    ? hmmOnValid
    : baseArming.armed && naturalCompletionFrames.length > 0
      ? decodeSquatHmm(naturalCompletionFrames)
      : hmmOnValid;

  let completionArming: CompletionArmingState = {
    ...baseArming,
    hmmArmingAssistEligible: armingAssistDec.assistEligible,
    hmmArmingAssistApplied: armingAssistDec.assistApplied,
    hmmArmingAssistReason: armingAssistDec.assistReason,
    effectiveArmed,
    armingFallbackUsed: true,
    armingStandingWindowRange: candidate.standingWindowRange,
    armingBaselineStandingDepthPrimary: candidate.baselineStandingDepthPrimary,
    armingBaselineStandingDepthBlended: candidate.baselineStandingDepthBlended,
    ...(armingAssistDec.assistApplied && !baseArming.armed
      ? {
          completionSliceStartIndex: 0,
          baselineCaptured: rerunValid.length >= MIN_FRAMES_FOR_BASELINE_CAPTURE,
          stableFrames: candidate.stableFrames,
          armingPeakAnchored: undefined,
        }
      : {}),
  };
  completionArming = mergeArmingDepthObservability(rerunValid, completionArming);

  let state = evaluateSquatCompletionState(completionFrames, {
    hmm: squatHmm,
    hmmArmingAssistApplied: armingAssistDec.assistApplied,
    seedBaselineStandingDepthPrimary: completionArming.armingBaselineStandingDepthPrimary,
    seedBaselineStandingDepthBlended: completionArming.armingBaselineStandingDepthBlended,
  });

  state = {
    ...state,
    readinessStableDwellSatisfied: dwell.satisfied,
    setupMotionBlocked: rerunSetupBlock.blocked,
    setupMotionBlockReason: rerunSetupBlock.reason,
    attemptStartedAfterReady: true,
  };

  if (state.completionSatisfied && rerunSetupBlock.blocked) {
    return result;
  }

  const baseBlockedReason = baseState?.completionBlockedReason ?? null;
  const shouldAdopt =
    state.completionSatisfied ||
    (baseBlockedReason === 'not_armed' && state.completionBlockedReason !== 'not_armed');
  if (!shouldAdopt) {
    return result;
  }

  const completionHints = state.completionSatisfied
    ? stripResolvedCompletionHints(result.completionHints ?? [])
    : [
        ...new Set(
          [
            ...stripResolvedCompletionHints(result.completionHints ?? []),
            state.completionBlockedReason,
          ].filter((hint): hint is string => typeof hint === 'string' && hint.length > 0)
        ),
      ];

  const interpretedSignals = [
    ...(result.interpretedSignals ?? []),
    'shallow_low_rom_setup_rearm_rerun',
  ];

  const highlightedMetrics = {
    ...(result.debug?.highlightedMetrics ?? {}),
    completionMachinePhase: state.completionMachinePhase,
    completionPassReason: state.completionPassReason,
    completionSatisfied: state.completionSatisfied,
    completionBlockedReason: state.completionBlockedReason,
    successPhaseAtOpen: state.successPhaseAtOpen ?? null,
    completionArmingArmed: completionArming.armed ? 1 : 0,
    effectiveArmed: effectiveArmed ? 1 : 0,
    armingFallbackUsed: completionArming.armingFallbackUsed ? 1 : 0,
    squatLowRomSetupRearmApplied: 1,
    setupMotionBlocked: rerunSetupBlock.blocked ? 1 : 0,
  };

  return {
    ...result,
    completionHints,
    interpretedSignals,
    debug: {
      ...(result.debug ?? {}),
      squatCompletionArming: completionArming,
      squatCompletionState: state,
      squatEventCycle: state.squatEventCycle,
      squatSetupPhaseTrace: {
        ...(result.debug?.squatSetupPhaseTrace ?? {}),
        readinessStableDwellSatisfied: dwell.satisfied,
        setupMotionBlocked: rerunSetupBlock.blocked,
        setupMotionBlockReason: rerunSetupBlock.reason,
        attemptStartedAfterReady: true,
        shallowLowRomSetupRearmApplied: true,
      },
      highlightedMetrics,
    },
  };
}

export function getShallowMeaningfulCycleBlockReason(
  state: SquatCompletionState | undefined
): string | null {
  if (state == null) return null;

  if (
    state.completionPassReason !== 'low_rom_cycle' &&
    state.completionPassReason !== 'ultra_low_rom_cycle' &&
    state.completionPassReason !== 'official_shallow_cycle'
  ) {
    return null;
  }

  /**
   * PR-10C-MEANINGFUL-SHALLOW-CURRENT-REP-ONLY / PR-12-OFFICIAL-SHALLOW-GOLD-PATH-CONVERGENCE:
   * Evaluator-level guard for official_shallow_cycle.
   *
   * PR-12 canonical contract tightening: official_shallow_cycle now requires gold-path
   * (rule/HMM) reversal. Bridge-assisted reversal no longer independently satisfies
   * the canonical contract. These evaluator gates add defense-in-depth:
   *
   * 1. Phase gate — pass authorization requires standing_recovered.
   *    terminal / non-standing phases cannot create new pass ownership.
   *    terminal-adjacent finalization is blocked here.
   *
   * 2. Descent timing lower bound — meaningful descent takes ≥ 200ms.
   *    jitter / sensor spike / micro-motion descend too quickly to satisfy this.
   *
   * 3. Reversal-to-standing lower bound — meaningful ascent takes ≥ 200ms.
   *    jitter / instant reversal cannot satisfy this even with real event detection.
   *
   * 4. Current-rep ownership upper bound — same 7500ms constant as canonical contract.
   *    Redundant with canonical contract but explicit here so both close paths are
   *    gated identically at the evaluator layer (single-constant, consistent behaviour).
   *
   * Note (PR-12): bridge/proof/fallback reversal is no longer allowed as authorization
   * for official_shallow_cycle at the canonical contract level. The old note about
   * "bridge-assisted reversal through the canonical contract" is no longer accurate.
   * These evaluator gates are now complementary to the tightened canonical contract,
   * not a substitute for it.
   */
  if (state.completionPassReason === 'official_shallow_cycle') {
    if (state.currentSquatPhase !== 'standing_recovered') {
      return 'standing_recovered_required';
    }

    if (
      state.squatDescentToPeakMs == null ||
      state.squatDescentToPeakMs < MIN_DESCENT_TO_PEAK_MS_SHALLOW
    ) {
      return 'shallow_descent_too_short';
    }

    if (
      state.squatReversalToStandingMs == null ||
      state.squatReversalToStandingMs < MIN_REVERSAL_TO_STANDING_MS_SHALLOW
    ) {
      return 'shallow_reversal_to_standing_too_short';
    }

    if (state.squatReversalToStandingMs > SHALLOW_CURRENT_REP_REVERSAL_TO_STANDING_MAX_MS) {
      return 'current_rep_ownership_blocked';
    }

    return null;
  }

  if (state.completionPassReason === 'ultra_low_rom_cycle') {
    const provisionalShallowTerminalAuthority = resolveProvisionalShallowTerminalAuthority(state, {
      standardOwnerFloor: STANDARD_OWNER_FLOOR,
      setupMotionBlocked: state.setupMotionBlocked,
      requireCanonicalAntiFalsePassClear: true,
    }).satisfied;
    // PR-6: policy layer가 이미 legitimate ultra-low cycle로 판정한 경우.
    // single-writer 원칙 유지: 이 gate는 새로운 truth를 만들지 않는다.
    if (
      (state.ultraLowPolicyScope === true &&
        state.ultraLowPolicyDecisionReady === true &&
        state.ultraLowPolicyBlocked === false) ||
      provisionalShallowTerminalAuthority === true
    ) {
      /**
       * PR-11-MEANINGFUL-SHALLOW-GOLD-PATH-ONLY:
       * Gold-path evaluator gates for ultra_low_rom_cycle.
       *
       * The policy gate (applyUltraLowPolicyLock) confirms canonical legitimacy, but
       * ultra_low_rom_cycle still needs the same open-window, reversal-source, and
       * timing standards as low_rom_cycle to prevent it from being a competing direct
       * path outside the gold path.
       *
       * Guards use `!= null` bypass (not `== null` block) to preserve backward
       * compatibility with callers that do not populate optional fields — the core/policy
       * layer already enforces these invariants; the evaluator adds defense-in-depth when
       * fields are explicitly set.
       *
       * 1. Phase gate — pass authorization requires standing_recovered.
       *    terminal / non-standing phases cannot create new pass ownership.
       *    terminal-adjacent and descent-phase passes are blocked here.
       *
       * 2. Reversal-source gate — rule or HMM reversal required (not bridge/trajectory).
       *    Direct bridge-only / trajectory-only reversal cannot authorize gold-path pass.
       *    Bypass when undefined: core (isUltraLowRomDirectCloseEligible) already requires
       *    reversalConfirmedByRuleOrHmm=true; this is defence-in-depth when field is set.
       *
       * 3. Descent timing lower bound — meaningful descent takes ≥ 200ms.
       *    jitter / sensor spike / micro-motion descend too quickly to satisfy this.
       *    Bypass when undefined (conservative).
       *
       * 4. Reversal-to-standing lower bound — meaningful ascent takes ≥ 200ms.
       *    jitter / instant reversal cannot satisfy this even with real event detection.
       *    Bypass when undefined (conservative).
       *
       * 5. Reversal-to-standing upper bound — same 7500ms constant as canonical contract
       *    and low_rom_cycle gate.
       *    Repeated shallow aggregation, slow-rise laundering, and terminal laundering
       *    produce large spans and are blocked here.
       *    Bypass when undefined (conservative).
       */
      if (state.currentSquatPhase != null && state.currentSquatPhase !== 'standing_recovered') {
        return 'standing_recovered_required';
      }

      if (
        state.reversalConfirmedBy != null &&
        state.reversalConfirmedBy !== 'rule' &&
        state.reversalConfirmedBy !== 'rule_plus_hmm'
      ) {
        return 'rule_based_reversal_required';
      }

      if (
        state.squatDescentToPeakMs != null &&
        state.squatDescentToPeakMs < MIN_DESCENT_TO_PEAK_MS_SHALLOW
      ) {
        return 'shallow_descent_too_short';
      }

      if (
        state.squatReversalToStandingMs != null &&
        state.squatReversalToStandingMs < MIN_REVERSAL_TO_STANDING_MS_SHALLOW
      ) {
        return 'shallow_reversal_to_standing_too_short';
      }

      if (
        state.squatReversalToStandingMs != null &&
        state.squatReversalToStandingMs > SHALLOW_CURRENT_REP_REVERSAL_TO_STANDING_MAX_MS
      ) {
        return 'current_rep_ownership_blocked';
      }

      return null; // policy layer가 이미 legitimate으로 판정 + gold-path gates 통과
    }
    return 'ultra_low_rom_not_allowed';
  }

  if (
    !(state.relativeDepthPeak >= LOW_ROM_LABEL_FLOOR && state.relativeDepthPeak < STANDARD_OWNER_FLOOR)
  ) {
    return 'low_rom_band_required';
  }

  if (state.currentSquatPhase !== 'standing_recovered') {
    return 'standing_recovered_required';
  }

  if (state.trajectoryReversalRescueApplied === true) {
    return 'trajectory_rescue_not_allowed';
  }

  if (state.eventCyclePromoted === true) {
    return 'event_promotion_not_allowed';
  }

  const cycle = state.squatEventCycle;
  if (cycle == null || cycle.detected !== true) {
    return 'event_cycle_not_detected';
  }
  if (cycle.band !== 'low_rom') {
    return 'event_cycle_band_not_low_rom';
  }
  if (cycle.descentDetected !== true) {
    return 'event_cycle_descent_missing';
  }
  if (cycle.reversalDetected !== true) {
    return 'event_cycle_reversal_missing';
  }
  if (cycle.recoveryDetected !== true) {
    return 'event_cycle_recovery_missing';
  }
  if (cycle.nearStandingRecovered !== true) {
    return 'event_cycle_near_standing_missing';
  }

  if (state.reversalConfirmedBy !== 'rule' && state.reversalConfirmedBy !== 'rule_plus_hmm') {
    return 'rule_based_reversal_required';
  }

  if (
    state.squatDescentToPeakMs == null ||
    state.squatDescentToPeakMs < MIN_DESCENT_TO_PEAK_MS_SHALLOW
  ) {
    return 'shallow_descent_too_short';
  }

  if (
    state.squatReversalToStandingMs == null ||
    state.squatReversalToStandingMs < MIN_REVERSAL_TO_STANDING_MS_SHALLOW
  ) {
    return 'shallow_reversal_to_standing_too_short';
  }

  /**
   * PR-10B-MEANINGFUL-SHALLOW-TERMINAL-OWNERSHIP:
   * Current-rep ownership gate — reversal-to-standing span must not exceed single-rep maximum.
   *
   * Uses the same constant (7500ms) as the canonical contract's currentRepOwnershipClear gate.
   * A large span means the reversal came from a prior attempt while standing is from a much
   * later point — the classic pattern for:
   *   - repeated shallow aggregation (3-5 attempts, reversal at t=3s, standing at t=15s)
   *   - slow-rise laundering (reversal from attempt 1, slow rise closing attempt N)
   *   - terminal finalization laundering (session end standing + stale reversal trace)
   *
   * standing_recovered is finalize-only for the CURRENT rep — it cannot inherit authorization
   * from a reversal that belonged to a prior attempt.
   * Bridge/proof/recovery evidence cannot substitute for current-rep ownership.
   *
   * Reuses SHALLOW_CURRENT_REP_REVERSAL_TO_STANDING_MAX_MS exported from shallow-completion-contract.ts.
   * Same constant as canonical contract — single source of truth, consistent behaviour across
   * both low_rom_cycle and official_shallow_cycle close paths.
   */
  if (state.squatReversalToStandingMs > SHALLOW_CURRENT_REP_REVERSAL_TO_STANDING_MAX_MS) {
    return 'current_rep_ownership_blocked';
  }

  const primaryRelativePeak = getPrimaryRelativePeak(state as SquatStateRecord);
  if (primaryRelativePeak != null && primaryRelativePeak < LOW_ROM_LABEL_FLOOR) {
    return 'primary_depth_below_low_rom_floor';
  }

  if (state.officialShallowPathClosed !== true || state.officialShallowClosureProofSatisfied !== true) {
    return 'official_shallow_closure_not_satisfied';
  }

  return null;
}

export function demoteMeaninglessShallowPass(
  result: EvaluatorResult,
  reason: string
): EvaluatorResult {
  const state = result.debug?.squatCompletionState as SquatStateRecord | undefined;
  if (state == null) return result;

  const nextState = {
    ...state,
    completionSatisfied: false,
    completionPassReason: 'not_confirmed',
    completionBlockedReason: reason,
    completionMachinePhase: deriveDemotedCompletionMachinePhase(state),
    cycleComplete: false,
    successPhaseAtOpen: undefined,
    eventCyclePromoted: false,
    eventCycleSource: null,
    postAssistCompletionBlockedReason: reason,
    completionFinalizeMode: 'blocked',
    completionAssistApplied: false,
    completionAssistSources: [],
    completionAssistMode: 'none',
    promotionBaseRuleBlockedReason: null,
    officialShallowPathClosed: false,
    officialShallowPathBlockedReason: reason,
    officialShallowClosureProofSatisfied: false,
  } as SquatStateRecord;

  nextState.completionTruthPassed = false;
  nextState.completionOwnerPassed = false;
  nextState.completionOwnerReason = null;
  nextState.completionOwnerBlockedReason = reason;
  nextState.uiProgressionAllowed = false;
  nextState.uiProgressionBlockedReason = reason;
  nextState.passOwner = null;
  nextState.finalSuccessOwner = null;
  nextState.standardOwnerEligible = false;
  nextState.shadowEventOwnerEligible = false;

  const completionHints = [
    ...new Set([...(result.completionHints ?? []), reason]),
  ];

  const interpretedSignals = [
    ...(result.interpretedSignals ?? []),
    `meaningful_shallow_gate_rejected:${reason}`,
  ];

  const highlightedMetrics = {
    ...(result.debug?.highlightedMetrics ?? {}),
    completionMachinePhase: nextState.completionMachinePhase,
    completionSatisfied: false,
    completionPassReason: 'not_confirmed',
    completionBlockedReason: reason,
    successPhaseAtOpen: null,
    squatEventCyclePromoted: 0,
    squatMeaningfulShallowGateRejected: 1,
  };

  return {
    ...result,
    completionHints,
    interpretedSignals,
    debug: {
      ...(result.debug ?? {}),
      squatCompletionState: nextState,
      highlightedMetrics,
    },
  };
}

export function evaluateSquat(landmarks: PoseLandmarks[]): EvaluatorResult {
  const frames = buildPoseFeaturesFrames('squat', landmarks);
  let result = evaluateSquatFromPoseFrames(frames);
  result = rerunShallowLowRomAfterSetupBlock(frames, result);
  const state = result.debug?.squatCompletionState as SquatCompletionState | undefined;
  const reason = getShallowMeaningfulCycleBlockReason(state);
  return reason ? demoteMeaninglessShallowPass(result, reason) : result;
}
