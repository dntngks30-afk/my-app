/**
 * 스쿼트 evaluator
 * metrics: depth, knee alignment trend, trunk lean, asymmetry
 */
import type { PoseLandmarks } from '@/lib/motion/pose-types';
import { buildPoseFeaturesFrames, getSquatRecoverySignal } from '@/lib/camera/pose-features';
import type { PoseFeaturesFrame } from '@/lib/camera/pose-features';
import { evaluateSquatCompletionState } from '@/lib/camera/squat-completion-state';
import { computeSquatCompletionArming } from '@/lib/camera/squat/squat-completion-arming';
import {
  computeSquatInternalQuality,
  squatInternalQualityInsufficientSignal,
} from '@/lib/camera/squat/squat-internal-quality';
import { getSquatPerStepDiagnostics } from '@/lib/camera/step-joint-spec';
import type { EvaluatorResult, EvaluatorMetric } from './types';

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
  const valid = frames.filter((frame) => frame.isValid);
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
    return {
      stepId: 'squat',
      metrics: [],
      insufficientSignal: true,
      reason: '프레임 부족',
      qualityHints: ['valid_frames_too_few'],
      completionHints: ['rep_missing'],
      debug: {
        frameCount: frames.length,
        validFrameCount: valid.length,
        phaseHints: Array.from(new Set(frames.map((frame) => frame.phaseHint))),
        highlightedMetrics: {
          validFrameCount: valid.length,
          completionMachinePhase: 'idle',
          completionPassReason: 'not_confirmed',
          completionSatisfied: false,
        },
        perStepDiagnostics: { descent: emptyDiag, bottom: emptyDiag, ascent: emptyDiag },
        squatInternalQuality: squatInternalQualityInsufficientSignal(),
      },
    };
  }

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
  const { arming: completionArming, completionFrames } = computeSquatCompletionArming(valid);
  const state = evaluateSquatCompletionState(
    completionArming.armed ? completionFrames : []
  );

  const phaseScan = completionArming.armed ? completionFrames : [];
  const offset = completionArming.completionSliceStartIndex;
  const toGlobalIdx = (idxInSlice: number) =>
    idxInSlice >= 0 ? offset + idxInSlice : -1;
  const firstStartIdx = toGlobalIdx(phaseScan.findIndex((f) => f.phaseHint === 'start'));
  const firstDescentIdx = toGlobalIdx(phaseScan.findIndex((f) => f.phaseHint === 'descent'));
  const firstBottomIdx = toGlobalIdx(phaseScan.findIndex((f) => f.phaseHint === 'bottom'));
  const firstAscentIdx = toGlobalIdx(phaseScan.findIndex((f) => f.phaseHint === 'ascent'));
  const repCountEstimate = state.completionSatisfied ? 1 : 0;

  if (!completionArming.armed) {
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
      squatInternalQuality,
      /** PR-CAM-09: typed completion state — auto-progression 이 highlightedMetrics 캐스팅 없이 읽는다 */
      squatCompletionState: state,
      highlightedMetrics: {
        depthPeak: depthValues.length > 0 ? Math.round(Math.max(...depthValues) * 100) : null,
        /** PR standing-fp: baseline-relative depth for standard path gate */
        completionArmingArmed: completionArming.armed ? 1 : 0,
        completionArmingBaselineCaptured: completionArming.baselineCaptured ? 1 : 0,
        completionArmingStableFrames: completionArming.stableFrames,
        completionArmingSliceStart: completionArming.completionSliceStartIndex,
        baselineStandingDepth: Math.round(state.baselineStandingDepth * 100) / 100,
        rawDepthPeak: Math.round(state.rawDepthPeak * 100) / 100,
        relativeDepthPeak: Math.round(state.relativeDepthPeak * 100) / 100,
        firstDescentIdx,
        firstBottomIdx,
        firstAscentIdx,
        depthBand,
        bottomStability: Math.round(bottomStability * 100),
        startCount,
        descentCount,
        bottomCount,
        ascentCount,
        ascentRecovered: recovery.recovered ? 1 : 0,
        ascentRecoveredLowRom: recovery.lowRomRecovered ? 1 : 0,
        ascentRecoveredUltraLowRom: recovery.ultraLowRomRecovered ? 1 : 0,
        ascentRecoveredUltraLowRomGuarded: recovery.ultraLowRomGuardedRecovered ? 1 : 0,
        recoveryDrop: Math.round(recovery.recoveryDrop * 100),
        attemptStarted: state.attemptStarted,
        currentSquatPhase: state.currentSquatPhase,
        descendConfirmed: state.descendConfirmed,
        committedAtMs: state.committedAtMs ?? null,
        ascendConfirmed: state.ascendConfirmed,
        standingRecoveredAtMs: state.standingRecoveredAtMs ?? null,
        standingRecoveryHoldMs: state.standingRecoveryHoldMs,
        standingRecoveryFrameCount: state.standingRecoveryFrameCount,
        standingRecoveryThreshold: Math.round(state.standingRecoveryThreshold * 100) / 100,
        successPhaseAtOpen: state.successPhaseAtOpen ?? null,
        evidenceLabel: state.evidenceLabel,
        completionBlockedReason: state.completionBlockedReason,
        completionSatisfied: state.completionSatisfied,
        /** PR-COMP-01: completion gate 전용(품질·depthBand와 분리) */
        completionMachinePhase: state.completionMachinePhase,
        completionPassReason: state.completionPassReason,
        /** PR squat-low-rom: trace */
        recoveryReturnContinuityFrames: state.recoveryReturnContinuityFrames,
        recoveryTrailingDepthCount: state.recoveryTrailingDepthCount,
        recoveryDropRatio: state.recoveryDropRatio != null ? Math.round(state.recoveryDropRatio * 100) / 100 : undefined,
        lowRomRecoveryReason: state.lowRomRecoveryReason,
        ultraLowRomRecoveryReason: state.ultraLowRomRecoveryReason,
        repCount: repCountEstimate,
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
        /** PR-CAM-02: 역전/타이밍 관측(기기 트레이스·디버그) */
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
      },
      perStepDiagnostics: perStepRecord,
    },
  };
}

export function evaluateSquat(landmarks: PoseLandmarks[]): EvaluatorResult {
  return evaluateSquatFromPoseFrames(buildPoseFeaturesFrames('squat', landmarks));
}
