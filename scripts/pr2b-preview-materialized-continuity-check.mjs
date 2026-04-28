import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
process.chdir(join(scriptDir, '..'));

/** plan-generator transitively loads supabase — placeholders for CLI harness. */
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://harness.preview.supabase.co';
}
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'harness-placeholder-anon-key';
}

/**
 * PR2-B follow-up continuity proof:
 * - preview/bootstrap path vs materialized plan path use same lower-pair truth
 * - lower tag expansion is synced with dominant-axis guard tags
 */

const PRIMARY_TO_BASELINE_ANCHOR = {
  LOWER_INSTABILITY: 'lower_stability',
  LOWER_MOBILITY_RESTRICTION: 'lower_mobility',
};

function toSafetyMode(painMode) {
  if (painMode === 'protected') return 'red';
  if (painMode === 'caution') return 'yellow';
  return 'none';
}

function topCounts(items, limit = 4) {
  const map = new Map();
  for (const item of items) map.set(item, (map.get(item) ?? 0) + 1);
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }));
}

function collectMainVectorsFromPlan(plan, templateById) {
  const main = plan.segments.find((s) => s.title === 'Main');
  const vectors = [];
  for (const item of main?.items ?? []) {
    const t = templateById.get(item.templateId);
    for (const v of t?.target_vector ?? []) vectors.push(v);
  }
  return topCounts(vectors);
}

function collectMainVectorsFromPreview(summary, templateById) {
  const main = summary.segments.find((s) => s.title === 'Main');
  const vectors = [];
  for (const item of main?.items ?? []) {
    const t = templateById.get(item.templateId);
    for (const v of t?.target_vector ?? []) vectors.push(v);
  }
  return topCounts(vectors);
}

function hasVector(vectors, key) {
  return vectors.some((v) => v.key === key && v.count > 0);
}

/** Mirrors lower-pair-session1-shared.ts (PR-FIRST-SESSION-LOWER-ANCHOR-MAIN-GUARD-01 / PREVIEW-PARITY-01). */
function isLowerStabilityMainAnchorCandidate(t) {
  const tv = t.target_vector ?? [];
  if (tv.includes('lower_stability')) return true;
  return (t.focus_tags ?? []).some((tag) =>
    ['lower_chain_stability', 'glute_activation', 'glute_medius', 'basic_balance', 'core_stability'].includes(tag),
  );
}

function isUpperOnlyMainOffAxisForLowerStability(t) {
  if (!t || !Array.isArray(t.focus_tags)) return false;
  if (isLowerStabilityMainAnchorCandidate(t)) return false;
  return t.focus_tags.some((tag) =>
    ['upper_back_activation', 'shoulder_stability', 'shoulder_mobility', 'upper_mobility'].includes(tag),
  );
}

function poolHasLowerStabilityAnchorLike(templates) {
  return templates.some(
    (tpl) =>
      tpl &&
      (tpl.level ?? 1) <= 3 &&
      isLowerStabilityMainAnchorCandidate(tpl) &&
      !isUpperOnlyMainOffAxisForLowerStability(tpl),
  );
}

function assertMainNoUpperOnlyOffAxis(label, segments, templateById) {
  const main = segments.find((s) => s.title === 'Main');
  const bad = [];
  for (const item of main?.items ?? []) {
    const tpl = templateById.get(item.templateId);
    if (tpl && isUpperOnlyMainOffAxisForLowerStability(tpl)) bad.push(item.templateId);
  }
  if (bad.length > 0) {
    throw new Error(
      `[PR2-B ${label}] lower_stability S1 Main must not include upper-only off-axis templates: ${bad.join(', ')}`,
    );
  }
}

function mainHasLowerStabilityAnchor(segments, templateById) {
  const main = segments.find((s) => s.title === 'Main');
  return (
    main?.items?.some((item) => {
      const tpl = templateById.get(item.templateId);
      return tpl && isLowerStabilityMainAnchorCandidate(tpl);
    }) ?? false
  );
}

function inferTargetVector(focusTags) {
  const hasAny = (tags) => tags.some((tag) => focusTags.includes(tag));
  const vectors = [];
  if (hasAny(['lower_chain_stability', 'glute_medius', 'glute_activation', 'basic_balance'])) vectors.push('lower_stability');
  if (hasAny(['hip_mobility', 'ankle_mobility', 'hip_flexor_stretch', 'calf_release'])) vectors.push('lower_mobility');
  if (hasAny(['core_control', 'core_stability', 'global_core'])) vectors.push('trunk_control');
  if (hasAny(['thoracic_mobility', 'shoulder_mobility', 'shoulder_stability', 'upper_back_activation'])) vectors.push('upper_mobility');
  if (hasAny(['full_body_reset'])) vectors.push('deconditioned');
  return [...new Set(vectors)];
}

function inferPhase(focusTags) {
  const hasAny = (tags) => tags.some((tag) => focusTags.includes(tag));
  if (hasAny(['full_body_reset', 'calf_release', 'upper_trap_release', 'neck_mobility', 'thoracic_mobility', 'shoulder_mobility', 'hip_flexor_stretch', 'hip_mobility', 'ankle_mobility'])) return 'prep';
  if (hasAny(['core_stability', 'global_core', 'upper_back_activation', 'shoulder_stability', 'glute_activation', 'lower_chain_stability', 'glute_medius', 'basic_balance'])) return 'main';
  return 'accessory';
}

function deriveDifficulty(level) {
  if (level <= 1) return 'low';
  if (level === 2) return 'medium';
  return 'high';
}

async function loadStaticTemplates() {
  const { EXERCISE_TEMPLATES } = await import('../src/lib/workout-routine/exercise-templates.ts');
  return EXERCISE_TEMPLATES.map((t) => ({
    id: t.id,
    name: t.name,
    level: t.level ?? 1,
    focus_tags: [...(t.focus_tags ?? [])],
    contraindications: [...(t.avoid_tags ?? [])],
    duration_sec: 300,
    media_ref: null,
    is_fallback: t.id === 'M01' || t.id === 'M28',
    phase: t.phase ?? inferPhase(t.focus_tags ?? []),
    target_vector: t.target_vector?.length ? [...t.target_vector] : inferTargetVector(t.focus_tags ?? []),
    difficulty: t.difficulty ?? deriveDifficulty(t.level ?? 1),
    avoid_if_pain_mode: t.avoid_if_pain_mode?.length ? [...t.avoid_if_pain_mode] : null,
    progression_level: t.progression_level ?? 1,
    balance_demand: t.balance_demand ?? 'low',
    complexity: t.complexity ?? 'low',
  }));
}

const PRIMARY_FOCUS_BY_TYPE_FOR_SSOT = {
  LOWER_INSTABILITY: ['lower_chain_stability', 'glute_activation', 'glute_medius', 'basic_balance'],
  UPPER_IMMOBILITY: ['shoulder_mobility', 'thoracic_mobility', 'upper_back_activation', 'shoulder_stability'],
};

async function run() {
  const [
    { calculateDeepV3 },
    { buildSessionPlanJson },
    { buildSessionBootstrapSummaryFromTemplates },
    { LOWER_AXIS_GUARD_TAGS },
    { resolveFirstSessionIntent },
    { resolveGoldPathVectorUnified },
    { computePhase, resolvePhaseLengths },
  ] = await Promise.all([
    import('../src/lib/deep-test/scoring/deep_v3.ts'),
    import('../src/lib/session/plan-generator.ts'),
    import('../src/lib/session/bootstrap-summary.ts'),
    import('../src/lib/session/lower-pair-session1-shared.ts'),
    import('../src/lib/session/priority-layer.ts'),
    import('../src/lib/session/first-session-anchor-resolver.ts'),
    import('../src/lib/session/phase.ts'),
  ]);
  const personas = (await import('../src/lib/deep-test/scenarios/personas.json')).default;
  const templates = await loadStaticTemplates();
  const templateById = new Map(templates.map((t) => [t.id, t]));

  const fixtures = [
    { anchor_type: 'LOWER_INSTABILITY', persona_id: 'lower-instability-basic' },
    { anchor_type: 'LOWER_MOBILITY_RESTRICTION', persona_id: 'lower-mobility-ankle' },
  ];
  const personaById = new Map(personas.map((p) => [p.id, p]));

  const continuity = [];
  for (const f of fixtures) {
    const persona = personaById.get(f.persona_id);
    const deep = calculateDeepV3(persona.input);
    const baselineAnchor = PRIMARY_TO_BASELINE_ANCHOR[deep.primary_type];

    const plan = await buildSessionPlanJson({
      templatePool: templates,
      sessionNumber: 1,
      totalSessions: 16,
      phase: 1,
      theme: 'PR2-B continuity check',
      timeBudget: 'normal',
      conditionMood: 'ok',
      focus: deep.derived?.focus_tags ?? [],
      avoid: deep.derived?.avoid_tags ?? [],
      painFlags: [],
      usedTemplateIds: [],
      scoringVersion: 'deep_v3',
      deep_level: deep.derived?.level ?? 2,
      safety_mode: toSafetyMode(deep.pain_mode),
      resultType: deep.derived?.result_type ?? 'LOWER-LIMB',
      primary_type: deep.primary_type,
      secondary_type: deep.secondary_type,
      priority_vector: deep.priority_vector,
      pain_mode: deep.pain_mode,
      baseline_session_anchor: baselineAnchor,
    });

    const deepSummary = {
      focus: deep.derived?.focus_tags ?? [],
      avoid: deep.derived?.avoid_tags ?? [],
      deep_level: deep.derived?.level ?? 2,
      safety_mode: toSafetyMode(deep.pain_mode),
      red_flags: false,
      primary_type: deep.primary_type,
      secondary_type: deep.secondary_type,
      priority_vector: deep.priority_vector,
      pain_mode: deep.pain_mode,
      result_type: deep.derived?.result_type ?? 'LOWER-LIMB',
      baseline_session_anchor: baselineAnchor,
    };
    const preview = buildSessionBootstrapSummaryFromTemplates(templates, {
      sessionNumber: 1,
      deepSummary,
    });

    const materializedMainVectors = collectMainVectorsFromPlan(plan, templateById);
    const previewMainVectors = collectMainVectorsFromPreview(preview, templateById);

    /** PR-FIRST-SESSION-PREVIEW-LOWER-ANCHOR-PARITY-01 */
    if (baselineAnchor === 'lower_stability') {
      assertMainNoUpperOnlyOffAxis('materialized', plan.segments, templateById);
      assertMainNoUpperOnlyOffAxis('preview', preview.segments, templateById);
      if (poolHasLowerStabilityAnchorLike(templates)) {
        if (!mainHasLowerStabilityAnchor(preview.segments, templateById)) {
          throw new Error(
            '[PR2-B preview] lower_stability S1: pool has anchor candidate but preview Main has none',
          );
        }
        if (!mainHasLowerStabilityAnchor(plan.segments, templateById)) {
          throw new Error(
            '[PR2-B materialized] lower_stability S1: pool has anchor candidate but materialized Main has none',
          );
        }
      }
    }

    continuity.push({
      anchor_type: f.anchor_type,
      expected_baseline_anchor: baselineAnchor,
      materialized_first_session_intent_anchor: plan.meta?.baseline_alignment?.first_session_intent_anchor ?? null,
      materialized_focus_axes: plan.meta?.session_focus_axes ?? [],
      preview_focus_axes: preview.focus_axes ?? [],
      materialized_main_vectors_top: materializedMainVectors,
      preview_main_vectors_top: previewMainVectors,
      continuity_checks: {
        focus_axes_match:
          JSON.stringify(plan.meta?.session_focus_axes ?? []) === JSON.stringify(preview.focus_axes ?? []),
        intent_anchor_matches_expected:
          (plan.meta?.baseline_alignment?.first_session_intent_anchor ?? null) === baselineAnchor,
        preview_main_has_expected_vector:
          hasVector(previewMainVectors, baselineAnchor),
        materialized_main_has_expected_vector:
          hasVector(materializedMainVectors, baselineAnchor),
        first_session_guardrail_kept:
          plan.meta?.constraint_flags?.first_session_guardrail_applied === true &&
          (preview.constraint_flags ?? []).includes('first_session_guardrail_applied'),
      },
    });
  }

  const lowerStabilityIntent = resolveFirstSessionIntent({
    sessionNumber: 1,
    baselineSessionAnchor: 'lower_stability',
  });
  const lowerMobilityIntent = resolveFirstSessionIntent({
    sessionNumber: 1,
    baselineSessionAnchor: 'lower_mobility',
  });

  const guardSync = {
    lower_stability: {
      intent_required_tags: lowerStabilityIntent?.requiredTags ?? [],
      guard_tags: [...LOWER_AXIS_GUARD_TAGS.lower_stability],
      includes_new_core_stability:
        (lowerStabilityIntent?.requiredTags ?? []).includes('core_stability') &&
        LOWER_AXIS_GUARD_TAGS.lower_stability.includes('core_stability'),
    },
    lower_mobility: {
      intent_required_tags: lowerMobilityIntent?.requiredTags ?? [],
      guard_tags: [...LOWER_AXIS_GUARD_TAGS.lower_mobility],
      includes_new_calf_release:
        (lowerMobilityIntent?.requiredTags ?? []).includes('calf_release') &&
        LOWER_AXIS_GUARD_TAGS.lower_mobility.includes('calf_release'),
    },
  };

  /** Upper-mobility S1: upper-only tags may still appear in Main (not lower_stability guard). */
  const upperPersona = personaById.get('upper-immobility-basic');
  let upperPreviewUpperOnlyInMain = false;
  if (upperPersona) {
    const deepU = calculateDeepV3(upperPersona.input);
    const previewU = buildSessionBootstrapSummaryFromTemplates(templates, {
      sessionNumber: 1,
      deepSummary: {
        focus: deepU.derived?.focus_tags ?? [],
        avoid: deepU.derived?.avoid_tags ?? [],
        deep_level: deepU.derived?.level ?? 2,
        safety_mode: toSafetyMode(deepU.pain_mode),
        red_flags: false,
        primary_type: deepU.primary_type,
        secondary_type: deepU.secondary_type,
        priority_vector: deepU.priority_vector,
        pain_mode: deepU.pain_mode,
        result_type: deepU.derived?.result_type ?? 'UPPER-LIMB',
        baseline_session_anchor: 'upper_mobility',
      },
    });
    const mainU = previewU.segments.find((s) => s.title === 'Main');
    upperPreviewUpperOnlyInMain = (mainU?.items ?? []).some((item) => {
      const tpl = templateById.get(item.templateId);
      return tpl && isUpperOnlyMainOffAxisForLowerStability(tpl);
    });
  }

  /** PR-FIRST-SESSION-ANCHOR-SSOT-01 — priority vs explicit Session 1 anchor */
  const ssotLowerDeepSummary = {
    focus: PRIMARY_FOCUS_BY_TYPE_FOR_SSOT.LOWER_INSTABILITY,
    avoid: [],
    deep_level: 2,
    safety_mode: 'none',
    red_flags: false,
    primary_type: 'LOWER_INSTABILITY',
    secondary_type: 'PR2B_SSOT_SECONDARY',
    priority_vector: { upper_mobility: 9, lower_stability: 3, trunk_control: 1 },
    pain_mode: 'none',
    result_type: 'LOWER-LIMB',
    baseline_session_anchor: 'lower_stability',
    scoring_version: 'deep_v2',
  };

  const intentSsotLower = resolveFirstSessionIntent({
    sessionNumber: 1,
    resultType: ssotLowerDeepSummary.result_type,
    baselineSessionAnchor: ssotLowerDeepSummary.baseline_session_anchor,
  });

  const unifiedSsotLower = resolveGoldPathVectorUnified({
    sessionNumber: 1,
    firstSessionGoldPath: intentSsotLower?.goldPath ?? null,
    baselineSessionAnchor: ssotLowerDeepSummary.baseline_session_anchor,
    primaryType: ssotLowerDeepSummary.primary_type,
    priorityVector: ssotLowerDeepSummary.priority_vector,
  });
  if (unifiedSsotLower.vector !== 'lower_stability') {
    throw new Error(
      `[PR2-B SSOT] unified lower mismatch expected lower_stability; got ${unifiedSsotLower.vector} (${unifiedSsotLower.source})`,
    );
  }

  const planSsotLower = await buildSessionPlanJson({
    templatePool: templates,
    sessionNumber: 1,
    totalSessions: 16,
    phase: 1,
    theme: 'PR2-B SSOT lower anchor',
    timeBudget: 'normal',
    conditionMood: 'ok',
    focus: ssotLowerDeepSummary.focus,
    avoid: ssotLowerDeepSummary.avoid,
    painFlags: [],
    usedTemplateIds: [],
    scoringVersion: 'deep_v3',
    deep_level: ssotLowerDeepSummary.deep_level,
    safety_mode: ssotLowerDeepSummary.safety_mode,
    resultType: ssotLowerDeepSummary.result_type,
    primary_type: ssotLowerDeepSummary.primary_type,
    secondary_type: ssotLowerDeepSummary.secondary_type,
    priority_vector: ssotLowerDeepSummary.priority_vector,
    pain_mode: ssotLowerDeepSummary.pain_mode,
    baseline_session_anchor: ssotLowerDeepSummary.baseline_session_anchor,
    red_flags: ssotLowerDeepSummary.red_flags,
  });

  if (planSsotLower.meta?.baseline_alignment?.gold_path_vector !== 'lower_stability') {
    throw new Error(
      `[PR2-B SSOT] materialized gold_path_vector expected lower_stability; got ${planSsotLower.meta?.baseline_alignment?.gold_path_vector ?? 'null'}`,
    );
  }

  const previewSsotLower = buildSessionBootstrapSummaryFromTemplates(templates, {
    sessionNumber: 1,
    deepSummary: ssotLowerDeepSummary,
  });
  assertMainNoUpperOnlyOffAxis('SSOT-preview-lower', previewSsotLower.segments, templateById);
  assertMainNoUpperOnlyOffAxis('SSOT-materialized-lower', planSsotLower.segments, templateById);
  if (poolHasLowerStabilityAnchorLike(templates)) {
    if (!mainHasLowerStabilityAnchor(previewSsotLower.segments, templateById)) {
      throw new Error('[PR2-B SSOT] preview Main missing lower-stability anchor candidate');
    }
    if (!mainHasLowerStabilityAnchor(planSsotLower.segments, templateById)) {
      throw new Error('[PR2-B SSOT] materialized Main missing lower-stability anchor candidate');
    }
  }

  const ssotUpperDeepSummary = {
    focus: PRIMARY_FOCUS_BY_TYPE_FOR_SSOT.UPPER_IMMOBILITY,
    avoid: [],
    deep_level: 2,
    safety_mode: 'none',
    red_flags: false,
    primary_type: 'UPPER_IMMOBILITY',
    secondary_type: 'PR2B_SSOT_SECONDARY_U',
    priority_vector: { lower_stability: 9, upper_mobility: 3, trunk_control: 1 },
    pain_mode: 'none',
    result_type: 'UPPER-LIMB',
    baseline_session_anchor: 'upper_mobility',
    scoring_version: 'deep_v2',
  };

  const intentSsotUpper = resolveFirstSessionIntent({
    sessionNumber: 1,
    resultType: ssotUpperDeepSummary.result_type,
    baselineSessionAnchor: ssotUpperDeepSummary.baseline_session_anchor,
  });

  const unifiedSsotUpper = resolveGoldPathVectorUnified({
    sessionNumber: 1,
    firstSessionGoldPath: intentSsotUpper?.goldPath ?? null,
    baselineSessionAnchor: ssotUpperDeepSummary.baseline_session_anchor,
    primaryType: ssotUpperDeepSummary.primary_type,
    priorityVector: ssotUpperDeepSummary.priority_vector,
  });
  if (unifiedSsotUpper.vector !== 'upper_mobility') {
    throw new Error(
      `[PR2-B SSOT] unified upper mismatch expected upper_mobility; got ${unifiedSsotUpper.vector} (${unifiedSsotUpper.source})`,
    );
  }

  const planSsotUpper = await buildSessionPlanJson({
    templatePool: templates,
    sessionNumber: 1,
    totalSessions: 16,
    phase: 1,
    theme: 'PR2-B SSOT upper anchor',
    timeBudget: 'normal',
    conditionMood: 'ok',
    focus: ssotUpperDeepSummary.focus,
    avoid: ssotUpperDeepSummary.avoid,
    painFlags: [],
    usedTemplateIds: [],
    scoringVersion: 'deep_v3',
    deep_level: ssotUpperDeepSummary.deep_level,
    safety_mode: ssotUpperDeepSummary.safety_mode,
    resultType: ssotUpperDeepSummary.result_type,
    primary_type: ssotUpperDeepSummary.primary_type,
    secondary_type: ssotUpperDeepSummary.secondary_type,
    priority_vector: ssotUpperDeepSummary.priority_vector,
    pain_mode: ssotUpperDeepSummary.pain_mode,
    baseline_session_anchor: ssotUpperDeepSummary.baseline_session_anchor,
    red_flags: ssotUpperDeepSummary.red_flags,
  });

  if (planSsotUpper.meta?.baseline_alignment?.gold_path_vector !== 'upper_mobility') {
    throw new Error(
      `[PR2-B SSOT] materialized gold_path_vector expected upper_mobility; got ${planSsotUpper.meta?.baseline_alignment?.gold_path_vector ?? 'null'}`,
    );
  }

  buildSessionBootstrapSummaryFromTemplates(templates, {
    sessionNumber: 1,
    deepSummary: ssotUpperDeepSummary,
  });

  const ssotSession2 = resolveGoldPathVectorUnified({
    sessionNumber: 2,
    firstSessionGoldPath: null,
    baselineSessionAnchor: 'lower_stability',
    primaryType: 'LOWER_INSTABILITY',
    priorityVector: { upper_mobility: 9, lower_stability: 3 },
  });
  if (ssotSession2.vector !== 'upper_mobility' || ssotSession2.source !== 'priority_vector') {
    throw new Error(
      `[PR2-B SSOT] session 2 expected priority_vector upper_mobility; got vector=${ssotSession2.vector}, source=${ssotSession2.source}`,
    );
  }

  /** PR-SESSION-2PLUS-TYPE-CONTINUITY-GUARD-01 */
  const phasePolicyS23 = {
    deepLevel: ssotLowerDeepSummary.deep_level ?? 2,
    safetyMode: ssotLowerDeepSummary.safety_mode,
    redFlags: ssotLowerDeepSummary.red_flags,
  };
  const phaseLengthsS23 = [...resolvePhaseLengths(16, phasePolicyS23)];
  const s23_continuity = {};
  const planSn4ContinuityCheck = await buildSessionPlanJson({
    templatePool: templates,
    sessionNumber: 4,
    totalSessions: 16,
    phase: computePhase(16, 4, {
      phaseLengths: phaseLengthsS23,
      policyOptions: phasePolicyS23,
    }),
    theme: 'PR2-B session 4 (no S2/S3 continuity meta)',
    timeBudget: 'normal',
    conditionMood: 'ok',
    focus: ssotLowerDeepSummary.focus,
    avoid: ssotLowerDeepSummary.avoid,
    painFlags: [],
    usedTemplateIds: [],
    scoringVersion: 'deep_v3',
    deep_level: ssotLowerDeepSummary.deep_level,
    safety_mode: ssotLowerDeepSummary.safety_mode,
    resultType: ssotLowerDeepSummary.result_type,
    primary_type: ssotLowerDeepSummary.primary_type,
    secondary_type: ssotLowerDeepSummary.secondary_type,
    priority_vector: ssotLowerDeepSummary.priority_vector,
    pain_mode: ssotLowerDeepSummary.pain_mode,
    baseline_session_anchor: ssotLowerDeepSummary.baseline_session_anchor,
    red_flags: ssotLowerDeepSummary.red_flags,
  });
  if (planSn4ContinuityCheck.meta?.session_type_continuity != null) {
    throw new Error(
      '[PR2-B S23] session 4 should not attach session_type_continuity (S2/S3-only guard)',
    );
  }

  for (const sn of [2, 3]) {
    const phaseSn = computePhase(16, sn, {
      phaseLengths: phaseLengthsS23,
      policyOptions: phasePolicyS23,
    });
    const planSn = await buildSessionPlanJson({
      templatePool: templates,
      sessionNumber: sn,
      totalSessions: 16,
      phase: phaseSn,
      theme: `PR2-B S${sn} lower continuity`,
      timeBudget: 'normal',
      conditionMood: 'ok',
      focus: ssotLowerDeepSummary.focus,
      avoid: ssotLowerDeepSummary.avoid,
      painFlags: [],
      usedTemplateIds: [],
      scoringVersion: 'deep_v3',
      deep_level: ssotLowerDeepSummary.deep_level,
      safety_mode: ssotLowerDeepSummary.safety_mode,
      resultType: ssotLowerDeepSummary.result_type,
      primary_type: ssotLowerDeepSummary.primary_type,
      secondary_type: ssotLowerDeepSummary.secondary_type,
      priority_vector: ssotLowerDeepSummary.priority_vector,
      pain_mode: ssotLowerDeepSummary.pain_mode,
      baseline_session_anchor: ssotLowerDeepSummary.baseline_session_anchor,
      red_flags: ssotLowerDeepSummary.red_flags,
    });
    if (!planSn.meta?.session_type_continuity || planSn.meta.session_type_continuity.version !== 'session_type_continuity_v1') {
      throw new Error(
        `[PR2-B S23] expected session_type_continuity for session ${sn}, got ${JSON.stringify(planSn.meta?.session_type_continuity)}`,
      );
    }
    assertMainNoUpperOnlyOffAxis(`S${sn}-materialized`, planSn.segments, templateById);
    const previewSn = buildSessionBootstrapSummaryFromTemplates(templates, {
      sessionNumber: sn,
      deepSummary: ssotLowerDeepSummary,
    });
    assertMainNoUpperOnlyOffAxis(`S${sn}-preview`, previewSn.segments, templateById);
    if (poolHasLowerStabilityAnchorLike(templates)) {
      if (!mainHasLowerStabilityAnchor(previewSn.segments, templateById)) {
        throw new Error(`[PR2-B S23] preview session ${sn} Main missing lower-stability anchor`);
      }
      if (!mainHasLowerStabilityAnchor(planSn.segments, templateById)) {
        throw new Error(`[PR2-B S23] materialized session ${sn} Main missing lower-stability anchor`);
      }
    }
    s23_continuity[`session_${sn}`] = {
      materialized_has_stc_meta: !!planSn.meta.session_type_continuity,
      preview_main_anchor_ok: poolHasLowerStabilityAnchorLike(templates)
        ? mainHasLowerStabilityAnchor(previewSn.segments, templateById)
        : null,
    };
  }

  const out = {
    generated_at: new Date().toISOString(),
    purpose: 'PR2-B follow-up continuity + dominant-axis guard sync proof',
    continuity,
    guard_sync: guardSync,
    lower_stability_s1_regression: {
      note: 'Preview/materialized Main upper-only off-axis blocked for lower_stability S1; upper-mobility path may still surface upper-only Main items',
      upper_preview_sample_has_upper_only_main_candidate: upperPreviewUpperOnlyInMain,
    },
    ssot_anchor_mismatch: {
      lower_vector_unified: unifiedSsotLower.vector,
      lower_resolution_source: unifiedSsotLower.source,
      materialized_lower_gold_path_vector: planSsotLower.meta?.baseline_alignment?.gold_path_vector ?? null,
      materialized_lower_gold_path_resolution_source:
        planSsotLower.meta?.baseline_alignment?.gold_path_resolution_source ?? null,
      upper_vector_unified: unifiedSsotUpper.vector,
      upper_resolution_source: unifiedSsotUpper.source,
      materialized_upper_gold_path_vector: planSsotUpper.meta?.baseline_alignment?.gold_path_vector ?? null,
      session_2_unified_vector: ssotSession2.vector,
      session_2_unified_source: ssotSession2.source,
    },
    s23_lower_stability_continuity: s23_continuity,
    session_4_has_no_session_type_continuity: planSn4ContinuityCheck.meta?.session_type_continuity == null,
  };

  const outPath = join(process.cwd(), 'artifacts/pr2b/lower-pair-preview-materialized-continuity.json');
  mkdirSync(join(process.cwd(), 'artifacts/pr2b'), { recursive: true });
  writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
  console.log(`Wrote continuity proof: ${outPath}`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
