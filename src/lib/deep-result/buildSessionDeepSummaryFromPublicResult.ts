/**
 * FLOW-06 — Public Result → SessionDeepSummary 어댑터
 * FLOW-07 — Result-aware Session Create Bridge (result_type 정렬 추가)
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
 * result_type (FLOW-07 정렬):
 *   우선순위 1: _compat.result_type (legacy 원본 타입 문자열 — backward compat 유지)
 *   우선순위 2: PRIMARY_TYPE_TO_SESSION_BAND[primary_type]
 *               (Unified → session band 변환; resolveFirstSessionIntent 정렬용)
 *   우선순위 3: primary_type 원문 (최후 fallback)
 *
 * scoring_version:
 *   템플릿 풀 조회 키로 정규화. deep_v3만 유지, 나머지는 deep_v2.
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
import { isUsableSurveySessionHints } from '@/lib/deep-v2/session/survey-session-hints-first-session';

// ─── PR-FLOW-07: primary_type → session band (first-session alignment) ──────
// resolveFirstSessionIntent(priority-layer.ts)는 legacy band 키로 첫 세션 정책을
// 결정한다 (UPPER-LIMB / LOWER-LIMB / LUMBO-PELVIS / DECONDITIONED / STABLE).
// _compat.result_type이 없는 Unified-only public result는 이 맵으로
// session-consumable band로 변환되어 firstSessionIntent가 null로 떨어지는
// 문제를 방지한다.
// - _compat.result_type이 있으면 항상 그쪽이 우선 (backward compat 유지).
// - UNKNOWN은 null → 기존처럼 primaryType 원문 사용 (intent 없음은 의도된 동작).

const PRIMARY_TYPE_TO_SESSION_BAND: Record<UnifiedPrimaryType, string | null> = {
  LOWER_INSTABILITY:          'LOWER-LIMB',
  LOWER_MOBILITY_RESTRICTION: 'LOWER-LIMB',
  UPPER_IMMOBILITY:           'UPPER-LIMB',
  CORE_CONTROL_DEFICIT:       'LUMBO-PELVIS',
  DECONDITIONED:              'DECONDITIONED',
  STABLE:                     'STABLE',
  UNKNOWN:                    null,
};

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

  // result_type: _compat 원본 → session band fallback → primary_type 원문
  // FLOW-07: _compat.result_type 없이 Unified-only payload가 들어와도
  // PRIMARY_TYPE_TO_SESSION_BAND가 session-consumable legacy band로 변환해
  // resolveFirstSessionIntent가 null로 떨어지지 않도록 한다.
  const result_type: string =
    compat?.result_type ??
    PRIMARY_TYPE_TO_SESSION_BAND[primaryType] ??
    primaryType ??
    'UNKNOWN';

  // scoring_version: 템플릿 풀 조회 키로 정규화.
  // ─── 정규화 규칙 (PR-SCORING-META-ALIGN) ────────────────────────────────────
  // canonical 값: 'deep_v2' (기본), 'deep_v3' (명시된 경우만)
  // 알려진 legacy public stamp → deep_v2로 normalize:
  //   'free_survey_v2_core'  (구 baseline builder 스탬프, < PR-SCORING-META-ALIGN)
  //   'camera_fusion_v2'     (구 camera refined builder 스탬프, < PR-SCORING-META-ALIGN)
  //   'free_v2'              (구 free-survey-adapter 스탬프)
  //   'camera_v1'            (구 camera-adapter 스탬프)
  //   undefined / 알 수 없는 값 → deep_v2 안전 기본값
  // 이 규칙은 old persisted payload를 깨뜨리지 않으면서
  // template pool 조회 키가 legacy analysis-engine 식별자로 오염되는 것을 방지한다.
  // ─────────────────────────────────────────────────────────────────────────────
  const rawScoringVersion = compat?.scoring_version;
  const scoring_version: string = rawScoringVersion === 'deep_v3' ? 'deep_v3' : 'deep_v2';

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
    ...(compat?.survey_session_hints &&
      isUsableSurveySessionHints(compat.survey_session_hints) && {
        survey_session_hints: compat.survey_session_hints,
      }),
    // ── FLOW-06 관찰가능성 ────────────────────────────────────────────
    source_mode: 'public_result' as const,
    source_public_result_id: row.id,
    // source_deep_attempt_id: 없음 (public result 경로)
  };
}
