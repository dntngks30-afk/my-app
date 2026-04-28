/**
 * PR-V2-05 — Camera → DeepScoringEvidence 변환기
 *
 * Camera pass/completion ≠ camera analysis/interpretation.
 * 이 파일은 camera 분석 결과에서 evidence만 추출한다.
 * "pass했다" = "높은 confidence"가 아니다.
 *
 * ─── Pass/Analysis 분리 원칙 ─────────────────────────────────────────────────
 * - Pass:       captureQuality가 'invalid'가 아니고 insufficientSignal이 false
 *               → 사용자가 동작을 충분히 수행했음을 의미
 * - Analysis:   evaluatorResults의 metrics/trends에서 가져온 신호
 *               → pass가 성공해도 analysis confidence는 낮을 수 있음
 *
 * ─── Camera가 실제로 관찰하는 것 ─────────────────────────────────────────────
 * - 스쿼트: knee_alignment (lower_stability), depth (lower_mobility),
 *            trunk_lean (trunk_control), lumbar_extension (trunk_control)
 * - Overhead-reach: arm_range (upper_mobility), lumbar_extension (trunk_control)
 * - Wall-angel: arm_range (upper_mobility)
 * - Single-leg-balance: sway (lower_stability), asymmetry
 *
 * ─── Camera가 관찰하지 못하는 것 (명시적 missing) ────────────────────────────
 * - 통증 강도/위치 (pain_intensity_missing, pain_location_missing)
 * - 자기보고 주관적 피로도/불편
 * - 비디오로 보이지 않는 좌우 비대칭의 깊이
 *
 * ─── 스케일 근거 ─────────────────────────────────────────────────────────────
 * camera concern 메트릭은 0-1 객관 신호이므로 paid test 수준의 evidence를 생성 가능.
 * 단, step당 신호이므로 paid test 14문항 대비 총 신호량이 적어 conservative.
 *
 * 최대 도달 가능 evidence 값:
 * - lower_stability: 3.0 (squat knee + balance sway)
 * - lower_mobility:  2.5 (squat depth)
 * - upper_mobility:  3.0 (overhead arm_range + wall-angel)
 * - trunk_control:   3.0 (squat trunk_lean + lumbar)
 * - asymmetry:       2.0 (balance step 편측)
 * - deconditioned:   0.0 (PR5: 카메라 단독 저조건화 추론 금지)
 *
 * @see src/lib/deep-scoring-core/extractors/paid-survey-extractor.ts (paid 대응 파일)
 * @see src/lib/deep-v2/adapters/free-survey-to-evidence.ts (survey 대응 파일)
 */

import type { NormalizedCameraResult, ResultEvidenceLevel } from '@/lib/camera/normalize';
import type { EvaluatorMetric, EvaluatorResult } from '@/lib/camera/evaluators/types';
import type { DeepScoringEvidence, AxisScores } from '@/lib/deep-scoring-core/types';
import {
  aggregateRefinementEvidenceStrength,
  applyRefinementStrengthToCameraEvidenceQuality,
} from '@/lib/camera/camera-evidence-summary';

// ─── Pass/Analysis 분리 ────────────────────────────────────────────────────────

/**
 * Camera pass 판정.
 * pass = 사용자가 동작을 충분히 수행해 분석 가능 신호가 존재함.
 * pass가 true여도 evidence quality는 별도로 평가해야 한다.
 */
export function isCameraPassCompleted(cameraResult: NormalizedCameraResult): boolean {
  if (cameraResult.insufficientSignal) return false;
  if (cameraResult.captureQuality === 'invalid') return false;
  if (cameraResult.fallbackMode === 'survey') return false;
  return true;
}

/**
 * Camera evidence quality 수준(어댑터 분석 신호 강도).
 * pass와 별개로 analysis confidence를 나타낸다.
 * PR-CAM-01: 세션 병합은 `computeCameraPlanningEvidenceTier`(none/limited/standard)로 별도 정규화한다.
 * PR-CAM-03: 오버헤드는 `overheadEvidenceLevel`이 normalize에서 weakest 병합에 포함된다.
 *
 * 'strong'  → resultEvidenceLevel=strong_evidence, captureQuality='ok'
 * 'partial' → resultEvidenceLevel=shallow/weak, captureQuality='low'
 * 'minimal' → 극히 제한적 신호 (pass는 했으나 신호 매우 약)
 */
export type CameraEvidenceQuality = 'strong' | 'partial' | 'minimal';

/**
 * PR-COMP-06 이전: `resultEvidenceLevel`(squat/overhead planning evidence 병합)만으로 3단계 매핑.
 */
function getCameraEvidenceQualityFromResultEvidenceLevel(
  cameraResult: NormalizedCameraResult
): CameraEvidenceQuality {
  const level: ResultEvidenceLevel = cameraResult.resultEvidenceLevel ?? 'strong_evidence';
  if (level === 'strong_evidence') return 'strong';
  if (level === 'shallow_evidence') return 'partial';
  return 'minimal';
}

/**
 * Camera evidence quality — 레거시 evidence level + PR-COMP-06 모션 요약(완료/품질/limitation) 보정.
 * 업그레이드는 하지 않고, 내부 품질이 낮거나 부분 시도만 있으면 한 단계씩 보수적으로 내린다.
 */
export function getCameraEvidenceQuality(
  cameraResult: NormalizedCameraResult
): CameraEvidenceQuality {
  if (!isCameraPassCompleted(cameraResult)) return 'minimal';
  const base = getCameraEvidenceQualityFromResultEvidenceLevel(cameraResult);
  const motionAgg = aggregateRefinementEvidenceStrength(cameraResult.evaluatorResults);
  return applyRefinementStrengthToCameraEvidenceQuality(base, motionAgg);
}

// ─── 메트릭 → evidence 축 매핑 ──────────────────────────────────────────────

/** 관찰된 concern 메트릭 이름 → evidence axis + weight */
const METRIC_TO_AXIS: Record<string, { axis: keyof AxisScores; weight: number }> = {
  knee_alignment_trend: { axis: 'lower_stability', weight: 1.5 },
  sway:                 { axis: 'lower_stability', weight: 1.5 },
  depth:                { axis: 'lower_mobility',  weight: 2.0 },
  arm_range:            { axis: 'upper_mobility',  weight: 1.5 },
  trunk_lean:           { axis: 'trunk_control',   weight: 1.5 },
  lumbar_extension:     { axis: 'trunk_control',   weight: 1.5 },
};

/** step ID → 관찰 가능한 메트릭 목록 (missing_signals 계산용) */
const STEP_OBSERVABLE_METRICS: Record<string, string[]> = {
  squat:              ['knee_alignment_trend', 'depth', 'trunk_lean', 'lumbar_extension'],
  'overhead-reach':   ['arm_range', 'lumbar_extension'],
  'wall-angel':       ['arm_range'],
  'single-leg-balance': ['sway'],
};

// ─── Evidence 추출 ─────────────────────────────────────────────────────────────

const AXIS_ZERO: AxisScores = {
  lower_stability: 0,
  lower_mobility:  0,
  upper_mobility:  0,
  trunk_control:   0,
  asymmetry:       0,
  deconditioned:   0,
};

const CAMERA_AXIS_SCORE_CAPS: AxisScores = {
  lower_stability: 3.0,
  lower_mobility:  2.5,
  upper_mobility:  3.0,
  trunk_control:   3.0,
  asymmetry:       2.0,
  deconditioned:   0,
};

const CAMERA_EVIDENCE_QUALITY_SCALE: Record<CameraEvidenceQuality, number> = {
  strong: 1,
  partial: 0.45,
  minimal: 0,
};

function emptyAxisScores(): AxisScores {
  return { ...AXIS_ZERO };
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function clampAxisScore(axis: keyof AxisScores, value: number): number {
  return Math.min(CAMERA_AXIS_SCORE_CAPS[axis], Math.max(0, value));
}

function addAxisEvidence(
  axes: AxisScores,
  axis: keyof AxisScores,
  value: number
): void {
  if (axis === 'deconditioned') return;
  axes[axis] = clampAxisScore(axis, axes[axis] + Math.max(0, value));
}

function hasLimitation(
  limitations: readonly string[] | undefined,
  limitation: string
): boolean {
  return limitations?.includes(limitation) === true;
}

function qualityTierScale(tier: 'high' | 'medium' | 'low' | undefined): number {
  if (tier === 'low') return 0.2;
  if (tier === 'medium') return 0.72;
  return 1;
}

function confidenceScale(confidence: number | undefined): number {
  if (confidence == null || !Number.isFinite(confidence)) return 1;
  if (confidence >= 0.7) return 1;
  if (confidence >= 0.55) return 0.82;
  if (confidence >= 0.42) return 0.62;
  return 0.35;
}

function selectedWindowScale(input: {
  selectedWindowScore?: number | null;
  selectedWindowSource?: string;
  fallbackReason?: string | null;
} | undefined): number {
  if (!input) return 1;

  let scale = 1;
  if (
    input.selectedWindowSource === 'fallback_sparse_frames' ||
    input.selectedWindowSource === 'fallback_all_valid_frames'
  ) {
    scale = Math.min(scale, 0.72);
  } else if (input.selectedWindowSource === 'unavailable') {
    scale = Math.min(scale, 0.35);
  }

  if (input.fallbackReason) {
    scale = Math.min(scale, 0.72);
  }

  const score = input.selectedWindowScore;
  if (typeof score === 'number' && Number.isFinite(score)) {
    if (score < 0.45) scale = Math.min(scale, 0.45);
    else if (score < 0.65) scale = Math.min(scale, 0.75);
  }

  return scale;
}

function scoreDeficitScale(score: number | null | undefined): number {
  if (score == null || !Number.isFinite(score)) return 1;
  return Math.max(0.25, clamp01(1 - score));
}

function motionQualityScale(
  result: EvaluatorResult,
  evidenceQuality: CameraEvidenceQuality
): number {
  const base = CAMERA_EVIDENCE_QUALITY_SCALE[evidenceQuality];
  if (base <= 0) return 0;

  const iq =
    result.stepId === 'squat'
      ? result.debug?.squatInternalQuality
      : result.stepId === 'overhead-reach'
        ? result.debug?.overheadInternalQuality
        : undefined;

  if (!iq) return base;

  return clamp01(
    base *
      qualityTierScale(iq.qualityTier) *
      confidenceScale(iq.confidence) *
      selectedWindowScale(iq.qualityWindow)
  );
}

function axisSupportScale(
  result: EvaluatorResult,
  axis: keyof AxisScores
): number {
  if (result.stepId === 'squat') {
    const iq = result.debug?.squatInternalQuality;
    if (!iq) return 1;
    if (axis === 'lower_mobility') return scoreDeficitScale(iq.depthScore);
    if (axis === 'lower_stability') {
      return Math.max(
        scoreDeficitScale(iq.controlScore),
        scoreDeficitScale(iq.recoveryScore) * 0.75
      );
    }
    if (axis === 'trunk_control') return scoreDeficitScale(iq.controlScore);
    if (axis === 'asymmetry') return scoreDeficitScale(iq.symmetryScore);
  }

  if (result.stepId === 'overhead-reach') {
    const iq = result.debug?.overheadInternalQuality;
    if (!iq) return 1;
    if (axis === 'upper_mobility') {
      return Math.max(
        scoreDeficitScale(iq.mobilityScore),
        scoreDeficitScale(iq.holdStabilityScore) * 0.55
      );
    }
    if (axis === 'trunk_control') return scoreDeficitScale(iq.controlScore);
    if (axis === 'asymmetry') return scoreDeficitScale(iq.symmetryScore);
  }

  return 1;
}

function addMetricConcernEvidence(
  axes: AxisScores,
  result: EvaluatorResult,
  metric: EvaluatorMetric,
  evidenceQuality: CameraEvidenceQuality
): void {
  const mapping = METRIC_TO_AXIS[metric.name];
  if (!mapping || mapping.axis === 'deconditioned') return;

  const motionScale = motionQualityScale(result, evidenceQuality);
  const supportScale = axisSupportScale(result, mapping.axis);
  addAxisEvidence(axes, mapping.axis, mapping.weight * motionScale * supportScale);
}

function addSquatInternalQualityEvidence(
  axes: AxisScores,
  result: EvaluatorResult,
  evidenceQuality: CameraEvidenceQuality
): void {
  const iq = result.debug?.squatInternalQuality;
  if (!iq) return;

  const motionScale = motionQualityScale(result, evidenceQuality);
  if (motionScale <= 0) return;

  if (hasLimitation(iq.limitations, 'depth_limited')) {
    addAxisEvidence(axes, 'lower_mobility', 2.0 * motionScale * scoreDeficitScale(iq.depthScore));
  }
  if (hasLimitation(iq.limitations, 'unstable_control')) {
    addAxisEvidence(axes, 'lower_stability', 1.5 * motionScale * scoreDeficitScale(iq.controlScore));
    addAxisEvidence(axes, 'trunk_control', 1.5 * motionScale * scoreDeficitScale(iq.controlScore));
  }
  if (hasLimitation(iq.limitations, 'recovery_trajectory_weak')) {
    addAxisEvidence(axes, 'lower_stability', 1.0 * motionScale * scoreDeficitScale(iq.recoveryScore));
  }
  if (hasLimitation(iq.limitations, 'asymmetry_elevated')) {
    addAxisEvidence(axes, 'asymmetry', 1.0 * motionScale * scoreDeficitScale(iq.symmetryScore));
  }
}

function addOverheadInternalQualityEvidence(
  axes: AxisScores,
  result: EvaluatorResult,
  evidenceQuality: CameraEvidenceQuality
): void {
  const iq = result.debug?.overheadInternalQuality;
  if (!iq) return;

  const motionScale = motionQualityScale(result, evidenceQuality);
  if (motionScale <= 0) return;

  if (hasLimitation(iq.limitations, 'mobility_limited')) {
    addAxisEvidence(axes, 'upper_mobility', 1.5 * motionScale * scoreDeficitScale(iq.mobilityScore));
  }
  if (hasLimitation(iq.limitations, 'hold_stability_weak')) {
    addAxisEvidence(axes, 'upper_mobility', 0.75 * motionScale * scoreDeficitScale(iq.holdStabilityScore));
  }
  if (hasLimitation(iq.limitations, 'compensation_elevated')) {
    addAxisEvidence(axes, 'trunk_control', 1.5 * motionScale * scoreDeficitScale(iq.controlScore));
  }
  if (hasLimitation(iq.limitations, 'asymmetry_elevated')) {
    addAxisEvidence(axes, 'asymmetry', 1.0 * motionScale * scoreDeficitScale(iq.symmetryScore));
  }
}

function addInternalQualityEvidence(
  axes: AxisScores,
  result: EvaluatorResult,
  evidenceQuality: CameraEvidenceQuality
): void {
  if (result.stepId === 'squat') {
    addSquatInternalQualityEvidence(axes, result, evidenceQuality);
  } else if (result.stepId === 'overhead-reach') {
    addOverheadInternalQualityEvidence(axes, result, evidenceQuality);
  }
}

/**
 * step별 concern 메트릭으로 axis evidence 축적.
 * concern = 해당 movement issue가 실제로 관찰됨.
 * non-concern = 해당 축은 관찰 가능했으나 issue 없음 → axis score 0.
 */
function buildAxisScoresFromMetrics(
  validResults: EvaluatorResult[],
  evidenceQuality: CameraEvidenceQuality
): AxisScores {
  const axes = emptyAxisScores();

  for (const result of validResults) {
    for (const metric of result.metrics) {
      if (metric.trend !== 'concern') continue;
      addMetricConcernEvidence(axes, result, metric, evidenceQuality);
    }
    addInternalQualityEvidence(axes, result, evidenceQuality);
  }

  axes.deconditioned = 0;
  return axes;
}

/**
 * 누락 신호 계산.
 * - 카메라는 통증 데이터 없음 (항상 missing)
 * - 수행되지 않은 step → 해당 step 관찰 불가
 */
function buildMissingSignals(
  cameraResult: NormalizedCameraResult,
  evidenceQuality: CameraEvidenceQuality
): string[] {
  const missing: string[] = [
    // 카메라가 항상 측정 못하는 신호
    'pain_intensity_missing',
    'pain_location_missing',
    'subjective_fatigue_missing',
  ];

  // step별 incomplete 체크
  const completedStepIds = new Set(
    cameraResult.evaluatorResults
      .filter((r) => !r.insufficientSignal)
      .map((r) => r.stepId)
  );

  for (const [stepId, metrics] of Object.entries(STEP_OBSERVABLE_METRICS)) {
    if (!completedStepIds.has(stepId)) {
      missing.push(`${stepId}_step_missing`);
    } else {
      // step은 완료됐으나 특정 메트릭이 측정 불가인 경우는 여기선 추가하지 않음
      void metrics; // used in loop above
    }
  }

  if (evidenceQuality === 'minimal') {
    missing.push('camera_evidence_minimal');
  } else if (evidenceQuality === 'partial') {
    missing.push('camera_evidence_partial');
  }

  return missing;
}

// ─── 공개 API ─────────────────────────────────────────────────────────────────

/**
 * cameraToEvidence — camera 분석 결과 → DeepScoringEvidence
 *
 * ⚠️ 중요: pass 여부와 evidence quality는 별개다.
 * `isCameraPassCompleted()` 확인 후 이 함수를 호출하는 것이 좋지만,
 * 불충분 신호여도 안전하게 처리한다 (axis_scores 모두 0, missing_signals에 기록).
 *
 * @param cameraResult NormalizedCameraResult (camera/complete에서 저장된 결과)
 * @returns DeepScoringEvidence
 */
export function cameraToEvidence(
  cameraResult: NormalizedCameraResult
): DeepScoringEvidence {
  const evidenceQuality = getCameraEvidenceQuality(cameraResult);

  // pass 실패 또는 insufficient → 최소 evidence 반환
  if (!isCameraPassCompleted(cameraResult) || evidenceQuality === 'minimal') {
    return {
      axis_scores: emptyAxisScores(),
      pain_signals: {
        max_intensity: undefined,
        primary_discomfort_none: undefined,
        has_location_data: false,
      },
      movement_quality: {
        // camera 분석이 최소 수준이면 all_good 판단 불가 → false (안전 기본값)
        all_good: false,
      },
      answered_count: 0,
      total_count: Object.keys(STEP_OBSERVABLE_METRICS).length,
      missing_signals: buildMissingSignals(cameraResult, evidenceQuality),
    };
  }

  const validResults = cameraResult.evaluatorResults.filter((r) => !r.insufficientSignal);
  const axisScores = buildAxisScoresFromMetrics(validResults, evidenceQuality);

  // movement_quality.all_good:
  // 카메라 결과에서 concern이 하나도 없고 captureQuality='ok'이면 STABLE 후보
  const allMetrics: EvaluatorMetric[] = validResults.flatMap((r) => r.metrics);
  const hasConcerns = allMetrics.some((m) => m.trend === 'concern');
  const allGood =
    !hasConcerns &&
    cameraResult.captureQuality === 'ok' &&
    !cameraResult.retryRecommended;

  // answered_count = 완료된 step 수
  const completedStepCount = validResults.length;
  const totalStepCount = Object.keys(STEP_OBSERVABLE_METRICS).length;

  return {
    axis_scores: axisScores,
    pain_signals: {
      // camera는 통증 데이터 없음 → 전부 undefined (0 대체 금지)
      max_intensity: undefined,
      primary_discomfort_none: undefined,
      has_location_data: false,
    },
    movement_quality: {
      all_good: allGood,
    },
    answered_count: completedStepCount,
    total_count: totalStepCount,
    missing_signals: buildMissingSignals(cameraResult, evidenceQuality),
  };
}
