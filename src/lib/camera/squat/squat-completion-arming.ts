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
};

/** pose-features `start` 밴드와 정렬 (약간 여유로 초기 캘리브레이션 허용) */
const STANDING_DEPTH_MAX = 0.085;
/** 인접 프레임 깊이 변화가 이 값 이하여야 "서 있기 안정"으로 친다 */
const STABLE_ADJACENT_DELTA_MAX = 0.018;
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

function readSquatDepth(frame: PoseFeaturesFrame): number | null {
  const d = frame.derived.squatDepthProxy;
  return typeof d === 'number' && Number.isFinite(d) ? d : null;
}

function isStableStandingRun(frames: PoseFeaturesFrame[], start: number, len: number): boolean {
  for (let k = 0; k < len; k++) {
    const d = readSquatDepth(frames[start + k]!);
    if (d == null || d >= STANDING_DEPTH_MAX) return false;
    if (k > 0) {
      const prev = readSquatDepth(frames[start + k - 1]!);
      if (prev == null || Math.abs(d - prev) > STABLE_ADJACENT_DELTA_MAX) return false;
    }
  }
  return true;
}

/** valid 내 첫 번째 전역 최대 squatDepthProxy 인덱스 (동률 시 앞쪽) */
function findGlobalSquatDepthPeakIndex(valid: PoseFeaturesFrame[]): number | null {
  let bestIdx: number | null = null;
  let bestD = -Infinity;
  for (let i = 0; i < valid.length; i++) {
    const d = readSquatDepth(valid[i]!);
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

  const peakDepth = readSquatDepth(valid[peakIdx]!);
  if (peakDepth == null) return null;

  const stableLens = [MIN_STABLE_STANDING_FRAMES, SECONDARY_STABLE_MIN_FRAMES] as const;

  for (const stableLen of stableLens) {
    for (let end = peakIdx - 1; end >= stableLen - 1; end--) {
      const start = end - stableLen + 1;
      if (!isStableStandingRun(valid, start, stableLen)) continue;

      const completionSliceStartIndex = end + 1;
      if (completionSliceStartIndex > peakIdx) continue;

      const completionFrames = valid.slice(completionSliceStartIndex);
      const baselineDepths = valid
        .slice(start, end + 1)
        .map(readSquatDepth)
        .filter((d): d is number => d != null);
      const completionDepths = completionFrames.map(readSquatDepth).filter((d): d is number => d != null);

      if (baselineDepths.length < stableLen || completionDepths.length === 0) continue;

      const baseMin = Math.min(...baselineDepths);
      const completionMax = Math.max(...completionDepths);

      if (completionMax - baseMin < SHALLOW_FALLBACK_EVIDENCE_MIN) continue;

      // 피크가 슬라이스 안에 있고, 슬라이스 최댓값이 전역 피크와 일치(부동 소수 허용)
      if (peakIdx >= completionSliceStartIndex && completionMax + 1e-9 >= peakDepth) {
        return {
          arming: {
            armed: true,
            baselineCaptured: completionFrames.length >= MIN_FRAMES_FOR_BASELINE_CAPTURE,
            stableFrames: stableLen,
            completionSliceStartIndex,
            armingPeakAnchored: true,
          },
          completionFrames,
        };
      }
    }
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
        .map(readSquatDepth)
        .filter((d): d is number => d != null);
      const baselineDepths = valid
        .slice(i, i + MIN_STABLE_STANDING_FRAMES)
        .map(readSquatDepth)
        .filter((d): d is number => d != null);
      const baseMin = baselineDepths.length > 0 ? Math.min(...baselineDepths) : 0;
      const completionMax = completionDepths.length > 0 ? Math.max(...completionDepths) : 0;

      if (completionMax - baseMin >= SHALLOW_FALLBACK_EVIDENCE_MIN) {
        return {
          arming: {
            armed: true,
            baselineCaptured: completionFrames.length >= MIN_FRAMES_FOR_BASELINE_CAPTURE,
            stableFrames: MIN_STABLE_STANDING_FRAMES,
            completionSliceStartIndex,
          },
          completionFrames,
        };
      }
      break;
    }
  }

  if (valid.length < SECONDARY_STABLE_MIN_FRAMES + 4) {
    return { arming: idle, completionFrames: [] };
  }

  for (let i = 0; i <= valid.length - SECONDARY_STABLE_MIN_FRAMES; i++) {
    if (!isStableStandingRun(valid, i, SECONDARY_STABLE_MIN_FRAMES)) continue;

    const completionSliceStartIndex = i + SECONDARY_STABLE_MIN_FRAMES;
    const completionFrames = valid.slice(completionSliceStartIndex);

    const baselineDepths = valid
      .slice(i, i + SECONDARY_STABLE_MIN_FRAMES)
      .map(readSquatDepth)
      .filter((d): d is number => d != null);
    const motionDepths = completionFrames.map(readSquatDepth).filter((d): d is number => d != null);

    if (baselineDepths.length < SECONDARY_STABLE_MIN_FRAMES || motionDepths.length === 0) continue;

    const baseMin = Math.min(...baselineDepths);
    const motionMax = Math.max(...motionDepths);

    if (motionMax - baseMin < SHALLOW_FALLBACK_EVIDENCE_MIN) continue;

    return {
      arming: {
        armed: true,
        baselineCaptured: completionFrames.length >= MIN_FRAMES_FOR_BASELINE_CAPTURE,
        stableFrames: SECONDARY_STABLE_MIN_FRAMES,
        completionSliceStartIndex,
        armingFallbackUsed: true,
      },
      completionFrames,
    };
  }

  return { arming: idle, completionFrames: [] };
}
