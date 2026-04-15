/**
 * PR-ALG-03: Priority Layer for Session Plan Generator
 *
 * Safety Gate + Priority Selector.
 * Additive front-layer only. Generator core unchanged.
 */

/** priority_vector axis → focus_tags for template scoring */
const PRIORITY_AXIS_TO_FOCUS_TAGS: Record<string, string[]> = {
  lower_stability: ['lower_chain_stability', 'glute_medius', 'basic_balance', 'core_stability'],
  lower_mobility: ['hip_mobility', 'ankle_mobility'],
  upper_mobility: ['thoracic_mobility', 'shoulder_mobility', 'shoulder_stability'],
  trunk_control: ['core_control', 'core_stability', 'global_core'],
  asymmetry: ['basic_balance', 'lower_chain_stability'],
  deconditioned: ['full_body_reset', 'core_control'],
};

/** pain_mode=protected 시 추가 제외할 contraindication 코드. PR-SESSION-QUALITY-01: deep_squat 추가 */
const PAIN_PROTECTED_EXTRA_AVOID = [
  'knee_load',
  'wrist_load',
  'shoulder_overhead',
  'ankle_instability',
  'deep_squat',
];

/** pain_mode=caution 시 추가 제외 (완화) */
const PAIN_CAUTION_EXTRA_AVOID = ['knee_load', 'wrist_load'];

/** PR-ALG-21: resultType (user-facing) → focus_tags for type-to-session alignment */
const RESULT_TYPE_TO_FOCUS_TAGS: Record<string, string[]> = {
  'NECK-SHOULDER': ['upper_trap_release', 'neck_mobility', 'thoracic_mobility', 'shoulder_stability'],
  'UPPER-LIMB': ['shoulder_mobility', 'shoulder_stability', 'upper_back_activation'],
  'LOWER-LIMB': ['lower_chain_stability', 'glute_medius', 'ankle_mobility', 'glute_activation'],
  'LUMBO-PELVIS': ['hip_mobility', 'glute_activation', 'core_control', 'core_stability'],
};

/** PR-ALIGN-01: resultType → GoldPathVector for first-session composition. Ensures UPPER-LIMB does not start as core-only. */
const RESULT_TYPE_TO_GOLD_PATH: Record<string, string> = {
  'UPPER-LIMB': 'upper_mobility',
  'NECK-SHOULDER': 'upper_mobility',
  'LOWER-LIMB': 'lower_stability',
  'LUMBO-PELVIS': 'trunk_control',
  'DECONDITIONED': 'deconditioned',
  'STABLE': '', // use priority_vector
};

/** PR-ALIGN-01: resultType → session_focus_axes (axis names for meta). First session alignment. */
const RESULT_TYPE_TO_FOCUS_AXES: Record<string, string[]> = {
  'UPPER-LIMB': ['upper_mobility'],
  'NECK-SHOULDER': ['upper_mobility'],
  'LOWER-LIMB': ['lower_stability'],
  'LUMBO-PELVIS': ['trunk_control'],
  'DECONDITIONED': ['deconditioned'],
  'STABLE': [],
};

/** PR-ALIGN-01: resultType → session_rationale first sentence. User-facing alignment. */
const RESULT_TYPE_TO_RATIONALE: Record<string, string> = {
  'UPPER-LIMB': '손목·팔꿈치 부담을 줄이기 위해 상체 가동성과 움직임 범위를 개선하는 세션입니다.',
  'NECK-SHOULDER': '어깨·목 움직임을 정리하기 위해 흉추·견갑 가동성을 회복하는 세션입니다.',
  'LOWER-LIMB': '무릎·발목 안정을 잡기 위해 엉덩이와 골반 안정성을 강화하는 세션입니다.',
  'LUMBO-PELVIS': '몸통 안정을 잡기 위해 호흡·코어 연결을 강화하는 세션입니다.',
  'DECONDITIONED': '기본 움직임 회복이 우선이어서 안정적인 움직임 기반을 다지는 세션입니다.',
  'STABLE': '',
};

// ─── PR-PILOT-BASELINE-SESSION-ALIGN-01: baseline_session_anchor → 세분화된 intent ───
// legacy band(LOWER-LIMB)로는 LOWER_INSTABILITY와 LOWER_MOBILITY_RESTRICTION을 구분 못함.
// baseline_session_anchor가 있으면 이 맵이 우선 적용.

const BASELINE_ANCHOR_TO_GOLD_PATH: Record<string, string> = {
  lower_stability: 'lower_stability',
  lower_mobility: 'lower_mobility',
  upper_mobility: 'upper_mobility',
  trunk_control: 'trunk_control',
  deconditioned: 'deconditioned',
  balanced_reset: '',
};

const BASELINE_ANCHOR_TO_FOCUS_AXES: Record<string, string[]> = {
  lower_stability: ['lower_stability'],
  lower_mobility: ['lower_mobility'],
  upper_mobility: ['upper_mobility'],
  trunk_control: ['trunk_control'],
  deconditioned: ['deconditioned'],
  balanced_reset: [],
};

const BASELINE_ANCHOR_TO_RATIONALE: Record<string, string> = {
  lower_stability: '하체 안정성이 우선이어서 무릎·골반·엉덩이 안정을 잡는 세션입니다.',
  lower_mobility: '하체 가동성 회복이 우선이어서 고관절·발목 움직임 범위를 여는 세션입니다.',
  upper_mobility: '상체 움직임 회복이 우선이어서 흉추·견갑·어깨 가동성을 여는 세션입니다.',
  trunk_control: '몸통 연결이 우선이어서 호흡·코어 제어를 강화하는 세션입니다.',
  deconditioned: '기본 움직임 회복이 우선이어서 안정적인 움직임 기반을 다지는 세션입니다.',
  balanced_reset: '',
};

const BASELINE_ANCHOR_TO_REQUIRED_TAGS: Record<string, string[]> = {
  lower_stability: ['lower_chain_stability', 'glute_medius', 'glute_activation', 'basic_balance'],
  lower_mobility: ['hip_mobility', 'ankle_mobility', 'hip_flexor_stretch'],
  upper_mobility: ['shoulder_mobility', 'thoracic_mobility', 'upper_back_activation', 'shoulder_stability'],
  trunk_control: ['core_control', 'core_stability', 'global_core'],
  deconditioned: ['full_body_reset', 'core_control'],
  balanced_reset: ['core_stability', 'upper_back_activation'],
};

const BASELINE_ANCHOR_TO_FORBIDDEN_DOMINANT: Record<string, string[]> = {
  lower_stability: ['upper_mobility', 'lower_mobility'],
  lower_mobility: ['upper_mobility', 'lower_stability'],
  upper_mobility: ['trunk_control', 'lower_stability', 'lower_mobility'],
  trunk_control: ['upper_mobility', 'lower_mobility'],
  deconditioned: [],
  balanced_reset: [],
};

const BASELINE_ANCHOR_RATIONALE_MUST_INCLUDE: Record<string, string[]> = {
  lower_stability: ['하체', '안정', '무릎', '골반', '엉덩이'],
  lower_mobility: ['가동성', '고관절', '발목', '움직임', '하체'],
  upper_mobility: ['상체', '흉추', '견갑', '어깨', '가동성'],
  trunk_control: ['몸통', '코어', '호흡', '연결'],
  deconditioned: ['기본', '움직임', '회복'],
  balanced_reset: [],
};

const BASELINE_ANCHOR_RATIONALE_MUST_AVOID_ONLY: Record<string, string[]> = {
  lower_stability: ['가동성', '스트레칭'],
  lower_mobility: ['안정성', '활성화'],
  upper_mobility: ['몸통', '코어', '안정성'],
  trunk_control: ['상체', '가동성'],
  deconditioned: [],
  balanced_reset: [],
};

export type PainMode = 'none' | 'caution' | 'protected';

/**
 * PR-ALG-21: resultType-aligned focus tags for scoring bonus.
 * Ensures first session main has at least one item matching user-facing type.
 */
export function getResultTypeFocusTags(resultType?: string | null): string[] {
  if (!resultType || typeof resultType !== 'string') return [];
  return RESULT_TYPE_TO_FOCUS_TAGS[resultType] ?? [];
}

/**
 * PR-ALIGN-01: First-session alignment policy. resultType = 1차 앵커, priority_vector = 2차 보조.
 * UPPER-LIMB 사용자가 코어-only 첫 세션을 받지 않도록 함.
 */
export interface FirstSessionAuditExpectations {
  forbiddenDominantAxes: string[];
  requiredFocusAxes: string[];
  requiredTags: string[];
  rationaleMustInclude: string[];
  rationaleMustAvoidOnly: string[];
}

export interface FirstSessionIntentSSOT {
  anchorType: string;
  goldPath: string | null;
  focusAxes: string[];
  rationale: string | null;
  requiredTags: string[];
  preferredTemplateTags: string[];
  forbiddenDominantAxes: string[];
  forbiddenTemplateTags: string[];
  intensityTier: 'inherit';
  auditExpectations: FirstSessionAuditExpectations;
}

export interface ResolveFirstSessionIntentInput {
  resultType?: string | null;
  primaryType?: string | null;
  secondaryType?: string | null;
  priorityVector?: Record<string, number> | null;
  painMode?: PainMode | null;
  sessionNumber: number;
  deepLevel?: 1 | 2 | 3;
  safetyMode?: 'red' | 'yellow' | 'none';
  redFlags?: boolean;
  /** PR-PILOT-BASELINE-SESSION-ALIGN-01: public baseline에서 온 세분화된 세션 앵커 */
  baselineSessionAnchor?: string | null;
}

/**
 * PR-SSOT-01: session 1 canonical intent SSOT.
 * PR-PILOT-BASELINE-SESSION-ALIGN-01: baseline_session_anchor가 있으면 우선 소비.
 * 그렇지 않으면 legacy resultType band를 사용 (backward compat).
 *
 * 우선순위: baselineSessionAnchor > resultType (legacy band)
 */
export function resolveFirstSessionIntent(
  input: ResolveFirstSessionIntentInput
): FirstSessionIntentSSOT | null {
  if (input.sessionNumber !== 1) return null;

  // PR-PILOT-BASELINE-SESSION-ALIGN-01: baseline anchor 우선 경로
  const anchor = typeof input.baselineSessionAnchor === 'string'
    ? input.baselineSessionAnchor.trim()
    : '';

  if (anchor && BASELINE_ANCHOR_TO_GOLD_PATH[anchor] !== undefined) {
    return buildBaselineAnchorIntent(anchor);
  }

  // Legacy band 경로 (backward compat)
  const key = typeof input.resultType === 'string' ? input.resultType.trim() : '';
  if (!key) return null;
  return buildLegacyBandIntent(key);
}

/** PR-PILOT-BASELINE-SESSION-ALIGN-01: baseline_session_anchor → intent (세분화) */
function buildBaselineAnchorIntent(anchor: string): FirstSessionIntentSSOT | null {
  const goldPath = BASELINE_ANCHOR_TO_GOLD_PATH[anchor];
  const focusAxes = BASELINE_ANCHOR_TO_FOCUS_AXES[anchor] ?? [];
  const rationale = BASELINE_ANCHOR_TO_RATIONALE[anchor] ?? null;
  const requiredTags = BASELINE_ANCHOR_TO_REQUIRED_TAGS[anchor] ?? [];
  const forbiddenDominantAxes = BASELINE_ANCHOR_TO_FORBIDDEN_DOMINANT[anchor] ?? [];
  const rationaleMustInclude = BASELINE_ANCHOR_RATIONALE_MUST_INCLUDE[anchor] ?? [];
  const rationaleMustAvoidOnly = BASELINE_ANCHOR_RATIONALE_MUST_AVOID_ONLY[anchor] ?? [];

  if (!goldPath && focusAxes.length === 0 && !rationale && requiredTags.length === 0) return null;

  return {
    anchorType: anchor,
    goldPath: goldPath || null,
    focusAxes: [...focusAxes],
    rationale,
    requiredTags: [...requiredTags],
    preferredTemplateTags: [...requiredTags],
    forbiddenDominantAxes: [...forbiddenDominantAxes],
    forbiddenTemplateTags: [],
    intensityTier: 'inherit',
    auditExpectations: {
      forbiddenDominantAxes: [...forbiddenDominantAxes],
      requiredFocusAxes: [...focusAxes],
      requiredTags: [...requiredTags],
      rationaleMustInclude: [...rationaleMustInclude],
      rationaleMustAvoidOnly: [...rationaleMustAvoidOnly],
    },
  };
}

/** Legacy resultType band → intent (기존 동작 유지) */
function buildLegacyBandIntent(key: string): FirstSessionIntentSSOT | null {
  const goldPath = RESULT_TYPE_TO_GOLD_PATH[key];
  const focusAxes = RESULT_TYPE_TO_FOCUS_AXES[key] ?? [];
  const rationale = RESULT_TYPE_TO_RATIONALE[key] ?? null;
  const requiredTags = RESULT_TYPE_TO_FOCUS_TAGS[key] ?? [];
  if (!goldPath && focusAxes.length === 0 && !rationale && requiredTags.length === 0) return null;

  const forbiddenDominantAxes =
    key === 'UPPER-LIMB'
      ? ['trunk_control']
      : key === 'LOWER-LIMB'
        ? ['upper_mobility']
        : key === 'NECK-SHOULDER'
          ? ['trunk_control']
          : key === 'LUMBO-PELVIS'
            ? ['upper_mobility']
            : [];

  const rationaleMustInclude =
    key === 'UPPER-LIMB'
      ? ['상체', '어깨', '손목', '팔꿈치', '흉추', '견갑']
      : key === 'LOWER-LIMB'
        ? ['하체', '무릎', '발목', '엉덩이', '골반']
        : key === 'NECK-SHOULDER'
          ? ['목', '어깨', '흉추', '견갑']
          : key === 'LUMBO-PELVIS'
            ? ['몸통', '코어', '호흡', '골반']
            : [];

  const rationaleMustAvoidOnly =
    key === 'UPPER-LIMB'
      ? ['몸통', '코어', '안정성']
      : key === 'NECK-SHOULDER'
        ? ['몸통', '코어', '안정성']
        : [];

  return {
    anchorType: key,
    goldPath: goldPath || null,
    focusAxes: [...focusAxes],
    rationale,
    requiredTags: [...requiredTags],
    preferredTemplateTags: [...requiredTags],
    forbiddenDominantAxes,
    forbiddenTemplateTags: [],
    intensityTier: 'inherit',
    auditExpectations: {
      forbiddenDominantAxes,
      requiredFocusAxes: [...focusAxes],
      requiredTags: [...requiredTags],
      rationaleMustInclude,
      rationaleMustAvoidOnly,
    },
  };
}

/** Backward-compatible wrapper for existing call sites. */
export interface FirstSessionAlignmentPolicy {
  alignedGoldPathVector: string | null;
  alignedFocusAxes: string[];
  alignedRationale: string | null;
}

export function resolveFirstSessionAlignmentPolicy(
  resultType: string | null | undefined,
  sessionNumber: number,
  priorityVector?: Record<string, number> | null,
  painMode?: 'none' | 'caution' | 'protected' | null
): FirstSessionAlignmentPolicy | null {
  const intent = resolveFirstSessionIntent({
    resultType,
    sessionNumber,
    priorityVector,
    painMode,
  });
  if (!intent) return null;
  return {
    alignedGoldPathVector: intent.goldPath,
    alignedFocusAxes: intent.focusAxes,
    alignedRationale: intent.rationale,
  };
}

/**
 * Safety Gate: pain_mode에 따라 추가 exclude 태그 반환.
 * 기존 avoid + painFlags에 더해 사용.
 */
export function getPainModeExtraAvoid(painMode?: PainMode | null): string[] {
  if (!painMode || painMode === 'none') return [];
  if (painMode === 'protected') return [...PAIN_PROTECTED_EXTRA_AVOID];
  if (painMode === 'caution') return [...PAIN_CAUTION_EXTRA_AVOID];
  return [];
}

/**
 * Priority Selector: priority_vector → 이번 세션 우선 focus_tags 2~3개.
 * deep_v3 없으면 null (fallback to existing focus).
 */
export function resolveSessionPriorities(priorityVector?: Record<string, number> | null): string[] | null {
  if (!priorityVector || typeof priorityVector !== 'object') return null;

  const axes = Object.entries(priorityVector)
    .filter(([, v]) => typeof v === 'number' && v > 0)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));

  if (axes.length === 0) return null;

  const tags: string[] = [];
  const seen = new Set<string>();
  for (const [axis] of axes.slice(0, 3)) {
    const axisTags = PRIORITY_AXIS_TO_FOCUS_TAGS[axis] ?? [];
    for (const t of axisTags) {
      if (!seen.has(t)) {
        seen.add(t);
        tags.push(t);
      }
    }
  }
  return tags.length > 0 ? tags : null;
}

/**
 * priority 기반 bonus 점수.
 * template의 focus_tags가 priorityTags와 겹치면 bonus.
 */
export function scoreByPriority(
  templateFocusTags: string[],
  priorityTags: string[] | null,
  bonusPerMatch = 2
): number {
  if (!priorityTags || priorityTags.length === 0) return 0;
  const set = new Set(priorityTags);
  const matches = templateFocusTags.filter((t) => set.has(t)).length;
  return matches * bonusPerMatch;
}

/**
 * pain_mode 기반 penalty.
 * protected: 고위험 contraindication 있으면 penalty.
 * caution: 완화된 penalty.
 */
export function getPainModePenalty(
  contraindications: string[],
  painMode?: PainMode | null
): number {
  if (!painMode || painMode === 'none') return 0;
  const highRisk = new Set(PAIN_PROTECTED_EXTRA_AVOID);
  const hasHighRisk = contraindications.some((c) => highRisk.has(c));
  if (!hasHighRisk) return 0;
  if (painMode === 'protected') return 50;
  if (painMode === 'caution') return 20;
  return 0;
}
