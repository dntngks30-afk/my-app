/**
 * PR-22: Adaptive Explanation Rules Table
 *
 * SSOT for adaptive explanation text.
 * Used by: session/create, plan-summary, app/bootstrap.
 * Deterministic. Trace/modifier → { summary, title, message }.
 */

import type { AdaptationTrace } from './adaptive-progression';
import type { AdaptiveModifierOutput } from '@/core/adaptive-engine/modifierTypes';

/** Output shape for SessionPanel (summary) and NextSessionPreviewCard (title, message) */
export type AdaptiveExplanationResult = {
  summary: string;
  title: string;
  message: string;
};

/** Rules table: reason/modifier key → explanation strings */
const EXPLANATION_RULES: Record<string, AdaptiveExplanationResult> = {
  pain_flare: {
    summary: '최근 통증/부담 기록을 반영해 회복 중심으로 조정했어요',
    title: '세션 조정',
    message: '몸 상태 변화를 고려해 다음 세션은 더 안전한 움직임 중심으로 구성했습니다.',
  },
  low_tolerance: {
    summary: '이전 수행 난이도를 반영해 강도를 소폭 조정했어요',
    title: '세션 조정',
    message: '지난 세션의 난이도가 높았기 때문에 이번 세션은 난이도를 조금 낮췄습니다.',
  },
  high_tolerance: {
    summary: '이전 수행이 원활해 강도를 소폭 올렸어요',
    title: '세션 조정',
    message: '지난 세션을 안정적으로 완료했기 때문에 이번 세션에서는 조금 더 발전된 동작을 시도합니다.',
  },
  protection_mode: {
    summary: '몸 상태 변화를 반영해 회복 중심으로 조정했어요',
    title: '세션 조정',
    message: '몸 상태 변화를 고려해 다음 세션은 더 안전한 움직임 중심으로 구성했습니다.',
  },
  discomfort_protection: {
    summary: '불편했던 부위를 고려해 해당 부위 부담을 줄였어요',
    title: '세션 조정',
    message: '불편했던 부위를 고려하여 해당 부위 부담을 줄이는 세션으로 조정했습니다.',
  },
  difficulty_reduction: {
    summary: '이전 수행 난이도를 반영해 강도를 소폭 조정했어요',
    title: '세션 조정',
    message: '지난 세션의 난이도가 높았기 때문에 이번 세션은 난이도를 조금 낮췄습니다.',
  },
  difficulty_progression: {
    summary: '이전 수행이 원활해 강도를 소폭 올렸어요',
    title: '세션 조정',
    message: '지난 세션을 안정적으로 완료했기 때문에 이번 세션에서는 조금 더 발전된 동작을 시도합니다.',
  },
  volume_reduction: {
    summary: '세션 수행이 어려웠던 것으로 보여 볼륨을 약간 줄였어요',
    title: '세션 조정',
    message: '세션 수행이 어려웠던 것으로 보여 운동 볼륨을 약간 줄였습니다.',
  },
  volume_increase: {
    summary: '지난 세션을 잘 소화해 볼륨을 조금 늘렸어요',
    title: '세션 조정',
    message: '지난 세션을 잘 소화했기 때문에 이번 세션은 조금 더 풍부하게 구성했습니다.',
  },
  event_recovery_bias: {
    summary: '최근 수행 데이터를 반영해 회복 중심으로 조정했어요',
    title: '세션 조정',
    message: '최근 세션 수행 데이터를 반영해 다음 세션은 회복에 맞춰 조정했습니다.',
  },
  event_complexity_cap: {
    summary: '건너뛴 동작을 고려해 더 단순한 움직임 위주로 구성했어요',
    title: '세션 조정',
    message: '건너뛴 동작을 고려해 더 단순한 움직임 위주로 구성했습니다.',
  },
};

/** Map engine modifier to rules-table key. Same priority as modifierInterpreter. */
function modifierToKey(modifier: AdaptiveModifierOutput): string | null {
  if (
    modifier.volume_modifier === 0 &&
    modifier.difficulty_modifier === 0 &&
    !modifier.protection_mode &&
    !modifier.discomfort_area
  ) {
    return null;
  }
  if (modifier.protection_mode) return 'protection_mode';
  if (modifier.discomfort_area?.trim()) return 'discomfort_protection';
  if (modifier.difficulty_modifier === -1) return 'difficulty_reduction';
  if (modifier.difficulty_modifier === 1) return 'difficulty_progression';
  if (modifier.volume_modifier === -1) return 'volume_reduction';
  if (modifier.volume_modifier === 1) return 'volume_increase';
  return null;
}

/** Map trace reason to rules-table key */
function traceReasonToKey(reason: string): string | null {
  if (reason === 'pain_flare' || reason === 'low_tolerance' || reason === 'high_tolerance') {
    return reason;
  }
  return null;
}

/** Get one-liner summary for trace reason. Used by buildAdaptationTrace. */
export function getSummaryForReason(
  reason: 'pain_flare' | 'low_tolerance' | 'high_tolerance' | 'none'
): string {
  if (reason === 'none') return '';
  const rule = EXPLANATION_RULES[reason];
  return rule?.summary ?? '';
}

/**
 * Build explanation from adaptation trace (session/create, plan-summary path).
 * Trace takes precedence when reason !== 'none'.
 */
export function buildAdaptiveExplanationFromTrace(
  trace: AdaptationTrace | null | undefined
): AdaptiveExplanationResult | null {
  if (!trace || trace.reason === 'none') {
    const eventSummary = trace?.event_based_summary;
    const triggers = eventSummary?.trigger_reasons ?? [];
    if (triggers.includes('discomfort_burden_high') || triggers.includes('dropout_risk_high')) {
      return EXPLANATION_RULES.event_recovery_bias ?? null;
    }
    if (triggers.includes('skipped_exercises_high')) {
      return EXPLANATION_RULES.event_complexity_cap ?? null;
    }
    return null;
  }

  const key = traceReasonToKey(trace.reason);
  if (!key) return null;

  const rule = EXPLANATION_RULES[key];
  return rule ?? null;
}

/**
 * Build explanation from engine modifier (bootstrap path).
 * Used when trace is not available (e.g. home preview before create).
 */
export function buildAdaptiveExplanationFromModifier(
  modifier: AdaptiveModifierOutput | null | undefined
): AdaptiveExplanationResult | null {
  if (!modifier) return null;
  const key = modifierToKey(modifier);
  if (!key) return null;
  return EXPLANATION_RULES[key] ?? null;
}

/**
 * Unified builder: prefers trace when available and has reason, else modifier.
 * Returns null when no adaptation applies.
 */
export function resolveAdaptiveExplanation(
  trace: AdaptationTrace | null | undefined,
  modifier: AdaptiveModifierOutput | null | undefined
): AdaptiveExplanationResult | null {
  const fromTrace = buildAdaptiveExplanationFromTrace(trace);
  if (fromTrace) return fromTrace;
  return buildAdaptiveExplanationFromModifier(modifier);
}
