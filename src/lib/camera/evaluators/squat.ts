/**
 * 스쿼트 evaluator
 * metrics: depth, knee alignment trend, trunk lean, asymmetry
 */
import type { PoseLandmarks } from '@/lib/motion/pose-types';
import {
  buildPoseFeaturesFrames,
  getSquatRecoverySignal,
  hasGuardedShallowSquatAscent,
} from '@/lib/camera/pose-features';
import type { PoseFeaturesFrame } from '@/lib/camera/pose-features';
import {
  attachShallowTruthObservabilityAlign01,
  evaluateSquatCompletionState,
  applyUltraLowPolicyLock,
} from '@/lib/camera/squat-completion-state';
import { evaluateSquatPassCore } from '@/lib/camera/squat/pass-core';
import {
  computeSquatCompletionArming,
  mergeArmingDepthObservability,
  type CompletionArmingState,
} from '@/lib/camera/squat/squat-completion-arming';
import { getSquatHmmArmingAssistDecision } from '@/lib/camera/squat/squat-arming-assist';
import {
  computeSquatInternalQuality,
  squatInternalQualityInsufficientSignal,
} from '@/lib/camera/squat/squat-internal-quality';
import { getSquatPerStepDiagnostics } from '@/lib/camera/step-joint-spec';
import { decodeSquatHmm } from '@/lib/camera/squat/squat-hmm';
import type {
  EvaluatorResult,
  EvaluatorMetric,
  SquatCalibrationDebug,
  SquatDepthCalibrationDebug,
  SquatReversalCalibrationDebug,
} from './types';
import {
  readSquatCompletionDepth,
  squatCompletionBlockedReasonToCode,
  computeSquatReadinessStableDwell,
  computeSquatSetupMotionBlock,
} from '@/lib/camera/squat-completion-state';

const MIN_VALID_FRAMES = 8;

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function getNumbers(values: Array<number | null>): number[] {
  return values.filter((value): value is number => typeof value === 'number');
}

function countPhases(frames: PoseFeaturesFrame[], phase: PoseFeaturesFrame['phaseHint']): number {
  return frames.filter((frame) => frame.phaseHint === phase).length;
}

export function evaluateSquatFromPoseFrames(frames: PoseFeaturesFrame[]): EvaluatorResult {
  const validRaw = frames.filter((frame) => frame.isValid);
  if (validRaw.length < MIN_VALID_FRAMES) {
    const emptyDiag = {
      criticalJointAvailability: 0,
      missingCriticalJoints: [] as string[],
      leftSideCompleteness: 0,
      rightSideCompleteness: 0,
      leftRightAsymmetry: 0,
      metricSufficiency: 0,
      frameCount: 0,
      instabilityFlags: [] as string[],
    };
    return {
      stepId: 'squat',
      metrics: [],
      insufficientSignal: true,
      reason: '프레임 부족',
      qualityHints: ['valid_frames_too_few'],
      completionHints: ['rep_missing'],
      debug: {
        frameCount: frames.length,
        validFrameCount: validRaw.length,
        phaseHints: Array.from(new Set(frames.map((frame) => frame.phaseHint))),
        highlightedMetrics: {
          validFrameCount: validRaw.length,
          completionMachinePhase: 'idle',
          completionPassReason: 'not_confirmed',
          completionSatisfied: false,
        },
        perStepDiagnostics: { descent: emptyDiag, bottom: emptyDiag, ascent: emptyDiag },
        squatInternalQuality: squatInternalQualityInsufficientSignal(),
      },
    };
  }

  /** Setup false-pass lock: dwell 충족 지점 이후만 rep 파이프라인에 넣는다. */
  const dwell = computeSquatReadinessStableDwell(validRaw);
  const valid = dwell.satisfied ? validRaw.slice(dwell.firstSliceStartIndexInValid) : [];
  const squatSetupPhaseTrace = {
    readinessStableDwellSatisfied: dwell.satisfied,
    setupMotionBlocked: false as boolean,
    setupMotionBlockReason: null as string | null,
    attemptStartedAfterReady: dwell.satisfied && valid.length >= MIN_VALID_FRAMES,
  };

  if (valid.length < MIN_VALID_FRAMES) {
    const emptyDiag = {
      criticalJointAvailability: 0,
      missingCriticalJoints: [] as string[],
      leftSideCompleteness: 0,
      rightSideCompleteness: 0,
      leftRightAsymmetry: 0,
      metricSufficiency: 0,
      frameCount: 0,
      instabilityFlags: [] as string[],
    };
    const qh = new Set(validRaw.flatMap((frame) => frame.qualityHints));
    if (!dwell.satisfied) qh.add('readiness_dwell_not_met');
    return {
      stepId: 'squat',
      metrics: [],
      insufficientSignal: true,
      reason: !dwell.satisfied ? '캡처 준비 연속 구간 부족' : '프레임 부족',
      qualityHints: [...qh],
      completionHints: ['rep_missing'],
      debug: {
        frameCount: frames.length,
        validFrameCount: validRaw.length,
        validFrameCountAfterReadinessDwell: valid.length,
        phaseHints: Array.from(new Set(frames.map((frame) => frame.phaseHint))),
        squatSetupPhaseTrace,
        highlightedMetrics: {
          validFrameCount: validRaw.length,
          completionMachinePhase: 'idle',
          completionPassReason: 'not_confirmed',
          completionSatisfied: false,
        },
        perStepDiagnostics: { descent: emptyDiag, bottom: emptyDiag, ascent: emptyDiag },
        squatInternalQuality: squatInternalQualityInsufficientSignal(),
      },
    };
  }

  const setupBlock = computeSquatSetupMotionBlock(valid);
  squatSetupPhaseTrace.setupMotionBlocked = setupBlock.blocked;
  squatSetupPhaseTrace.setupMotionBlockReason = setupBlock.reason;

  const metrics: EvaluatorMetric[] = [];
  const rawMetrics: EvaluatorMetric[] = [];
  const interpretedSignals: string[] = [];
  const qualityHints = [...new Set(valid.flatMap((frame) => frame.qualityHints))];
  const completionHints: string[] = [];
  const depthValues = getNumbers(valid.map((frame) => frame.derived.squatDepthProxy));
  const kneeTracking = getNumbers(valid.map((frame) => frame.derived.kneeTrackingRatio));
  const trunkLeanValues = getNumbers(valid.map((frame) => frame.derived.trunkLeanDeg)).map((value) =>
    Math.abs(value)
  );
  const asymmetryValues = getNumbers(valid.map((frame) => frame.derived.kneeAngleGap));
  const weightShiftValues = getNumbers(valid.map((frame) => frame.derived.weightShiftRatio));
  const bottomFrames = valid.filter((frame) => frame.phaseHint === 'bottom');
  const bottomDepths = getNumbers(bottomFrames.map((frame) => frame.derived.squatDepthProxy));

  const bottomStability =
    bottomDepths.length > 1
      ? clamp(1 - (Math.max(...bottomDepths) - Math.min(...bottomDepths)) / 0.2)
      : 0;
  const startCount = countPhases(valid, 'start');
  const descentCount = countPhases(valid, 'descent');
  const bottomCount = countPhases(valid, 'bottom');
  const ascentCount = countPhases(valid, 'ascent');
  const recovery = getSquatRecoverySignal(valid);
  const ascentSatisfied = ascentCount > 0 || recovery.recovered;

  const unstableHintHits = qualityHints.filter((h) =>
    ['unstable_bbox', 'unstable_landmarks', 'timestamp_gap'].includes(h)
  ).length;
  const signalIntegrityMultiplier = Math.max(0.55, 1 - unstableHintHits * 0.14);

  /** PR-COMP-03: completion 상태 **이전**에 계산 — gate·completion과 무관 */
  const squatInternalQuality = computeSquatInternalQuality({
    peakDepthProxy: depthValues.length > 0 ? Math.max(...depthValues) : 0,
    meanDepthProxy: depthValues.length > 0 ? mean(depthValues) : 0,
    bottomStability,
    trunkLeanDegMeanAbs: trunkLeanValues.length > 0 ? mean(trunkLeanValues) : null,
    kneeTrackingMean: kneeTracking.length > 0 ? mean(kneeTracking) : null,
    asymmetryDegMean: asymmetryValues.length > 0 ? mean(asymmetryValues) : null,
    weightShiftMean: weightShiftValues.length > 0 ? mean(weightShiftValues) : null,
    validFrameRatio: frames.length > 0 ? valid.length / frames.length : 0,
    descentCount,
    bottomCount,
    ascentCount,
    recoveryDropRatio: recovery.recoveryDropRatio,
    returnContinuityFrames: recovery.returnContinuityFrames,
    signalIntegrityMultiplier,
  });

  /** PR-HOTFIX-02: 서 있기 안정 구간 이후에만 completion 상태기에 프레임 전달 */
  const { arming: baseArming, completionFrames: naturalCompletionFrames } = computeSquatCompletionArming(valid);

  /** PR-HMM-04A: 동일 버퍼로 HMM decode → arming 보조 판단 (final gate 아님) */
  const hmmOnValid = decodeSquatHmm(valid);
  const armingAssistDec = getSquatHmmArmingAssistDecision(valid, hmmOnValid, { armed: baseArming.armed });
  const effectiveArmed = baseArming.armed || armingAssistDec.assistApplied;
  const completionFrames = !effectiveArmed ? [] : baseArming.armed ? naturalCompletionFrames : valid;

  const squatHmm =
    !effectiveArmed
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
    ...(armingAssistDec.assistApplied && !baseArming.armed
      ? {
          completionSliceStartIndex: 0,
          baselineCaptured: valid.length >= 6,
          stableFrames: 0,
          armingStandingWindowRange: undefined,
          armingFallbackUsed: undefined,
          armingPeakAnchored: undefined,
        }
      : {}),
  };
  completionArming = mergeArmingDepthObservability(valid, completionArming);

  const primaryDepthCalib = getNumbers(valid.map((frame) => frame.derived.squatDepthProxy));
  const blendedDepthCalib = getNumbers(
    valid.map((frame) =>
      typeof frame.derived.squatDepthProxyBlended === 'number'
        ? frame.derived.squatDepthProxyBlended
        : frame.derived.squatDepthProxy
    )
  );
  const maxPrimaryCalib = primaryDepthCalib.length > 0 ? Math.max(...primaryDepthCalib) : 0;
  const maxBlendedCalib = blendedDepthCalib.length > 0 ? Math.max(...blendedDepthCalib) : 0;

  /** PR-CAM-29: depth source chain 관측(pass/fail·completion 로직 미변경) */
  let depthBlendObsFallbackPeak = 0;
  let depthBlendObsTravelPeak = 0;
  let squatDepthBlendOfferedCount = 0;
  let squatDepthBlendCapHitCount = 0;
  let squatDepthBlendActiveFrameCount = 0;
  let squatDepthSourceFlipCount = 0;
  let prevDepthSourceKey: string | null = null;
  for (const fr of valid) {
    const d = fr.derived;
    if (typeof d.squatDepthFallbackPeakFrame === 'number' && Number.isFinite(d.squatDepthFallbackPeakFrame)) {
      depthBlendObsFallbackPeak = Math.max(depthBlendObsFallbackPeak, d.squatDepthFallbackPeakFrame);
    }
    if (typeof d.squatDepthBlendEvidence === 'number' && Number.isFinite(d.squatDepthBlendEvidence)) {
      depthBlendObsTravelPeak = Math.max(depthBlendObsTravelPeak, d.squatDepthBlendEvidence);
    }
    if (d.squatDepthBlendOffered) squatDepthBlendOfferedCount += 1;
    if (d.squatDepthBlendCapped) squatDepthBlendCapHitCount += 1;
    if (d.squatDepthBlendActive) squatDepthBlendActiveFrameCount += 1;
    const src = d.squatDepthSource ?? 'primary';
    if (prevDepthSourceKey != null && prevDepthSourceKey !== src) squatDepthSourceFlipCount += 1;
    prevDepthSourceKey = src;
  }

  let state = evaluateSquatCompletionState(completionFrames, {
    hmm: squatHmm,
    hmmArmingAssistApplied: armingAssistDec.assistApplied,
    seedBaselineStandingDepthPrimary: completionArming.armingBaselineStandingDepthPrimary,
    seedBaselineStandingDepthBlended: completionArming.armingBaselineStandingDepthBlended,
    setupMotionBlocked: setupBlock.blocked,
  });

  /**
   * PASS-AUTHORITY-RESET-01: Evaluator post-completion pipeline.
   *
   * The evaluator sequencing below operates on the finalized completion truth
   * returned by evaluateSquatCompletionState. The sequence is:
   *
   *   1. Stamp setup-phase context fields (readiness, setupMotionBlocked) onto state —
   *      additive observability only, not completion truth.
   *
   *   PASS-CORE: Derive immutable pass truth BEFORE any policy or late-setup rewrite.
   *      pass-core.ts is the ONLY owner of squat motion pass truth.
   *      Result stored in squatPassCore; consumed by auto-progression.
   *
   *   2. Late-setup suppression — ANNOTATION ONLY (PASS-AUTHORITY-RESET-01).
   *      Completion truth (completionSatisfied / completionPassReason / completionBlockedReason)
   *      is NO LONGER rewritten by this check. The pass-core's lateSetupSuppressed gate
   *      handles setup rejection before pass opens. This block now only stamps
   *      standingFinalizeSuppressedByLateSetup for observability.
   *
   *   3. attachShallowTruthObservabilityAlign01 — pure observability re-stamp.
   *
   *   4. applyUltraLowPolicyLock — ANNOTATION ONLY (PASS-AUTHORITY-RESET-01).
   *      Policy fields (ultraLowPolicyBlocked, trace) are set for observability.
   *      Does NOT rewrite completionSatisfied / completionPassReason / completionBlockedReason.
   */

  // ── Step 1: stamp setup-phase context ──
  let standingFinalizeSuppressedByLateSetup = false;

  state = {
    ...state,
    readinessStableDwellSatisfied: dwell.satisfied,
    setupMotionBlocked: setupBlock.blocked,
    setupMotionBlockReason: setupBlock.reason,
    attemptStartedAfterReady: dwell.satisfied,
  };

  // ── PASS-CORE: derive immutable pass truth (before policy lock and late-setup annotation) ──
  const squatPassCore = evaluateSquatPassCore(state, {
    setupMotionBlocked: setupBlock.blocked,
    reason: setupBlock.reason,
  });

  // ── Step 2: late-setup — ANNOTATION ONLY, no completion truth rewrite ──
  if (state.completionSatisfied && setupBlock.blocked) {
    /**
     * PASS-AUTHORITY-RESET-01: This block now only computes standingFinalizeSuppressedByLateSetup
     * for observability. completionSatisfied, completionPassReason, completionBlockedReason are NOT
     * rewritten here. Setup rejection is handled inside evaluateSquatPassCore (lateSetupSuppressed).
     *
     * Bypass criteria preserved for observability annotation consistency.
     */
    const trajectoryBridgeClosedCycle =
      state.shallowTrajectoryBridgeSatisfied === true &&
      state.descendConfirmed === true &&
      state.attemptStarted === true &&
      state.currentSquatPhase === 'standing_recovered';

    const guardedClosureProofClosedCycle =
      state.guardedShallowTrajectoryClosureProofSatisfied === true &&
      state.completionPassReason === 'official_shallow_cycle' &&
      state.descendConfirmed === true &&
      state.attemptStarted === true &&
      state.currentSquatPhase === 'standing_recovered';

    const bypassLateSetupForClosedCycle =
      trajectoryBridgeClosedCycle ||
      guardedClosureProofClosedCycle ||
      (state.descendConfirmed === true &&
        state.attemptStarted === true &&
        state.ownerAuthoritativeReversalSatisfied === true &&
        state.ownerAuthoritativeRecoverySatisfied === true &&
        state.currentSquatPhase === 'standing_recovered');

    if (bypassLateSetupForClosedCycle) {
      standingFinalizeSuppressedByLateSetup = false;
    } else {
      // Annotation only: mark for observability but do NOT rewrite completion truth.
      standingFinalizeSuppressedByLateSetup = true;
    }
  }

  state = {
    ...state,
    standingFinalizeSuppressedByLateSetup,
  };

  // ── Step 3: re-stamp observability to reflect final state (including late-setup adjustment) ──
  state = attachShallowTruthObservabilityAlign01(state);

  // ── Step 4: product policy — applied exactly once, after canonical closer + late-setup check ──
  state = applyUltraLowPolicyLock(state);

  /** PR-CAM-29B: pose-features guarded shallow ascent — additive observability only */
  let guardedShallowAscentDetected = 0;
  for (let i = 0; i < frames.length; i++) {
    if (hasGuardedShallowSquatAscent(frames, i)) {
      guardedShallowAscentDetected = 1;
      break;
    }
  }

  const lastCompletionFrame =
    completionFrames.length > 0 ? completionFrames[completionFrames.length - 1]! : null;
  const latestSquatDepthProxy =
    lastCompletionFrame != null &&
    typeof lastCompletionFrame.derived.squatDepthProxy === 'number' &&
    Number.isFinite(lastCompletionFrame.derived.squatDepthProxy)
      ? Math.round(lastCompletionFrame.derived.squatDepthProxy * 1000) / 1000
      : null;

  const squatDepthCalibration: SquatDepthCalibrationDebug = {
    maxPrimaryDepth: Math.round(maxPrimaryCalib * 1000) / 1000,
    maxBlendedDepth: Math.round(maxBlendedCalib * 1000) / 1000,
    blendedDepthUsed: maxBlendedCalib > maxPrimaryCalib + 0.006,
    armingDepthSource: completionArming.armingDepthSource ?? null,
    rawDepthPeakPrimary:
      state.rawDepthPeakPrimary != null
        ? Math.round(state.rawDepthPeakPrimary * 1000) / 1000
        : undefined,
    rawDepthPeakBlended:
      state.rawDepthPeakBlended != null
        ? Math.round(state.rawDepthPeakBlended * 1000) / 1000
        : undefined,
    relativeDepthPeakSource: state.relativeDepthPeakSource ?? null,
  };

  const BASELINE_WINDOW_EVAL = 6;
  const compWin = completionFrames.slice(0, BASELINE_WINDOW_EVAL);
  const primBs = getNumbers(compWin.map((f) => f.derived.squatDepthProxy));
  const minPrimB = primBs.length > 0 ? Math.min(...primBs) : 0;
  const blendBaselineCandidates = compWin.map((f) => {
    const r = readSquatCompletionDepth(f);
    const p = f.derived.squatDepthProxy;
    if (r != null && Number.isFinite(r)) return r;
    if (typeof p === 'number' && Number.isFinite(p)) return p;
    return Number.NaN;
  });
  const blendMins = blendBaselineCandidates.filter((x) => Number.isFinite(x));
  const minBlendB = blendMins.length > 0 ? Math.min(...blendMins) : minPrimB;
  const relPeakPrimPct =
    state.rawDepthPeakPrimary != null && Number.isFinite(minPrimB)
      ? Math.max(0, state.rawDepthPeakPrimary - minPrimB) * 100
      : null;
  const relPeakBlendPct =
    state.rawDepthPeakBlended != null && Number.isFinite(minBlendB)
      ? Math.max(0, state.rawDepthPeakBlended - minBlendB) * 100
      : null;

  let squatCompletionPeakIndex: number | null = null;
  let completionPeakDepthScan = -Infinity;
  const depthSrc = state.relativeDepthPeakSource ?? 'primary';
  for (let i = 0; i < completionFrames.length; i++) {
    const f = completionFrames[i]!;
    const p = f.derived.squatDepthProxy;
    if (typeof p !== 'number' || !Number.isFinite(p)) continue;
    const off = depthSrc === 'blended' ? (readSquatCompletionDepth(f) ?? p) : p;
    if (off > completionPeakDepthScan) {
      completionPeakDepthScan = off;
      squatCompletionPeakIndex = i;
    }
  }
  const squatReversalCalibration: SquatReversalCalibrationDebug = {
    reversalConfirmedBy: state.reversalConfirmedBy ?? null,
    reversalDepthDrop: state.reversalDepthDrop ?? null,
    reversalFrameCount: state.reversalFrameCount ?? null,
    peakDepth: state.rawDepthPeak,
    peakIndex: squatCompletionPeakIndex,
  };

  /** PR-HMM-03A: calibration 전용 묶음 — pass/truth 변경 없음 */
  const squatCalibration: SquatCalibrationDebug = {
    ruleCompletionBlockedReason: state.ruleCompletionBlockedReason ?? null,
    postAssistCompletionBlockedReason: state.postAssistCompletionBlockedReason ?? null,
    hmmAssistEligible: state.hmmAssistEligible ?? false,
    hmmAssistApplied: state.hmmAssistApplied ?? false,
    hmmAssistReason: state.hmmAssistReason ?? null,
    assistSuppressedByFinalize: state.assistSuppressedByFinalize ?? false,
    standingRecoveryFinalizeReason: state.standingRecoveryFinalizeReason,
    standingRecoveryBand: state.standingRecoveryBand,
    hmmConfidence: squatHmm.confidence,
    hmmExcursion: squatHmm.effectiveExcursion,
    hmmTransitionCount: squatHmm.transitionCount,
    hmmDominantStateCounts: { ...squatHmm.dominantStateCounts },
    hmmExcursionScore: squatHmm.confidenceBreakdown.excursionScore,
    hmmSequenceScore: squatHmm.confidenceBreakdown.sequenceScore,
    hmmCoverageScore: squatHmm.confidenceBreakdown.coverageScore,
    hmmNoisePenalty: squatHmm.confidenceBreakdown.noisePenalty,
  };

  const globalMaxDepthProxy = depthValues.length > 0 ? Math.max(...depthValues) : 0;
  const completionSliceDepthValues = getNumbers(
    completionFrames.map((frame) => frame.derived.squatDepthProxy)
  );
  const completionSliceMaxDepthProxy =
    completionSliceDepthValues.length > 0 ? Math.max(...completionSliceDepthValues) : 0;
  /** PR-CAM-28: 슬라이스 최댓값이 전역 피크보다 유의하게 낮으면 tail-only 등 mismatch */
  const DEPTH_TRUTH_MISMATCH_EPS = 0.015;
  const depthTruthWindowMismatch =
    effectiveArmed && globalMaxDepthProxy - completionSliceMaxDepthProxy > DEPTH_TRUTH_MISMATCH_EPS
      ? 1
      : 0;
  const sliceMissedMotionCode = !effectiveArmed
    ? 2
    : depthTruthWindowMismatch === 1
      ? 1
      : 0;

  const phaseScan = effectiveArmed ? completionFrames : [];
  const offset = completionArming.completionSliceStartIndex;
  const toGlobalIdx = (idxInSlice: number) =>
    idxInSlice >= 0 ? offset + idxInSlice : -1;
  const firstStartIdx = toGlobalIdx(phaseScan.findIndex((f) => f.phaseHint === 'start'));
  const firstDescentIdx = toGlobalIdx(phaseScan.findIndex((f) => f.phaseHint === 'descent'));
  const firstBottomIdx = toGlobalIdx(phaseScan.findIndex((f) => f.phaseHint === 'bottom'));
  const firstAscentIdx = toGlobalIdx(phaseScan.findIndex((f) => f.phaseHint === 'ascent'));
  const firstDescentIdxGlobal = valid.findIndex((f) => f.phaseHint === 'descent');
  const repCountEstimate = state.completionSatisfied ? 1 : 0;

  if (!effectiveArmed) {
    completionHints.push('completion_not_armed');
  }

  if (!state.attemptStarted || !ascentSatisfied) {
    completionHints.push('rep_phase_incomplete');
  } else if (!state.completionSatisfied) {
    completionHints.push(state.completionBlockedReason ?? 'recovery_not_confirmed');
  } else {
    interpretedSignals.push('descend-commit-ascend-standing_recovered pattern detected');
  }

  /** PR G6: depthBand — completion과 분리된 quality 해석. shallow(<35%), moderate(35-55%), deep(>=55%) */
  const depthBand =
    depthValues.length > 0
      ? (() => {
          const peakPct = Math.max(...depthValues) * 100;
          return peakPct >= 55 ? 2 : peakPct >= 35 ? 1 : 0;
        })()
      : 0;

  if (depthValues.length > 0) {
    const avgDepth = mean(depthValues) * 100;
    const peakDepth = Math.max(...depthValues) * 100;
    metrics.push({
      name: 'depth',
      value: Math.round(avgDepth),
      unit: '%',
      trend: peakDepth >= 68 ? 'good' : peakDepth >= 48 ? 'neutral' : 'concern',
    });
    rawMetrics.push({
      name: 'bottom_stability_proxy',
      value: Math.round(bottomStability * 100),
      unit: '%',
      trend: bottomStability >= 0.65 ? 'good' : bottomStability >= 0.45 ? 'neutral' : 'concern',
    });
  }

  if (kneeTracking.length > 0) {
    const avg = mean(kneeTracking);
    metrics.push({
      name: 'knee_alignment_trend',
      value: Math.round(avg * 100) / 100,
      trend: avg > 0.88 && avg < 1.12 ? 'good' : avg > 0.8 && avg < 1.2 ? 'neutral' : 'concern',
    });
  }

  if (trunkLeanValues.length > 0) {
    const avg = mean(trunkLeanValues);
    metrics.push({
      name: 'trunk_lean',
      value: Math.round(avg * 10) / 10,
      unit: 'deg',
      trend: avg < 15 ? 'good' : avg < 24 ? 'neutral' : 'concern',
    });
  }

  if (asymmetryValues.length > 0) {
    const asym = mean(asymmetryValues);
    metrics.push({
      name: 'asymmetry',
      value: Math.round(asym * 10) / 10,
      unit: 'deg',
      trend: asym < 10 ? 'good' : asym < 18 ? 'neutral' : 'concern',
    });
  }

  if (weightShiftValues.length > 0) {
    rawMetrics.push({
      name: 'left_right_weight_shift_proxy',
      value: Math.round(mean(weightShiftValues) * 100),
      unit: '%',
      trend: mean(weightShiftValues) < 0.22 ? 'good' : mean(weightShiftValues) < 0.35 ? 'neutral' : 'concern',
    });
  }

  const perStepDiagnostics = getSquatPerStepDiagnostics(valid, metrics.length);
  const perStepRecord: Record<string, typeof perStepDiagnostics.descent> = {
    descent: perStepDiagnostics.descent,
    bottom: perStepDiagnostics.bottom,
    ascent: perStepDiagnostics.ascent,
  };

  /**
   * PR-3-EVALUATOR-BOUNDARY-CLEANUP: Packaging.
   *
   * buildSquatEvaluatorHighlightedMetrics assembles the read-only debug/observability
   * surface from finalized completion truth. It does NOT write to completion fields.
   * It reads from `state` which at this point has already passed through:
   *   evaluateSquatCompletionState → late-setup check → attachShallowTruthObservabilityAlign01
   *   → applyUltraLowPolicyLock
   */
  const highlightedMetrics = buildSquatEvaluatorHighlightedMetrics({
    state,
    frames,
    valid,
    completionFrames,
    completionArming,
    effectiveArmed,
    squatHmm,
    depthValues,
    globalMaxDepthProxy,
    completionSliceMaxDepthProxy,
    maxPrimaryCalib,
    maxBlendedCalib,
    firstDescentIdx,
    firstDescentIdxGlobal,
    firstBottomIdx,
    firstAscentIdx,
    firstStartIdx,
    depthTruthWindowMismatch,
    sliceMissedMotionCode,
    relPeakPrimPct,
    relPeakBlendPct,
    latestSquatDepthProxy,
    guardedShallowAscentDetected,
    depthBlendObsFallbackPeak,
    depthBlendObsTravelPeak,
    squatDepthBlendOfferedCount,
    squatDepthBlendCapHitCount,
    squatDepthBlendActiveFrameCount,
    squatDepthSourceFlipCount,
    bottomStability,
    startCount,
    descentCount,
    bottomCount,
    ascentCount,
    recovery,
    depthBand,
    repCountEstimate,
  });

  return {
    stepId: 'squat',
    metrics,
    insufficientSignal: false,
    rawMetrics,
    interpretedSignals,
    qualityHints,
    completionHints,
    debug: {
      frameCount: frames.length,
      validFrameCount: valid.length,
      phaseHints: Array.from(new Set(valid.map((frame) => frame.phaseHint))),
      squatCompletionArming: completionArming,
      squatDepthCalibration,
      squatReversalCalibration,
      squatInternalQuality,
      /** PR-CAM-09: typed completion state — auto-progression reads this directly */
      squatCompletionState: state,
      /**
       * PASS-AUTHORITY-RESET-01: immutable motion pass authority result.
       * Set BEFORE applyUltraLowPolicyLock and before late-setup suppression.
       * auto-progression reads squatPassCore.passDetected as final motion pass truth.
       */
      squatPassCore,
      /** Setup false-pass lock: dwell / framing-motion observation (auto-progression / trace) */
      squatSetupPhaseTrace,
      highlightedMetrics,
      perStepDiagnostics: perStepRecord,
      /** PR-HMM-01B: shadow decoder full result — debug only */
      squatHmm,
      squatCalibration,
      /** PR-04E3B: shallow event-cycle helper — populated by completion-state */
      squatEventCycle: state.squatEventCycle,
    },
  };
}

/**
 * PR-3-EVALUATOR-BOUNDARY-CLEANUP: Evaluator packaging helper.
 *
 * Converts finalized completion truth + evaluator-local context into the
 * highlightedMetrics debug surface consumed by auto-progression and debug tooling.
 *
 * OWNERSHIP: Pure packaging — reads from finalized state, produces scalar/code fields.
 * Does NOT write to completionSatisfied, completionPassReason, completionBlockedReason,
 * or any other completion truth field.
 *
 * All fields produced here are observability/debug — NOT gate inputs for auto-progression.
 */
function buildSquatEvaluatorHighlightedMetrics(p: {
  state: ReturnType<typeof evaluateSquatCompletionState> & {
    standingFinalizeSuppressedByLateSetup?: boolean;
  };
  frames: PoseFeaturesFrame[];
  valid: PoseFeaturesFrame[];
  completionFrames: PoseFeaturesFrame[];
  completionArming: ReturnType<typeof mergeArmingDepthObservability>;
  effectiveArmed: boolean;
  squatHmm: ReturnType<typeof decodeSquatHmm>;
  depthValues: number[];
  globalMaxDepthProxy: number;
  completionSliceMaxDepthProxy: number;
  maxPrimaryCalib: number;
  maxBlendedCalib: number;
  firstDescentIdx: number;
  firstDescentIdxGlobal: number;
  firstBottomIdx: number;
  firstAscentIdx: number;
  firstStartIdx: number;
  depthTruthWindowMismatch: number;
  sliceMissedMotionCode: number;
  relPeakPrimPct: number | null;
  relPeakBlendPct: number | null;
  latestSquatDepthProxy: number | null;
  guardedShallowAscentDetected: number;
  depthBlendObsFallbackPeak: number;
  depthBlendObsTravelPeak: number;
  squatDepthBlendOfferedCount: number;
  squatDepthBlendCapHitCount: number;
  squatDepthBlendActiveFrameCount: number;
  squatDepthSourceFlipCount: number;
  bottomStability: number;
  startCount: number;
  descentCount: number;
  bottomCount: number;
  ascentCount: number;
  recovery: ReturnType<typeof getSquatRecoverySignal>;
  depthBand: number;
  repCountEstimate: number;
}) {
  const { state, completionArming, effectiveArmed, squatHmm } = p;

  return {
    depthPeak: p.depthValues.length > 0 ? Math.round(Math.max(...p.depthValues) * 100) : null,
    completionArmingArmed: completionArming.armed ? 1 : 0,
    effectiveArmed: effectiveArmed ? 1 : 0,
    hmmArmingAssistEligible: completionArming.hmmArmingAssistEligible ? 1 : 0,
    hmmArmingAssistApplied: completionArming.hmmArmingAssistApplied ? 1 : 0,
    hmmArmingAssistReason: completionArming.hmmArmingAssistReason ?? null,
    completionArmingBaselineCaptured: completionArming.baselineCaptured ? 1 : 0,
    completionArmingStableFrames: completionArming.stableFrames,
    completionArmingSliceStart: completionArming.completionSliceStartIndex,
    completionSliceEndIndex: effectiveArmed ? p.valid.length - 1 : -1,
    globalDepthPeak: Math.round(p.globalMaxDepthProxy * 1000) / 1000,
    completionSliceDepthPeak: Math.round(p.completionSliceMaxDepthProxy * 1000) / 1000,
    firstDescentIdxGlobal: p.firstDescentIdxGlobal >= 0 ? p.firstDescentIdxGlobal : -1,
    depthTruthWindowMismatch: p.depthTruthWindowMismatch,
    sliceMissedMotionCode: p.sliceMissedMotionCode,
    completionArmingFallbackUsed: completionArming.armingFallbackUsed ? 1 : 0,
    squatDepthPeakPrimary: Math.round(p.maxPrimaryCalib * 100),
    squatDepthPeakBlended: Math.round(p.maxBlendedCalib * 100),
    squatArmingDepthBlendAssisted: completionArming.armingDepthBlendAssisted ? 1 : 0,
    completionArmingPeakAnchored: completionArming.armingPeakAnchored ? 1 : 0,
    armingRetroApplied: completionArming.armingRetroApplied ? 1 : 0,
    ra: completionArming.armingRetroApplied ?? false,
    completionArmingStandingWindowRange:
      completionArming.armingStandingWindowRange != null
        ? Math.round(completionArming.armingStandingWindowRange * 1000) / 1000
        : null,
    armingBaselineStandingDepthPrimary:
      completionArming.armingBaselineStandingDepthPrimary != null
        ? Math.round(completionArming.armingBaselineStandingDepthPrimary * 100) / 100
        : null,
    armingBaselineStandingDepthBlended:
      completionArming.armingBaselineStandingDepthBlended != null
        ? Math.round(completionArming.armingBaselineStandingDepthBlended * 100) / 100
        : null,
    completionBaselineSeeded: state.baselineSeeded === true ? 1 : 0,
    baselineStandingDepth: Math.round(state.baselineStandingDepth * 100) / 100,
    rawDepthPeak: Math.round(state.rawDepthPeak * 100) / 100,
    relativeDepthPeak: Math.round(state.relativeDepthPeak * 100) / 100,
    latestSquatDepthProxy: p.latestSquatDepthProxy,
    squatRelativeDepthPeakPrimary:
      p.relPeakPrimPct != null ? Math.round(p.relPeakPrimPct * 10) / 10 : null,
    squatRelativeDepthPeakBlended:
      p.relPeakBlendPct != null ? Math.round(p.relPeakBlendPct * 10) / 10 : null,
    squatRelativeDepthSourceCode:
      state.relativeDepthPeakSource === 'primary'
        ? 1
        : state.relativeDepthPeakSource === 'blended'
          ? 2
          : 0,
    guardedShallowAscentDetected: p.guardedShallowAscentDetected,
    squatDepthObsFallbackPeak: Math.round(p.depthBlendObsFallbackPeak * 1000) / 1000,
    squatDepthObsTravelPeak: Math.round(p.depthBlendObsTravelPeak * 1000) / 1000,
    squatDepthBlendOfferedCount: p.squatDepthBlendOfferedCount,
    squatDepthBlendCapHitCount: p.squatDepthBlendCapHitCount,
    squatDepthBlendActiveFrameCount: p.squatDepthBlendActiveFrameCount,
    squatDepthSourceFlipCount: p.squatDepthSourceFlipCount,
    firstDescentIdx: p.firstDescentIdx,
    firstBottomIdx: p.firstBottomIdx,
    firstAscentIdx: p.firstAscentIdx,
    depthBand: p.depthBand,
    bottomStability: Math.round(p.bottomStability * 100),
    startCount: p.startCount,
    descentCount: p.descentCount,
    bottomCount: p.bottomCount,
    ascentCount: p.ascentCount,
    ascentRecovered: p.recovery.recovered ? 1 : 0,
    ascentRecoveredLowRom: p.recovery.lowRomRecovered ? 1 : 0,
    ascentRecoveredUltraLowRom: p.recovery.ultraLowRomRecovered ? 1 : 0,
    ascentRecoveredUltraLowRomGuarded: p.recovery.ultraLowRomGuardedRecovered ? 1 : 0,
    recoveryDrop: Math.round(p.recovery.recoveryDrop * 100),
    attemptStarted: state.attemptStarted,
    currentSquatPhase: state.currentSquatPhase,
    descendConfirmed: state.descendConfirmed,
    committedAtMs: state.committedAtMs ?? null,
    ascendConfirmed: state.ascendConfirmed,
    standingRecoveredAtMs: state.standingRecoveredAtMs ?? null,
    standingRecoveryHoldMs: state.standingRecoveryHoldMs,
    standingRecoveryFrameCount: state.standingRecoveryFrameCount,
    standingRecoveryThreshold: Math.round(state.standingRecoveryThreshold * 100) / 100,
    standingRecoveryMinFramesUsed: state.standingRecoveryMinFramesUsed,
    standingRecoveryMinHoldMsUsed: state.standingRecoveryMinHoldMsUsed,
    standingRecoveryBand: state.standingRecoveryBand,
    standingRecoveryFinalizeReason: state.standingRecoveryFinalizeReason,
    squatStandingBandHit: state.standingRecoveredAtMs != null ? 1 : 0,
    squatFinalizeGateOk:
      state.standingRecoveryFinalizeReason === 'standing_hold_met' ||
      state.standingRecoveryFinalizeReason === 'low_rom_guarded_finalize' ||
      state.standingRecoveryFinalizeReason === 'ultra_low_rom_guarded_finalize'
        ? 1
        : 0,
    successPhaseAtOpen: state.successPhaseAtOpen ?? null,
    evidenceLabel: state.evidenceLabel,
    completionBlockedReason: state.completionBlockedReason,
    completionSatisfied: state.completionSatisfied,
    shallowProofStage: state.shallowClosureProofTrace?.stage ?? null,
    shallowProofBlockedReason: state.shallowClosureProofTrace?.proofBlockedReason ?? null,
    shallowConsumptionBlockedReason:
      state.shallowClosureProofTrace?.consumptionBlockedReason ?? null,
    completionMachinePhase: state.completionMachinePhase,
    completionPassReason: state.completionPassReason,
    contractA_officialShallowCandidate: state.officialShallowPathCandidate ? 1 : 0,
    contractA_officialShallowAdmitted: state.officialShallowPathAdmitted ? 1 : 0,
    contractB_officialShallowReversal: state.officialShallowReversalSatisfied ? 1 : 0,
    contractB_officialShallowAscentEquiv: state.officialShallowAscentEquivalentSatisfied ? 1 : 0,
    contractC_officialShallowClosed: state.officialShallowPathClosed ? 1 : 0,
    contractC_closureProof: state.officialShallowClosureProofSatisfied ? 1 : 0,
    contractC_shallowDriftedToStandard: state.officialShallowDriftedToStandard ? 1 : 0,
    recoveryReturnContinuityFrames: state.recoveryReturnContinuityFrames,
    recoveryTrailingDepthCount: state.recoveryTrailingDepthCount,
    recoveryDropRatio:
      state.recoveryDropRatio != null
        ? Math.round(state.recoveryDropRatio * 100) / 100
        : undefined,
    lowRomRecoveryReason: state.lowRomRecoveryReason,
    ultraLowRomRecoveryReason: state.ultraLowRomRecoveryReason,
    repCount: p.repCountEstimate,
    cycleComplete: state.cycleComplete ? 1 : 0,
    startBeforeBottom: state.startBeforeBottom ? 1 : 0,
    descendStartAtMs: state.descendStartAtMs,
    peakAtMs: state.peakAtMs,
    committedAtMs: state.committedAtMs ?? null,
    reversalAtMs: state.reversalAtMs ?? null,
    ascendStartAtMs: state.ascendStartAtMs,
    recoveryAtMs: state.standingRecoveredAtMs ?? null,
    cycleDurationMs: state.cycleDurationMs,
    downwardCommitmentDelta: Math.round(state.downwardCommitmentDelta * 100) / 100,
    squatReversalDropRequiredPct:
      state.squatReversalDropRequired != null
        ? Math.round(state.squatReversalDropRequired * 1000) / 10
        : null,
    squatReversalDropAchievedPct:
      state.squatReversalDropAchieved != null
        ? Math.round(state.squatReversalDropAchieved * 1000) / 10
        : null,
    squatDescentToPeakMs: state.squatDescentToPeakMs ?? null,
    squatReversalToStandingMs: state.squatReversalToStandingMs ?? null,
    hmmConfidence: squatHmm.confidence,
    hmmExcursionScore: Math.round(squatHmm.confidenceBreakdown.excursionScore * 1000) / 1000,
    hmmSequenceScore: Math.round(squatHmm.confidenceBreakdown.sequenceScore * 1000) / 1000,
    hmmCoverageScore: Math.round(squatHmm.confidenceBreakdown.coverageScore * 1000) / 1000,
    hmmNoisePenalty: Math.round(squatHmm.confidenceBreakdown.noisePenalty * 1000) / 1000,
    hmmCompletionCandidate: squatHmm.completionCandidate ? 1 : 0,
    hmmStandingCount: squatHmm.dominantStateCounts.standing,
    hmmDescentCount: squatHmm.dominantStateCounts.descent,
    hmmBottomCount: squatHmm.dominantStateCounts.bottom,
    hmmAscentCount: squatHmm.dominantStateCounts.ascent,
    hmmExcursion: squatHmm.effectiveExcursion,
    hmmAssistEligible: state.hmmAssistEligible ? 1 : 0,
    hmmAssistApplied: state.hmmAssistApplied ? 1 : 0,
    ruleCompletionBlockedReasonCode: squatCompletionBlockedReasonToCode(
      state.ruleCompletionBlockedReason ?? null
    ),
    postAssistCompletionBlockedReasonCode: squatCompletionBlockedReasonToCode(
      state.postAssistCompletionBlockedReason ?? null
    ),
    assistSuppressedByFinalize: state.assistSuppressedByFinalize ? 1 : 0,
    hmmTransitionCount: squatHmm.transitionCount,
    hmmReversalAssistEligible: state.hmmReversalAssistEligible ? 1 : 0,
    hmmReversalAssistApplied: state.hmmReversalAssistApplied ? 1 : 0,
    hmmReversalAssistReason: state.hmmReversalAssistReason ?? null,
    squatReversalSourceCode:
      state.reversalConfirmedBy === 'rule'
        ? 1
        : state.reversalConfirmedBy === 'rule_plus_hmm'
          ? 2
          : 0,
    squatReversalDepthDrop:
      state.reversalDepthDrop != null
        ? Math.round(state.reversalDepthDrop * 1000) / 1000
        : null,
    squatReversalFrameCount: state.reversalFrameCount ?? null,
    squatBaselineFrozen: state.baselineFrozen ? 1 : 0,
    squatPeakLatched: state.peakLatched ? 1 : 0,
    squatPeakLatchedAtIndex: state.peakLatchedAtIndex ?? null,
    baselineFrozenDepth:
      state.baselineFrozenDepth != null && Number.isFinite(state.baselineFrozenDepth)
        ? Math.round(state.baselineFrozenDepth * 1000) / 1000
        : null,
    squatEventCycleDetected: state.squatEventCycle?.detected ? 1 : 0,
    squatEventCycleBandCode:
      state.squatEventCycle?.band === 'low_rom'
        ? 1
        : state.squatEventCycle?.band === 'ultra_low_rom'
          ? 2
          : 0,
    squatEventCyclePromoted: state.eventCyclePromoted ? 1 : 0,
    squatEventCycleSourceCode:
      state.eventCycleSource === 'rule'
        ? 1
        : state.eventCycleSource === 'rule_plus_hmm'
          ? 2
          : 0,
    shallowAuthoritativeStage: state.shallowAuthoritativeStage ?? null,
    shallowObservationLayerReversalTruth: state.shallowObservationLayerReversalTruth ? 1 : 0,
    shallowAuthoritativeReversalTruth: state.shallowAuthoritativeReversalTruth ? 1 : 0,
    shallowObservationLayerRecoveryTruth: state.shallowObservationLayerRecoveryTruth ? 1 : 0,
    shallowAuthoritativeRecoveryTruth: state.shallowAuthoritativeRecoveryTruth ? 1 : 0,
    shallowProvenanceOnlyReversalEvidence: state.shallowProvenanceOnlyReversalEvidence ? 1 : 0,
    truthMismatch_reversalTopVsCompletion: state.truthMismatch_reversalTopVsCompletion ? 1 : 0,
    truthMismatch_recoveryTopVsCompletion: state.truthMismatch_recoveryTopVsCompletion ? 1 : 0,
    truthMismatch_shallowAdmissionVsClosure: state.truthMismatch_shallowAdmissionVsClosure ? 1 : 0,
    truthMismatch_provenanceReversalWithoutAuthoritative:
      state.truthMismatch_provenanceReversalWithoutAuthoritative ? 1 : 0,
    truthMismatch_recoveryBandHitWithoutAuthoritativeRecovery:
      state.truthMismatch_recoveryBandHitWithoutAuthoritativeRecovery ? 1 : 0,
    shallowNormalizedBlockerFamily: state.shallowNormalizedBlockerFamily ?? null,
    shallowAuthoritativeContractStatus: state.shallowAuthoritativeContractStatus ?? null,
    shallowContractAuthoritativeClosure: state.shallowContractAuthoritativeClosure ? 1 : 0,
    shallowContractAuthorityTrace: state.shallowContractAuthorityTrace ?? null,
    ultraLowPolicyScope: state.ultraLowPolicyScope ? 1 : 0,
    ultraLowPolicyDecisionReady: state.ultraLowPolicyDecisionReady ? 1 : 0,
    ultraLowPolicyBlocked: state.ultraLowPolicyBlocked ? 1 : 0,
    ultraLowPolicyTrace: state.ultraLowPolicyTrace ?? null,
    ownerTruthSource: state.ownerTruthSource ?? 'none',
    ownerTruthStage: state.ownerTruthStage ?? null,
    ownerTruthBlockedBy: state.ownerTruthBlockedBy ?? null,
    standingFinalizeSatisfied: state.standingFinalizeSatisfied ? 1 : 0,
    standingFinalizeSuppressedByLateSetup: state.standingFinalizeSuppressedByLateSetup ? 1 : 0,
    standingFinalizeReadyAtMs: state.standingFinalizeReadyAtMs ?? null,
  };
}

export function evaluateSquat(landmarks: PoseLandmarks[]): EvaluatorResult {
  return evaluateSquatFromPoseFrames(buildPoseFeaturesFrames('squat', landmarks));
}

/** CAM-OBS: pass_snapshot JSON 행 — snake_case·camelCase 혼합은 제품 스펙 4.3과 동일 */
export type SquatPassSnapshotObservabilityInput = {
  frameIdx: number;
  passReason: string | null | undefined;
  completionOwner: string | null | undefined;
  eventCyclePromoted: boolean;
  passLatched: boolean;
  descentConfirmed: boolean;
  reversalConfirmedAfterDescend: boolean;
  recoveryConfirmedAfterReversal: boolean;
  peakLatchedAtIndex: number | null;
  bottomPeakTs: number | null | undefined;
  relativeDepthPeak: number;
  currentDepth: number;
  stillSeatedAtPass: boolean;
};

export function formatSquatPassSnapshotObservabilityRow(
  p: SquatPassSnapshotObservabilityInput
): Record<string, unknown> {
  return {
    frame_idx: p.frameIdx,
    pass_reason: p.passReason ?? '',
    completion_owner: p.completionOwner ?? '',
    eventCyclePromoted: p.eventCyclePromoted,
    passLatched: p.passLatched,
    descentConfirmed: p.descentConfirmed,
    reversalConfirmedAfterDescend: p.reversalConfirmedAfterDescend,
    recoveryConfirmedAfterReversal: p.recoveryConfirmedAfterReversal,
    peakLatchedAtIndex: p.peakLatchedAtIndex,
    bottomPeakTs: p.bottomPeakTs ?? null,
    relativeDepthPeak: p.relativeDepthPeak,
    currentDepth: p.currentDepth,
    stillSeatedAtPass: p.stillSeatedAtPass,
  };
}
