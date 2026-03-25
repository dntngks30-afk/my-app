/**
 * PR-CAM-11A — 오버헤드 리치 top-hold 폴백 (jitter 허용 경로)
 *
 * 목적: 실기기 MediaPipe landmark jitter(2–4°/frame)로 인해 strict stable-top
 *      dwell 누적이 실패할 때도 "진짜 top-zone 지속 홀드"를 인정한다.
 *
 * 핵심 차이:
 *   strict : |delta| < 1.5° 연속 settle + arming 필요  → jitter에 취약
 *   fallback: top-zone(e >= floor) 프레임만 수집, 연속 스팬 측정  → delta 제약 없음
 *
 * 안전 장치 (strict와 동일):
 *   - raise/peak prerequisite
 *   - 절대 elevation floor (132°) 동일 적용
 *   - 비대칭 한도 동일 적용
 *   - 최소 프레임 수 요건 (brief 터치 방지)
 *   - 최소 지속 시간 요건 (≥ OVERHEAD_REQUIRED_HOLD_MS)
 */

import {
  OVERHEAD_TOP_FLOOR_DEG,
  OVERHEAD_REQUIRED_HOLD_MS,
  OVERHEAD_MIN_PEAK_FRAMES,
  OVERHEAD_COMPLETION_MAX_MEAN_ASYM_DEG,
  OVERHEAD_COMPLETION_MAX_PEAK_ASYM_DEG,
} from './overhead-constants';

/** 폴백 top-zone run에서 허용되는 최대 프레임 간 gap (ms) — brief dip below floor 허용 */
export const OVERHEAD_FALLBACK_TOP_ZONE_GAP_TOLERANCE_MS = 200;

/** 폴백: 연속 top-zone run의 최소 절대 프레임 수 (brief touch 방지) */
export const OVERHEAD_FALLBACK_TOP_ZONE_MIN_FRAMES = 10;

export interface OverheadTopHoldFallbackInput {
  /** e >= floor 인 valid 프레임들의 타임스탬프 리스트 (오름차순) */
  topZoneFrames: ReadonlyArray<{ readonly timestampMs: number }>;
  raiseCount: number;
  peakCount: number;
  /** 피크 arm elevation (deg) — elevation floor 확인용 */
  effectiveArmDeg: number;
  meanAsymmetryDeg: number | null;
  maxAsymmetryDeg: number | null;
}

export interface OverheadTopHoldFallbackResult {
  /** 필수 조건(elevation, raise/peak, 비대칭)을 모두 충족 — 폴백 심사 대상 */
  fallbackEligible: boolean;
  /** 폴백 경로로 completion 인정 가능 */
  fallbackSatisfied: boolean;
  /** 최장 연속 top-zone run의 스팬 (ms) */
  bestTopRunMs: number;
  /** 최장 연속 top-zone run의 프레임 수 */
  bestTopRunFrameCount: number;
  /** 통과 불가 이유 (fallbackSatisfied == false 시에만 의미 있음) */
  fallbackBlockedReason: string | null;
}

/**
 * top-zone 내 최장 연속 run을 찾아 폴백 hold 조건을 평가한다.
 *
 * 알고리즘:
 *  1. topZoneFrames에서 연속 프레임 간 gap > GAP_TOLERANCE 이면 run 분리
 *  2. 각 run의 타임스탬프 스팬(last - first)을 계산
 *  3. 최장 run 스팬 >= OVERHEAD_REQUIRED_HOLD_MS 이고 프레임 수 >= MIN_FRAMES → 만족
 */
export function computeOverheadTopHoldFallback(
  input: OverheadTopHoldFallbackInput
): OverheadTopHoldFallbackResult {
  const {
    topZoneFrames,
    raiseCount,
    peakCount,
    effectiveArmDeg,
    meanAsymmetryDeg,
    maxAsymmetryDeg,
  } = input;

  // ── prerequisite 1: raise/peak 확인 (weak raise 차단) ──
  if (raiseCount === 0 || peakCount < OVERHEAD_MIN_PEAK_FRAMES) {
    return {
      fallbackEligible: false,
      fallbackSatisfied: false,
      bestTopRunMs: 0,
      bestTopRunFrameCount: 0,
      fallbackBlockedReason: 'raise_peak_incomplete',
    };
  }

  // ── prerequisite 2: 절대 elevation floor (132°) — below-floor 차단 ──
  if (effectiveArmDeg < OVERHEAD_TOP_FLOOR_DEG) {
    return {
      fallbackEligible: false,
      fallbackSatisfied: false,
      bestTopRunMs: 0,
      bestTopRunFrameCount: 0,
      fallbackBlockedReason: 'insufficient_elevation',
    };
  }

  // ── prerequisite 3: 비대칭 한도 (strict와 동일) ──
  if (
    (maxAsymmetryDeg != null && maxAsymmetryDeg > OVERHEAD_COMPLETION_MAX_PEAK_ASYM_DEG) ||
    (meanAsymmetryDeg != null && meanAsymmetryDeg > OVERHEAD_COMPLETION_MAX_MEAN_ASYM_DEG)
  ) {
    return {
      fallbackEligible: false,
      fallbackSatisfied: false,
      bestTopRunMs: 0,
      bestTopRunFrameCount: 0,
      fallbackBlockedReason: 'asymmetry_unacceptable',
    };
  }

  // ── top-zone 프레임 없음 ──
  if (topZoneFrames.length === 0) {
    return {
      fallbackEligible: true,
      fallbackSatisfied: false,
      bestTopRunMs: 0,
      bestTopRunFrameCount: 0,
      fallbackBlockedReason: 'no_top_zone_frames',
    };
  }

  // ── 최장 연속 top-zone run 탐색 ──
  let bestRunMs = 0;
  let bestRunFrameCount = 0;

  let runStartMs = topZoneFrames[0]!.timestampMs;
  let runEndMs = topZoneFrames[0]!.timestampMs;
  let runFrames = 1;

  for (let i = 1; i < topZoneFrames.length; i++) {
    const gap = topZoneFrames[i]!.timestampMs - topZoneFrames[i - 1]!.timestampMs;
    if (gap <= OVERHEAD_FALLBACK_TOP_ZONE_GAP_TOLERANCE_MS) {
      // run 연속
      runEndMs = topZoneFrames[i]!.timestampMs;
      runFrames += 1;
    } else {
      // run 끊김 — 현재 run 기록
      const runMs = runEndMs - runStartMs;
      if (runMs > bestRunMs || (runMs === bestRunMs && runFrames > bestRunFrameCount)) {
        bestRunMs = runMs;
        bestRunFrameCount = runFrames;
      }
      runStartMs = topZoneFrames[i]!.timestampMs;
      runEndMs = topZoneFrames[i]!.timestampMs;
      runFrames = 1;
    }
  }
  // 마지막 run 처리
  const lastRunMs = runEndMs - runStartMs;
  if (lastRunMs > bestRunMs || (lastRunMs === bestRunMs && runFrames > bestRunFrameCount)) {
    bestRunMs = lastRunMs;
    bestRunFrameCount = runFrames;
  }

  // ── hold 조건 평가 ──
  if (bestRunMs < OVERHEAD_REQUIRED_HOLD_MS) {
    return {
      fallbackEligible: true,
      fallbackSatisfied: false,
      bestTopRunMs: bestRunMs,
      bestTopRunFrameCount: bestRunFrameCount,
      fallbackBlockedReason: 'top_zone_hold_short',
    };
  }

  if (bestRunFrameCount < OVERHEAD_FALLBACK_TOP_ZONE_MIN_FRAMES) {
    return {
      fallbackEligible: true,
      fallbackSatisfied: false,
      bestTopRunMs: bestRunMs,
      bestTopRunFrameCount: bestRunFrameCount,
      fallbackBlockedReason: 'top_zone_frames_too_few',
    };
  }

  return {
    fallbackEligible: true,
    fallbackSatisfied: true,
    bestTopRunMs: bestRunMs,
    bestTopRunFrameCount: bestRunFrameCount,
    fallbackBlockedReason: null,
  };
}
