/**
 * PR-ALG-16A: First session stricter policy under general constraint engine.
 * Pure function. Reused by legacy first-session wrapper.
 */

import type { PlanItem, PlanJsonOutput, PlanSegment } from '@/lib/session/plan-generator';
import { getExerciseRationale } from '@/core/session-rationale';
import {
  exceedsVolumeLimits,
  clampVolume,
  type VolumeLimitsTier,
} from '@/core/session-guardrail/volumeClamp';
import { exceedsDifficultyCap, isSafeForFirstSession } from '@/core/session-guardrail/difficultyClamp';
import {
  isUnsafeCombination,
  hasHighBalanceDemand,
  hasSingleLegLoad,
} from '@/core/session-guardrail/movementSafetyRules';
import { DECONDITIONED_REDUCTIONS } from '@/core/session-guardrail/guardrailRules';
import { RULE_IDS } from '@/lib/session/policy-registry';
import { createConstraintReason } from './reasons';
import { scoreTrunkCoreReplacementFit } from '@/lib/session/trunk-core-session1-shared';
import type {
  ConstraintEngineContext,
  ConstraintEngineResult,
  ConstraintReason,
  ConstraintTemplateLike,
} from './types';

const REPLACEMENT_PRIORITY_TAGS = [
  ['glute_activation', 'core_control', 'upper_back_activation'],
  ['core_stability', 'lower_chain_stability'],
  ['full_body_reset', 'hip_mobility', 'ankle_mobility', 'calf_release'],
] as const;

type FirstSessionResult = {
  plan: PlanJsonOutput;
  reasons: ConstraintReason[];
};

function cloneSegments(segments: PlanSegment[]): PlanSegment[] {
  return segments.map((seg) => ({
    ...seg,
    items: seg.items.map((item) => ({ ...item })),
  }));
}

function templateToPlanItem(
  template: ConstraintTemplateLike,
  order: number,
  segmentTitle: string
): PlanItem {
  const focusTag = template.focus_tags[0] ?? null;
  const rationale = getExerciseRationale(focusTag);
  const item: PlanItem = {
    order,
    templateId: template.id,
    name: template.name,
    focus_tag: focusTag,
    media_ref: template.media_ref ?? undefined,
    ...(rationale && { rationale }),
  };
  if (segmentTitle === 'Cooldown' || template.name.includes('이완')) {
    item.sets = 1;
    item.hold_seconds = 30;
  } else {
    item.sets = 2;
    item.reps = 12;
  }
  return item;
}

function findReplacementTemplate(
  templates: ConstraintTemplateLike[],
  usedIds: Set<string>,
  segmentTitle: string,
  sessionFocusAxes: string[],
  painMode: 'none' | 'caution' | 'protected'
): ConstraintTemplateLike | null {
  const desiredPhase = segmentTitle.toLowerCase();
  const focusSet = new Set(sessionFocusAxes);

  for (const tagGroup of REPLACEMENT_PRIORITY_TAGS) {
    const candidates = templates.filter((template) => {
      if (usedIds.has(template.id)) return false;
      if (!isSafeForFirstSession(template)) return false;
      if (painMode !== 'none' && (template.avoid_if_pain_mode ?? []).includes(painMode)) return false;
      const phaseOk =
        !template.phase ||
        template.phase === desiredPhase ||
        (segmentTitle === 'Cooldown' && template.phase === 'accessory');
      if (!phaseOk) return false;
      return template.focus_tags.some((tag) => tagGroup.includes(tag as (typeof tagGroup)[number]));
    });
    if (candidates.length === 0) continue;
    const ranked = candidates
      .map((template) => ({
        template,
        score:
          template.focus_tags.filter((tag) => focusSet.has(tag)).length +
          scoreTrunkCoreReplacementFit(template.focus_tags, sessionFocusAxes),
      }))
      .sort((a, b) => b.score - a.score || a.template.id.localeCompare(b.template.id));
    return ranked[0]?.template ?? null;
  }

  return null;
}

function deriveFirstSessionTier(context: ConstraintEngineContext): VolumeLimitsTier {
  if (context.firstSessionTier) return context.firstSessionTier;
  if (!context.isFirstSession) return 'normal';
  if (context.painMode === 'protected' || context.safetyMode === 'red') return 'conservative';
  if (context.painMode === 'caution' || context.safetyMode === 'yellow') return 'moderate';
  const pv = context.priorityVector ?? {};
  const topAxis = Object.entries(pv)
    .filter(([, v]) => typeof v === 'number' && v > 0)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0]?.[0];
  if (topAxis === 'deconditioned') return 'moderate';
  return 'normal';
}

export function applyFirstSessionPolicy(
  plan: PlanJsonOutput,
  templates: ConstraintTemplateLike[],
  context: ConstraintEngineContext
): FirstSessionResult {
  if (!context.isFirstSession) {
    return { plan, reasons: [] };
  }

  const volumeTier = deriveFirstSessionTier(context);
  const templateById = new Map(templates.map((template) => [template.id, template]));
  const usedIds = new Set(plan.meta.used_template_ids ?? []);
  const painMode = context.painMode ?? 'none';
  const priorityVector = context.priorityVector ?? {};
  const hasDeconditioned = (priorityVector.deconditioned ?? 0) > 0;
  const hasAsymmetry = (priorityVector.asymmetry ?? 0) > 0;
  const sessionFocusAxes = (plan.meta.session_focus_axes ?? []).slice(0, 2);
  const reasons: ConstraintReason[] = [];

  let segments = cloneSegments(plan.segments);

  for (let segIdx = 0; segIdx < segments.length; segIdx++) {
    const segment = segments[segIdx]!;
    for (let itemIdx = 0; itemIdx < segment.items.length; itemIdx++) {
      const item = segment.items[itemIdx]!;
      const template = templateById.get(item.templateId);
      if (!template) continue;

      let shouldReplace = exceedsDifficultyCap(template);
      if (painMode !== 'none' && (template.avoid_if_pain_mode ?? []).includes(painMode)) {
        shouldReplace = true;
      }
      if (hasAsymmetry && (hasHighBalanceDemand(template) || hasSingleLegLoad(template))) {
        shouldReplace = true;
      }

      if (!shouldReplace) continue;

      const replacement = findReplacementTemplate(
        templates,
        usedIds,
        segment.title,
        sessionFocusAxes,
        painMode
      );
      if (!replacement) continue;

      usedIds.delete(item.templateId);
      usedIds.add(replacement.id);
      segment.items[itemIdx] = templateToPlanItem(replacement, item.order, segment.title);
      reasons.push(
        createConstraintReason(
          'degrade_applied',
          painMode !== 'none' ? 'blocked_by_pain_mode' : 'first_session_guardrail_applied',
          'item',
          `first session replacement: ${item.templateId} -> ${replacement.id}`,
          {
            segmentIndex: segIdx,
            itemIndex: itemIdx,
            beforeValue: item.templateId,
            afterValue: replacement.id,
            rule_id: RULE_IDS.post_first_session_item,
            stage: 'post_selection',
          }
        )
      );
    }
  }

  const flattened: Array<{ segIdx: number; itemIdx: number; template: ConstraintTemplateLike }> = [];
  for (let segIdx = 0; segIdx < segments.length; segIdx++) {
    for (let itemIdx = 0; itemIdx < segments[segIdx]!.items.length; itemIdx++) {
      const template = templateById.get(segments[segIdx]!.items[itemIdx]!.templateId);
      if (template) flattened.push({ segIdx, itemIdx, template });
    }
  }
  for (let idx = 0; idx < flattened.length - 1; idx++) {
    const a = flattened[idx]!;
    const b = flattened[idx + 1]!;
    if (!isUnsafeCombination(a.template, b.template)) continue;

    const replacement = findReplacementTemplate(
      templates,
      usedIds,
      segments[b.segIdx]!.title,
      sessionFocusAxes,
      painMode
    );
    if (!replacement) continue;

    const item = segments[b.segIdx]!.items[b.itemIdx]!;
    usedIds.delete(item.templateId);
    usedIds.add(replacement.id);
    segments[b.segIdx]!.items[b.itemIdx] = templateToPlanItem(replacement, item.order, segments[b.segIdx]!.title);
    flattened[idx + 1] = { ...b, template: replacement };
    reasons.push(
      createConstraintReason(
        'degrade_applied',
        'replaced_unsafe_combination',
        'item',
        `unsafe combination replaced: ${item.templateId} -> ${replacement.id}`,
        {
          segmentIndex: b.segIdx,
          itemIndex: b.itemIdx,
          beforeValue: item.templateId,
          afterValue: replacement.id,
          rule_id: RULE_IDS.post_first_session_unsafe_combo,
          stage: 'post_selection',
        }
      )
    );
  }

  if (exceedsVolumeLimits(segments, volumeTier)) {
    segments = clampVolume(segments, volumeTier);
    reasons.push(
      createConstraintReason(
        'degrade_applied',
        'first_session_guardrail_applied',
        'session',
        'first session volume clamp applied',
        { rule_id: RULE_IDS.post_first_session_volume, stage: 'post_selection' }
      )
    );
  }

  if (hasDeconditioned) {
    segments = segments.map((segment) => ({
      ...segment,
      items: segment.items.map((item) => {
        const next = { ...item };
        if (next.sets != null) {
          next.sets = Math.max(1, Math.floor(next.sets * DECONDITIONED_REDUCTIONS.sets_factor));
        }
        if (next.hold_seconds != null) {
          next.hold_seconds = Math.max(15, Math.floor(next.hold_seconds * DECONDITIONED_REDUCTIONS.hold_factor));
        }
        return next;
      }),
      duration_sec: Math.max(60, Math.floor((segment.duration_sec ?? 120) * DECONDITIONED_REDUCTIONS.session_time_factor)),
    }));
    reasons.push(
      createConstraintReason(
        'degrade_applied',
        'reduced_due_to_deconditioned',
        'session',
        'deconditioned reduction applied to first session',
        { rule_id: RULE_IDS.post_deconditioned, stage: 'post_selection' }
      )
    );
  }

  const usedTemplateIds = Array.from(new Set(segments.flatMap((segment) => segment.items.map((item) => item.templateId))));

  return {
    plan: {
      ...plan,
      segments,
      meta: {
        ...plan.meta,
        used_template_ids: usedTemplateIds,
      },
    },
    reasons,
  };
}
