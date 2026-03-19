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
 * - deconditioned:   1.0 (전반 concern rate 기반)
 *
 * @see src/lib/deep-scoring-core/extractors/paid-survey-extractor.ts (paid 대응 파일)
 * @see src/lib/deep-v2/adapters/free-survey-to-evidence.ts (survey 대응 파일)
 */

import type { NormalizedCameraResult, ResultEvidenceLevel } from '@/lib/camera/normalize';
import type { EvaluatorMetric, EvaluatorResult } from '@/lib/camera/evaluators/types';
import type { DeepScoringEvidence, AxisScores } from '@/lib/deep-scoring-core/types';

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
 * Camera evidence quality 수준.
 * pass와 별개로 analysis confidence를 나타낸다.
 *
 * 'strong'  → resultEvidenceLevel=strong_evidence, captureQuality='ok'
 * 'partial' → resultEvidenceLevel=shallow/weak, captureQuality='low'
 * 'minimal' → 극히 제한적 신호 (pass는 했으나 신호 매우 약)
 */
export type CameraEvidenceQuality = 'strong' | 'partial' | 'minimal';

export function getCameraEvidenceQuality(
  cameraResult: NormalizedCameraResult
): CameraEvidenceQuality {
  if (!isCameraPassCompleted(cameraResult)) return 'minimal';
  const level: ResultEvidenceLevel = cameraResult.resultEvidenceLevel ?? 'strong_evidence';
  if (level === 'strong_evidence') return 'strong';
  if (level === 'shallow_evidence') return 'partial';
  return 'minimal';
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

/**
 * step별 concern 메트릭으로 axis evidence 축적.
 * concern = 해당 movement issue가 실제로 관찰됨.
 * non-concern = 해당 축은 관찰 가능했으나 issue 없음 → axis score 0.
 */
function buildAxisScoresFromMetrics(
  validResults: EvaluatorResult[]
): AxisScores {
  const axes: AxisScores = {
    lower_stability: 0,
    lower_mobility:  0,
    upper_mobility:  0,
    trunk_control:   0,
    asymmetry:       0,
    deconditioned:   0,
  };

  for (const result of validResults) {
    for (const metric of result.metrics) {
      if (metric.trend !== 'concern') continue;
      const mapping = METRIC_TO_AXIS[metric.name];
      if (!mapping) continue;
      axes[mapping.axis] += mapping.weight;
    }
  }

  // asymmetry: single-leg-balance에서 사이드별 편차가 있으면 별도 추가
  // (현재 evaluator가 asymmetry를 직접 측정하지 않으므로 sway가 한 방향만 있으면 proxy)
  // 이 PR 범위에서는 보수적으로 0 유지 (카메라가 명시적으로 측정 안 함)

  // deconditioned: overall concern rate가 높을 때 proxy
  const allMetrics: EvaluatorMetric[] = validResults.flatMap((r) => r.metrics);
  if (allMetrics.length > 0) {
    const concernRate = allMetrics.filter((m) => m.trend === 'concern').length / allMetrics.length;
    // concern이 60% 이상이면 전반적 저조건화 신호
    if (concernRate >= 0.6) axes.deconditioned += 1.0;
  }

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
      axis_scores: {
        lower_stability: 0,
        lower_mobility:  0,
        upper_mobility:  0,
        trunk_control:   0,
        asymmetry:       0,
        deconditioned:   0,
      },
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
  const axisScores = buildAxisScoresFromMetrics(validResults);

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
