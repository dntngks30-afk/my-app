import { computePhase, type PhaseLengths, type PhasePolicyOptions } from '@/lib/session/phase';
import { resolveSessionDisplayContract } from '@/lib/session/session-display-contract';
import type { SessionCreatePlanRow } from './types';

const PHASE_LABELS = [
  '\u0031\uc21c\uc704 \ud0c0\uac9f',
  '\u0032\uc21c\uc704 \ud0c0\uac9f',
  '\ud1b5\ud569',
  '\ub9b4\ub809\uc2a4',
] as const;

export function toSummaryPlan(
  plan: SessionCreatePlanRow,
  adaptationTrace?: { reason_summary?: string } | null
): SessionCreatePlanRow {
  const pj = plan.plan_json as {
    meta?: {
      focus?: string[];
      priority_vector?: Record<string, number>;
      pain_mode?: 'none' | 'caution' | 'protected';
      session_rationale?: string | null;
      session_focus_axes?: string[];
      primary_type?: string;
      result_type?: string;
      constraint_flags?: { first_session_guardrail_applied?: boolean };
    };
    segments?: Array<{
      title?: string;
      items?: Array<{
        templateId?: string;
        name?: string;
        order?: number;
        sets?: number;
        reps?: number;
        hold_seconds?: number;
      }>;
    }>;
  } | null;

  const segments = (pj?.segments ?? []).map((seg) => ({
    title: seg.title ?? '',
    items: (seg.items ?? []).map((it) => ({
      templateId: it.templateId ?? '',
      name: it.name ?? '',
      order: it.order ?? 0,
      sets: it.sets,
      reps: it.reps,
      hold_seconds: it.hold_seconds,
    })),
  }));

  const meta: Record<string, unknown> = {};
  if (pj?.meta) {
    if (Array.isArray(pj.meta.focus)) meta.focus = pj.meta.focus.slice(0, 3);
    if (pj.meta.priority_vector) meta.priority_vector = pj.meta.priority_vector;
    if (pj.meta.pain_mode) meta.pain_mode = pj.meta.pain_mode;
    if (typeof pj.meta.session_rationale === 'string') {
      meta.session_rationale = pj.meta.session_rationale;
    }
    if (Array.isArray(pj.meta.session_focus_axes) && pj.meta.session_focus_axes.length > 0) {
      meta.session_focus_axes = pj.meta.session_focus_axes.slice(0, 8);
    }
    if (typeof pj.meta.primary_type === 'string' && pj.meta.primary_type.length > 0) {
      meta.primary_type = pj.meta.primary_type;
    }
    if (typeof pj.meta.result_type === 'string' && pj.meta.result_type.length > 0) {
      meta.result_type = pj.meta.result_type;
    }
    const cf = pj.meta.constraint_flags;
    if (cf && typeof cf === 'object' && typeof cf.first_session_guardrail_applied === 'boolean') {
      meta.constraint_flags = { first_session_guardrail_applied: cf.first_session_guardrail_applied };
    }

    const display = resolveSessionDisplayContract(pj.meta as unknown as Record<string, unknown>);
    for (const k of [
      'session_role_code',
      'session_role_label',
      'session_goal_code',
      'session_goal_label',
      'session_goal_hint',
    ] as const) {
      const v = display[k];
      if (typeof v === 'string' && v.length > 0) meta[k] = v;
    }
  }
  if (adaptationTrace?.reason_summary) meta.adaptation_summary = adaptationTrace.reason_summary;

  return {
    ...plan,
    plan_json: {
      ...(Object.keys(meta).length > 0 && { meta }),
      segments,
    },
  };
}

export function getPhaseLengthsFromTrace(trace: unknown): PhaseLengths | null {
  if (!trace || typeof trace !== 'object') return null;
  const arr = (trace as Record<string, unknown>).phase_lengths;
  if (!Array.isArray(arr) || arr.length !== 4) return null;
  const nums = arr.map((x) => (typeof x === 'number' && Number.isInteger(x) && x >= 1 ? x : null));
  if (nums.some((n) => n === null)) return null;
  const sum = (nums as number[]).reduce((a, b) => a + b, 0);
  if (sum < 4 || sum > 20) return null;
  return nums as unknown as PhaseLengths;
}

export function getUsedTemplateIds(planJson: unknown): string[] {
  if (!planJson || typeof planJson !== 'object') return [];
  const meta = (planJson as Record<string, unknown>).meta as Record<string, unknown> | undefined;
  if (meta && Array.isArray(meta.used_template_ids)) {
    return (meta.used_template_ids as unknown[]).filter((x): x is string => typeof x === 'string');
  }
  const segments = (planJson as Record<string, unknown>).segments as
    | Array<{ items?: Array<{ templateId?: string }> }>
    | undefined;
  if (!Array.isArray(segments)) return [];
  const ids: string[] = [];
  for (const seg of segments) {
    for (const it of seg.items ?? []) {
      if (typeof it.templateId === 'string') ids.push(it.templateId);
    }
  }
  return ids;
}

function getPhaseIndex(
  sessionNumber: number,
  totalSessions: number,
  options?: { phaseLengths?: PhaseLengths | null; policyOptions?: PhasePolicyOptions | null }
): number {
  return computePhase(totalSessions, sessionNumber, options) - 1;
}

export function buildTheme(
  sessionNumber: number,
  totalSessions: number,
  deep: { result_type: string; focus: string[] },
  options?: { phaseLengths?: PhaseLengths | null; policyOptions?: PhasePolicyOptions | null }
): string {
  const phaseIdx = getPhaseIndex(sessionNumber, totalSessions, options);
  const phaseLabel = PHASE_LABELS[phaseIdx];

  if (phaseIdx === 0) {
    const target = deep.focus[0] ?? deep.result_type;
    return `Phase 1 \u00b7 ${target} \uc548\uc815\ud654`;
  }
  if (phaseIdx === 1) {
    const target = deep.focus[1] ?? deep.focus[0] ?? deep.result_type;
    return `Phase 2 \u00b7 ${target} \uc2ec\ud654`;
  }
  return `Phase ${phaseIdx + 1} \u00b7 ${phaseLabel}`;
}
