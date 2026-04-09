import { buildSessionPlanJson } from '@/lib/session/plan-generator';
import { getCachedPlan, setCachedPlan, type GenCacheInput } from '@/lib/session-gen-cache';
import {
  PLAN_VERSION,
  buildDeepSummarySnapshot,
  buildProfileSnapshot,
  buildGenerationTrace,
} from '@/lib/session/session-snapshot';
import { buildAdaptationTrace } from '@/lib/session/adaptive-progression';
import { isAdaptivePhasePolicy, resolvePhasePolicyReason } from '@/lib/session/phase';
import type { GenerationInputContinue, PlanMaterializeResult } from './types';

export async function runPlanMaterialize(
  input: GenerationInputContinue
): Promise<PlanMaterializeResult> {
  const {
    timings,
    requestBody,
    progress,
    resolved,
    nextSessionNumber,
    deepSummary,
    analysisSourceMode,
    sourcePublicResultId,
    totalSessionsForPhase,
    policyOptions,
    phaseLengths,
    phase,
    theme,
    usedTemplateIds,
    summary,
    adaptiveModifier,
    modifiers,
    mergedControls,
    mergedVolume,
    adaptiveCtx,
    sourceSessionNumbers,
    exerciseExperienceForSession1,
    effectivePainFlags,
    cacheInput,
  } = input;

  const tGen = performance.now();
  let planJson = getCachedPlan(cacheInput as GenCacheInput);
  if (!planJson) {
    planJson = await buildSessionPlanJson({
      sessionNumber: nextSessionNumber,
      totalSessions: progress.total_sessions,
      phase,
      theme,
      timeBudget: requestBody.timeBudget,
      conditionMood: requestBody.conditionMood,
      focus: deepSummary.focus,
      avoid: deepSummary.avoid,
      painFlags: effectivePainFlags,
      usedTemplateIds,
      resultType: deepSummary.result_type,
      confidence: deepSummary.effective_confidence ?? deepSummary.confidence,
      scoringVersion: deepSummary.scoring_version,
      deep_level: deepSummary.deep_level,
      pain_risk: deepSummary.pain_risk,
      red_flags: deepSummary.red_flags,
      safety_mode: deepSummary.safety_mode,
      primary_type: deepSummary.primary_type,
      secondary_type: deepSummary.secondary_type,
      priority_vector: deepSummary.priority_vector,
      pain_mode: deepSummary.pain_mode,
      adaptiveOverlay: mergedControls.overlay,
      volumeModifier: mergedVolume,
      exercise_experience_level: exerciseExperienceForSession1,
      survey_session_hints: deepSummary.survey_session_hints,
      session_camera_translation: deepSummary.session_camera_translation,
    });
    setCachedPlan(cacheInput as GenCacheInput, planJson as Record<string, unknown>);
  }
  timings.generation_ms = Math.round(performance.now() - tGen);

  const tSer = performance.now();
  JSON.stringify(planJson);
  timings.serialization_ms = Math.round(performance.now() - tSer);

  const condition = {
    condition_mood: requestBody.conditionMood,
    time_budget: requestBody.timeBudget,
    pain_flags: effectivePainFlags,
    equipment: requestBody.equipment,
  };

  const confidenceSource =
    deepSummary.effective_confidence !== undefined && deepSummary.effective_confidence !== null
      ? ('effective_confidence' as const)
      : ('legacy_confidence' as const);
  const deepSummarySnapshot = buildDeepSummarySnapshot(deepSummary) as unknown as Record<string, unknown>;
  const profileSnapshot =
    buildProfileSnapshot(resolved.profile, totalSessionsForPhase) as unknown as Record<string, unknown>;
  const phasePolicy = isAdaptivePhasePolicy(policyOptions) ? 'front_loaded' : 'equal';
  const phasePolicyReason = resolvePhasePolicyReason(policyOptions);
  const baseTrace = buildGenerationTrace({
    sessionNumber: nextSessionNumber,
    totalSessions: totalSessionsForPhase,
    phase,
    theme,
    confidenceSource,
    scoringVersion: deepSummary.scoring_version,
    safetyMode: deepSummary.safety_mode,
    primaryFocus: deepSummary.primaryFocus,
    secondaryFocus: deepSummary.secondaryFocus,
    phaseLengths,
    phasePolicy,
    phasePolicyReason,
  });

  const traceModifiers = {
    ...modifiers,
    targetLevelDelta: mergedControls.targetLevelDelta,
    forceShort: mergedControls.forceShort,
    forceRecovery: mergedControls.forceRecovery,
    avoidExerciseKeys: mergedControls.avoidTemplateIds,
    maxDifficultyCap: mergedControls.maxDifficultyCap,
  };

  let adaptationTrace = buildAdaptationTrace(
    traceModifiers,
    sourceSessionNumbers,
    adaptiveCtx
  );
  if (summary) {
    const triggerReasons: string[] = [];
    if (summary.completion_ratio < 0.6) triggerReasons.push('completion_ratio_low');
    else if (summary.completion_ratio < 0.8) triggerReasons.push('completion_ratio_moderate');
    if (summary.skipped_exercises >= 2) triggerReasons.push('skipped_exercises_high');
    if (summary.dropout_risk_score >= 50) triggerReasons.push('dropout_risk_high');
    if (summary.discomfort_burden_score >= 60) triggerReasons.push('discomfort_burden_high');
    adaptationTrace = {
      ...adaptationTrace,
      event_based_summary: {
        completion_ratio: summary.completion_ratio,
        avg_rpe: summary.avg_rpe,
        avg_discomfort: summary.avg_discomfort,
        dropout_risk_score: summary.dropout_risk_score,
        discomfort_burden_score: summary.discomfort_burden_score,
        flags: summary.flags,
        trigger_reasons: triggerReasons.length > 0 ? triggerReasons : undefined,
      },
    };
  }

  const generationTrace = {
    ...baseTrace,
    adaptation: adaptationTrace,
  };

  const planPayload = {
    user_id: input.userId,
    session_number: nextSessionNumber,
    status: 'draft' as const,
    theme,
    plan_json: planJson,
    condition,
    plan_version: PLAN_VERSION,
    source_deep_attempt_id: deepSummary.source_deep_attempt_id ?? null,
    deep_summary_snapshot_json: deepSummarySnapshot,
    profile_snapshot_json: profileSnapshot,
    generation_trace_json: {
      ...generationTrace,
      analysis_source_mode: analysisSourceMode,
      ...(sourcePublicResultId && { source_public_result_id: sourcePublicResultId }),
    },
  };

  return {
    ...input,
    planJson,
    condition,
    deepSummarySnapshot,
    profileSnapshot,
    adaptationTrace,
    generationTrace,
    planPayload,
  };
}
