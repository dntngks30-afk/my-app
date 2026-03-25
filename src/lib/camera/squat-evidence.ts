/**
 * PR-CAM-09 — SquatEvidenceLabel → SquatEvidenceLevel 매핑 + 품질 캡 헬퍼.
 *
 * 소유권 원칙:
 * - squat-completion-state.ts 가 completion truth (pass/fail, evidenceLabel) 소유
 * - 이 파일은 그 출력을 planning/confidence tier 로 변환하는 순수 매핑만 포함
 * - completion 로직 변경 금지. 매핑·다운그레이드만.
 */
import type { SquatEvidenceLabel } from './squat-completion-state';

/** 스쿼트 사이클 완료 후 planning·confidence 티어 */
export type SquatEvidenceLevel =
  | 'strong_evidence'
  | 'shallow_evidence'
  | 'weak_evidence'
  | 'insufficient_signal';

/**
 * applySquatQualityCap 이 필요로 하는 품질 신호 형태.
 * auto-progression 의 SquatQualitySignals 구조와 호환된다.
 */
export interface SquatQualityConcerns {
  bottomStabilityLow: boolean;
  kneeTrackingOff: boolean;
  trunkLeanHigh: boolean;
  strongQuality: boolean;
}

/**
 * evidenceLabel (squat-completion-state 출력) + cycleProofPassed →
 * planning tier (SquatEvidenceLevel).
 *
 * cycleProofPassed = true 는 currentSquatPhase === 'standing_recovered' 를 의미한다.
 */
export function evidenceLabelToSquatEvidenceLevel(
  label: SquatEvidenceLabel,
  cycleProofPassed: boolean
): SquatEvidenceLevel {
  if (!cycleProofPassed || label === 'insufficient_signal') return 'insufficient_signal';
  if (label === 'standard') return 'strong_evidence';
  if (label === 'low_rom') return 'shallow_evidence';
  // ultra_low_rom
  return 'weak_evidence';
}

/**
 * SquatEvidenceLevel → reason 태그 배열.
 * completionBlockedReason 은 'insufficient_signal' 경우에만 사용한다.
 */
export function squatEvidenceLevelToReasons(
  level: SquatEvidenceLevel,
  completionBlockedReason: string | null
): string[] {
  switch (level) {
    case 'insufficient_signal':
      return completionBlockedReason != null
        ? [completionBlockedReason]
        : ['cycle_proof_insufficient'];
    case 'strong_evidence':
      return ['standard', 'standing_recovered'];
    case 'shallow_evidence':
      return ['low_rom', 'standing_recovered'];
    case 'weak_evidence':
      return ['ultra_low_rom', 'standing_recovered'];
  }
}

/**
 * SquatEvidenceLevel → confidence downgrade reason (없으면 null).
 */
export function squatEvidenceLevelToConfidenceDowngradeReason(
  level: SquatEvidenceLevel
): string | null {
  if (level === 'shallow_evidence') return 'shallow_depth';
  if (level === 'weak_evidence') return 'ultra_low_rom_cycle';
  return null;
}

export interface SquatEvidenceCapResult {
  level: SquatEvidenceLevel;
  reasons: string[];
  qualityInterpretationReason: string | null;
  confidenceDowngradeReason: string | null;
}

/**
 * PR-CAM-02 품질 캡: 사이클 완료 후 내부 품질 신호로 evidence level 을 보수적으로 내린다.
 * 올리지 않고 내리기만 한다.
 *
 * 이 함수는 strong → shallow → weak 방향만 허용한다.
 */
export function applySquatQualityCap(
  baseLevel: SquatEvidenceLevel,
  baseReasons: string[],
  evidenceLabel: SquatEvidenceLabel,
  quality: SquatQualityConcerns
): SquatEvidenceCapResult {
  let level = baseLevel;
  let reasons = [...baseReasons];
  let qualityInterpretationReason: string | null =
    evidenceLabel === 'standard' ? 'valid_strong' : 'valid_limited_shallow';
  let confidenceDowngradeReason: string | null =
    squatEvidenceLevelToConfidenceDowngradeReason(level);

  if (level === 'strong_evidence' && !quality.strongQuality) {
    level = 'shallow_evidence';
    reasons = ['cam02_standard_quality_capped', ...reasons];
    qualityInterpretationReason = 'cam02_standard_capped_to_shallow';
    confidenceDowngradeReason = 'cam02_standard_cycle_quality_capped';
  }

  if (level === 'shallow_evidence') {
    const concernCount = [
      quality.bottomStabilityLow,
      quality.kneeTrackingOff,
      quality.trunkLeanHigh,
    ].filter(Boolean).length;
    if (concernCount >= 2) {
      level = 'weak_evidence';
      reasons = ['cam02_low_rom_multi_concern', ...reasons];
      qualityInterpretationReason = 'cam02_shallow_capped_to_weak';
      confidenceDowngradeReason =
        confidenceDowngradeReason ?? 'cam02_low_rom_quality_capped';
    }
  }

  return { level, reasons, qualityInterpretationReason, confidenceDowngradeReason };
}
