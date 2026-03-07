/**
 * PR-P1-3: Session plan snapshot builders
 * Pure functions. No DB. Auditability / versioning foundation.
 */

import type { SessionDeepSummary } from '@/lib/deep-result/session-deep-summary';

export const PLAN_VERSION = 'session_plan_v1';
export const CREATED_BY = 'session_create_api';

export interface DeepSummarySnapshot {
  result_type: string;
  primary_focus?: string;
  secondary_focus?: string;
  effective_confidence: number;
  focus: string[];
  avoid: string[];
  level?: 1 | 2 | 3;
  scoring_version: string;
  red_flags?: boolean;
  safety_mode?: 'red' | 'yellow' | 'none';
  pain_risk?: number;
  confidence_breakdown?: { base_confidence?: number; gap_bonus?: number; final_confidence: number };
  evidence_quality?: { answered_ratio?: number; pain_detail?: string };
  rationale?: { summary?: string; top_positive_signals?: string[]; caution_reason?: string };
  decision_trace?: { primary_axis?: string; secondary_axis?: string; level_reason?: string };
}

export interface ProfileSnapshot {
  target_frequency?: number;
  total_sessions: number;
  snapshot_at?: string;
}

import type { PhaseLengths, PhasePolicy, PhasePolicyReason } from './phase';

export interface GenerationTrace {
  session_number: number;
  total_sessions: number;
  resolved_phase: number;
  chosen_theme: string;
  confidence_source: 'effective_confidence' | 'legacy_confidence';
  scoring_version: string;
  safety_mode?: 'red' | 'yellow' | 'none';
  primary_focus?: string;
  secondary_focus?: string;
  summary_source: 'deep_summary_snapshot';
  created_by: string;
  /** PR-P1-4: phase policy for program consistency */
  phase_lengths?: PhaseLengths;
  phase_policy?: PhasePolicy;
  phase_policy_reason?: PhasePolicyReason;
}

/**
 * Build deep summary snapshot (no raw answers). Explainability + plan generation basis only.
 */
export function buildDeepSummarySnapshot(summary: SessionDeepSummary): DeepSummarySnapshot {
  const base: DeepSummarySnapshot = {
    result_type: summary.result_type,
    effective_confidence: summary.effective_confidence,
    focus: [...summary.focus],
    avoid: [...summary.avoid],
    scoring_version: summary.scoring_version,
  };
  if (summary.primaryFocus) base.primary_focus = summary.primaryFocus;
  if (summary.secondaryFocus) base.secondary_focus = summary.secondaryFocus;
  if (summary.deep_level) base.level = summary.deep_level;
  if (summary.red_flags !== undefined) base.red_flags = summary.red_flags;
  if (summary.safety_mode) base.safety_mode = summary.safety_mode;
  if (summary.pain_risk !== undefined) base.pain_risk = summary.pain_risk;
  if (summary.confidence_breakdown) base.confidence_breakdown = summary.confidence_breakdown;
  if (summary.evidence_quality) base.evidence_quality = summary.evidence_quality;
  if (summary.rationale) base.rationale = summary.rationale;
  if (summary.decision_trace) base.decision_trace = summary.decision_trace;
  return base;
}

/**
 * Build profile snapshot at creation time.
 */
export function buildProfileSnapshot(
  profile: { target_frequency?: number } | null,
  totalSessions: number
): ProfileSnapshot {
  return {
    target_frequency: profile?.target_frequency,
    total_sessions: totalSessions,
    snapshot_at: new Date().toISOString(),
  };
}

/**
 * Build generation trace for audit.
 */
export function buildGenerationTrace(input: {
  sessionNumber: number;
  totalSessions: number;
  phase: number;
  theme: string;
  confidenceSource: 'effective_confidence' | 'legacy_confidence';
  scoringVersion: string;
  safetyMode?: 'red' | 'yellow' | 'none';
  primaryFocus?: string;
  secondaryFocus?: string;
  phaseLengths?: PhaseLengths;
  phasePolicy?: PhasePolicy;
  phasePolicyReason?: PhasePolicyReason;
}): GenerationTrace {
  const trace: GenerationTrace = {
    session_number: input.sessionNumber,
    total_sessions: input.totalSessions,
    resolved_phase: input.phase,
    chosen_theme: input.theme,
    confidence_source: input.confidenceSource,
    scoring_version: input.scoringVersion,
    safety_mode: input.safetyMode,
    primary_focus: input.primaryFocus,
    secondary_focus: input.secondaryFocus,
    summary_source: 'deep_summary_snapshot',
    created_by: CREATED_BY,
  };
  if (input.phaseLengths) trace.phase_lengths = input.phaseLengths;
  if (input.phasePolicy) trace.phase_policy = input.phasePolicy;
  if (input.phasePolicyReason) trace.phase_policy_reason = input.phasePolicyReason;
  return trace;
}
