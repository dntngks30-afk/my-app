import type { SessionDeepSummary } from '@/lib/deep-result/session-deep-summary';
import { resolveSessionAnalysisInput } from '@/lib/session/resolveSessionAnalysisInput';
import {
  computePhase,
  resolvePhaseLengths,
  isAdaptivePhasePolicy,
  resolvePhasePolicyReason,
  type PhasePolicyOptions,
} from '@/lib/session/phase';
import { loadRecentAdaptiveSignals, deriveAdaptiveModifiers } from '@/lib/session/adaptive-progression';
import { loadLatestAdaptiveSummary, resolveAdaptiveModifier } from '@/lib/session/adaptive-modifier-resolver';
import { resolveAdaptiveMerge } from '@/lib/session/adaptive-merge';
import { computeAdaptiveModifier, getAvoidTagsForDiscomfort } from '@/core/adaptive-engine';
import { isValidExerciseExperienceLevel } from '@/lib/session/profile';
import type { GenerationInputResult, ProgressGateContinue } from './types';
import { buildTheme, getPhaseLengthsFromTrace, getUsedTemplateIds } from './helpers';
import { logSessionEvent } from '@/lib/session-events';

const DEFAULT_TOTAL_SESSIONS = 16;
const USED_WINDOW_K = 4;

function buildPolicyOptions(deepSummary: SessionDeepSummary): PhasePolicyOptions {
  return {
    deepLevel: deepSummary.deep_level ?? null,
    safetyMode: deepSummary.safety_mode ?? null,
    redFlags: deepSummary.red_flags ?? null,
  };
}

export async function runGenerationInputResolve(
  input: ProgressGateContinue
): Promise<GenerationInputResult> {
  const {
    userId,
    supabase,
    timings,
    requestBody,
    progress,
    resolved,
    nextSessionNumber,
  } = input;

  const tDeep = performance.now();
  let deepSummary: SessionDeepSummary | null = null;
  let analysisSourceMode: 'public_result' | 'legacy_paid_deep' | null = null;
  let sourcePublicResultId: string | null = null;
  let isPublicResultTruthOwner = false;
  let fallbackReason: string | null = null;

  const resolvedAnalysisInput = await resolveSessionAnalysisInput(userId);
  if (resolvedAnalysisInput) {
    deepSummary = resolvedAnalysisInput.summary;
    analysisSourceMode = resolvedAnalysisInput.source.mode;
    sourcePublicResultId = resolvedAnalysisInput.source.public_result_id;
    isPublicResultTruthOwner = resolvedAnalysisInput.source.is_public_result_truth_owner;
    fallbackReason = resolvedAnalysisInput.source.fallback_reason;
  }

  timings.deep_profile_ms = Math.round(performance.now() - tDeep);
  timings.deep_load_ms = timings.deep_profile_ms;

  if (!deepSummary || !analysisSourceMode) {
    void logSessionEvent(supabase, {
      userId,
      eventType: 'session_create_blocked',
      status: 'blocked',
      code: 'ANALYSIS_INPUT_UNAVAILABLE',
      meta: { public_result_found: false, legacy_deep_found: false },
    });
    return { kind: 'analysis_input_unavailable' };
  }

  const totalSessionsForPhase = progress.total_sessions ?? DEFAULT_TOTAL_SESSIONS;
  const policyOptions = buildPolicyOptions(deepSummary);

  let phaseLengths = null;
  if (nextSessionNumber > 1) {
    const { data: prevPlan } = await supabase
      .from('session_plans')
      .select('generation_trace_json')
      .eq('user_id', userId)
      .eq('session_number', nextSessionNumber - 1)
      .maybeSingle();
    phaseLengths = getPhaseLengthsFromTrace(prevPlan?.generation_trace_json);
  }
  if (!phaseLengths) {
    phaseLengths = resolvePhaseLengths(totalSessionsForPhase, policyOptions);
  }

  const phase = computePhase(totalSessionsForPhase, nextSessionNumber, { phaseLengths });
  const theme = buildTheme(nextSessionNumber, totalSessionsForPhase, deepSummary, {
    phaseLengths,
    policyOptions,
  });

  let usedTemplateIds: string[] = [];
  if (nextSessionNumber > 1) {
    const K = Math.max(1, Math.min(8, USED_WINDOW_K));
    const { data: plans } = await supabase
      .from('session_plans')
      .select('plan_json')
      .eq('user_id', userId)
      .lt('session_number', nextSessionNumber)
      .order('session_number', { ascending: false })
      .limit(K);
    const usedSet = new Set<string>();
    for (const row of plans ?? []) {
      for (const id of getUsedTemplateIds(row?.plan_json)) {
        usedSet.add(id);
      }
    }
    usedTemplateIds = Array.from(usedSet);
  }

  const tAdaptive = performance.now();
  const { sessionFeedback, exerciseFeedback, sourceSessionNumbers } =
    await loadRecentAdaptiveSignals(userId, nextSessionNumber);
  timings.adaptive_load_ms = Math.round(performance.now() - tAdaptive);

  const adaptiveCtx = {
    priority_vector: deepSummary.priority_vector ?? null,
    pain_mode: deepSummary.pain_mode ?? null,
  };
  const modifiers = deriveAdaptiveModifiers(
    sessionFeedback,
    exerciseFeedback,
    sourceSessionNumbers,
    adaptiveCtx
  );

  const tAdaptiveMod = performance.now();
  const summary = await loadLatestAdaptiveSummary(supabase, userId);
  const adaptiveModifier = resolveAdaptiveModifier(summary);
  let mergedControls = resolveAdaptiveMerge({
    progression: modifiers,
    modifier: adaptiveModifier,
    summary: summary ? { flags: summary.flags, created_at: summary.created_at } : null,
  });

  const engineModifier = computeAdaptiveModifier({
    sessionFeedback: sessionFeedback.map((f) => ({
      session_number: f.session_number,
      overall_rpe: f.overall_rpe,
      pain_after: f.pain_after,
      difficulty_feedback: f.difficulty_feedback,
      completion_ratio: f.completion_ratio,
      body_state_change: f.body_state_change,
      discomfort_area: f.discomfort_area,
    })),
    adaptiveSummary: summary
      ? {
          completion_ratio: summary.completion_ratio,
          skipped_exercises: summary.skipped_exercises,
          avg_rpe: summary.avg_rpe,
          avg_discomfort: summary.avg_discomfort,
          dropout_risk_score: summary.dropout_risk_score,
          discomfort_burden_score: summary.discomfort_burden_score,
        }
      : null,
  });

  if (engineModifier.protection_mode) {
    const baseOverlay = mergedControls.overlay;
    mergedControls = {
      ...mergedControls,
      forceRecovery: true,
      overlay: {
        ...(baseOverlay ?? {}),
        forceRecovery: true,
        targetLevelDelta: -1 as const,
        ...(baseOverlay?.maxDifficultyCap ? {} : { maxDifficultyCap: 'medium' as const }),
      },
    };
  }

  if (engineModifier.volume_modifier === -1 && (mergedControls.volumeModifier ?? 0) > -0.2) {
    mergedControls = {
      ...mergedControls,
      volumeModifier: Math.min(mergedControls.volumeModifier ?? 0, -0.2),
    };
  }

  if (engineModifier.difficulty_modifier === -1 && !mergedControls.maxDifficultyCap) {
    mergedControls = {
      ...mergedControls,
      maxDifficultyCap: 'medium' as const,
      overlay: {
        ...mergedControls.overlay,
        maxDifficultyCap: 'medium' as const,
      } as typeof mergedControls.overlay,
    };
  }

  const effectivePainFlags = [...requestBody.painFlags];
  const discomfortAvoid = getAvoidTagsForDiscomfort(engineModifier.discomfort_area);
  for (const tag of discomfortAvoid) {
    if (!effectivePainFlags.includes(tag)) effectivePainFlags.push(tag);
  }

  const mergedVolume = mergedControls.volumeModifier;
  timings.adaptive_modifier_ms = Math.round(performance.now() - tAdaptiveMod);

  const exerciseExperienceForSession1 =
    nextSessionNumber === 1 &&
    resolved.profile &&
    isValidExerciseExperienceLevel(resolved.profile.exercise_experience_level)
      ? resolved.profile.exercise_experience_level
      : undefined;

  return {
    ...input,
    kind: 'continue',
    deepSummary,
    analysisSourceMode,
    sourcePublicResultId,
    isPublicResultTruthOwner,
    fallbackReason,
    totalSessionsForPhase,
    policyOptions,
    phaseLengths,
    phase,
    theme,
    usedTemplateIds,
    modifiers,
    summary,
    adaptiveModifier,
    mergedControls,
    mergedVolume,
    adaptiveCtx,
    sourceSessionNumbers,
    exerciseExperienceForSession1,
    effectivePainFlags,
    cacheInput: {
      userId,
      sessionNumber: nextSessionNumber,
      totalSessions: progress.total_sessions ?? DEFAULT_TOTAL_SESSIONS,
      phase,
      theme,
      timeBudget: requestBody.timeBudget,
      conditionMood: requestBody.conditionMood,
      focus: deepSummary.focus ?? [],
      avoid: deepSummary.avoid ?? [],
      painFlags: effectivePainFlags,
      usedTemplateIds,
      adaptiveOverlay: mergedControls.overlay ?? undefined,
      volumeModifier: mergedVolume,
      priority_vector: deepSummary.priority_vector ?? undefined,
      pain_mode: deepSummary.pain_mode ?? undefined,
      exercise_experience_level: exerciseExperienceForSession1,
      survey_session_hints: deepSummary.survey_session_hints ?? null,
      session_camera_translation: deepSummary.session_camera_translation ?? null,
      baseline_session_anchor: deepSummary.baseline_session_anchor ?? undefined,
    },
  };
}
