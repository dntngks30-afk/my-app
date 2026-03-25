/**
 * PR-V2-05 — Baseline + Camera Evidence Fusion Builder
 *
 * baseline Deep Result V2 + camera evidence → refined Deep Result V2.
 *
 * 파이프라인:
 *   1. cameraToEvidence()                : camera 결과 → DeepScoringEvidence
 *   2. merge evidence                    : baseline axis_scores + camera axis_scores 융합
 *   3. runDeepScoringCore(fusedEvidence) : fused evidence → DeepScoringCoreResult
 *   4. buildRefinedResult()              : core 결과 + metadata → UnifiedDeepResultV2
 *   5. validateUnifiedDeepResultV2()     : 계약 검증
 *
 * ─── 핵심 설계 원칙 ──────────────────────────────────────────────────────────
 * - baseline이 truth의 시작점; camera는 그것을 refine한다.
 * - camera 신호가 강할수록 refinement 영향 크고, 약하면 baseline 유지.
 * - confidence는 보수적으로 계산 — camera pass ≠ high confidence.
 * - source_inputs에 두 채널 모두 기록.
 * - result_stage는 baseline에서 'refined'로 변경.
 *
 * ─── Confidence 계산 규칙 ─────────────────────────────────────────────────────
 * fused_confidence = weighted avg:
 *   - baseline_confidence * 0.5 + camera_confidence * 0.5  (strong camera)
 *   - baseline_confidence * 0.7 + camera_confidence * 0.3  (partial camera)
 *   - baseline_confidence                                   (minimal camera)
 * 이후 runDeepScoringCore가 re-compute하므로 최종값은 core에서 결정.
 *
 * ─── Evidence_level 결정 규칙 ─────────────────────────────────────────────────
 * - camera strong + baseline partial → 'full'
 * - camera strong + baseline lite → 'partial'
 * - camera partial + baseline any → 'partial'
 * - camera minimal + any → baseline 유지
 *
 * ─── V2-06 경계 ───────────────────────────────────────────────────────────────
 * 이 builder는 purpose-built이다.
 * 완전 일반화된 multi-stage renderer는 V2-06에서 처리한다.
 *
 * @see src/lib/deep-v2/builders/build-free-survey-baseline.ts (V2-03 baseline builder)
 * @see src/lib/deep-v2/adapters/camera-to-evidence.ts (V2-05 camera evidence extractor)
 */

import type { NormalizedCameraResult } from '@/lib/camera/normalize';
import { runDeepScoringCore } from '@/lib/deep-scoring-core/core';
import type { DeepScoringEvidence, AxisScores } from '@/lib/deep-scoring-core/types';
import {
  validateUnifiedDeepResultV2,
  type UnifiedDeepResultV2,
  type EvidenceLevel,
  type PainMode,
} from '@/lib/result/deep-result-v2-contract';
import { cameraToEvidence, getCameraEvidenceQuality, isCameraPassCompleted } from '../adapters/camera-to-evidence';

// ─── 공개 타입 ───────────────────────────────────────────────────────────────

export interface CameraRefinedResult {
  result: UnifiedDeepResultV2;
  refined_meta: {
    /** 'refined' = baseline + camera fusion 성공 */
    result_stage: 'refined';
    /** 두 채널 모두 기록 */
    source_inputs: readonly ['free_survey', 'camera'];
    /** 추가 refinement 가능 여부 (유료 딥테스트) */
    refinement_available: true;
    generated_at: string;
    /**
     * Canonical scoring family 식별자.
     * 'deep_v2' = canonical deep family (template pool 조회 키와 정렬됨).
     * PR-SCORING-META-ALIGN: 과거 'camera_fusion_v2' 스탬프에서 canonical 정렬.
     * 하위 호환: 과거 'camera_fusion_v2' 값을 읽는 경우는
     * buildSessionDeepSummaryFromPublicResult에서 자동 normalize된다.
     */
    scoring_version: 'deep_v2';
    /** camera evidence quality */
    camera_evidence_quality: 'strong' | 'partial' | 'minimal';
    /** camera pass 여부 */
    camera_pass: boolean;
    /** 기존 baseline confidence */
    baseline_confidence: number;
  };
}

// ─── 내부 헬퍼 ───────────────────────────────────────────────────────────────

/**
 * Axis scores 융합.
 * baseline 신호 + camera 신호를 weighted sum으로 합산한다.
 *
 * 융합 가중치:
 * - camera strong:  camera * 0.6 + baseline * 0.4
 * - camera partial: camera * 0.4 + baseline * 0.6
 * - camera minimal: camera * 0.0 + baseline * 1.0  (baseline 그대로)
 */
function fuseAxisScores(
  baselineAxes: AxisScores | null,
  cameraAxes: AxisScores,
  cameraWeight: number
): AxisScores {
  const baseWeight = 1 - cameraWeight;

  const safeBaseline: AxisScores = baselineAxes ?? {
    lower_stability: 0,
    lower_mobility:  0,
    upper_mobility:  0,
    trunk_control:   0,
    asymmetry:       0,
    deconditioned:   0,
  };

  return {
    lower_stability: safeBaseline.lower_stability * baseWeight + cameraAxes.lower_stability * cameraWeight,
    lower_mobility:  safeBaseline.lower_mobility  * baseWeight + cameraAxes.lower_mobility  * cameraWeight,
    upper_mobility:  safeBaseline.upper_mobility  * baseWeight + cameraAxes.upper_mobility  * cameraWeight,
    trunk_control:   safeBaseline.trunk_control   * baseWeight + cameraAxes.trunk_control   * cameraWeight,
    asymmetry:       safeBaseline.asymmetry       * baseWeight + cameraAxes.asymmetry       * cameraWeight,
    deconditioned:   safeBaseline.deconditioned   * baseWeight + cameraAxes.deconditioned   * cameraWeight,
  };
}

/**
 * evidence_level 결정.
 * camera quality + baseline evidence_level 조합.
 */
function resolveRefinedEvidenceLevel(
  cameraQuality: 'strong' | 'partial' | 'minimal',
  baselineEvidenceLevel: EvidenceLevel,
  confidence: number
): EvidenceLevel {
  if (cameraQuality === 'minimal') return baselineEvidenceLevel;
  if (cameraQuality === 'strong' && baselineEvidenceLevel === 'partial' && confidence >= 0.7) return 'full';
  if (cameraQuality === 'strong') return 'partial';
  if (cameraQuality === 'partial') return 'partial';
  return baselineEvidenceLevel;
}

/**
 * 요약 문구 생성 (refined 전용).
 * baseline_only와 달리 "카메라 분석을 통해 보완됨" 명시.
 */
function buildRefinedSummaryCopy(
  primaryType: string,
  cameraQuality: 'strong' | 'partial' | 'minimal'
): string {
  const copies: Record<string, string> = {
    LOWER_INSTABILITY:          '하체 안정성 패턴이 동작 분석을 통해 확인되었습니다.',
    LOWER_MOBILITY_RESTRICTION: '하체 가동성 제한 패턴이 동작 분석을 통해 확인되었습니다.',
    UPPER_IMMOBILITY:           '상체 가동성 제한 패턴이 동작 분석을 통해 확인되었습니다.',
    CORE_CONTROL_DEFICIT:       '체간 조절 패턴이 동작 분석을 통해 확인되었습니다.',
    DECONDITIONED:              '복합 패턴이 동작 분석을 통해 확인되었습니다.',
    STABLE:                     '전반적으로 균형이 잡힌 움직임 패턴이 동작 분석을 통해 확인되었습니다.',
    UNKNOWN:                    '동작 분석 신호를 확인했으나 추가 정보가 필요합니다.',
  };
  const base = copies[primaryType] ?? '동작 분석을 통해 움직임 패턴을 확인했습니다.';

  if (cameraQuality === 'partial') {
    return `${base} (일부 구간 신호 기반 분석입니다.)`;
  }
  return base;
}

// ─── 공개 API ─────────────────────────────────────────────────────────────────

/**
 * buildCameraRefinedResult — baseline + camera evidence → refined Deep Result V2
 *
 * @param baseline  V2-03 builder가 생성한 baseline UnifiedDeepResultV2
 * @param cameraResult  camera/complete에서 저장된 NormalizedCameraResult
 * @returns CameraRefinedResult
 * @throws Error if Deep Result V2 contract validation fails
 */
export function buildCameraRefinedResult(
  baseline: UnifiedDeepResultV2,
  cameraResult: NormalizedCameraResult
): CameraRefinedResult {
  const cameraPass = isCameraPassCompleted(cameraResult);
  const cameraQuality = getCameraEvidenceQuality(cameraResult);

  // Step 1: camera → evidence
  const cameraEvidence = cameraToEvidence(cameraResult);

  // Step 2: axis 융합 가중치 결정
  const cameraWeight =
    cameraQuality === 'strong'  ? 0.6 :
    cameraQuality === 'partial' ? 0.4 :
    0.0; // minimal: baseline 그대로

  // baseline axis_scores 결정.
  // PR-BASELINE-RAW-AXIS-SNAPSHOT-03:
  //   우선순위 1 — baseline._compat.baseline_deep_evidence_snapshot.axis_scores (PR-03에서 저장)
  //   우선순위 2 — baseline.priority_vector * 5 proxy (이전 payload / snapshot 없는 경우 fallback)
  //
  // 왜 fallback이 필요한가:
  //   이전에 생성된 baseline payload에는 snapshot이 없다.
  //   proxy는 정밀도가 낮지만(priority_vector는 0~1 정규화 후 역산 불가),
  //   regression 없이 기존 동작을 유지하기 위해 보존한다.

  const snapshotAxes = baseline._compat?.baseline_deep_evidence_snapshot?.axis_scores;
  const baselineAxes: AxisScores | null = snapshotAxes
    ? {
        lower_stability: snapshotAxes.lower_stability,
        lower_mobility:  snapshotAxes.lower_mobility,
        upper_mobility:  snapshotAxes.upper_mobility,
        trunk_control:   snapshotAxes.trunk_control,
        asymmetry:       snapshotAxes.asymmetry,
        deconditioned:   snapshotAxes.deconditioned,
      }
    : baseline.priority_vector
      ? {
          lower_stability: (baseline.priority_vector['lower_stability'] ?? 0) * 5,
          lower_mobility:  (baseline.priority_vector['lower_mobility']  ?? 0) * 5,
          upper_mobility:  (baseline.priority_vector['upper_mobility']  ?? 0) * 5,
          trunk_control:   (baseline.priority_vector['trunk_control']   ?? 0) * 5,
          asymmetry:       (baseline.priority_vector['asymmetry']       ?? 0) * 5,
          deconditioned:   (baseline.priority_vector['deconditioned']   ?? 0) * 5,
        }
      : null;

  const fusedAxes = fuseAxisScores(baselineAxes, cameraEvidence.axis_scores, cameraWeight);

  // Step 3: fused evidence 조립
  // movement_quality: camera 완료 시 all_good 우선, 아니면 baseline 보존
  const movementQualityAllGood =
    cameraPass
      ? cameraEvidence.movement_quality.all_good
      : false;

  // missing_signals: 두 채널의 missing 합산 (중복 제거)
  const mergedMissing = [
    ...new Set([
      ...baseline.missing_signals,
      ...cameraEvidence.missing_signals,
    ]),
  ];

  const fusedEvidence: DeepScoringEvidence = {
    axis_scores: fusedAxes,
    pain_signals: {
      // 두 채널 모두 pain 정보 없음 → undefined 유지
      max_intensity: undefined,
      primary_discomfort_none: undefined,
      has_location_data: false,
    },
    movement_quality: {
      all_good: movementQualityAllGood,
    },
    // answered_count: survey(18) + camera steps
    answered_count: 18 + cameraEvidence.answered_count,
    total_count:    18 + cameraEvidence.total_count,
    missing_signals: mergedMissing,
  };

  // Step 4: scoring core 재실행
  const coreResult = runDeepScoringCore(fusedEvidence);

  // Step 5: evidence_level 결정
  const evidenceLevel = resolveRefinedEvidenceLevel(
    cameraQuality,
    baseline.evidence_level,
    coreResult.confidence
  );

  // Step 6: UnifiedDeepResultV2 구성
  // reason_codes에 baseline 타입 보존 기록 추가
  const extraReasonCodes: string[] = [];
  if (baseline.primary_type !== coreResult.primary_type) {
    extraReasonCodes.push(`baseline_was_${baseline.primary_type.toLowerCase()}`);
  }
  if (cameraQuality === 'partial') {
    extraReasonCodes.push('camera_evidence_partial');
  }

  const refined: UnifiedDeepResultV2 = {
    primary_type: coreResult.primary_type,
    secondary_type: coreResult.secondary_type,
    priority_vector: coreResult.priority_vector,
    pain_mode: coreResult.pain_mode as PainMode,
    confidence: coreResult.confidence,
    evidence_level: evidenceLevel,
    source_mode: 'camera',
    missing_signals: coreResult.missing_signals,
    reason_codes: [...coreResult.reason_codes, ...extraReasonCodes],
    summary_copy: buildRefinedSummaryCopy(coreResult.primary_type, cameraQuality),
    _compat: {
      // PR-SCORING-META-ALIGN: canonical deep family 기준 = 'deep_v2'.
      // 과거 'camera_fusion_v2' 스탬프는 compat/historical 용도였으나,
      // buildSessionDeepSummaryFromPublicResult의 normalization guard와 정렬.
      scoring_version: 'deep_v2',
      // PR-SURVEY-07: baseline 설문 힌트·스냅샷을 refined payload에 보존 → session-create 병합 가능
      ...(baseline._compat?.survey_session_hints != null && {
        survey_session_hints: baseline._compat.survey_session_hints,
      }),
      ...(baseline._compat?.survey_deconditioned_interpretation != null && {
        survey_deconditioned_interpretation: baseline._compat.survey_deconditioned_interpretation,
      }),
      ...(baseline._compat?.baseline_deep_evidence_snapshot != null && {
        baseline_deep_evidence_snapshot: baseline._compat.baseline_deep_evidence_snapshot,
      }),
      camera_evidence_quality: cameraQuality,
      camera_pass: cameraPass,
    },
  };

  // Step 7: 계약 검증
  const validation = validateUnifiedDeepResultV2(refined);
  if (!validation.valid) {
    throw new Error(
      `[buildCameraRefinedResult] Deep Result V2 contract validation failed:\n` +
      validation.errors.join('\n')
    );
  }

  return {
    result: refined,
    refined_meta: {
      result_stage: 'refined',
      source_inputs: ['free_survey', 'camera'],
      refinement_available: true,
      generated_at: new Date().toISOString(),
      // PR-SCORING-META-ALIGN: canonical deep family 기준.
      // 과거 'camera_fusion_v2'에서 'deep_v2'로 정렬됨.
      scoring_version: 'deep_v2',
      camera_evidence_quality: cameraQuality,
      camera_pass: cameraPass,
      baseline_confidence: baseline.confidence,
    },
  };
}
