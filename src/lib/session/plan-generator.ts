/**
 * Session Plan Generator (BE-06)
 *
 * exercise_templates 기반 plan_json 생성.
 * Safety gate, repetition penalty, phase별 focus 반영.
 */

import { getTemplatesForSessionPlan, type SessionTemplateRow } from '@/lib/workout-routine/exercise-templates-db';
import { computePhase, type Phase } from './phase';
import { buildExcludeSet, hasContraindicationOverlap } from './safety';
import {
  getPainModeExtraAvoid,
  resolveSessionPriorities,
  scoreByPriority,
  getPainModePenalty,
} from './priority-layer';

const REPETITION_PENALTY = 100;
const CONTRAINDICATION_PENALTY = 100;
const MAX_LEVEL_CAP = 3;
const PRIMARY_FOCUS_BONUS = 3;
const SECONDARY_FOCUS_BONUS = 2;
/** PR-ALG-03: priority_vector 기반 추가 보너스 */
const PRIORITY_MATCH_BONUS = 2;
const SHORT_DURATION_BONUS = 1;
const LEVEL_MATCH_BONUS = 1;

/** PR-P2-4: constraint hardening */
const MAX_SAME_FOCUS_IN_MAIN = 2;

/** Phase-safe composition: focus_tags → segment eligibility (no DB change) */
const PREP_TAGS = new Set([
  'full_body_reset', 'calf_release', 'upper_trap_release', 'neck_mobility',
  'thoracic_mobility', 'shoulder_mobility', 'hip_flexor_stretch', 'hip_mobility',
  'ankle_mobility', 'core_control',
]);
const MAIN_TAGS = new Set([
  'core_stability', 'global_core', 'upper_back_activation', 'shoulder_stability',
  'glute_activation', 'lower_chain_stability', 'glute_medius', 'basic_balance',
]);
/** Main-strength tags: NEVER place in Release/Cooldown */
const MAIN_EXCLUSIVE_FROM_RELEASE = new Set([
  'lower_chain_stability', 'glute_medius', 'glute_activation', 'core_stability',
  'global_core', 'shoulder_stability', 'upper_back_activation',
]);
const RELEASE_TAGS = new Set([
  'full_body_reset', 'calf_release', 'upper_trap_release', 'neck_mobility',
  'thoracic_mobility', 'shoulder_mobility', 'hip_flexor_stretch', 'hip_mobility',
]);

function isPrepEligible(t: SessionTemplateRow): boolean {
  return t.focus_tags.some((tag) => PREP_TAGS.has(tag));
}
function isMainEligible(t: SessionTemplateRow): boolean {
  return t.focus_tags.some((tag) => MAIN_TAGS.has(tag));
}
function isReleaseEligible(t: SessionTemplateRow): boolean {
  const hasReleaseTag = t.focus_tags.some((tag) => RELEASE_TAGS.has(tag));
  const hasMainExclusive = t.focus_tags.some((tag) => MAIN_EXCLUSIVE_FROM_RELEASE.has(tag));
  return hasReleaseTag && !hasMainExclusive;
}
const MIN_CANDIDATES_FOR_STRICT_AVOID = 3;
const SHORT_TOTAL_ITEM_CAP = 4;

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
  /** PR-P2-3: adaptive overlay from recent feedback */
  adaptiveOverlay?: {
    targetLevelDelta?: -1 | 0 | 1;
    forceShort?: boolean;
    forceRecovery?: boolean;
    avoidTemplateIds?: string[];
  };
  /** PR-ALG-02: deep_v3 additive (optional) */
  primary_type?: string;
  secondary_type?: string | null;
  priority_vector?: Record<string, number>;
  pain_mode?: 'none' | 'caution' | 'protected';
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
    /** PR-ALG-02: deep_v3 additive */
    primary_type?: string;
    secondary_type?: string | null;
    priority_vector?: Record<string, number>;
    pain_mode?: 'none' | 'caution' | 'protected';
    /** PR-P2-4: constraint trace */
    constraint_flags?: {
      avoid_filter_applied: boolean;
      duplicate_filtered_count: number;
      focus_diversity_enforced: boolean;
      fallback_used: boolean;
      short_mode_applied: boolean;
      recovery_mode_applied: boolean;
      /** PR-ALG-03 */
      priority_applied?: boolean;
      pain_gate_applied?: boolean;
    };
  };
  flags: { recovery: boolean; short: boolean };
  segments: PlanSegment[];
};

function scoreTemplate(
  t: SessionTemplateRow,
  input: PlanGeneratorInput,
  finalTargetLevel: number,
  excludeSet: Set<string>
): number {
  if (hasContraindicationOverlap(t.contraindications, excludeSet)) {
    return -CONTRAINDICATION_PENALTY;
  }

  if (input.usedTemplateIds.includes(t.id)) {
    return -REPETITION_PENALTY;
  }

  let score = 0;

  // PR-ALG-03: priority_vector 우선, 없으면 focus fallback
  const priorityTags = resolveSessionPriorities(input.priority_vector);
  const effectiveFocus = priorityTags && priorityTags.length > 0 ? priorityTags : input.focus;
  const primary = effectiveFocus[0];
  const secondary = effectiveFocus[1] ?? effectiveFocus[0];

  if (primary && t.focus_tags.includes(primary)) score += PRIMARY_FOCUS_BONUS;
  if (secondary && t.focus_tags.includes(secondary)) score += SECONDARY_FOCUS_BONUS;

  // PR-ALG-03: priority_vector 기반 추가 보너스
  if (priorityTags) {
    score += scoreByPriority(t.focus_tags, priorityTags, PRIORITY_MATCH_BONUS);
  }

  // PR-ALG-03: pain_mode 기반 penalty
  score -= getPainModePenalty(t.contraindications, input.pain_mode);

  if (input.timeBudget === 'short' && t.duration_sec <= 420) score += SHORT_DURATION_BONUS;

  if (t.level === finalTargetLevel) score += LEVEL_MATCH_BONUS;

  return score;
}

/**
 * PR-P2-4: Phase-safe selection. Prep/Main/Release each use phase-eligible templates only.
 * Fallback: Release may use prep-eligible (stretch) if no release-eligible; never main-exclusive.
 * Deterministic: same input → same output.
 */
function selectTemplatesWithConstraints(
  sorted: Array<{ template: SessionTemplateRow; score: number }>,
  usedTemplateIds: string[],
  prepCount: number,
  mainCount: number,
  releaseCount: number,
  onDuplicateFiltered: (count: number) => void
): SessionTemplateRow[] {
  const used = new Set<string>([...usedTemplateIds]);
  let duplicateFiltered = 0;

  const pick = (
    pool: Array<{ template: SessionTemplateRow; score: number }>,
    eligible: (t: SessionTemplateRow) => boolean,
    count: number,
    mainFocusCap?: Map<string, number>
  ): SessionTemplateRow[] => {
    const out: SessionTemplateRow[] = [];
    for (const { template } of pool) {
      if (out.length >= count) break;
      if (used.has(template.id)) {
        duplicateFiltered++;
        continue;
      }
      if (!eligible(template)) continue;
      if (mainFocusCap) {
        const ft = template.focus_tags[0] ?? '_none';
        if ((mainFocusCap.get(ft) ?? 0) >= MAX_SAME_FOCUS_IN_MAIN) continue;
      }
      out.push(template);
      used.add(template.id);
      if (mainFocusCap) {
        const ft = template.focus_tags[0] ?? '_none';
        mainFocusCap.set(ft, (mainFocusCap.get(ft) ?? 0) + 1);
      }
    }
    return out;
  };

  const mainFocusCount = new Map<string, number>();
  let prepItems = pick(sorted, isPrepEligible, prepCount);
  if (prepItems.length < prepCount) {
    prepItems = [...prepItems, ...pick(sorted, () => true, prepCount - prepItems.length)];
  }
  let mainItems = pick(sorted, isMainEligible, mainCount, mainFocusCount);
  if (mainItems.length < mainCount) {
    mainItems = [...mainItems, ...pick(sorted, () => true, mainCount - mainItems.length, mainFocusCount)];
  }
  let releaseItems = pick(sorted, isReleaseEligible, releaseCount);
  if (releaseItems.length < releaseCount) {
    const more = pick(sorted, isPrepEligible, releaseCount - releaseItems.length);
    releaseItems = [...releaseItems, ...more];
  }
  if (releaseItems.length < releaseCount) {
    const safeForRelease = (t: SessionTemplateRow) =>
      !t.focus_tags.some((tag) => MAIN_EXCLUSIVE_FROM_RELEASE.has(tag));
    const more = pick(sorted, safeForRelease, releaseCount - releaseItems.length);
    releaseItems = [...releaseItems, ...more];
  }

  onDuplicateFiltered(duplicateFiltered);
  return [...prepItems, ...mainItems, ...releaseItems];
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
 * PR-P2-3: adaptiveOverlay.targetLevelDelta 적용 (clamp 1~3)
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
  let finalTargetLevel = Math.min(target, maxLevel);

  const delta = input.adaptiveOverlay?.targetLevelDelta ?? 0;
  if (delta !== 0) {
    finalTargetLevel = Math.min(MAX_LEVEL_CAP, Math.max(1, finalTargetLevel + delta));
    finalTargetLevel = Math.min(finalTargetLevel, maxLevel);
  }
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

  // PR-ALG-03: pain_mode Safety Gate - 추가 제외 태그
  const painExtraAvoid = getPainModeExtraAvoid(input.pain_mode);
  const extendedPainFlags = [...input.painFlags, ...painExtraAvoid];
  const excludeSet = buildExcludeSet(input.avoid, extendedPainFlags);
  const avoidIds = new Set(input.adaptiveOverlay?.avoidTemplateIds ?? []);
  const candidates = templates.filter(
    (t) =>
      !hasContraindicationOverlap(t.contraindications, excludeSet) &&
      t.level <= maxLevel &&
      !avoidIds.has(t.id)
  );

  const scored = candidates.map((t) => ({
    template: t,
    score: scoreTemplate(t, input, finalTargetLevel, excludeSet),
  }));

  let sorted = scored
    .filter((s) => s.score >= 0)
    .sort((a, b) => b.score - a.score);

  let usedFallbackPool = false;
  if (sorted.length === 0) {
    const fallbacks = candidates.length > 0
      ? candidates.filter((t) => t.is_fallback)
      : templates.filter((t) => t.is_fallback && t.level <= maxLevel);
    sorted = fallbacks.map((t) => ({ template: t, score: 0 }));
    usedFallbackPool = true;
  }

  const overlay = input.adaptiveOverlay;
  const isShort = overlay?.forceShort ?? input.timeBudget === 'short';
  const isRecovery = overlay?.forceRecovery ?? input.conditionMood === 'bad';
  let mainCount = isShort ? (isRecovery ? 1 : 2) : isRecovery ? 2 : 3;
  if (input.safety_mode === 'red') {
    mainCount = Math.min(mainCount, isShort ? 1 : 2);
  }
  const prepCount = 1;
  const releaseCount = 1;
  if (isShort && prepCount + mainCount + releaseCount > SHORT_TOTAL_ITEM_CAP) {
    mainCount = Math.max(1, SHORT_TOTAL_ITEM_CAP - prepCount - releaseCount);
  }
  const totalNeeded = prepCount + mainCount + releaseCount;

  const avoidFilterApplied = avoidIds.size > 0;
  const fallbackUsed = usedFallbackPool;
  let duplicateFilteredCount = 0;

  let selected = selectTemplatesWithConstraints(
    sorted,
    input.usedTemplateIds,
    prepCount,
    mainCount,
    releaseCount,
    (d) => { duplicateFilteredCount = d; }
  );

  if (selected.length < totalNeeded && candidates.length < MIN_CANDIDATES_FOR_STRICT_AVOID) {
    const relaxedCandidates = templates.filter(
      (t) =>
        t.level <= maxLevel &&
        !hasContraindicationOverlap(t.contraindications, excludeSet)
    );
    const relaxedSorted = relaxedCandidates.map((t) => ({ template: t, score: 0 }));
    const relaxedSelected = selectTemplatesWithConstraints(
      relaxedSorted,
      input.usedTemplateIds,
      prepCount,
      mainCount,
      releaseCount,
      () => {}
    );
    if (relaxedSelected.length >= totalNeeded) {
      selected = relaxedSelected;
    }
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
      ...(input.primary_type != null && { primary_type: input.primary_type }),
      ...(input.secondary_type !== undefined && { secondary_type: input.secondary_type }),
      ...(input.priority_vector != null && { priority_vector: input.priority_vector }),
      ...(input.pain_mode != null && { pain_mode: input.pain_mode }),
      finalTargetLevel,
      maxLevel,
      constraint_flags: {
        avoid_filter_applied: avoidFilterApplied,
        duplicate_filtered_count: duplicateFilteredCount,
        focus_diversity_enforced: true,
        fallback_used: fallbackUsed,
        short_mode_applied: isShort,
        recovery_mode_applied: isRecovery,
        priority_applied: !!input.priority_vector,
        pain_gate_applied: !!input.pain_mode && input.pain_mode !== 'none',
      },
    },
    flags: {
      recovery: isRecovery,
      short: isShort,
    },
    segments,
  };
}
