/**
 * PR-ALG-16A: General Session Constraint Engine.
 * Pure function, reusable from plan generator and compatibility wrappers.
 */

import type { PlanJsonOutput, PlanSegment } from '@/lib/session/plan-generator';
import {
  CONSTRAINT_ENGINE_VERSION,
  FATIGUE_CAP_SCORE,
  FATIGUE_HOLD_UNIT_SECONDS,
  FATIGUE_WEIGHT_DIFFICULTY,
  FATIGUE_WEIGHT_PROGRESSION,
  LOW_INVENTORY_TEMPLATE_THRESHOLD,
  MAIN_COUNT_MIN,
  PATTERN_CAP_MAIN,
  PHASE_ORDER,
} from './constants';
import { applyFirstSessionPolicy } from './applyFirstSessionPolicy';
import { createConstraintReason } from './reasons';
import type {
  ConstraintEngineContext,
  ConstraintEngineMeta,
  ConstraintEngineResult,
  ConstraintReason,
  ConstraintTemplateLike,
} from './types';

const MAIN_TITLE = 'Main';
const ACCESSORY_TITLE = 'Accessory';

function cloneSegments(segments: PlanSegment[]): PlanSegment[] {
  return segments.map((segment) => ({
    ...segment,
    items: segment.items.map((item) => ({ ...item })),
  }));
}

function getPhaseOrderIndex(title: string): number {
  const idx = PHASE_ORDER.indexOf(title as (typeof PHASE_ORDER)[number]);
  return idx >= 0 ? idx : PHASE_ORDER.length;
}

function getMainSegment(segments: PlanSegment[]): PlanSegment | undefined {
  return segments.find((segment) => segment.title === MAIN_TITLE);
}

function getOrCreateAccessorySegment(segments: PlanSegment[]): PlanSegment {
  const existing = segments.find((segment) => segment.title === ACCESSORY_TITLE);
  if (existing) return existing;
  const accessory: PlanSegment = {
    title: ACCESSORY_TITLE,
    duration_sec: 120,
    items: [],
  };
  const cooldownIdx = segments.findIndex((segment) => segment.title === 'Cooldown');
  if (cooldownIdx >= 0) {
    segments.splice(cooldownIdx, 0, accessory);
  } else {
    segments.push(accessory);
  }
  return accessory;
}

function countMainItems(segments: PlanSegment[]): number {
  return getMainSegment(segments)?.items.length ?? 0;
}

function countTotalItems(segments: PlanSegment[]): number {
  return segments.reduce((sum, segment) => sum + segment.items.length, 0);
}

function normalizePhaseOrder(
  segments: PlanSegment[],
  reasons: ConstraintReason[]
): PlanSegment[] {
  const normalized = [...segments].sort((a, b) => getPhaseOrderIndex(a.title) - getPhaseOrderIndex(b.title));
  const changed = normalized.some((segment, index) => segment.title !== segments[index]?.title);
  if (changed) {
    reasons.push(
      createConstraintReason(
        'degrade_applied',
        'phase_order_violation',
        'session',
        'segment order normalized to Prep → Main → Accessory → Cooldown'
      )
    );
  }
  return normalized;
}

function findSafeReplacement(
  templates: ConstraintTemplateLike[],
  templateById: Map<string, ConstraintTemplateLike>,
  usedIds: Set<string>,
  originalTemplateId: string,
  segmentTitle: string,
  painMode: 'none' | 'caution' | 'protected'
): ConstraintTemplateLike | null {
  const original = templateById.get(originalTemplateId);
  const desiredPhase = segmentTitle.toLowerCase();
  const originalFocus = original?.focus_tags[0] ?? null;
  const candidates = templates
    .filter((template) => {
      if (usedIds.has(template.id)) return false;
      if (painMode !== 'none' && (template.avoid_if_pain_mode ?? []).includes(painMode)) return false;
      if (painMode === 'protected' && (template.balance_demand === 'high' || template.complexity === 'high')) {
        return false;
      }
      if (template.phase && template.phase !== desiredPhase) {
        if (!(segmentTitle === 'Accessory' && template.phase === 'main')) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const aFocus = a.focus_tags[0] ?? '';
      const bFocus = b.focus_tags[0] ?? '';
      const aMatch = aFocus === originalFocus ? 1 : 0;
      const bMatch = bFocus === originalFocus ? 1 : 0;
      if (bMatch !== aMatch) return bMatch - aMatch;
      return a.id.localeCompare(b.id);
    });

  return candidates[0] ?? null;
}

function enforcePainModeSafety(
  segments: PlanSegment[],
  templates: ConstraintTemplateLike[],
  context: ConstraintEngineContext,
  reasons: ConstraintReason[]
): void {
  const painMode = context.painMode ?? 'none';
  if (painMode === 'none') return;

  const templateById = new Map(templates.map((template) => [template.id, template]));
  const usedIds = new Set(segments.flatMap((segment) => segment.items.map((item) => item.templateId)));

  for (let segIdx = 0; segIdx < segments.length; segIdx++) {
    const segment = segments[segIdx]!;
    for (let itemIdx = 0; itemIdx < segment.items.length; itemIdx++) {
      const item = segment.items[itemIdx]!;
      const template = templateById.get(item.templateId);
      if (!template) continue;

      const blockedByPain = (template.avoid_if_pain_mode ?? []).includes(painMode);
      const blockedByProtected =
        painMode === 'protected' &&
        (template.balance_demand === 'high' || template.complexity === 'high');
      if (!blockedByPain && !blockedByProtected) continue;

      const replacement = findSafeReplacement(templates, templateById, usedIds, item.templateId, segment.title, painMode);
      if (replacement) {
        usedIds.delete(item.templateId);
        usedIds.add(replacement.id);
        segment.items[itemIdx] = {
          ...item,
          templateId: replacement.id,
          name: replacement.name,
          focus_tag: replacement.focus_tags[0] ?? item.focus_tag ?? null,
          media_ref: replacement.media_ref ?? item.media_ref,
        };
        reasons.push(
          createConstraintReason(
            'hard_block',
            'blocked_by_pain_mode',
            'item',
            `unsafe item replaced for pain_mode=${painMode}: ${item.templateId} -> ${replacement.id}`,
            { segmentIndex: segIdx, itemIndex: itemIdx, beforeValue: item.templateId, afterValue: replacement.id }
          )
        );
      } else {
        segment.items.splice(itemIdx, 1);
        itemIdx -= 1;
        reasons.push(
          createConstraintReason(
            'degrade_applied',
            'degraded_due_to_low_inventory',
            'item',
            `unsafe item removed with no safe replacement: ${item.templateId}`,
            { segmentIndex: segIdx, beforeValue: item.templateId }
          )
        );
      }
    }
  }
}

function enforceMainCountMinimum(
  segments: PlanSegment[],
  templates: ConstraintTemplateLike[],
  context: ConstraintEngineContext,
  reasons: ConstraintReason[]
): void {
  if (context.isFirstSession) return;

  const main = getMainSegment(segments);
  if (!main) return;

  const before = main.items.length;
  if (before >= MAIN_COUNT_MIN) return;

  const accessory = segments.find((segment) => segment.title === ACCESSORY_TITLE);
  while (main.items.length < MAIN_COUNT_MIN && accessory?.items.length) {
    const promoted = accessory.items.shift();
    if (!promoted) break;
    main.items.push(promoted);
  }

  if (main.items.length >= MAIN_COUNT_MIN) {
    reasons.push(
      createConstraintReason(
        'degrade_applied',
        'degraded_due_to_main_count_shortage',
        'segment',
        `promoted accessory items to satisfy main minimum (${before} -> ${main.items.length})`,
        { beforeValue: before, afterValue: main.items.length }
      )
    );
    return;
  }

  const lowInventory = templates.length < LOW_INVENTORY_TEMPLATE_THRESHOLD;
  reasons.push(
    createConstraintReason(
      'degrade_applied',
      lowInventory ? 'degraded_due_to_low_inventory' : 'degraded_due_to_main_count_shortage',
      'segment',
      `main count below minimum (${main.items.length}/${MAIN_COUNT_MIN}) after degrade`
    )
  );
}

function enforcePatternCap(
  segments: PlanSegment[],
  templates: ConstraintTemplateLike[],
  reasons: ConstraintReason[]
): void {
  const main = getMainSegment(segments);
  if (!main) return;

  const templateById = new Map(templates.map((template) => [template.id, template]));
  const focusBuckets = new Map<string, number[]>();
  for (let idx = 0; idx < main.items.length; idx++) {
    const template = templateById.get(main.items[idx]!.templateId);
    const focus = template?.focus_tags[0] ?? '_none';
    const bucket = focusBuckets.get(focus) ?? [];
    bucket.push(idx);
    focusBuckets.set(focus, bucket);
  }

  const accessory = getOrCreateAccessorySegment(segments);
  for (const [focus, indexes] of focusBuckets) {
    if (focus === '_none' || indexes.length <= PATTERN_CAP_MAIN) continue;
    const extras = indexes.slice(PATTERN_CAP_MAIN).reverse();
    for (const itemIndex of extras) {
      const [moved] = main.items.splice(itemIndex, 1);
      if (moved) accessory.items.unshift(moved);
    }
    reasons.push(
      createConstraintReason(
        'hard_block',
        'blocked_by_pattern_cap',
        'segment',
        `moved ${extras.length} overloaded main item(s) with focus ${focus} to Accessory`
      )
    );
  }
}

function computeFatigueScore(
  segments: PlanSegment[],
  templates: ConstraintTemplateLike[]
): number {
  const templateById = new Map(templates.map((template) => [template.id, template]));
  let score = 0;
  for (const segment of segments) {
    for (const item of segment.items) {
      const template = templateById.get(item.templateId);
      const diffWeight = FATIGUE_WEIGHT_DIFFICULTY[template?.difficulty ?? ''] ?? 2;
      const progressionWeight = Math.max(0, (template?.progression_level ?? 1) - 1) * FATIGUE_WEIGHT_PROGRESSION;
      const sets = item.sets ?? 2;
      const repsWeight = Math.ceil((item.reps ?? 0) / 8);
      const holdWeight = Math.ceil((item.hold_seconds ?? 0) / FATIGUE_HOLD_UNIT_SECONDS);
      score += diffWeight + progressionWeight + sets + repsWeight + holdWeight;
    }
  }
  return score;
}

function reduceFatigueLoad(segments: PlanSegment[]): boolean {
  const order = ['Accessory', 'Main', 'Prep', 'Cooldown'];
  for (const title of order) {
    const segment = segments.find((candidate) => candidate.title === title);
    if (!segment) continue;
    for (let idx = segment.items.length - 1; idx >= 0; idx--) {
      const item = segment.items[idx]!;
      if ((item.sets ?? 0) > 1) {
        item.sets = (item.sets ?? 2) - 1;
        return true;
      }
      if ((item.reps ?? 0) > 8) {
        item.reps = Math.max(8, (item.reps ?? 12) - 4);
        return true;
      }
      if ((item.hold_seconds ?? 0) > 20) {
        item.hold_seconds = Math.max(20, (item.hold_seconds ?? 30) - 10);
        return true;
      }
    }
  }
  const accessory = segments.find((segment) => segment.title === ACCESSORY_TITLE);
  if (accessory && accessory.items.length > 0) {
    accessory.items.pop();
    return true;
  }
  return false;
}

function replaceForFatigue(
  segments: PlanSegment[],
  templates: ConstraintTemplateLike[]
): boolean {
  const templateById = new Map(templates.map((template) => [template.id, template]));
  const usedIds = new Set(segments.flatMap((segment) => segment.items.map((item) => item.templateId)));

  for (const title of ['Main', 'Accessory']) {
    const segment = segments.find((candidate) => candidate.title === title);
    if (!segment) continue;
    for (let idx = segment.items.length - 1; idx >= 0; idx--) {
      const item = segment.items[idx]!;
      const current = templateById.get(item.templateId);
      if (!current) continue;
      const replacement = templates
        .filter((template) => {
          if (usedIds.has(template.id)) return false;
          if (template.phase && template.phase !== title.toLowerCase()) {
            if (!(title === 'Accessory' && template.phase === 'main')) return false;
          }
          const currentDifficulty = FATIGUE_WEIGHT_DIFFICULTY[current.difficulty ?? ''] ?? 2;
          const nextDifficulty = FATIGUE_WEIGHT_DIFFICULTY[template.difficulty ?? ''] ?? 2;
          const currentProgression = current.progression_level ?? 1;
          const nextProgression = template.progression_level ?? 1;
          return nextDifficulty < currentDifficulty || nextProgression < currentProgression;
        })
        .sort((a, b) => {
          const aWeight = (FATIGUE_WEIGHT_DIFFICULTY[a.difficulty ?? ''] ?? 2) + (a.progression_level ?? 1);
          const bWeight = (FATIGUE_WEIGHT_DIFFICULTY[b.difficulty ?? ''] ?? 2) + (b.progression_level ?? 1);
          return aWeight - bWeight || a.id.localeCompare(b.id);
        })[0];
      if (!replacement) continue;
      usedIds.delete(item.templateId);
      usedIds.add(replacement.id);
      segment.items[idx] = {
        ...item,
        templateId: replacement.id,
        name: replacement.name,
        focus_tag: replacement.focus_tags[0] ?? item.focus_tag ?? null,
        media_ref: replacement.media_ref ?? item.media_ref,
      };
      return true;
    }
  }
  return false;
}

function enforceFatigueCap(
  segments: PlanSegment[],
  templates: ConstraintTemplateLike[],
  reasons: ConstraintReason[]
): number {
  let fatigueScore = computeFatigueScore(segments, templates);
  if (fatigueScore <= FATIGUE_CAP_SCORE) return fatigueScore;

  while (fatigueScore > FATIGUE_CAP_SCORE) {
    const changed = reduceFatigueLoad(segments);
    if (!changed) {
      const replaced = replaceForFatigue(segments, templates);
      if (!replaced) break;
    }
    fatigueScore = computeFatigueScore(segments, templates);
  }

  reasons.push(
    createConstraintReason(
      'hard_block',
      'blocked_by_fatigue_cap',
      'session',
      `fatigue cap applied (${fatigueScore}/${FATIGUE_CAP_SCORE})`,
      { afterValue: fatigueScore }
    )
  );
  return fatigueScore;
}

function buildConstraintEngineMeta(
  reasons: ConstraintReason[],
  flags: Record<string, boolean>,
  segments: PlanSegment[],
  fatigueScore: number
): ConstraintEngineMeta {
  return {
    version: CONSTRAINT_ENGINE_VERSION,
    reasons,
    flags,
    summary: {
      hard_block_count: reasons.filter((reason) => reason.kind === 'hard_block').length,
      soft_discourage_count: reasons.filter((reason) => reason.kind === 'soft_discourage').length,
      degrade_applied_count: reasons.filter((reason) => reason.kind === 'degrade_applied').length,
      total_items: countTotalItems(segments),
      main_items: countMainItems(segments),
      fatigue_score: fatigueScore,
    },
    applied_rule_count: reasons.length,
  };
}

export function applySessionConstraints(
  plan: PlanJsonOutput,
  templates: ConstraintTemplateLike[],
  context: ConstraintEngineContext
): ConstraintEngineResult<PlanJsonOutput> {
  const reasons: ConstraintReason[] = [];
  let segments = normalizePhaseOrder(cloneSegments(plan.segments), reasons);

  enforcePainModeSafety(segments, templates, context, reasons);
  enforceMainCountMinimum(segments, templates, context, reasons);
  enforcePatternCap(segments, templates, reasons);

  let constrainedPlan: PlanJsonOutput = {
    ...plan,
    segments,
    meta: {
      ...plan.meta,
      used_template_ids: Array.from(new Set(segments.flatMap((segment) => segment.items.map((item) => item.templateId)))),
    },
  };

  if (context.isFirstSession) {
    const firstSessionResult = applyFirstSessionPolicy(constrainedPlan, templates, context);
    constrainedPlan = firstSessionResult.plan;
    reasons.push(...firstSessionResult.reasons);
    segments = constrainedPlan.segments;
  }

  const fatigueScore = enforceFatigueCap(segments, templates, reasons);

  constrainedPlan = {
    ...constrainedPlan,
    segments,
    meta: {
      ...constrainedPlan.meta,
      used_template_ids: Array.from(new Set(segments.flatMap((segment) => segment.items.map((item) => item.templateId)))),
    },
  };

  const flags: Record<string, boolean> = {};
  for (const reason of reasons) {
    flags[reason.code] = true;
  }
  const meta = buildConstraintEngineMeta(reasons, flags, segments, fatigueScore);

  return {
    plan: {
      ...constrainedPlan,
      meta: {
        ...constrainedPlan.meta,
        constraint_engine: meta,
      },
    },
    meta,
  };
}
