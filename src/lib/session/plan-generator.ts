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
  /** PR-C: deep_level (1~3), 없으면 2. targetLevel base. */
  deep_level?: 1 | 2 | 3;
  pain_risk?: number;
  red_flags?: boolean;
  /** PR-C: safety_mode → maxLevel cap. red=1, yellow=2, none=3 */
  safety_mode?: 'red' | 'yellow' | 'none';
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
    /** PR-C optional enrichment */
    deep_level?: 1 | 2 | 3;
    pain_risk?: number;
    red_flags?: boolean;
    safety_mode?: 'red' | 'yellow' | 'none';
    finalTargetLevel?: number;
    maxLevel?: number;
  };
  flags: { recovery: boolean; short: boolean };
  segments: PlanSegment[];
};

function scoreTemplate(
  t: SessionTemplateRow,
  input: PlanGeneratorInput,
  finalTargetLevel: number
): number {
  const excludeSet = buildExcludeSet(input.avoid, input.painFlags);
  if (hasContraindicationOverlap(t.contraindications, excludeSet)) {
    return -CONTRAINDICATION_PENALTY;
  }

  if (input.usedTemplateIds.includes(t.id)) {
    return -REPETITION_PENALTY;
  }

  let score = 0;
  const primary = input.focus[0];
  const secondary = input.focus[1] ?? input.focus[0];

  if (primary && t.focus_tags.includes(primary)) score += PRIMARY_FOCUS_BONUS;
  if (secondary && t.focus_tags.includes(secondary)) score += SECONDARY_FOCUS_BONUS;

  if (input.timeBudget === 'short' && t.duration_sec <= 420) score += SHORT_DURATION_BONUS;

  if (t.level === finalTargetLevel) score += LEVEL_MATCH_BONUS;

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
 * PR-C: targetLevel 결정론
 * base = deep_level ?? 2, mood → target, safety_mode → maxLevel, finalTargetLevel = min(target, maxLevel)
 */
function computeTargetLevel(input: PlanGeneratorInput): {
  finalTargetLevel: number;
  maxLevel: number;
} {
  const base = input.deep_level ?? 2;
  const target =
    input.conditionMood === 'bad'
      ? 1
      : input.conditionMood === 'ok'
        ? base
        : Math.min(base + 1, 3);
  const maxLevel =
    input.safety_mode === 'red' ? 1 : input.safety_mode === 'yellow' ? 2 : 3;
  const finalTargetLevel = Math.min(target, maxLevel);
  return { finalTargetLevel, maxLevel };
}

/**
 * 세션 플랜 plan_json 생성.
 * 템플릿 1회 조회, 스코어링, 선택, 세그먼트 조립.
 */
export async function buildSessionPlanJson(input: PlanGeneratorInput): Promise<PlanJsonOutput> {
  const templates = await getTemplatesForSessionPlan({
    scoringVersion: input.scoringVersion ?? 'deep_v2',
  });

  const { finalTargetLevel, maxLevel } = computeTargetLevel(input);

  const excludeSet = buildExcludeSet(input.avoid, input.painFlags);
  const candidates = templates.filter(
    (t) =>
      !hasContraindicationOverlap(t.contraindications, excludeSet) && t.level <= maxLevel
  );

  const scored = candidates.map((t) => ({
    template: t,
    score: scoreTemplate(t, input, finalTargetLevel),
  }));

  let sorted = scored
    .filter((s) => s.score >= 0)
    .sort((a, b) => b.score - a.score);

  if (sorted.length === 0) {
    const fallbacks = candidates.length > 0
      ? candidates.filter((t) => t.is_fallback)
      : templates.filter((t) => t.is_fallback && t.level <= maxLevel);
    sorted = fallbacks.map((t) => ({ template: t, score: 0 }));
  }

  const isShort = input.timeBudget === 'short';
  const isRecovery = input.conditionMood === 'bad';
  let mainCount = isShort ? (isRecovery ? 1 : 2) : isRecovery ? 2 : 3;
  if (input.safety_mode === 'red') {
    mainCount = Math.min(mainCount, isShort ? 1 : 2);
  }
  const prepCount = 1;
  const releaseCount = 1;

  const selected: SessionTemplateRow[] = [];
  const used = new Set<string>([...input.usedTemplateIds]);

  for (const { template } of sorted) {
    if (selected.length >= prepCount + mainCount + releaseCount) break;
    if (used.has(template.id)) continue;
    selected.push(template);
    used.add(template.id);
  }

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
      ...(input.deep_level != null && { deep_level: input.deep_level }),
      ...(input.pain_risk != null && { pain_risk: input.pain_risk }),
      ...(input.red_flags != null && { red_flags: input.red_flags }),
      ...(input.safety_mode != null && { safety_mode: input.safety_mode }),
      finalTargetLevel,
      maxLevel,
    },
    flags: {
      recovery: isRecovery,
      short: isShort,
    },
    segments,
  };
}
