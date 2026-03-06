/**
 * Lightweight Deep Result summary for Session Path B.
 * Single query, no template selection, no media sign.
 * Used by /api/session/create only.
 *
 * PR-P1-2: explainability pass-through, effective_confidence SSOT.
 */

import { getServerSupabaseAdmin } from '@/lib/supabase';
import { getEffectiveConfidence, toConfidenceSource } from './effective-confidence';
import type { ConfidenceBreakdown, EvidenceQuality, Rationale, DecisionTrace } from '@/lib/deep-test/types';

/** pain_risk thresholds (0~10+ scale, matches deep_v2 D) */
const PAIN_RISK_RED = 7;
const PAIN_RISK_YELLOW = 4;

export interface SessionDeepSummary {
  result_type: string;
  /** @deprecated use effective_confidence. backward compat only */
  confidence: number;
  /** SSOT: UI/summary/session consumer는 이 값만 사용 */
  effective_confidence: number;
  focus: string[];
  avoid: string[];
  scoring_version: string;
  /** Optional enrichment from scores.derived (PR-B) */
  deep_level?: 1 | 2 | 3;
  pain_risk?: number;
  red_flags?: boolean;
  safety_mode?: 'red' | 'yellow' | 'none';
  /** P1-2: explainability pass-through (optional) */
  primaryFocus?: string;
  secondaryFocus?: string;
  confidence_breakdown?: ConfidenceBreakdown;
  evidence_quality?: EvidenceQuality;
  rationale?: Rationale;
  decision_trace?: DecisionTrace;
}

/**
 * Load minimal Deep Result summary for session create.
 * Returns null if no final deep_v2 result exists → 404 DEEP_RESULT_MISSING.
 */
export async function loadSessionDeepSummary(
  userId: string
): Promise<SessionDeepSummary | null> {
  const supabase = getServerSupabaseAdmin();

  const { data: attempt, error } = await supabase
    .from('deep_test_attempts')
    .select('result_type, confidence, scoring_version, scores')
    .eq('user_id', userId)
    .eq('status', 'final')
    .eq('scoring_version', 'deep_v2')
    .order('finalized_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !attempt) return null;

  const scores = attempt.scores as Record<string, unknown> | null;
  const derived = scores?.derived as Record<string, unknown> | null | undefined;

  const focus = Array.isArray(derived?.focus_tags)
    ? (derived.focus_tags as string[]).filter((x): x is string => typeof x === 'string')
    : [];
  const avoid = Array.isArray(derived?.avoid_tags)
    ? (derived.avoid_tags as string[]).filter((x): x is string => typeof x === 'string')
    : [];

  const levelRaw = derived?.level;
  const deep_level: 1 | 2 | 3 | undefined =
    typeof levelRaw === 'number' && levelRaw >= 1 && levelRaw <= 3
      ? (levelRaw as 1 | 2 | 3)
      : undefined;

  const algorithmScores = derived?.algorithm_scores as Record<string, unknown> | null | undefined;
  const pain_risk =
    typeof algorithmScores?.pain_risk === 'number' && !Number.isNaN(algorithmScores.pain_risk)
      ? (algorithmScores.pain_risk as number)
      : undefined;

  const signals = derived?.signals as Record<string, unknown> | null | undefined;
  const red_flags =
    typeof signals?.red_flags === 'boolean' ? (signals.red_flags as boolean) : undefined;

  let safety_mode: 'red' | 'yellow' | 'none' = 'none';
  if (red_flags === true) {
    safety_mode = 'red';
  } else if (typeof pain_risk === 'number') {
    if (pain_risk >= PAIN_RISK_RED) safety_mode = 'red';
    else if (pain_risk >= PAIN_RISK_YELLOW) safety_mode = 'yellow';
  }

  const confSource = toConfidenceSource({
    confidence: attempt.confidence,
    scores: { derived },
  });
  const effective_confidence = getEffectiveConfidence(confSource);
  const legacyConfidence = typeof attempt.confidence === 'number' ? attempt.confidence : 0;

  const expl = derived?.explainability as Record<string, unknown> | undefined;
  const confidence_breakdown = (derived?.confidence_breakdown ?? expl?.confidence_breakdown) as
    | ConfidenceBreakdown
    | undefined;
  const evidence_quality = (derived?.evidence_quality ?? expl?.evidence_quality) as
    | EvidenceQuality
    | undefined;
  const rationale = (derived?.rationale ?? expl?.rationale) as Rationale | undefined;
  const decision_trace = (derived?.decision_trace ?? expl?.decision_trace) as
    | DecisionTrace
    | undefined;
  const primaryFocus = typeof derived?.primaryFocus === 'string' ? derived.primaryFocus : undefined;
  const secondaryFocus =
    typeof derived?.secondaryFocus === 'string' ? derived.secondaryFocus : undefined;

  return {
    result_type: typeof attempt.result_type === 'string' ? attempt.result_type : 'UNKNOWN',
    confidence: legacyConfidence,
    effective_confidence,
    focus,
    avoid,
    scoring_version: attempt.scoring_version ?? 'deep_v2',
    ...(deep_level !== undefined && { deep_level }),
    ...(pain_risk !== undefined && { pain_risk }),
    ...(red_flags !== undefined && { red_flags }),
    safety_mode,
    ...(primaryFocus && { primaryFocus }),
    ...(secondaryFocus && { secondaryFocus }),
    ...(confidence_breakdown && { confidence_breakdown }),
    ...(evidence_quality && { evidence_quality }),
    ...(rationale && { rationale }),
    ...(decision_trace && { decision_trace }),
  };
}
