/**
 * FLOW-06 — Public Result → SessionDeepSummary 어댑터
 *
 * UnifiedDeepResultV2를 session create가 소비하는 SessionDeepSummary로 변환한다.
 * 순수 함수. DB 접근 없음.
 *
 * ─── 역할 경계 ─────────────────────────────────────────────────────────────────
 * - UnifiedDeepResultV2 → SessionDeepSummary 변환만 담당
 * - 로드는 getLatestClaimedPublicResultForUser.ts 범위
 * - session create 라우트는 이 어댑터를 통해 public result를 소비
 *
 * ─── 매핑 전략 ────────────────────────────────────────────────────────────────
 * focus / avoid:
 *   우선순위 1: _compat.focus_tags / _compat.avoid_tags (legacy paid deep 계열 호환)
 *   우선순위 2: primary_type 기반 파생 (free_survey / camera 계열)
 *
 * result_type:
 *   우선순위 1: _compat.result_type (legacy 원본 타입 문자열)
 *   우선순위 2: primary_type (UnifiedPrimaryType)
 *
 * scoring_version:
 *   우선순위 1: _compat.scoring_version
 *   우선순위 2: 'public_result_v2' (public-first 경로 식별)
 *
 * deep_level: evidence_level → 1(lite) / 2(partial) / 3(full)
 *
 * safety_mode: pain_mode → 'red'(protected) / 'yellow'(caution) / 'none'
 * red_flags: pain_mode === 'protected'
 *
 * ─── 관찰가능성 ─────────────────────────────────────────────────────────────
 * source_mode: 'public_result' — session create 로그/trace에서 입력 경로 식별 가능
 *
 * @see src/lib/deep-result/session-deep-summary.ts (SessionDeepSummary 계약)
 * @see src/lib/result/deep-result-v2-contract.ts (UnifiedDeepResultV2 계약)
 */

import type { SessionDeepSummary } from '@/lib/deep-result/session-deep-summary';
import type { UnifiedDeepResultV2, UnifiedPrimaryType } from '@/lib/result/deep-result-v2-contract';
import type { ClaimedPublicResultRow } from '@/lib/public-results/getLatestClaimedPublicResultForUser';

// ─── primary_type → focus/avoid 파생 매핑 ────────────────────────────────────
// plan generator의 focus scoring 체계와 호환되는 태그 집합.
// _compat.focus_tags가 없는 free_survey/camera 계열에 적용.

const PRIMARY_TYPE_FOCUS_MAP: Record<UnifiedPrimaryType, string[]> = {
  LOWER_INSTABILITY:         ['lower_chain_stability', 'glute_activation', 'glute_medius'],
  LOWER_MOBILITY_RESTRICTION:['hip_mobility', 'ankle_mobility', 'hip_flexor_stretch'],
  UPPER_IMMOBILITY:          ['shoulder_mobility', 'thoracic_mobility', 'upper_back_activation'],
  CORE_CONTROL_DEFICIT:      ['core_stability', 'core_control', 'global_core'],
  DECONDITIONED:             ['full_body_reset', 'glute_activation', 'core_stability'],
  STABLE:                    ['core_stability', 'upper_back_activation'],
  UNKNOWN:                   ['core_stability'],
};

const PRIMARY_TYPE_AVOID_MAP: Record<UnifiedPrimaryType, string[]> = {
  LOWER_INSTABILITY:         [],
  LOWER_MOBILITY_RESTRICTION:[],
  UPPER_IMMOBILITY:          [],
  CORE_CONTROL_DEFICIT:      [],
  DECONDITIONED:             [],
  STABLE:                    [],
  UNKNOWN:                   [],
};

// ─── evidence_level → deep_level ─────────────────────────────────────────────

function evidenceLevelToDeepLevel(level: string): 1 | 2 | 3 {
  if (level === 'lite')    return 1;
  if (level === 'partial') return 2;
  if (level === 'full')    return 3;
  return 2; // 알 수 없으면 partial로 안전 기본값
}

// ─── pain_mode → safety_mode ─────────────────────────────────────────────────

function painModeToSafetyMode(
  painMode: string | null | undefined
): 'red' | 'yellow' | 'none' {
  if (painMode === 'protected') return 'red';
  if (painMode === 'caution')   return 'yellow';
  return 'none';
}

// ─── 어댑터 함수 ─────────────────────────────────────────────────────────────

/**
 * SessionDeepSummaryFromPublicResult — 어댑터 반환 타입
 *
 * SessionDeepSummary + source 관찰가능성 필드.
 */
export interface SessionDeepSummaryFromPublicResult extends SessionDeepSummary {
  /** FLOW-06 관찰가능성: 입력 경로 식별 */
  source_mode: 'public_result';
  /** FLOW-06 관찰가능성: 원본 public result id (source_deep_attempt_id 대신) */
  source_public_result_id: string;
}

/**
 * buildSessionDeepSummaryFromPublicResult — UnifiedDeepResultV2 → SessionDeepSummary
 *
 * @param row ClaimedPublicResultRow from getLatestClaimedPublicResultForUser
 * @returns SessionDeepSummaryFromPublicResult
 */
export function buildSessionDeepSummaryFromPublicResult(
  row: ClaimedPublicResultRow
): SessionDeepSummaryFromPublicResult {
  const v2: UnifiedDeepResultV2 = row.result;
  const compat = v2._compat;
  const primaryType = v2.primary_type;

  // focus: _compat 우선, 없으면 primary_type 파생
  const focus: string[] =
    Array.isArray(compat?.focus_tags) && compat.focus_tags.length > 0
      ? (compat.focus_tags as string[]).filter((x): x is string => typeof x === 'string')
      : (PRIMARY_TYPE_FOCUS_MAP[primaryType] ?? PRIMARY_TYPE_FOCUS_MAP.UNKNOWN);

  // avoid: _compat 우선, 없으면 빈 배열
  const avoid: string[] =
    Array.isArray(compat?.avoid_tags) && compat.avoid_tags.length > 0
      ? (compat.avoid_tags as string[]).filter((x): x is string => typeof x === 'string')
      : (PRIMARY_TYPE_AVOID_MAP[primaryType] ?? []);

  // result_type: _compat 원본 → unified type fallback
  const result_type: string = compat?.result_type ?? primaryType ?? 'UNKNOWN';

  // scoring_version
  const scoring_version: string = compat?.scoring_version ?? 'public_result_v2';

  // deep_level from evidence_level
  const deep_level = evidenceLevelToDeepLevel(v2.evidence_level);

  // pain_risk from _compat
  const pain_risk: number | undefined =
    typeof compat?.algorithm_scores?.pain_risk === 'number' &&
    !Number.isNaN(compat.algorithm_scores.pain_risk)
      ? (compat.algorithm_scores.pain_risk as number)
      : undefined;

  // safety_mode / red_flags from pain_mode
  const safety_mode = painModeToSafetyMode(v2.pain_mode);
  const red_flags: boolean | undefined = v2.pain_mode === 'protected' ? true : undefined;

  // confidence: V2 계약상 confidence가 SSOT, effective_confidence도 동일값 사용
  const confidence = v2.confidence;

  // focus 표시 필드
  const primaryFocus = focus[0];
  const secondaryFocus = focus[1];

  // priority_vector (nullable → undefined로 변환)
  const priority_vector: Record<string, number> | undefined =
    v2.priority_vector && typeof v2.priority_vector === 'object'
      ? (v2.priority_vector as Record<string, number>)
      : undefined;

  // pain_mode (nullable → undefined로 변환)
  const pain_mode: 'none' | 'caution' | 'protected' | undefined =
    v2.pain_mode != null ? v2.pain_mode : undefined;

  return {
    // ── SessionDeepSummary fields ───────────────────────────────────────
    result_type,
    confidence,
    effective_confidence: confidence,
    focus,
    avoid,
    scoring_version,
    deep_level,
    ...(pain_risk !== undefined && { pain_risk }),
    ...(red_flags !== undefined && { red_flags }),
    safety_mode,
    ...(primaryFocus && { primaryFocus }),
    ...(secondaryFocus && { secondaryFocus }),
    primary_type: primaryType,
    ...(v2.secondary_type !== undefined && { secondary_type: v2.secondary_type }),
    ...(priority_vector && { priority_vector }),
    ...(pain_mode && { pain_mode }),
    // ── FLOW-06 관찰가능성 ────────────────────────────────────────────
    source_mode: 'public_result' as const,
    source_public_result_id: row.id,
    // source_deep_attempt_id: 없음 (public result 경로)
  };
}
