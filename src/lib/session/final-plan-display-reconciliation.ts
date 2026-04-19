/**
 * PR-TRUTH-02 — Final-plan back-projection for session display meta.
 * After segments are final (post competition / constraints / ordering), derive
 * bounded display meaning from actual template tags & vectors. Upstream intent
 * stays observable in final_alignment_audit only; display-facing fields follow
 * composition when it materially diverges.
 */

import type { SessionTemplateRow } from '@/lib/workout-routine/exercise-templates-db';
import { getAxisLabel, getAxisSessionGoal } from '@/core/session-rationale';
import { TAG_TO_AXES, VECTOR_TO_FOCUS_AXIS } from '@/lib/session/axis-focus-tag-mapping';
import { resolveSessionDisplayContract } from '@/lib/session/session-display-contract';

export type FinalAlignmentAuditV1 = {
  upstream_focus_axes: string[];
  final_focus_axes: string[];
  upstream_goal_code: string | null;
  final_goal_code: string | null;
  drift_level: 'none' | 'light' | 'material';
  dominant_template_tags: string[];
};

export type FinalPlanDisplayReconcileInput = {
  segments: Array<{ title: string; items: Array<{ templateId: string }> }>;
  templatesById: Map<string, SessionTemplateRow>;
  upstreamFocusAxes: string[];
  upstreamRationale: string | null;
  sessionNumber: number;
  phase: number;
  painMode: 'none' | 'caution' | 'protected' | null | undefined;
  priorityVector?: Record<string, number> | null;
  primaryType?: string | null;
  resultType?: string | null;
};

export type FinalPlanDisplayReconcileResult = {
  session_focus_axes: string[];
  session_rationale: string | null;
  sessionDisplayFields: {
    session_role_code?: string;
    session_role_label?: string;
    session_goal_code?: string;
    session_goal_label?: string;
    session_goal_hint?: string;
  };
  audit: FinalAlignmentAuditV1;
};

function segmentWeight(title: string): number {
  const t = title.trim().toLowerCase();
  if (t === 'main') return 3;
  if (t === 'accessory') return 2;
  return 1;
}

function collectAxisScoresAndTags(
  segments: FinalPlanDisplayReconcileInput['segments'],
  templatesById: Map<string, SessionTemplateRow>
): { axisScores: Record<string, number>; tagCounts: Map<string, number>; anyResolved: boolean } {
  const axisScores: Record<string, number> = {};
  const tagCounts = new Map<string, number>();
  let anyResolved = false;

  for (const seg of segments) {
    const w = segmentWeight(seg.title);
    for (const item of seg.items) {
      const t = templatesById.get(item.templateId);
      if (!t) continue;
      anyResolved = true;

      for (const tag of t.focus_tags ?? []) {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + w);
        const axes = TAG_TO_AXES.get(tag);
        if (!axes) continue;
        for (const ax of axes) {
          axisScores[ax] = (axisScores[ax] ?? 0) + w;
        }
      }

      for (const raw of t.target_vector ?? []) {
        const v = typeof raw === 'string' ? raw.trim() : '';
        if (!v) continue;
        const mapped = VECTOR_TO_FOCUS_AXIS[v];
        if (mapped === 'split_trunk_upper') {
          axisScores.trunk_control = (axisScores.trunk_control ?? 0) + w * 0.5;
          axisScores.upper_mobility = (axisScores.upper_mobility ?? 0) + w * 0.5;
        } else if (mapped) {
          axisScores[mapped] = (axisScores[mapped] ?? 0) + w;
        }
      }
    }
  }

  return { axisScores, tagCounts, anyResolved };
}

function pickTopAxes(axisScores: Record<string, number>, max = 2): string[] {
  return Object.entries(axisScores)
    .filter(([, s]) => typeof s === 'number' && s > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([a]) => a);
}

function dominantTags(tagCounts: Map<string, number>, limit = 12): string[] {
  return [...tagCounts.entries()]
    .filter(([, c]) => c > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([t]) => t);
}

function computeDriftLevel(upstream: string[], finalAxes: string[]): FinalAlignmentAuditV1['drift_level'] {
  const u = upstream.filter(Boolean);
  const f = finalAxes.filter(Boolean);
  if (f.length === 0) return 'none';
  if (u.length === 0) return 'light';

  const setU = new Set(u);
  const setF = new Set(f);
  let inter = 0;
  for (const x of setF) {
    if (setU.has(x)) inter += 1;
  }
  if (inter === setU.size && inter === setF.size && setU.size === setF.size) return 'none';
  if (inter === 0) return 'material';
  if (u[0] !== f[0]) return 'material';
  if (setU.size !== setF.size) return 'light';
  return 'light';
}

function buildReconciledRationale(axes: string[], axisScores: Record<string, number>): string | null {
  if (axes.length === 0) return null;
  const primary = axes[0];
  const secondary = axes[1];
  const primaryGoal = getAxisSessionGoal(primary);
  if (!secondary) return primaryGoal;

  const ra = axisScores[primary] ?? 0;
  const rb = axisScores[secondary] ?? 0;
  if (ra <= 0 || rb < ra * 0.55) return primaryGoal;

  return `${primaryGoal.replace(/입니다\.?$/, '')}고, ${getAxisLabel(secondary)} 비중도 함께 넣었습니다.`;
}

function contractDisplayFields(
  axes: string[],
  ctx: Pick<
    FinalPlanDisplayReconcileInput,
    'sessionNumber' | 'phase' | 'painMode' | 'priorityVector' | 'primaryType' | 'resultType'
  >
): FinalPlanDisplayReconcileResult['sessionDisplayFields'] {
  const c = resolveSessionDisplayContract({
    session_focus_axes: axes,
    session_number: ctx.sessionNumber,
    phase: ctx.phase,
    ...(ctx.painMode != null ? { pain_mode: ctx.painMode } : {}),
    ...(ctx.priorityVector && typeof ctx.priorityVector === 'object' ? { priority_vector: ctx.priorityVector } : {}),
    ...(typeof ctx.primaryType === 'string' && ctx.primaryType.trim()
      ? { primary_type: ctx.primaryType.trim() }
      : {}),
    ...(typeof ctx.resultType === 'string' && ctx.resultType.trim()
      ? { result_type: ctx.resultType.trim() }
      : {}),
  });
  const out: FinalPlanDisplayReconcileResult['sessionDisplayFields'] = {};
  if (c.session_role_code?.trim()) out.session_role_code = c.session_role_code.trim();
  if (c.session_role_label?.trim()) out.session_role_label = c.session_role_label.trim();
  if (c.session_goal_code?.trim()) out.session_goal_code = c.session_goal_code.trim();
  if (c.session_goal_label?.trim()) out.session_goal_label = c.session_goal_label.trim();
  if (c.session_goal_hint?.trim()) out.session_goal_hint = c.session_goal_hint.trim();
  return out;
}

/**
 * Returns null if no template rows could be resolved from the final plan (cannot derive composition truth).
 */
export function reconcileFinalPlanDisplayMeta(input: FinalPlanDisplayReconcileInput): FinalPlanDisplayReconcileResult | null {
  const { axisScores, tagCounts, anyResolved } = collectAxisScoresAndTags(input.segments, input.templatesById);
  if (!anyResolved) return null;

  const finalAxes = pickTopAxes(axisScores, 2);
  const domTags = dominantTags(tagCounts, 12);

  const drift = computeDriftLevel(input.upstreamFocusAxes, finalAxes);

  const upContract = resolveSessionDisplayContract({
    session_focus_axes: input.upstreamFocusAxes,
    session_number: input.sessionNumber,
    phase: input.phase,
    ...(input.painMode != null ? { pain_mode: input.painMode } : {}),
    ...(input.priorityVector && typeof input.priorityVector === 'object'
      ? { priority_vector: input.priorityVector }
      : {}),
    ...(typeof input.primaryType === 'string' && input.primaryType.trim()
      ? { primary_type: input.primaryType.trim() }
      : {}),
    ...(typeof input.resultType === 'string' && input.resultType.trim()
      ? { result_type: input.resultType.trim() }
      : {}),
  });

  const finContract = resolveSessionDisplayContract({
    session_focus_axes: finalAxes.length > 0 ? finalAxes : input.upstreamFocusAxes,
    session_number: input.sessionNumber,
    phase: input.phase,
    ...(input.painMode != null ? { pain_mode: input.painMode } : {}),
    ...(input.priorityVector && typeof input.priorityVector === 'object'
      ? { priority_vector: input.priorityVector }
      : {}),
    ...(typeof input.primaryType === 'string' && input.primaryType.trim()
      ? { primary_type: input.primaryType.trim() }
      : {}),
    ...(typeof input.resultType === 'string' && input.resultType.trim()
      ? { result_type: input.resultType.trim() }
      : {}),
  });

  const session_focus_axes = finalAxes.length > 0 ? finalAxes : input.upstreamFocusAxes;

  const axesForRationale = finalAxes.length > 0 ? finalAxes : session_focus_axes;
  const reconciledLine = buildReconciledRationale(axesForRationale, axisScores);
  const session_rationale =
    drift === 'none'
      ? (input.upstreamRationale ?? reconciledLine)
      : (reconciledLine ?? input.upstreamRationale);

  const sessionDisplayFields =
    finalAxes.length > 0
      ? contractDisplayFields(finalAxes, {
          sessionNumber: input.sessionNumber,
          phase: input.phase,
          painMode: input.painMode,
          priorityVector: input.priorityVector,
          primaryType: input.primaryType,
          resultType: input.resultType,
        })
      : contractDisplayFields(session_focus_axes, {
          sessionNumber: input.sessionNumber,
          phase: input.phase,
          painMode: input.painMode,
          priorityVector: input.priorityVector,
          primaryType: input.primaryType,
          resultType: input.resultType,
        });

  const audit: FinalAlignmentAuditV1 = {
    upstream_focus_axes: [...input.upstreamFocusAxes],
    final_focus_axes: [...finalAxes],
    upstream_goal_code: upContract.session_goal_code?.trim() ?? null,
    final_goal_code: finContract.session_goal_code?.trim() ?? null,
    drift_level: drift,
    dominant_template_tags: domTags,
  };

  return {
    session_focus_axes,
    session_rationale,
    sessionDisplayFields,
    audit,
  };
}
