/**
 * PR-CAM-11B — 오버헤드 **진행(completion) 게이트** 완화 경로
 *
 * - strict / 11A fallback 은 `evaluateOverheadCompletionState` + dwell 그대로 (해석·플래닝용).
 * - 본 모듈은 "팔을 귀/머리 위 근처까지 올리고 잠깐만 멈춤"이면 진행 통과 허용.
 * - 비대칭·약한 들기·프레이밍 invalid 는 여기서도 차단하지 않음 (evaluator 입력 전제).
 */

import {
  OVERHEAD_EASY_ELEVATION_FLOOR_DEG,
  OVERHEAD_EASY_REQUIRED_HOLD_MS,
  OVERHEAD_EASY_MIN_PEAK_FRAMES,
  OVERHEAD_EASY_TOP_ZONE_MIN_FRAMES,
  OVERHEAD_EASY_TOP_ZONE_GAP_TOLERANCE_MS,
  OVERHEAD_COMPLETION_MAX_MEAN_ASYM_DEG,
  OVERHEAD_COMPLETION_MAX_PEAK_ASYM_DEG,
} from './overhead-constants';

export interface OverheadEasyProgressionInput {
  easyTopZoneFrames: ReadonlyArray<{ readonly timestampMs: number }>;
  raiseCount: number;
  /**
   * easy top-zone(e >= easy floor) 내 유효 프레임 수.
   * PR-CAM-12: strict phaseHint==='peak'(132°+저지터) 비의존 —
   * evaluator에서 easyTopZoneFrames.length로 공급된다.
   */
  peakCountAtEasyFloor: number;
  effectiveArmDeg: number;
  meanAsymmetryDeg: number | null;
  maxAsymmetryDeg: number | null;
}

export interface OverheadEasyProgressionResult {
  easyCompletionSatisfied: boolean;
  easyCompletionBlockedReason: string | null;
  easyBestRunMs: number;
  easyBestRunFrameCount: number;
}

function asymmetryFails(mean: number | null, peak: number | null): boolean {
  if (peak != null && peak > OVERHEAD_COMPLETION_MAX_PEAK_ASYM_DEG) return true;
  if (mean != null && mean > OVERHEAD_COMPLETION_MAX_MEAN_ASYM_DEG) return true;
  return false;
}

/**
 * easy top-zone 연속 run 스팬으로 짧은 홀드 판정 (fallback과 동일 알고리즘, 상수만 완화).
 */
export function computeOverheadEasyProgressionHold(
  input: OverheadEasyProgressionInput
): OverheadEasyProgressionResult {
  const {
    easyTopZoneFrames,
    raiseCount,
    peakCountAtEasyFloor,
    effectiveArmDeg,
    meanAsymmetryDeg,
    maxAsymmetryDeg,
  } = input;

  if (raiseCount === 0 || peakCountAtEasyFloor < OVERHEAD_EASY_MIN_PEAK_FRAMES) {
    return {
      easyCompletionSatisfied: false,
      easyCompletionBlockedReason: 'raise_peak_incomplete',
      easyBestRunMs: 0,
      easyBestRunFrameCount: 0,
    };
  }

  if (effectiveArmDeg < OVERHEAD_EASY_ELEVATION_FLOOR_DEG) {
    return {
      easyCompletionSatisfied: false,
      easyCompletionBlockedReason: 'insufficient_elevation',
      easyBestRunMs: 0,
      easyBestRunFrameCount: 0,
    };
  }

  if (asymmetryFails(meanAsymmetryDeg, maxAsymmetryDeg)) {
    return {
      easyCompletionSatisfied: false,
      easyCompletionBlockedReason: 'asymmetry_unacceptable',
      easyBestRunMs: 0,
      easyBestRunFrameCount: 0,
    };
  }

  if (easyTopZoneFrames.length === 0) {
    return {
      easyCompletionSatisfied: false,
      easyCompletionBlockedReason: 'no_easy_top_zone_frames',
      easyBestRunMs: 0,
      easyBestRunFrameCount: 0,
    };
  }

  let bestRunMs = 0;
  let bestRunFrameCount = 0;
  let runStartMs = easyTopZoneFrames[0]!.timestampMs;
  let runEndMs = easyTopZoneFrames[0]!.timestampMs;
  let runFrames = 1;

  for (let i = 1; i < easyTopZoneFrames.length; i++) {
    const gap =
      easyTopZoneFrames[i]!.timestampMs - easyTopZoneFrames[i - 1]!.timestampMs;
    if (gap <= OVERHEAD_EASY_TOP_ZONE_GAP_TOLERANCE_MS) {
      runEndMs = easyTopZoneFrames[i]!.timestampMs;
      runFrames += 1;
    } else {
      const runMs = runEndMs - runStartMs;
      if (runMs > bestRunMs || (runMs === bestRunMs && runFrames > bestRunFrameCount)) {
        bestRunMs = runMs;
        bestRunFrameCount = runFrames;
      }
      runStartMs = easyTopZoneFrames[i]!.timestampMs;
      runEndMs = easyTopZoneFrames[i]!.timestampMs;
      runFrames = 1;
    }
  }
  const lastRunMs = runEndMs - runStartMs;
  if (lastRunMs > bestRunMs || (lastRunMs === bestRunMs && runFrames > bestRunFrameCount)) {
    bestRunMs = lastRunMs;
    bestRunFrameCount = runFrames;
  }

  if (bestRunMs < OVERHEAD_EASY_REQUIRED_HOLD_MS) {
    return {
      easyCompletionSatisfied: false,
      easyCompletionBlockedReason: 'easy_hold_short',
      easyBestRunMs: bestRunMs,
      easyBestRunFrameCount: bestRunFrameCount,
    };
  }

  if (bestRunFrameCount < OVERHEAD_EASY_TOP_ZONE_MIN_FRAMES) {
    return {
      easyCompletionSatisfied: false,
      easyCompletionBlockedReason: 'easy_top_frames_too_few',
      easyBestRunMs: bestRunMs,
      easyBestRunFrameCount: bestRunFrameCount,
    };
  }

  return {
    easyCompletionSatisfied: true,
    easyCompletionBlockedReason: null,
    easyBestRunMs: bestRunMs,
    easyBestRunFrameCount: bestRunFrameCount,
  };
}
