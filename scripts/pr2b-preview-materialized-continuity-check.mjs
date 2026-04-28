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

async function run() {
  const [{ calculateDeepV3 }, { buildSessionPlanJson }, { buildSessionBootstrapSummaryFromTemplates }, { LOWER_AXIS_GUARD_TAGS }, { resolveFirstSessionIntent }] = await Promise.all([
    import('../src/lib/deep-test/scoring/deep_v3.ts'),
    import('../src/lib/session/plan-generator.ts'),
    import('../src/lib/session/bootstrap-summary.ts'),
    import('../src/lib/session/lower-pair-session1-shared.ts'),
    import('../src/lib/session/priority-layer.ts'),
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

  const out = {
    generated_at: new Date().toISOString(),
    purpose: 'PR2-B follow-up continuity + dominant-axis guard sync proof',
    continuity,
    guard_sync: guardSync,
    lower_stability_s1_regression: {
      note: 'Preview/materialized Main upper-only off-axis blocked for lower_stability S1; upper-mobility path may still surface upper-only Main items',
      upper_preview_sample_has_upper_only_main_candidate: upperPreviewUpperOnlyInMain,
    },
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
