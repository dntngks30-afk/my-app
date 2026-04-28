/**
 * PR-RESET-BE-02 — Reset recommendation pure engine (no Supabase/request).
 */
import { RESET_ISSUE_CATALOG } from '@/lib/reset/reset-issue-catalog';
import { RESET_STRETCH_CATALOG } from '@/lib/reset/reset-stretch-catalog';
import type {
  ResetIssueDefinition,
  ResetIssueViewModel,
  ResetRecommendationPatternInput,
  ResetRecommendationResponse,
  ResetStretchDefinition,
  ResetStretchViewModel,
} from '@/lib/reset/types';

const STRETCH_BY_KEY: ReadonlyMap<string, ResetStretchDefinition> = new Map(
  RESET_STRETCH_CATALOG.map((s) => [s.stretch_key, s])
);

/** 기본 타입(primary_type)별 기본 Featured issue_key (RESET_TAB / PR 계약). */
const DEFAULT_FEATURED_BY_PRIMARY_TYPE: Readonly<
  Record<string, string | undefined>
> = {
  UPPER_IMMOBILITY: 'forward_head',
  LOWER_MOBILITY_RESTRICTION: 'hip_tightness',
  LOWER_INSTABILITY: 'knee_discomfort',
  CORE_CONTROL_DEFICIT: 'pelvis_lowback_tension',
  DECONDITIONED: 'thoracic_stiffness',
  STABLE: 'thoracic_stiffness',
  UNKNOWN: 'thoracic_stiffness',
};

const DISPLAY_LABEL_BY_PRIMARY_TYPE: Readonly<Record<string, string>> = {
  UPPER_IMMOBILITY: '상체 긴장형',
  LOWER_MOBILITY_RESTRICTION: '하체 경직형',
  LOWER_INSTABILITY: '하체 불안정형',
  CORE_CONTROL_DEFICIT: '중심 흐트러짐형',
  DECONDITIONED: '전신 무거움형',
  STABLE: '균형형',
};

const FALLBACK_DISPLAY_LABEL = '기본 리셋 추천';

const RESET_CTA_LABEL = '지금 따라하기';

const FALLBACK_ISSUE_KEY = 'thoracic_stiffness';

function normalizePrimaryType(primary: string | null | undefined): string | null {
  if (primary == null) return null;
  const s = primary.trim().toUpperCase();
  return s.length === 0 ? null : s;
}

function displayLabelForPrimary(primaryNormalized: string | null): string {
  if (!primaryNormalized) return FALLBACK_DISPLAY_LABEL;
  return (
    DISPLAY_LABEL_BY_PRIMARY_TYPE[primaryNormalized] ?? FALLBACK_DISPLAY_LABEL
  );
}

export function pickDefaultFeaturedIssueKey(
  primaryType: string | null | undefined
): string {
  const p = normalizePrimaryType(primaryType);
  if (!p) return FALLBACK_ISSUE_KEY;
  return DEFAULT_FEATURED_BY_PRIMARY_TYPE[p] ?? FALLBACK_ISSUE_KEY;
}

export function findFirstIssueMatchingAxis(axis: string): string | null {
  const trimmed = axis.trim();
  if (!trimmed) return null;
  for (const row of RESET_ISSUE_CATALOG) {
    if (row.recommended_for.priority_axes.includes(trimmed)) {
      return row.issue_key;
    }
  }
  return null;
}

/**
 * 우선순위: 기본 featured → (첫 축이 있고) default 이슈 축과 일치하면 유지,
 * 불일치 시에만 카탈로그 순 첫 매칭 이슈로 보정 → 없으면 기본 유지.
 */
export function pickFeaturedIssueKey(
  input: ResetRecommendationPatternInput | null | undefined
): string {
  if (input === null || input === undefined) {
    return FALLBACK_ISSUE_KEY;
  }

  const defaultFeaturedKey = pickDefaultFeaturedIssueKey(input.primary_type);
  const firstAxis = input.priority_vector?.[0];

  if (firstAxis === undefined || String(firstAxis).trim() === '') {
    return defaultFeaturedKey;
  }

  const axis = String(firstAxis).trim();

  const defaultIssueDef = RESET_ISSUE_CATALOG.find(
    (r) => r.issue_key === defaultFeaturedKey
  );
  if (!defaultIssueDef) {
    return defaultFeaturedKey;
  }

  if (defaultIssueDef.recommended_for.priority_axes.includes(axis)) {
    return defaultFeaturedKey;
  }

  const override = findFirstIssueMatchingAxis(axis);
  if (override !== null) {
    return override;
  }

  return defaultFeaturedKey;
}

export function stretchDefinitionToViewModel(
  def: ResetStretchDefinition
): ResetStretchViewModel {
  return {
    stretch_key: def.stretch_key,
    name_ko: def.name_ko,
    name_en: def.name_en,
    asset_slug: def.asset_slug,
    template_id: def.template_id,
    media_status: def.template_id == null ? 'unmapped' : 'ready',
  };
}

export function resolveStretchDefinition(
  stretchKey: string
): ResetStretchDefinition {
  const def = STRETCH_BY_KEY.get(stretchKey);
  if (!def) {
    throw new Error(`Unknown stretch_key: ${stretchKey}`);
  }
  return def;
}

export function durationLabelKo(durationSec: number): string {
  const mins = Math.max(1, Math.round(durationSec / 60));
  return `${mins}분`;
}

export function buildResetIssueViewModel(
  issue: ResetIssueDefinition
): ResetIssueViewModel {
  const primaryDef = resolveStretchDefinition(issue.primary_stretch_key);
  const altDefs = issue.alternative_stretch_keys.map((k) =>
    resolveStretchDefinition(k)
  );

  return {
    issue_key: issue.issue_key,
    issue_label: issue.issue_label,
    short_goal: issue.short_goal,
    card_title: issue.card_title,
    card_summary: issue.card_summary,
    duration_sec: primaryDef.duration_sec,
    duration_label: durationLabelKo(primaryDef.duration_sec),
    primary_stretch: stretchDefinitionToViewModel(primaryDef),
    alternative_stretches: altDefs.map(stretchDefinitionToViewModel),
    cta_label: RESET_CTA_LABEL,
    safety_note: issue.safety_note ?? null,
  };
}

/** 카탈로그 내 template_id 미매핑 고유 스트레칭 수(SSOT 고정 계산 가능). */
export function countUnmappedTemplateStretchesInCatalog(): number {
  const unique = new Set<string>();
  for (const s of RESET_STRETCH_CATALOG) {
    if (s.template_id == null) {
      unique.add(s.stretch_key);
    }
  }
  return unique.size;
}

export type BuildRecommendationParams = {
  pattern: ResetRecommendationPatternInput | null;
  metaSource: 'readiness' | 'fallback';
  /** result_summary.source_mode 매핑. 없거나 폴백 경로면 user_pattern은 fallback 처리. */
  resultSummarySourceMode?: 'baseline' | 'refined' | null;
};

/** 라우트·스모크 공통: 전체 추천 응답 조립 */
export function buildResetRecommendationPayload(
  params: BuildRecommendationParams
): ResetRecommendationResponse {
  const { pattern, metaSource, resultSummarySourceMode } = params;

  const featuredKey = pickFeaturedIssueKey(pattern);

  const issues: ResetIssueViewModel[] = RESET_ISSUE_CATALOG.map((row) =>
    buildResetIssueViewModel(row)
  );

  const featured = issues.find((i) => i.issue_key === featuredKey);
  if (!featured) {
    throw new Error(`Featured issue not in catalog: ${featuredKey}`);
  }

  const primaryNorm = pattern ? normalizePrimaryType(pattern.primary_type) : null;

  let source_stage: ResetRecommendationResponse['user_pattern']['source_stage'];
  if (metaSource === 'fallback') {
    source_stage = 'fallback';
  } else if (resultSummarySourceMode === 'baseline' || resultSummarySourceMode === 'refined') {
    source_stage = resultSummarySourceMode;
  } else {
    source_stage = 'fallback';
  }

  const user_pattern: ResetRecommendationResponse['user_pattern'] = {
    primary_type: primaryNorm,
    secondary_type:
      pattern?.secondary_type === undefined ? null : pattern.secondary_type,
    display_label: displayLabelForPrimary(primaryNorm),
    source_stage,
    priority_vector:
      pattern?.priority_vector && pattern.priority_vector.length > 0
        ? [...pattern.priority_vector]
        : undefined,
    pain_mode:
      pattern?.pain_mode === undefined ? undefined : pattern.pain_mode ?? null,
  };

  return {
    version: 'reset_v1',
    user_pattern,
    featured_issue_key: featuredKey,
    featured,
    issues,
    meta: {
      source: metaSource,
      total_issues: issues.length,
      unmapped_template_count: countUnmappedTemplateStretchesInCatalog(),
    },
  };
}

/** 스모크·유닛: 간단 진입점 (metaSource는 입력 null이면 fallback). */
export function recommendResetForPattern(
  input: ResetRecommendationPatternInput | null,
  options?: { metaSource?: 'readiness' | 'fallback'; resultSummarySourceMode?: 'baseline' | 'refined' | null }
): ResetRecommendationResponse {
  const metaSource =
    options?.metaSource ??
    (input === null || input === undefined ? 'fallback' : 'readiness');
  const resultStage =
    options?.resultSummarySourceMode ??
    (metaSource === 'readiness' ? 'baseline' : null);

  return buildResetRecommendationPayload({
    pattern: input,
    metaSource,
    resultSummarySourceMode: resultStage,
  });
}
