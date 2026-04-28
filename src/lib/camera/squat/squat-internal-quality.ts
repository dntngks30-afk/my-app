/**
 * PR-COMP-03 — 스쿼트 **내부 해석(interpretation)** 전용 품질 레이어.
 *
 * - completion / pass / latch / 재시도(페이지)와 **완전 분리**: 본 모듈은 진행 게이트를 읽지도 쓰지도 않는다.
 * - 포즈·프레임에서 파생된 **숫자 신호만** 입력으로 받는다 (completionSatisfied 등 금지).
 * - 퍼블릭 UX·트렌드 라벨보다 **보수적(strict)** 인 0–1 스코어와 tier를 만든다.
 */
import type { MotionInternalQualityBase } from '@/lib/camera/types/motion-completion';
import type { QualityWindowTrace } from '@/lib/camera/stability';

export type SquatInternalQuality = MotionInternalQualityBase & {
  depthScore: number;
  controlScore: number;
  symmetryScore: number;
  recoveryScore: number;
  qualityWindow?: QualityWindowTrace;
};

/**
 * completion 상태기계와 무관하게, 이미 추출된 관측값만 전달한다.
 * (evaluator가 `PoseFeaturesFrame[]`에서 뽑은 요약 통계 수준)
 */
export type SquatInternalQualityInput = {
  peakDepthProxy: number;
  meanDepthProxy: number;
  bottomStability: number;
  trunkLeanDegMeanAbs: number | null;
  kneeTrackingMean: number | null;
  asymmetryDegMean: number | null;
  weightShiftMean: number | null;
  /** 유효 프레임 / 전체 캡처 프레임 */
  validFrameRatio: number;
  descentCount: number;
  bottomCount: number;
  ascentCount: number;
  /** `getSquatRecoverySignal`의 depth 기반 비율 (0–1) */
  recoveryDropRatio: number;
  returnContinuityFrames: number;
  /** 1 = 패널티 없음, 0.75 등 = 품질 힌트 기반 신뢰도 감쇠 */
  signalIntegrityMultiplier: number;
  /** PR3: interpretation-only selected-window trace. Not consumed by pass/progression. */
  qualityWindow?: QualityWindowTrace;
};

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** 공개 depth 밴드(35/55)보다 빡센 내부 깊이 점수 */
function scoreDepthStrict(peak: number): number {
  if (peak <= 0) return 0;
  if (peak >= 0.64) {
    return clamp01(0.8 + ((peak - 0.64) / 0.36) * 0.2);
  }
  if (peak >= 0.48) {
    return 0.52 + ((peak - 0.48) / (0.64 - 0.48)) * 0.28;
  }
  if (peak >= 0.3) {
    return 0.28 + ((peak - 0.3) / (0.48 - 0.3)) * 0.24;
  }
  return (peak / 0.3) * 0.28;
}

/** 하단 안정성 + 상체 전술 + 체중이동 — 관성 큰 지표는 강하게 깎는다 */
function scoreControlStrict(
  trunkDeg: number | null,
  bottomStability: number,
  weightShift: number | null
): number {
  const trunk =
    trunkDeg == null ? 0.52 : clamp01(1 - trunkDeg / 20);
  const weight =
    weightShift == null ? 0.58 : clamp01(1 - weightShift / 0.34);
  return clamp01(trunk * 0.42 + clamp01(bottomStability) * 0.33 + weight * 0.25);
}

/** 무릎 추적 1.0 대칭 + 무릎각 갭 — 엄격 */
function scoreSymmetryStrict(kneeTrackingMean: number | null, asymmetryDegMean: number | null): number {
  const knee =
    kneeTrackingMean == null
      ? 0.52
      : clamp01(1 - Math.abs(kneeTrackingMean - 1) / 0.14);
  const asym =
    asymmetryDegMean == null ? 0.52 : clamp01(1 - asymmetryDegMean / 16);
  return clamp01((knee + asym) / 2);
}

/**
 * completion의 “standing_recovered”와 별개로, 깊이 궤적의 **복귀 비율**만으로 복구 품질을 본다.
 * 상승 phase 프레임이 거의 없으면 강하게 감점.
 */
function scoreRecoveryStrict(
  recoveryDropRatio: number,
  ascentCount: number,
  returnContinuityFrames: number
): number {
  let base: number;
  if (recoveryDropRatio >= 0.58) {
    base = 0.82 + Math.min(0.18, ((recoveryDropRatio - 0.58) / 0.42) * 0.18);
  } else if (recoveryDropRatio >= 0.42) {
    base = 0.55 + ((recoveryDropRatio - 0.42) / (0.58 - 0.42)) * 0.27;
  } else if (recoveryDropRatio >= 0.26) {
    base = 0.3 + ((recoveryDropRatio - 0.26) / (0.42 - 0.26)) * 0.25;
  } else {
    base = (recoveryDropRatio / 0.26) * 0.3;
  }

  if (ascentCount <= 0) {
    base *= 0.62;
  }
  base += Math.min(0.1, returnContinuityFrames * 0.022);
  return clamp01(base);
}

function deriveTier(
  depth: number,
  control: number,
  symmetry: number,
  recovery: number,
  confidence: number
): 'high' | 'medium' | 'low' {
  const core = ((depth + control + symmetry + recovery) / 4) * confidence;
  const weakest = Math.min(depth, control, symmetry, recovery);
  if (core >= 0.66 && weakest >= 0.46 && confidence >= 0.58) {
    return 'high';
  }
  if (core < 0.38 || weakest < 0.26 || confidence < 0.4) {
    return 'low';
  }
  return 'medium';
}

function deriveLimitations(
  depth: number,
  control: number,
  symmetry: number,
  recovery: number,
  confidence: number,
  input: SquatInternalQualityInput
): string[] {
  const lim: string[] = [];
  if (depth < 0.44) lim.push('depth_limited');
  if (control < 0.44) lim.push('unstable_control');
  if (symmetry < 0.44) lim.push('asymmetry_elevated');
  if (recovery < 0.44) lim.push('recovery_trajectory_weak');
  if (confidence < 0.52) lim.push('low_tracking_confidence');
  if (input.bottomCount <= 0 && input.peakDepthProxy >= 0.22) {
    lim.push('bottom_phase_weak');
  }
  if (input.descentCount <= 0 && input.peakDepthProxy >= 0.15) {
    lim.push('descent_phase_unclear');
  }
  if (input.peakDepthProxy > 0.18 && input.meanDepthProxy / input.peakDepthProxy < 0.52) {
    lim.push('shallow_time_in_depth');
  }
  return lim;
}

/** 신호 부족 분기 — evaluator early return과 동일 계약 */
export function squatInternalQualityInsufficientSignal(): SquatInternalQuality {
  return {
    depthScore: 0,
    controlScore: 0,
    symmetryScore: 0,
    recoveryScore: 0,
    confidence: 0,
    qualityTier: 'low',
    limitations: ['insufficient_frames'],
  };
}

/**
 * strict 내부 품질 — **completion 여부와 무관**하게 항상 동일 공식으로 계산.
 */
export function computeSquatInternalQuality(input: SquatInternalQualityInput): SquatInternalQuality {
  const depthScore = scoreDepthStrict(clamp01(input.peakDepthProxy));
  const controlScore = scoreControlStrict(
    input.trunkLeanDegMeanAbs,
    input.bottomStability,
    input.weightShiftMean
  );
  const symmetryScore = scoreSymmetryStrict(input.kneeTrackingMean, input.asymmetryDegMean);
  const recoveryScore = scoreRecoveryStrict(
    clamp01(input.recoveryDropRatio),
    input.ascentCount,
    input.returnContinuityFrames
  );
  const confidence = clamp01(input.validFrameRatio * clamp01(input.signalIntegrityMultiplier));

  const qualityTier = deriveTier(depthScore, controlScore, symmetryScore, recoveryScore, confidence);
  const limitations = deriveLimitations(
    depthScore,
    controlScore,
    symmetryScore,
    recoveryScore,
    confidence,
    input
  );

  return {
    depthScore: clamp01(depthScore),
    controlScore: clamp01(controlScore),
    symmetryScore: clamp01(symmetryScore),
    recoveryScore: clamp01(recoveryScore),
    confidence: clamp01(confidence),
    qualityTier,
    limitations,
    ...(input.qualityWindow != null ? { qualityWindow: input.qualityWindow } : {}),
  };
}
