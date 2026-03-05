/**
 * Session Plan Generator (BE-06)
 *
 * exercise_templates 기반 plan_json 생성.
 * Safety gate, repetition penalty, phase별 focus 반영.
 */

import { getTemplatesForSessionPlan, type SessionTemplateRow } from '@/lib/workout-routine/exercise-templates-db';
import { computePhase, type Phase } from './phase';
import { buildExcludeSet, hasContraindicationOverlap } from './safety';

const REPETITION_PENALTY = 100;
const REPETITION_PENALTY_RELAXED = 10; // Pass2: used_template_ids 완화
const CONTRAINDICATION_PENALTY = 100;
const PRIMARY_FOCUS_BONUS = 3;
const SECONDARY_FOCUS_BONUS = 2;
const SHORT_DURATION_BONUS = 1;
const LEVEL_MATCH_BONUS = 1;

export type ConditionMood = 'good' | 'ok' | 'bad';
export type TimeBudget = 'short' | 'normal';

export type PlanGeneratorInput = {
  sessionNumber: number;
  totalSessions: number;
  phase: Phase;
  theme: string;
  timeBudget: TimeBudget;
  conditionMood: ConditionMood;
  focus: string[];
  avoid: string[];
  painFlags: string[];
  usedTemplateIds: string[];
  resultType?: string;
  confidence?: number;
  scoringVersion?: string;
};

export type PlanItem = {
  order: number;
  templateId: string;
  name: string;
  sets?: number;
  reps?: number;
  hold_seconds?: number;
  focus_tag?: string | null;
  media_ref?: unknown;
};

export type PlanSegment = {
  title: string;
  duration_sec: number;
  items: PlanItem[];
};

/** plan_json 품질 audit (meta.audit, consumers 무시 가능) */
export type PlanAudit = {
  candidate_count: number;
  selected_count: number;
  unique_count: number;
  fallback_count: number;
  primary_coverage: boolean;
  secondary_coverage: boolean;
  conflicts: number;
  degraded: boolean;
  degraded_reason: string[];
};

export type PlanJsonOutput = {
  version: string;
  meta: {
    session_number: number;
    phase: number;
    result_type?: string;
    confidence?: number;
    focus: string[];
    avoid: string[];
    scoring_version: string;
    used_template_ids: string[];
    audit?: PlanAudit;
  };
  flags: { recovery: boolean; short: boolean };
  segments: PlanSegment[];
};

function scoreTemplate(
  t: SessionTemplateRow,
  input: PlanGeneratorInput,
  repetitionPenalty: number = REPETITION_PENALTY
): number {
  const excludeSet = buildExcludeSet(input.avoid, input.painFlags);
  if (hasContraindicationOverlap(t.contraindications, excludeSet)) {
    return -CONTRAINDICATION_PENALTY;
  }

  if (input.usedTemplateIds.includes(t.id)) {
    return -repetitionPenalty;
  }

  let score = 0;
  const primary = input.focus[0];
  const secondary = input.focus[1] ?? input.focus[0];

  if (primary && t.focus_tags.includes(primary)) score += PRIMARY_FOCUS_BONUS;
  if (secondary && t.focus_tags.includes(secondary)) score += SECONDARY_FOCUS_BONUS;

  if (input.timeBudget === 'short' && t.duration_sec <= 420) score += SHORT_DURATION_BONUS;

  const targetLevel = input.conditionMood === 'bad' ? 1 : input.conditionMood === 'good' ? 2 : 1;
  if (t.level === targetLevel) score += LEVEL_MATCH_BONUS;

  return score;
}

function toPlanItem(
  t: SessionTemplateRow,
  order: number,
  segmentTitle: string,
  conditionMood: ConditionMood
): PlanItem {
  const isRecovery = conditionMood === 'bad';
  const sets = isRecovery ? 1 : 2;
  const reps = isRecovery ? 8 : 12;
  const focusTag = t.focus_tags[0] ?? null;

  const item: PlanItem = {
    order,
    templateId: t.id,
    name: t.name,
    focus_tag: focusTag,
    media_ref: t.media_ref ?? undefined,
  };

  if (t.name.includes('이완') || segmentTitle === 'Release') {
    item.sets = 1;
    item.hold_seconds = 30;
  } else {
    item.sets = sets;
    item.reps = reps;
  }

  return item;
}

/**
 * 세션 플랜 plan_json 생성.
 * 템플릿 1회 조회, 스코어링, 선택, 세그먼트 조립.
 */
export async function buildSessionPlanJson(input: PlanGeneratorInput): Promise<PlanJsonOutput> {
  const templates = await getTemplatesForSessionPlan({
    scoringVersion: input.scoringVersion ?? 'deep_v2',
  });

  const excludeSet = buildExcludeSet(input.avoid, input.painFlags);
  const candidates = templates.filter(
    (t) => !hasContraindicationOverlap(t.contraindications, excludeSet)
  );

  const isShort = input.timeBudget === 'short';
  const isRecovery = input.conditionMood === 'bad';
  const mainCount = isShort ? (isRecovery ? 1 : 2) : isRecovery ? 2 : 3;
  const prepCount = 1;
  const releaseCount = 1;
  const requiredCount = prepCount + mainCount + releaseCount;

  const degradedReasons: string[] = [];

  function selectFromScored(
    scored: { template: SessionTemplateRow; score: number }[],
    used: Set<string>
  ): SessionTemplateRow[] {
    const out: SessionTemplateRow[] = [];
    for (const { template } of scored) {
      if (out.length >= requiredCount) break;
      if (used.has(template.id)) continue;
      out.push(template);
      used.add(template.id);
    }
    return out;
  }

  const scoredPass1 = candidates.map((t) => ({
    template: t,
    score: scoreTemplate(t, input, REPETITION_PENALTY),
  }));
  let sortedPass1 = scoredPass1
    .filter((s) => s.score >= 0)
    .sort((a, b) => b.score - a.score);

  if (sortedPass1.length === 0) {
    const fallbacks = candidates.length > 0
      ? candidates.filter((t) => t.is_fallback)
      : templates.filter((t) => t.is_fallback);
    sortedPass1 = fallbacks.map((t) => ({ template: t, score: 0 }));
    degradedReasons.push('FALLBACK_ONLY');
  }

  const used = new Set<string>([...input.usedTemplateIds]);
  let selected = selectFromScored(sortedPass1, used);

  if (selected.length < requiredCount && sortedPass1.length > 0) {
    const scoredPass2 = candidates.map((t) => ({
      template: t,
      score: scoreTemplate(t, input, REPETITION_PENALTY_RELAXED),
    }));
    const sortedPass2 = scoredPass2
      .filter((s) => s.score >= 0)
      .sort((a, b) => b.score - a.score);
    if (sortedPass2.length > 0) {
      const used2 = new Set<string>([...input.usedTemplateIds]);
      selected = selectFromScored(sortedPass2, used2);
      degradedReasons.push('PASS2_RELAXED');
    }
  }

  if (selected.length < requiredCount) {
    degradedReasons.push('LOW_CANDIDATES');
  }

  const primary = input.focus[0];
  const secondary = input.focus[1] ?? input.focus[0];
  const primaryCoverage = !primary || selected.some((t) => t.focus_tags.includes(primary));
  const secondaryCoverage = !secondary || selected.some((t) => t.focus_tags.includes(secondary));
  if (!primaryCoverage) degradedReasons.push('PRIMARY_COVERAGE_MISS');
  if (!secondaryCoverage && primary !== secondary) degradedReasons.push('SECONDARY_COVERAGE_MISS');

  const audit: PlanAudit = {
    candidate_count: candidates.length,
    selected_count: selected.length,
    unique_count: new Set(selected.map((t) => t.id)).size,
    fallback_count: selected.filter((t) => t.is_fallback).length,
    primary_coverage: primaryCoverage,
    secondary_coverage: secondaryCoverage,
    conflicts: 0,
    degraded: degradedReasons.length > 0,
    degraded_reason: degradedReasons,
  };

  const prepItems = selected.slice(0, prepCount);
  const mainItems = selected.slice(prepCount, prepCount + mainCount);
  const releaseItems = selected.slice(prepCount + mainCount, prepCount + mainCount + releaseCount);

  const prepDuration = isShort ? 120 : 180;
  const mainDuration = isShort ? 240 : 420;
  const releaseDuration = isShort ? 60 : 120;

  const sets = isShort ? 2 : 3;
  const reps = isRecovery ? 8 : 12;

  const segments: PlanSegment[] = [];

  if (prepItems.length > 0) {
    segments.push({
      title: 'Prep',
      duration_sec: prepDuration,
      items: prepItems.map((t, i) =>
        toPlanItem(t, i + 1, 'Prep', input.conditionMood)
      ),
    });
  }

  if (mainItems.length > 0) {
    segments.push({
      title: 'Main',
      duration_sec: mainDuration,
      items: mainItems.map((t, i) =>
        toPlanItem(t, i + 1, 'Main', input.conditionMood)
      ),
    });
  }

  if (releaseItems.length > 0) {
    segments.push({
      title: 'Release',
      duration_sec: releaseDuration,
      items: releaseItems.map((t, i) =>
        toPlanItem(t, i + 1, 'Release', input.conditionMood)
      ),
    });
  }

  const usedTemplateIds = selected.map((t) => t.id);

  return {
    version: 'session_plan_v1',
    meta: {
      session_number: input.sessionNumber,
      phase: input.phase,
      result_type: input.resultType ?? 'UNKNOWN',
      confidence: (input.confidence ?? 0) >= 0.7 ? 'high' : (input.confidence ?? 0) >= 0.4 ? 'mid' : 'low',
      focus: input.focus.slice(0, 4),
      avoid: input.avoid.slice(0, 4),
      scoring_version: input.scoringVersion ?? 'deep_v2',
      used_template_ids: usedTemplateIds,
      audit,
    },
    flags: {
      recovery: isRecovery,
      short: isShort,
    },
    segments,
  };
}
