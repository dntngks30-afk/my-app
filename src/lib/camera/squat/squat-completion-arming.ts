/**
 * PR-HOTFIX-02 — 스쿼트 completion **평가 시작 시점**만 제한한다.
 *
 * - `evaluateSquatCompletionState` 내부 규칙·임계값은 변경하지 않는다.
 * - 서 있기 안정 구간이 쌓인 뒤에만 completion용 프레임 슬라이스를 넘긴다.
 *
 * PR-CAM-27: 얕은 스쿼트 depth-truth 정렬 (secondary arm)
 * PR-CAM-28: **피크 앵커 arm** — 버퍼 내 `squatDepthProxy` 최댓값 직전의 마지막 안정 standing을
 *   기준으로 슬라이스를 잡아, “선행 스쿼트 + 긴 사후 standing”에서 첫 10프레임이 tail만 보는
 *   source-chain mismatch를 제거한다.
 */

import type { PoseFeaturesFrame } from '@/lib/camera/pose-features';

export const KNEE_DESCENT_ONSET_EPSILON_DEG = 5.0;
export const KNEE_DESCENT_ONSET_SUSTAIN_FRAMES = 2;

export type PreArmingKinematicDescentEpoch = {
  source: 'pre_arming_kinematic_descent_epoch';
  baselineKneeAngleAvg: number;
  baselineWindowStartValidIndex: number;
  baselineWindowEndValidIndex: number;
  descentOnsetValidIndex: number;
  descentOnsetAtMs: number;
  descentOnsetKneeAngleAvg: number;
  completionSliceStartIndex: number;
  peakGuardValidIndex: number;
  peakGuardAtMs: number;
  proof: {
    monotonicSustainSatisfied: true;
    baselineBeforeOnset: true;
    onsetBeforeCompletionSlicePeak: true;
    noStandingRecoveryBetweenOnsetAndSlice: true;
  };
};

/** completion 평가를 허용하기 전 관측 상태(디버그·게이트용) */
export type CompletionArmingState = {
  armed: boolean;
  /** 무장 후 슬라이스에 baseline(최소 프레임)을 잡을 수 있는지 */
  baselineCaptured: boolean;
  /** 무장에 사용된 연속 서 있기 안정 프레임 수 */
  stableFrames: number;
  /** `valid` 배열 기준 completion 슬라이스 시작 인덱스(미무장이면 0) */
  completionSliceStartIndex: number;
  /** PR-CAM-27: 1차 arm이 motion을 포함하지 않아 폴백 arm을 사용했는지 */
  armingFallbackUsed?: boolean;
  /** PR-CAM-28: 글로벌 depth 피크 직전 standing에 슬라이스를 앵커했는지 */
  armingPeakAnchored?: boolean;
  /** PR-CAM-RETRO-ARMING-ASSIST-01: 짧은 standing + 강한 motion으로 뒤늦게 연 rule arm */
  armingRetroApplied?: boolean;
  /**
   * PR-B: 선택된 standing 윈도우 내부 depth range (max-min).
   * 높으면 arming이 진짜 standing이 아닌 하강 구간을 선택했을 가능성이 있다.
   */
  armingStandingWindowRange?: number;
  /** PR-HMM-04A: HMM 기반 arming 보조 — rule `armed`와 별도 */
  hmmArmingAssistEligible?: boolean;
  hmmArmingAssistApplied?: boolean;
  hmmArmingAssistReason?: string | null;
  /** `armed || hmmArmingAssistApplied` — completion 슬라이스 선택 기준 */
  effectiveArmed?: boolean;
  /** PR-X1: same-rep shared descent truth consumed before completion slicing. */
  sharedDescentArmingStabilizationApplied?: boolean;
  sharedDescentArmingStabilizationReason?: string | null;
  /**
   * PR-CAM-ARMING-BASELINE-HANDOFF-01: 검증된 standing 윈도우 min(primary) — completion-state seed
   */
  armingBaselineStandingDepthPrimary?: number;
  /** 동일 윈도우 min(blended 우선 스트림) */
  armingBaselineStandingDepthBlended?: number;
  /** PR-04E1: arming depth 스트림 요약 — primary vs blended 우선 */
  armingDepthSource?: string | null;
  armingDepthPeak?: number;
  /** blended depth 가 primary 피크를 유의하게 넘겼을 때 true */
  armingDepthBlendAssisted?: boolean;
};

/** pose-features `start` 밴드와 정렬 (약간 여유로 초기 캘리브레이션 허용) */
const STANDING_DEPTH_MAX = 0.085;
/** 인접 프레임 깊이 변화가 이 값 이하여야 "서 있기 안정"으로 친다 */
const STABLE_ADJACENT_DELTA_MAX = 0.018;
/**
 * PR-B: 윈도우 내부 max-min 범위 상한.
 *
 * ultra-shallow 스쿼트(peak < 0.085)에서 하강 구간 전체가 STANDING_DEPTH_MAX 미만이고
 * 인접 델타도 작아서 isStableStandingRun이 하강 구간을 "standing"으로 오인하는 버그를 막는다.
 *
 * 기준:
 * - 진짜 서 있기 윈도우 내부 range: ≈ 0.000–0.008 (자연 자세 변화 포함)
 * - early-descent 구간(서서히 오름): range ≈ 0.010–0.030
 * → 0.010 컷오프로 descent ramp를 안전하게 차단하면서 standing 사소한 흔들림은 허용한다.
 */
const STANDING_INTERNAL_RANGE_MAX = 0.010;
/** 연속 안정 서 있기 프레임 수 — 짧은 지터만으로 descent가 열리지 않게 */
const MIN_STABLE_STANDING_FRAMES = 10;
/** squat-completion-state baseline 윈도우와 정합(슬라이스만 넘기므로 최소 길이 힌트) */
const MIN_FRAMES_FOR_BASELINE_CAPTURE = 6;

/**
 * PR-CAM-27: 폴백 arm 최소 연속 standing 프레임.
 * 4프레임(≈133ms @30fps)은 자연 피드팅으로도 충분히 쌓이며,
 * 단일 프레임 스파이크는 STABLE_ADJACENT_DELTA_MAX로 차단된다.
 */
const SECONDARY_STABLE_MIN_FRAMES = 4;
/**
 * PR-CAM-27: baseline 대비 최소 depth excursion — standing sway 차단 기준.
 * guardedShallowDescent는 SHALLOW_DESCENT_EXCURSION_MIN(0.015)을 요구하므로
 * 이 값은 그보다 약간 높게 잡아 실질 하강 신호만 폴백을 허용한다.
 */
const SHALLOW_FALLBACK_EVIDENCE_MIN = 0.018;

/** PR-CAM-RETRO-ARMING-ASSIST-01: 피크 직전 짧은 standing 런(10/4프레임 rule과 별도) */
const RETRO_STABLE_MIN_FRAMES = 3;
const RETRO_ARMING_MIN_PEAK_DEPTH = 0.25;
const RETRO_ARMING_MIN_EXCURSION_FROM_BASE = 0.12;

function readSquatDepthPrimary(frame: PoseFeaturesFrame): number | null {
  const d = frame.derived.squatDepthProxy;
  return typeof d === 'number' && Number.isFinite(d) ? d : null;
}

/** PR-CAM-ARMING-BASELINE-HANDOFF-01: standing 윈도우 baseline primary 전용 — blended 미사용 */
export function readSquatArmingDepthPrimaryOnly(frame: PoseFeaturesFrame): number | null {
  return readSquatDepthPrimary(frame);
}

/** PR-04E1: 무장·피크 탐색은 blended(보조) 우선, 없으면 primary */
function readSquatArmingDepth(frame: PoseFeaturesFrame): number | null {
  const b = frame.derived.squatDepthProxyBlended;
  if (typeof b === 'number' && Number.isFinite(b)) return b;
  return readSquatDepthPrimary(frame);
}

function readFiniteKneeAngleAvg(frame: PoseFeaturesFrame | undefined): number | null {
  const knee = frame?.derived.kneeAngleAvg;
  return typeof knee === 'number' && Number.isFinite(knee) ? knee : null;
}

export function findPreArmingKinematicDescentEpoch(
  valid: PoseFeaturesFrame[],
  input: {
    baselineKneeAngleAvg: number | undefined;
    completionSliceStartIndex: number;
    baselineWindowStartValidIndex?: number;
    baselineWindowEndValidIndex?: number;
  }
): PreArmingKinematicDescentEpoch | null {
  const baseline = input.baselineKneeAngleAvg;
  const completionSliceStartIndex = input.completionSliceStartIndex;
  if (typeof baseline !== 'number' || !Number.isFinite(baseline)) return null;
  if (!Number.isInteger(completionSliceStartIndex) || completionSliceStartIndex <= 0) return null;
  if (completionSliceStartIndex >= valid.length) return null;

  const baselineWindowStartValidIndex = input.baselineWindowStartValidIndex ?? 0;
  const baselineWindowEndValidIndex =
    input.baselineWindowEndValidIndex ?? Math.min(5, valid.length - 1);
  if (
    !Number.isInteger(baselineWindowStartValidIndex) ||
    !Number.isInteger(baselineWindowEndValidIndex) ||
    baselineWindowStartValidIndex < 0 ||
    baselineWindowEndValidIndex < baselineWindowStartValidIndex ||
    baselineWindowEndValidIndex >= valid.length
  ) {
    return null;
  }

  let peakGuardValidIndex: number | null = null;
  let peakGuardDepth = -Infinity;
  for (let i = completionSliceStartIndex; i < valid.length; i++) {
    const depth = readSquatArmingDepth(valid[i]!);
    if (depth == null) continue;
    if (depth > peakGuardDepth) {
      peakGuardDepth = depth;
      peakGuardValidIndex = i;
    }
  }
  if (peakGuardValidIndex == null) return null;

  const threshold = baseline - KNEE_DESCENT_ONSET_EPSILON_DEG;
  const sustainWindow = Math.max(2, KNEE_DESCENT_ONSET_SUSTAIN_FRAMES);
  for (let i = baselineWindowEndValidIndex + 1; i < completionSliceStartIndex; i++) {
    if (i >= peakGuardValidIndex) break;
    const kneeAtI = readFiniteKneeAngleAvg(valid[i]);
    if (kneeAtI == null || !(kneeAtI <= threshold)) continue;
    if (i + sustainWindow - 1 >= valid.length) break;
    if (i + sustainWindow - 1 >= peakGuardValidIndex) continue;

    let monotonic = true;
    for (let j = 0; j < sustainWindow - 1; j++) {
      const cur = readFiniteKneeAngleAvg(valid[i + j]);
      const nxt = readFiniteKneeAngleAvg(valid[i + j + 1]);
      if (cur == null || nxt == null || cur - nxt < 0) {
        monotonic = false;
        break;
      }
    }
    if (!monotonic) continue;

    let noStandingRecoveryBetweenOnsetAndSlice = true;
    for (let k = i + 1; k < completionSliceStartIndex; k++) {
      const knee = readFiniteKneeAngleAvg(valid[k]);
      if (knee == null || knee > threshold) {
        noStandingRecoveryBetweenOnsetAndSlice = false;
        break;
      }
    }
    if (!noStandingRecoveryBetweenOnsetAndSlice) continue;

    return {
      source: 'pre_arming_kinematic_descent_epoch',
      baselineKneeAngleAvg: baseline,
      baselineWindowStartValidIndex,
      baselineWindowEndValidIndex,
      descentOnsetValidIndex: i,
      descentOnsetAtMs: valid[i]!.timestampMs,
      descentOnsetKneeAngleAvg: kneeAtI,
      completionSliceStartIndex,
      peakGuardValidIndex,
      peakGuardAtMs: valid[peakGuardValidIndex]!.timestampMs,
      proof: {
        monotonicSustainSatisfied: true,
        baselineBeforeOnset: true,
        onsetBeforeCompletionSlicePeak: true,
        noStandingRecoveryBetweenOnsetAndSlice: true,
      },
    };
  }

  return null;
}

/** PR-04E1: 최종 arming 상태에 valid 버퍼 기준 depth 피크 메타를 합친다 (evaluator 재호출 가능). */
export function mergeArmingDepthObservability(
  valid: PoseFeaturesFrame[],
  arming: CompletionArmingState
): CompletionArmingState {
  let primaryPeak = -Infinity;
  let armingPeak = -Infinity;
  for (const f of valid) {
    const p = readSquatDepthPrimary(f);
    const a = readSquatArmingDepth(f);
    if (p != null) primaryPeak = Math.max(primaryPeak, p);
    if (a != null) armingPeak = Math.max(armingPeak, a);
  }
  if (!Number.isFinite(primaryPeak) || primaryPeak === -Infinity) primaryPeak = 0;
  if (!Number.isFinite(armingPeak) || armingPeak === -Infinity) armingPeak = 0;
  const assisted = armingPeak > primaryPeak + 0.007;
  return {
    ...arming,
    armingDepthPeak: Math.round(armingPeak * 1000) / 1000,
    armingDepthSource: assisted ? 'blended_preferred' : 'primary',
    armingDepthBlendAssisted: assisted,
  };
}

function isStableStandingRun(frames: PoseFeaturesFrame[], start: number, len: number): boolean {
  let dMin = Infinity;
  let dMax = -Infinity;
  for (let k = 0; k < len; k++) {
    const d = readSquatArmingDepth(frames[start + k]!);
    if (d == null || d >= STANDING_DEPTH_MAX) return false;
    if (k > 0) {
      const prev = readSquatArmingDepth(frames[start + k - 1]!);
      if (prev == null || Math.abs(d - prev) > STABLE_ADJACENT_DELTA_MAX) return false;
    }
    if (d < dMin) dMin = d;
    if (d > dMax) dMax = d;
  }
  // PR-B: 윈도우 내부 범위가 크면 하강 구간(낮은 델타의 ramp)을 standing으로 오인한 것.
  // ultra-shallow 스쿼트 전체가 STANDING_DEPTH_MAX 미만이므로 내부 범위로 구분한다.
  return dMax - dMin <= STANDING_INTERNAL_RANGE_MAX;
}

/** valid 내 첫 번째 전역 최대 squatDepthProxy 인덱스 (동률 시 앞쪽) */
function findGlobalSquatDepthPeakIndex(valid: PoseFeaturesFrame[]): number | null {
  let bestIdx: number | null = null;
  let bestD = -Infinity;
  for (let i = 0; i < valid.length; i++) {
    const d = readSquatArmingDepth(valid[i]!);
    if (d == null) continue;
    if (d > bestD) {
      bestD = d;
      bestIdx = i;
    }
  }
  return bestIdx;
}

/**
 * PR-CAM-28: 글로벌 피크 **바로 앞**에서 끝나는 가장 가까운 안정 standing 구간을 찾는다.
 * end는 peakIdx-1 이하이며, [end-len+1, end]가 안정 standing이면 슬라이스는 end+1부터.
 */
function tryPeakAnchoredArming(valid: PoseFeaturesFrame[]): {
  arming: CompletionArmingState;
  completionFrames: PoseFeaturesFrame[];
} | null {
  const peakIdx = findGlobalSquatDepthPeakIndex(valid);
  if (peakIdx == null || peakIdx < 1) return null;

  const peakDepth = readSquatArmingDepth(valid[peakIdx]!);
  if (peakDepth == null) return null;

  const stableLens = [MIN_STABLE_STANDING_FRAMES, SECONDARY_STABLE_MIN_FRAMES] as const;

  for (const stableLen of stableLens) {
    for (let end = peakIdx - 1; end >= stableLen - 1; end--) {
      const start = end - stableLen + 1;
      if (!isStableStandingRun(valid, start, stableLen)) continue;

      const completionSliceStartIndex = end + 1;
      if (completionSliceStartIndex > peakIdx) continue;

      const completionFrames = valid.slice(completionSliceStartIndex);
      const baselineDepthsBlended = valid
        .slice(start, end + 1)
        .map(readSquatArmingDepth)
        .filter((d): d is number => d != null);
      const baselineDepthsPrimary = valid
        .slice(start, end + 1)
        .map(readSquatArmingDepthPrimaryOnly)
        .filter((d): d is number => d != null);
      const completionDepths = completionFrames.map(readSquatArmingDepth).filter((d): d is number => d != null);

      if (baselineDepthsBlended.length < stableLen || completionDepths.length === 0) continue;

      const baseMinBlended = Math.min(...baselineDepthsBlended);
      const baseMinPrimary =
        baselineDepthsPrimary.length > 0 ? Math.min(...baselineDepthsPrimary) : baseMinBlended;
      const baseMax = Math.max(...baselineDepthsBlended);
      const completionMax = Math.max(...completionDepths);

      if (completionMax - baseMinBlended < SHALLOW_FALLBACK_EVIDENCE_MIN) continue;

      // 피크가 슬라이스 안에 있고, 슬라이스 최댓값이 전역 피크와 일치(부동 소수 허용)
      if (peakIdx >= completionSliceStartIndex && completionMax + 1e-9 >= peakDepth) {
        return {
          arming: {
            armed: true,
            baselineCaptured: completionFrames.length >= MIN_FRAMES_FOR_BASELINE_CAPTURE,
            stableFrames: stableLen,
            completionSliceStartIndex,
            armingPeakAnchored: true,
            armingStandingWindowRange: Math.round((baseMax - baseMinBlended) * 1000) / 1000,
            armingBaselineStandingDepthPrimary: Math.round(baseMinPrimary * 1000) / 1000,
            armingBaselineStandingDepthBlended: Math.round(baseMinBlended * 1000) / 1000,
          },
          completionFrames,
        };
      }
    }
  }

  return null;
}

/**
 * PR-CAM-RETRO-ARMING-ASSIST-01: rule arm(피크/10/4)이 아직 열리지 않았을 때,
 * 버퍼 안에 이미 짧은 stable standing 직후 의미 있는 하강 피크가 있으면 슬라이스를 복구한다.
 * 기존 arm보다 먼저 호출하면 안 된다 — `computeSquatCompletionArming` 말단 보조 전용.
 */
export function tryRetroArmingFromMeaningfulMotion(valid: PoseFeaturesFrame[]): {
  arming: CompletionArmingState;
  completionFrames: PoseFeaturesFrame[];
} | null {
  const peakIdx = findGlobalSquatDepthPeakIndex(valid);
  if (peakIdx == null || peakIdx < 1) return null;

  const peakDepth = readSquatArmingDepth(valid[peakIdx]!);
  if (peakDepth == null || peakDepth < RETRO_ARMING_MIN_PEAK_DEPTH) return null;

  for (let end = peakIdx - 1; end >= RETRO_STABLE_MIN_FRAMES - 1; end--) {
    const start = end - RETRO_STABLE_MIN_FRAMES + 1;
    if (start < 0) break;
    if (!isStableStandingRun(valid, start, RETRO_STABLE_MIN_FRAMES)) continue;

    const completionSliceStartIndex = end + 1;
    if (completionSliceStartIndex > peakIdx) continue;

    const completionFrames = valid.slice(completionSliceStartIndex);
    const baselineDepthsBlended = valid
      .slice(start, end + 1)
      .map(readSquatArmingDepth)
      .filter((d): d is number => d != null);
    const baselineDepthsPrimary = valid
      .slice(start, end + 1)
      .map(readSquatArmingDepthPrimaryOnly)
      .filter((d): d is number => d != null);

    if (baselineDepthsBlended.length < RETRO_STABLE_MIN_FRAMES || completionFrames.length === 0) continue;

    const baseMinBlended = Math.min(...baselineDepthsBlended);
    const baseMinPrimary =
      baselineDepthsPrimary.length > 0 ? Math.min(...baselineDepthsPrimary) : baseMinBlended;
    const baseMax = Math.max(...baselineDepthsBlended);
    const completionDepths = completionFrames.map(readSquatArmingDepth).filter((d): d is number => d != null);
    if (completionDepths.length === 0) continue;

    const completionMax = Math.max(...completionDepths);
    if (completionMax - baseMinBlended < RETRO_ARMING_MIN_EXCURSION_FROM_BASE) continue;

    return {
      arming: {
        armed: true,
        baselineCaptured: completionFrames.length >= MIN_FRAMES_FOR_BASELINE_CAPTURE,
        stableFrames: RETRO_STABLE_MIN_FRAMES,
        completionSliceStartIndex,
        armingFallbackUsed: true,
        armingRetroApplied: true,
        armingStandingWindowRange: Math.round((baseMax - baseMinBlended) * 1000) / 1000,
        armingBaselineStandingDepthPrimary: Math.round(baseMinPrimary * 1000) / 1000,
        armingBaselineStandingDepthBlended: Math.round(baseMinBlended * 1000) / 1000,
      },
      completionFrames,
    };
  }

  return null;
}

/**
 * 첫 번째로 나타나는 "연속 서 있기 안정" 구간 직후부터 completion 평가용 프레임을 자른다.
 * 해당 구간이 없으면 `armed: false`이고 completion 프레임은 빈 배열.
 *
 * PR-CAM-28: **피크 앵커**를 먼저 시도해, 사후 standing tail만 보는 슬라이스를 피한다.
 * PR-CAM-27: 1차 arm 이후 completionFrames에 motion이 없을 경우 4프레임 축소 arm 폴백.
 */
export function computeSquatCompletionArming(valid: PoseFeaturesFrame[]): {
  arming: CompletionArmingState;
  completionFrames: PoseFeaturesFrame[];
} {
  const idle: CompletionArmingState = {
    armed: false,
    baselineCaptured: false,
    stableFrames: 0,
    completionSliceStartIndex: 0,
  };

  const peakAnchored = tryPeakAnchoredArming(valid);
  if (peakAnchored != null) {
    return peakAnchored;
  }

  if (valid.length >= MIN_STABLE_STANDING_FRAMES) {
    for (let i = 0; i <= valid.length - MIN_STABLE_STANDING_FRAMES; i++) {
      if (!isStableStandingRun(valid, i, MIN_STABLE_STANDING_FRAMES)) continue;

      const completionSliceStartIndex = i + MIN_STABLE_STANDING_FRAMES;
      const completionFrames = valid.slice(completionSliceStartIndex);

      const completionDepths = completionFrames
        .map(readSquatArmingDepth)
        .filter((d): d is number => d != null);
      const baselineDepthsBlended = valid
        .slice(i, i + MIN_STABLE_STANDING_FRAMES)
        .map(readSquatArmingDepth)
        .filter((d): d is number => d != null);
      const baselineDepthsPrimary = valid
        .slice(i, i + MIN_STABLE_STANDING_FRAMES)
        .map(readSquatArmingDepthPrimaryOnly)
        .filter((d): d is number => d != null);
      const baseMinBlended = baselineDepthsBlended.length > 0 ? Math.min(...baselineDepthsBlended) : 0;
      const baseMinPrimary =
        baselineDepthsPrimary.length > 0 ? Math.min(...baselineDepthsPrimary) : baseMinBlended;
      const baseMax = baselineDepthsBlended.length > 0 ? Math.max(...baselineDepthsBlended) : 0;
      const completionMax = completionDepths.length > 0 ? Math.max(...completionDepths) : 0;

      if (completionMax - baseMinBlended >= SHALLOW_FALLBACK_EVIDENCE_MIN) {
        return {
          arming: mergeArmingDepthObservability(valid, {
            armed: true,
            baselineCaptured: completionFrames.length >= MIN_FRAMES_FOR_BASELINE_CAPTURE,
            stableFrames: MIN_STABLE_STANDING_FRAMES,
            completionSliceStartIndex,
            armingStandingWindowRange: Math.round((baseMax - baseMinBlended) * 1000) / 1000,
            armingBaselineStandingDepthPrimary: Math.round(baseMinPrimary * 1000) / 1000,
            armingBaselineStandingDepthBlended: Math.round(baseMinBlended * 1000) / 1000,
          }),
          completionFrames,
        };
      }
      break;
    }
  }

  if (valid.length >= SECONDARY_STABLE_MIN_FRAMES + 4) {
    for (let i = 0; i <= valid.length - SECONDARY_STABLE_MIN_FRAMES; i++) {
      if (!isStableStandingRun(valid, i, SECONDARY_STABLE_MIN_FRAMES)) continue;

      const completionSliceStartIndex = i + SECONDARY_STABLE_MIN_FRAMES;
      const completionFrames = valid.slice(completionSliceStartIndex);

      const baselineDepthsBlended = valid
        .slice(i, i + SECONDARY_STABLE_MIN_FRAMES)
        .map(readSquatArmingDepth)
        .filter((d): d is number => d != null);
      const baselineDepthsPrimary = valid
        .slice(i, i + SECONDARY_STABLE_MIN_FRAMES)
        .map(readSquatArmingDepthPrimaryOnly)
        .filter((d): d is number => d != null);
      const motionDepths = completionFrames.map(readSquatArmingDepth).filter((d): d is number => d != null);

      if (baselineDepthsBlended.length < SECONDARY_STABLE_MIN_FRAMES || motionDepths.length === 0) continue;

      const baseMinBlended = Math.min(...baselineDepthsBlended);
      const baseMinPrimary =
        baselineDepthsPrimary.length > 0 ? Math.min(...baselineDepthsPrimary) : baseMinBlended;
      const baseMax = Math.max(...baselineDepthsBlended);
      const motionMax = Math.max(...motionDepths);

      if (motionMax - baseMinBlended < SHALLOW_FALLBACK_EVIDENCE_MIN) continue;

      return {
        arming: mergeArmingDepthObservability(valid, {
          armed: true,
          baselineCaptured: completionFrames.length >= MIN_FRAMES_FOR_BASELINE_CAPTURE,
          stableFrames: SECONDARY_STABLE_MIN_FRAMES,
          completionSliceStartIndex,
          armingFallbackUsed: true,
          armingStandingWindowRange: Math.round((baseMax - baseMinBlended) * 1000) / 1000,
          armingBaselineStandingDepthPrimary: Math.round(baseMinPrimary * 1000) / 1000,
          armingBaselineStandingDepthBlended: Math.round(baseMinBlended * 1000) / 1000,
        }),
        completionFrames,
      };
    }
  }

  const retro = tryRetroArmingFromMeaningfulMotion(valid);
  if (retro != null) {
    return {
      arming: mergeArmingDepthObservability(valid, retro.arming),
      completionFrames: retro.completionFrames,
    };
  }

  return { arming: mergeArmingDepthObservability(valid, idle), completionFrames: [] };
}
