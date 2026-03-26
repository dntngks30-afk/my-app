/**
 * PR-CAM-11B — 오버헤드 **진행(completion) 게이트** 완화 경로
 *
 * - strict / 11A fallback 은 `evaluateOverheadCompletionState` + dwell 그대로 (해석·플래닝용).
 * - 본 모듈은 "팔을 귀/머리 위 근처까지 올리고 잠깐만 멈춤"이면 진행 통과 허용.
 * - 비대칭·약한 들기·프레이밍 invalid 는 여기서도 차단하지 않음 (evaluator 입력 전제).
 *
 * PR-CAM-15 — low-ROM 진행 경로(제한적 ROM 사용자용) 추가.
 * - 귀 높이(126°)에 미치지 못하는 사용자도 개인 baseline 대비 실질적 거상 노력 + 짧은 안정이면 통과.
 *
 * PR-CAM-16 — humane low-ROM 진행 경로 (더 낮은 절대 하한 + lower-envelope baseline).
 * - 어깨 ROM이 매우 제한된 사용자(어깨 손상·고령)도 진짜 거상 의도 + 짧은 안정이면 통과.
 * - 판단·플래닝·internal quality 기준은 변경하지 않는다.
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

// ============================================================================
// PR-CAM-15: Low-ROM 진행 경로 (제한적 ROM 사용자용)
// ============================================================================

/**
 * 절대 하한선 — easy floor 126° 미만.
 * 어깨 쉬러그(≈ 60-90°)·하프레이즈 노이즈를 제거하면서 제한적 ROM 사용자에게 접근성 제공.
 * evaluator·guardrails.ts 에서 공유하기 위해 export.
 */
export const OVERHEAD_LOW_ROM_ABSOLUTE_FLOOR_DEG = 110;

/** 개인 baseline 대비 최소 거상 개선량 — 20° 미만은 노이즈·미세 흔들림으로 간주. */
const LOW_ROM_REQUIRED_DELTA_FROM_BASELINE_DEG = 20;
/** 최소 안정 홀드 — 350ms ≈ 5 프레임@70ms. 순간 스윙-스루 차단. */
const LOW_ROM_REQUIRED_HOLD_MS = 350;
/** low-ROM zone 진입 최소 프레임 수 (피크 카운트 기준). */
const LOW_ROM_MIN_PEAK_FRAMES = 3;
/** run 사이 간격 허용 (easy와 동일). */
const LOW_ROM_GAP_TOLERANCE_MS = 200;
/** 연속 run 최소 프레임 수 (단발성 스파이크 차단). */
const LOW_ROM_MIN_RUN_FRAMES = 3;
/** 비대칭 최대 허용 — easy(22°)보다 약간 완화. 편측 불가 사용자 배려. */
const LOW_ROM_MAX_MEAN_ASYM_DEG = 26;
/** 비대칭 피크 최대 허용 — easy(36°)보다 약간 완화. */
const LOW_ROM_MAX_PEAK_ASYM_DEG = 40;

export interface OverheadLowRomProgressionInput {
  /** armElevationAvg >= OVERHEAD_LOW_ROM_ABSOLUTE_FLOOR_DEG 인 유효 프레임 */
  lowRomZoneFrames: ReadonlyArray<{ readonly timestampMs: number }>;
  raiseCount: number;
  /** lowRomZoneFrames.length (evaluator에서 공급). */
  peakCountAtLowRomFloor: number;
  /** 세션 내 최대 팔 거상 각도. */
  effectiveArmDeg: number;
  /**
   * 개인 시작 포지션 추정치 — evaluator 초기 N프레임 평균.
   * 팔을 내린 상태에서 시작하면 자연스럽게 낮은 값이 된다.
   */
  baselineArmDeg: number;
  meanAsymmetryDeg: number | null;
  maxAsymmetryDeg: number | null;
}

export interface OverheadLowRomProgressionResult {
  lowRomProgressionSatisfied: boolean;
  lowRomBlockedReason: string | null;
  lowRomBestRunMs: number;
  lowRomBestRunFrameCount: number;
  lowRomElevationDeltaFromBaseline: number;
  /** effectiveArmDeg 그대로 (trace용). */
  lowRomBestElevation: number;
}

function lowRomAsymmetryFails(meanDeg: number | null, peakDeg: number | null): boolean {
  if (peakDeg != null && peakDeg > LOW_ROM_MAX_PEAK_ASYM_DEG) return true;
  if (meanDeg != null && meanDeg > LOW_ROM_MAX_MEAN_ASYM_DEG) return true;
  return false;
}

/**
 * PR-CAM-15: 제한적 ROM 사용자 전용 진행 완화 경로.
 *
 * easy path(126°)에 도달하지 못하는 사용자가 아래 조건을 모두 충족하면 진행 통과:
 *   1) raiseCount > 0 + low-ROM zone 최소 3프레임  (실질적 들기 동작 확인)
 *   2) effectiveArmDeg >= 110°                     (절대 하한 — 쉬러그·노이즈 제거)
 *   3) delta from baseline >= 20°                  (개인 시작점 대비 실질적 개선)
 *   4) 연속 run >= 350ms + 최소 3프레임             (순간 스윙-스루 차단)
 *
 * 판단·플래닝·internal quality 는 변경하지 않는다 (strict 기준 별도 유지).
 */
export function computeOverheadLowRomProgression(
  input: OverheadLowRomProgressionInput
): OverheadLowRomProgressionResult {
  const {
    lowRomZoneFrames,
    raiseCount,
    peakCountAtLowRomFloor,
    effectiveArmDeg,
    baselineArmDeg,
    meanAsymmetryDeg,
    maxAsymmetryDeg,
  } = input;

  const elevationDelta = effectiveArmDeg - baselineArmDeg;

  // 1. 들기 동작 확인 (raiseCount 및 최소 프레임)
  if (raiseCount === 0 || peakCountAtLowRomFloor < LOW_ROM_MIN_PEAK_FRAMES) {
    return {
      lowRomProgressionSatisfied: false,
      lowRomBlockedReason: 'low_rom_raise_incomplete',
      lowRomBestRunMs: 0,
      lowRomBestRunFrameCount: 0,
      lowRomElevationDeltaFromBaseline: elevationDelta,
      lowRomBestElevation: effectiveArmDeg,
    };
  }

  // 2. 절대 하한 확인
  if (effectiveArmDeg < OVERHEAD_LOW_ROM_ABSOLUTE_FLOOR_DEG) {
    return {
      lowRomProgressionSatisfied: false,
      lowRomBlockedReason: 'low_rom_insufficient_elevation',
      lowRomBestRunMs: 0,
      lowRomBestRunFrameCount: 0,
      lowRomElevationDeltaFromBaseline: elevationDelta,
      lowRomBestElevation: effectiveArmDeg,
    };
  }

  // 3. 개인 baseline 대비 실질적 개선 확인
  if (elevationDelta < LOW_ROM_REQUIRED_DELTA_FROM_BASELINE_DEG) {
    return {
      lowRomProgressionSatisfied: false,
      lowRomBlockedReason: 'low_rom_insufficient_delta',
      lowRomBestRunMs: 0,
      lowRomBestRunFrameCount: 0,
      lowRomElevationDeltaFromBaseline: elevationDelta,
      lowRomBestElevation: effectiveArmDeg,
    };
  }

  // 4. 비대칭 확인 (완화된 임계)
  if (lowRomAsymmetryFails(meanAsymmetryDeg, maxAsymmetryDeg)) {
    return {
      lowRomProgressionSatisfied: false,
      lowRomBlockedReason: 'asymmetry_unacceptable',
      lowRomBestRunMs: 0,
      lowRomBestRunFrameCount: 0,
      lowRomElevationDeltaFromBaseline: elevationDelta,
      lowRomBestElevation: effectiveArmDeg,
    };
  }

  if (lowRomZoneFrames.length === 0) {
    return {
      lowRomProgressionSatisfied: false,
      lowRomBlockedReason: 'low_rom_no_zone_frames',
      lowRomBestRunMs: 0,
      lowRomBestRunFrameCount: 0,
      lowRomElevationDeltaFromBaseline: elevationDelta,
      lowRomBestElevation: effectiveArmDeg,
    };
  }

  // 5. 연속 run 계산 (easy와 동일 알고리즘, 완화된 상수)
  let bestRunMs = 0;
  let bestRunFrameCount = 0;
  let runStartMs = lowRomZoneFrames[0]!.timestampMs;
  let runEndMs = lowRomZoneFrames[0]!.timestampMs;
  let runFrames = 1;

  for (let i = 1; i < lowRomZoneFrames.length; i++) {
    const gap = lowRomZoneFrames[i]!.timestampMs - lowRomZoneFrames[i - 1]!.timestampMs;
    if (gap <= LOW_ROM_GAP_TOLERANCE_MS) {
      runEndMs = lowRomZoneFrames[i]!.timestampMs;
      runFrames += 1;
    } else {
      const runMs = runEndMs - runStartMs;
      if (runMs > bestRunMs || (runMs === bestRunMs && runFrames > bestRunFrameCount)) {
        bestRunMs = runMs;
        bestRunFrameCount = runFrames;
      }
      runStartMs = lowRomZoneFrames[i]!.timestampMs;
      runEndMs = lowRomZoneFrames[i]!.timestampMs;
      runFrames = 1;
    }
  }
  const lastRunMs = runEndMs - runStartMs;
  if (lastRunMs > bestRunMs || (lastRunMs === bestRunMs && runFrames > bestRunFrameCount)) {
    bestRunMs = lastRunMs;
    bestRunFrameCount = runFrames;
  }

  if (bestRunMs < LOW_ROM_REQUIRED_HOLD_MS) {
    return {
      lowRomProgressionSatisfied: false,
      lowRomBlockedReason: 'low_rom_hold_short',
      lowRomBestRunMs: bestRunMs,
      lowRomBestRunFrameCount: bestRunFrameCount,
      lowRomElevationDeltaFromBaseline: elevationDelta,
      lowRomBestElevation: effectiveArmDeg,
    };
  }

  if (bestRunFrameCount < LOW_ROM_MIN_RUN_FRAMES) {
    return {
      lowRomProgressionSatisfied: false,
      lowRomBlockedReason: 'low_rom_frames_too_few',
      lowRomBestRunMs: bestRunMs,
      lowRomBestRunFrameCount: bestRunFrameCount,
      lowRomElevationDeltaFromBaseline: elevationDelta,
      lowRomBestElevation: effectiveArmDeg,
    };
  }

  return {
    lowRomProgressionSatisfied: true,
    lowRomBlockedReason: null,
    lowRomBestRunMs: bestRunMs,
    lowRomBestRunFrameCount: bestRunFrameCount,
    lowRomElevationDeltaFromBaseline: elevationDelta,
    lowRomBestElevation: effectiveArmDeg,
  };
}

// ============================================================================
// PR-CAM-16: Humane Low-ROM 진행 경로 (very limited ROM tolerant)
// ============================================================================

/**
 * 절대 하한선 — low-ROM floor 110° 미만.
 * 어깨 가동성이 매우 제한된 사용자(고령·부상)도 100° 이상 올리면 진짜 거상 의도로 인정.
 * 쉬러그(≈ 60-90°)는 여전히 차단. evaluator·guardrails.ts 에서 공유하기 위해 export.
 */
export const OVERHEAD_HUMANE_ABSOLUTE_FLOOR_DEG = 100;

/** 개인 baseline 대비 최소 거상 개선량 — 15°. 10° 미만은 측정 노이즈·자세 흔들림 수준. */
const HUMANE_REQUIRED_DELTA_DEG = 15;
/**
 * 최소 안정 홀드 — 200ms. 순간 스윙-스루(< 100ms)와 의도적 안정(> 150ms)을 구분.
 * at 70ms cadence: 4프레임 span = 3×70=210ms ≥ 200ms → 통과.
 */
const HUMANE_REQUIRED_HOLD_MS = 200;
/** humane zone 진입 최소 프레임 수. */
const HUMANE_MIN_PEAK_FRAMES = 2;
/** run 사이 간격 허용 (다른 경로와 동일). */
const HUMANE_GAP_TOLERANCE_MS = 200;
/** 연속 run 최소 프레임 수 (단발 스파이크 차단). */
const HUMANE_MIN_RUN_FRAMES = 2;
/** 비대칭 허용 — 가장 완화된 임계; 아주 심한 편측성만 차단. */
const HUMANE_MAX_MEAN_ASYM_DEG = 28;
const HUMANE_MAX_PEAK_ASYM_DEG = 44;

export interface OverheadHumaneLowRomProgressionInput {
  /** armElevationAvg >= OVERHEAD_HUMANE_ABSOLUTE_FLOOR_DEG 인 유효 프레임. */
  humaneZoneFrames: ReadonlyArray<{ readonly timestampMs: number }>;
  raiseCount: number;
  /** humaneZoneFrames.length (evaluator에서 공급). */
  peakCountAtHumaneFloor: number;
  /** 세션 내 최대 팔 거상 각도. */
  effectiveArmDeg: number;
  /**
   * Lower-envelope baseline — 초기 N프레임의 최솟값.
   * 평균(mean)보다 강건: 사용자가 이미 팔을 약간 올린 상태로 시작해도
   * 가장 낮은 초기 포지션을 baseline으로 사용해 delta 계산이 관대해진다.
   */
  humaneBaselineArmDeg: number;
  meanAsymmetryDeg: number | null;
  maxAsymmetryDeg: number | null;
}

export interface OverheadHumaneLowRomProgressionResult {
  humaneLowRomProgressionSatisfied: boolean;
  humaneLowRomBlockedReason: string | null;
  humaneLowRomBestRunMs: number;
  humaneLowRomBestRunFrameCount: number;
  humaneLowRomPeakElevation: number;
  humaneLowRomBaselineElevation: number;
  humaneLowRomElevationDeltaFromBaseline: number;
}

function humaneAsymmetryFails(meanDeg: number | null, peakDeg: number | null): boolean {
  if (peakDeg != null && peakDeg > HUMANE_MAX_PEAK_ASYM_DEG) return true;
  if (meanDeg != null && meanDeg > HUMANE_MAX_MEAN_ASYM_DEG) return true;
  return false;
}

/**
 * PR-CAM-16: 매우 제한적 ROM 사용자 전용 진행 경로 (humane low-ROM).
 *
 * easy(126°)·low-ROM(110°)보다 더 낮은 하한(100°)으로,
 * 개인 baseline 대비 15° 이상 거상 + 200ms 이상 안정이면 통과.
 *
 * 복합 anti-noise 조건:
 *   1) raiseCount > 0 + 최소 2프레임 zone 진입  — 실질적 들기 동작
 *   2) effectiveArmDeg >= 100°                  — 쉬러그(90°이하)·측면 흔들림 차단
 *   3) delta from lower-envelope baseline >= 15° — 시작 포지션 대비 실질적 개선
 *   4) 연속 run >= 200ms + 최소 2프레임          — 순간 스윙-스루 차단
 *
 * 판단·플래닝·internal quality 는 변경하지 않음.
 */
export function computeOverheadHumaneLowRomProgression(
  input: OverheadHumaneLowRomProgressionInput
): OverheadHumaneLowRomProgressionResult {
  const {
    humaneZoneFrames,
    raiseCount,
    peakCountAtHumaneFloor,
    effectiveArmDeg,
    humaneBaselineArmDeg,
    meanAsymmetryDeg,
    maxAsymmetryDeg,
  } = input;

  const elevationDelta = effectiveArmDeg - humaneBaselineArmDeg;

  // 1. 들기 동작 확인
  if (raiseCount === 0 || peakCountAtHumaneFloor < HUMANE_MIN_PEAK_FRAMES) {
    return {
      humaneLowRomProgressionSatisfied: false,
      humaneLowRomBlockedReason: 'humane_raise_incomplete',
      humaneLowRomBestRunMs: 0,
      humaneLowRomBestRunFrameCount: 0,
      humaneLowRomPeakElevation: effectiveArmDeg,
      humaneLowRomBaselineElevation: humaneBaselineArmDeg,
      humaneLowRomElevationDeltaFromBaseline: elevationDelta,
    };
  }

  // 2. 절대 하한 확인 (100°)
  if (effectiveArmDeg < OVERHEAD_HUMANE_ABSOLUTE_FLOOR_DEG) {
    return {
      humaneLowRomProgressionSatisfied: false,
      humaneLowRomBlockedReason: 'humane_insufficient_elevation',
      humaneLowRomBestRunMs: 0,
      humaneLowRomBestRunFrameCount: 0,
      humaneLowRomPeakElevation: effectiveArmDeg,
      humaneLowRomBaselineElevation: humaneBaselineArmDeg,
      humaneLowRomElevationDeltaFromBaseline: elevationDelta,
    };
  }

  // 3. baseline 대비 실질적 개선 확인 (15°)
  if (elevationDelta < HUMANE_REQUIRED_DELTA_DEG) {
    return {
      humaneLowRomProgressionSatisfied: false,
      humaneLowRomBlockedReason: 'humane_insufficient_delta',
      humaneLowRomBestRunMs: 0,
      humaneLowRomBestRunFrameCount: 0,
      humaneLowRomPeakElevation: effectiveArmDeg,
      humaneLowRomBaselineElevation: humaneBaselineArmDeg,
      humaneLowRomElevationDeltaFromBaseline: elevationDelta,
    };
  }

  // 4. 비대칭 확인 (가장 완화된 임계)
  if (humaneAsymmetryFails(meanAsymmetryDeg, maxAsymmetryDeg)) {
    return {
      humaneLowRomProgressionSatisfied: false,
      humaneLowRomBlockedReason: 'asymmetry_unacceptable',
      humaneLowRomBestRunMs: 0,
      humaneLowRomBestRunFrameCount: 0,
      humaneLowRomPeakElevation: effectiveArmDeg,
      humaneLowRomBaselineElevation: humaneBaselineArmDeg,
      humaneLowRomElevationDeltaFromBaseline: elevationDelta,
    };
  }

  if (humaneZoneFrames.length === 0) {
    return {
      humaneLowRomProgressionSatisfied: false,
      humaneLowRomBlockedReason: 'humane_no_zone_frames',
      humaneLowRomBestRunMs: 0,
      humaneLowRomBestRunFrameCount: 0,
      humaneLowRomPeakElevation: effectiveArmDeg,
      humaneLowRomBaselineElevation: humaneBaselineArmDeg,
      humaneLowRomElevationDeltaFromBaseline: elevationDelta,
    };
  }

  // 5. 연속 run 계산 (동일 알고리즘, 완화된 상수)
  let bestRunMs = 0;
  let bestRunFrameCount = 0;
  let runStartMs = humaneZoneFrames[0]!.timestampMs;
  let runEndMs = humaneZoneFrames[0]!.timestampMs;
  let runFrames = 1;

  for (let i = 1; i < humaneZoneFrames.length; i++) {
    const gap = humaneZoneFrames[i]!.timestampMs - humaneZoneFrames[i - 1]!.timestampMs;
    if (gap <= HUMANE_GAP_TOLERANCE_MS) {
      runEndMs = humaneZoneFrames[i]!.timestampMs;
      runFrames += 1;
    } else {
      const runMs = runEndMs - runStartMs;
      if (runMs > bestRunMs || (runMs === bestRunMs && runFrames > bestRunFrameCount)) {
        bestRunMs = runMs;
        bestRunFrameCount = runFrames;
      }
      runStartMs = humaneZoneFrames[i]!.timestampMs;
      runEndMs = humaneZoneFrames[i]!.timestampMs;
      runFrames = 1;
    }
  }
  const lastRunMs = runEndMs - runStartMs;
  if (lastRunMs > bestRunMs || (lastRunMs === bestRunMs && runFrames > bestRunFrameCount)) {
    bestRunMs = lastRunMs;
    bestRunFrameCount = runFrames;
  }

  if (bestRunMs < HUMANE_REQUIRED_HOLD_MS) {
    return {
      humaneLowRomProgressionSatisfied: false,
      humaneLowRomBlockedReason: 'humane_hold_short',
      humaneLowRomBestRunMs: bestRunMs,
      humaneLowRomBestRunFrameCount: bestRunFrameCount,
      humaneLowRomPeakElevation: effectiveArmDeg,
      humaneLowRomBaselineElevation: humaneBaselineArmDeg,
      humaneLowRomElevationDeltaFromBaseline: elevationDelta,
    };
  }

  if (bestRunFrameCount < HUMANE_MIN_RUN_FRAMES) {
    return {
      humaneLowRomProgressionSatisfied: false,
      humaneLowRomBlockedReason: 'humane_frames_too_few',
      humaneLowRomBestRunMs: bestRunMs,
      humaneLowRomBestRunFrameCount: bestRunFrameCount,
      humaneLowRomPeakElevation: effectiveArmDeg,
      humaneLowRomBaselineElevation: humaneBaselineArmDeg,
      humaneLowRomElevationDeltaFromBaseline: elevationDelta,
    };
  }

  return {
    humaneLowRomProgressionSatisfied: true,
    humaneLowRomBlockedReason: null,
    humaneLowRomBestRunMs: bestRunMs,
    humaneLowRomBestRunFrameCount: bestRunFrameCount,
    humaneLowRomPeakElevation: effectiveArmDeg,
    humaneLowRomBaselineElevation: humaneBaselineArmDeg,
    humaneLowRomElevationDeltaFromBaseline: elevationDelta,
  };
}
