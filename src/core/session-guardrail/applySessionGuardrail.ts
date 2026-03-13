/**
 * PR-FIRST-SESSION: First Session Guardrail Engine
 *
 * Runs after session generation when session_number === 1.
 * Enforces volume, difficulty, pain protection, deconditioned, asymmetry, movement safety.
 */

import type { PlanJsonOutput, PlanSegment, PlanItem } from '@/lib/session/plan-generator';
import { getTemplatesForSessionPlan } from '@/lib/workout-routine/exercise-templates-db';
import type { SessionTemplateRow } from '@/lib/workout-routine/exercise-templates-db';
import { getExerciseRationale } from '@/core/session-rationale';
import { exceedsVolumeLimits, clampVolume } from './volumeClamp';
import { exceedsDifficultyCap, isSafeForFirstSession } from './difficultyClamp';
import {
  isUnsafeCombination,
  hasHighBalanceDemand,
  hasSingleLegLoad,
} from './movementSafetyRules';
import { DECONDITIONED_REDUCTIONS } from './guardrailRules';

export interface GuardrailContext {
  session_number: number;
  priority_vector?: Record<string, number> | null;
  pain_mode?: 'none' | 'caution' | 'protected' | null;
  scoring_version?: string;
}

/** Safe replacement priority: activation > controlled stability > simple mobility */
const REPLACEMENT_PRIORITY_TAGS = [
  ['glute_activation', 'core_control', 'upper_back_activation'],
  ['core_stability', 'lower_chain_stability'],
  ['full_body_reset', 'hip_mobility', 'ankle_mobility', 'calf_release'],
] as const;

function templateToPlanItem(
  t: SessionTemplateRow,
  order: number,
  segmentTitle: string
): PlanItem {
  const focusTag = t.focus_tags[0] ?? null;
  const rationale = getExerciseRationale(focusTag);
  const item: PlanItem = {
    order,
    templateId: t.id,
    name: t.name,
    focus_tag: focusTag,
    media_ref: t.media_ref ?? undefined,
    ...(rationale && { rationale }),
  };
  if (t.name.includes('이완') || segmentTitle === 'Cooldown') {
    item.sets = 1;
    item.hold_seconds = 30;
  } else {
    item.sets = 2;
    item.reps = 12;
  }
  return item;
}

function findReplacementTemplate(
  templates: SessionTemplateRow[],
  usedIds: Set<string>,
  segmentTitle: string,
  sessionFocusAxes: string[],
  painMode: 'none' | 'caution' | 'protected'
): SessionTemplateRow | null {
  const avoidIds = new Set(usedIds);
  const focusSet = new Set(sessionFocusAxes);

  for (const tagGroup of REPLACEMENT_PRIORITY_TAGS) {
    const candidates = templates.filter(
      (t) =>
        !avoidIds.has(t.id) &&
        isSafeForFirstSession(t) &&
        t.focus_tags.some((ft) => tagGroup.includes(ft as typeof tagGroup[number])) &&
        (painMode === 'none' || !(t.avoid_if_pain_mode ?? []).includes(painMode))
    );
    if (candidates.length > 0) {
      const scored = candidates.map((t) => ({
        t,
        score: t.focus_tags.filter((ft) => focusSet.has(ft)).length,
      }));
      scored.sort((a, b) => b.score - a.score);
      return scored[0]?.t ?? null;
    }
  }
  return null;
}

/**
 * Apply first session guardrail. Only runs when session_number === 1.
 * Returns modified plan or original if not first session.
 */
export async function applySessionGuardrail(
  plan: PlanJsonOutput,
  context: GuardrailContext
): Promise<PlanJsonOutput> {
  if (context.session_number !== 1) {
    return plan;
  }

  const templates = await getTemplatesForSessionPlan({
    scoringVersion: context.scoring_version ?? 'deep_v2',
  });
  const templateById = new Map(templates.map((t) => [t.id, t]));
  const painMode = context.pain_mode ?? 'none';
  const priorityVector = context.priority_vector ?? {};
  const hasDeconditioned = (priorityVector.deconditioned ?? 0) > 0;
  const hasAsymmetry = (priorityVector.asymmetry ?? 0) > 0;
  const sessionFocusAxes = (plan.meta.session_focus_axes ?? []).slice(0, 2);

  let segments = plan.segments.map((seg) => ({
    ...seg,
    items: seg.items.map((item) => ({ ...item })),
  }));

  const usedIds = new Set(plan.meta.used_template_ids ?? []);

  // 1. Difficulty clamp + pain protection: replace violating exercises
  for (const seg of segments) {
    for (let i = 0; i < seg.items.length; i++) {
      const item = seg.items[i];
      const template = templateById.get(item.templateId);
      if (!template) continue;

      let shouldReplace = exceedsDifficultyCap(template);
      if (painMode !== 'none' && (template.avoid_if_pain_mode ?? []).includes(painMode)) {
        shouldReplace = true;
      }
      if (hasAsymmetry && (hasHighBalanceDemand(template) || hasSingleLegLoad(template))) {
        shouldReplace = true;
      }

      if (shouldReplace) {
        const replacement = findReplacementTemplate(
          templates,
          usedIds,
          seg.title,
          sessionFocusAxes,
          painMode
        );
        if (replacement) {
          usedIds.delete(item.templateId);
          usedIds.add(replacement.id);
          (seg.items[i] as PlanItem) = templateToPlanItem(replacement, item.order, seg.title);
        }
      }
    }
  }

  // 2. Movement combination safety: replace second of unsafe pair
  const allItems: { segIdx: number; itemIdx: number; template: SessionTemplateRow }[] = [];
  for (let si = 0; si < segments.length; si++) {
    for (let ii = 0; ii < segments[si].items.length; ii++) {
      const t = templateById.get(segments[si].items[ii].templateId);
      if (t) allItems.push({ segIdx: si, itemIdx: ii, template: t });
    }
  }
  for (let i = 0; i < allItems.length - 1; i++) {
    const a = allItems[i];
    const b = allItems[i + 1];
    if (isUnsafeCombination(a.template, b.template)) {
      const replacement = findReplacementTemplate(
        templates,
        usedIds,
        segments[b.segIdx].title,
        sessionFocusAxes,
        painMode
      );
      if (replacement) {
        const item = segments[b.segIdx].items[b.itemIdx];
        usedIds.delete(item.templateId);
        usedIds.add(replacement.id);
        (segments[b.segIdx].items[b.itemIdx] as PlanItem) = templateToPlanItem(
          replacement,
          item.order,
          segments[b.segIdx].title
        );
        allItems[i + 1] = { ...b, template: replacement };
      }
    }
  }

  // 3. Volume clamp
  if (exceedsVolumeLimits(segments)) {
    segments = clampVolume(segments);
  }

  // 4. Deconditioned: reduce sets, hold, session time
  if (hasDeconditioned) {
    segments = segments.map((seg) => ({
      ...seg,
      items: seg.items.map((item) => {
        const next = { ...item };
        if (next.sets != null) next.sets = Math.max(1, Math.floor(next.sets * DECONDITIONED_REDUCTIONS.sets_factor));
        if (next.hold_seconds != null) next.hold_seconds = Math.max(15, Math.floor(next.hold_seconds * DECONDITIONED_REDUCTIONS.hold_factor));
        return next;
      }),
      duration_sec: Math.max(60, Math.floor((seg.duration_sec ?? 120) * DECONDITIONED_REDUCTIONS.session_time_factor)),
    }));
  }

  const usedTemplateIds = Array.from(
    new Set(segments.flatMap((s) => s.items.map((i) => i.templateId)))
  );

  return {
    ...plan,
    segments,
    meta: {
      ...plan.meta,
      used_template_ids: usedTemplateIds,
      constraint_flags: {
        ...plan.meta.constraint_flags,
        first_session_guardrail_applied: true,
      },
    },
  };
}
