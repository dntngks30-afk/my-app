/**
 * PR-HOTFIX-02 — 스쿼트 completion **평가 시작 시점**만 제한한다.
 *
 * - `evaluateSquatCompletionState` 내부 규칙·임계값은 변경하지 않는다.
 * - 서 있기 안정 구간이 쌓인 뒤에만 completion용 프레임 슬라이스를 넘긴다.
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
};

/** pose-features `start` 밴드와 정렬 (약간 여유로 초기 캘리브레이션 허용) */
const STANDING_DEPTH_MAX = 0.085;
/** 인접 프레임 깊이 변화가 이 값 이하여야 “서 있기 안정”으로 친다 */
const STABLE_ADJACENT_DELTA_MAX = 0.018;
/** 연속 안정 서 있기 프레임 수 — 짧은 지터만으로 descent가 열리지 않게 */
const MIN_STABLE_STANDING_FRAMES = 10;
/** squat-completion-state baseline 윈도우와 정합(슬라이스만 넘기므로 최소 길이 힌트) */
const MIN_FRAMES_FOR_BASELINE_CAPTURE = 6;

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

/**
 * 첫 번째로 나타나는 “연속 서 있기 안정” 구간 직후부터 completion 평가용 프레임을 자른다.
 * 해당 구간이 없으면 `armed: false`이고 completion 프레임은 빈 배열.
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

  if (valid.length < MIN_STABLE_STANDING_FRAMES) {
    return { arming: idle, completionFrames: [] };
  }

  for (let i = 0; i <= valid.length - MIN_STABLE_STANDING_FRAMES; i++) {
    if (!isStableStandingRun(valid, i, MIN_STABLE_STANDING_FRAMES)) continue;

    const completionSliceStartIndex = i + MIN_STABLE_STANDING_FRAMES;
    const completionFrames = valid.slice(completionSliceStartIndex);

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

  return { arming: idle, completionFrames: [] };
}
