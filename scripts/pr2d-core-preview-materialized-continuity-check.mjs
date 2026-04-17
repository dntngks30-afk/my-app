/**
 * PR2-D continuity proof:
 * preview/bootstrap path and materialized plan path both read trunk/core
 * session-1 truth for CORE_CONTROL_DEFICIT.
 */

import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const BASELINE_ANCHOR = 'trunk_control';

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
  if (hasAny(['full_body_reset', 'calf_release', 'upper_trap_release', 'neck_mobility', 'thoracic_mobility', 'shoulder_mobility', 'hip_flexor_stretch', 'hip_mobility', 'ankle_mobility', 'core_control'])) return 'prep';
  if (hasAny(['core_stability', 'global_core', 'upper_back_activation', 'shoulder_stability', 'glute_activation', 'lower_chain_stability', 'glute_medius', 'basic_balance'])) return 'main';
  return 'accessory';
}

function deriveDifficulty(level) {
  if (level <= 1) return 'low';
  if (level === 2) return 'medium';
  return 'high';
}

function collectMainShape(segmentCarrier, templateById) {
  const main = segmentCarrier.segments.find((segment) => segment.title === 'Main');
  const tags = [];
  const vectors = [];
  const template_ids = [];
  for (const item of main?.items ?? []) {
    const template = templateById.get(item.templateId);
    template_ids.push(item.templateId);
    for (const tag of template?.focus_tags ?? []) tags.push(tag);
    for (const vector of template?.target_vector ?? []) vectors.push(vector);
  }
  return {
    template_ids,
    focus_tags_top: topCounts(tags),
    target_vectors_top: topCounts(vectors),
  };
}

function vectorCount(shape, key) {
  return shape.target_vectors_top.find((item) => item.key === key)?.count ?? 0;
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
  const [{ calculateDeepV3 }, { buildSessionPlanJson }, { buildSessionBootstrapSummaryFromTemplates }] = await Promise.all([
    import('../src/lib/deep-test/scoring/deep_v3.ts'),
    import('../src/lib/session/plan-generator.ts'),
    import('../src/lib/session/bootstrap-summary.ts'),
  ]);
  const personas = (await import('../src/lib/deep-test/scenarios/personas.json')).default;
  const persona = personas.find((p) => p.id === 'core-control-lumbo');
  if (!persona) throw new Error('Missing core-control-lumbo persona fixture');

  const deep = calculateDeepV3(persona.input);
  const templates = await loadStaticTemplates();
  const templateById = new Map(templates.map((template) => [template.id, template]));

  const common = {
    sessionNumber: 1,
    deep_level: deep.derived?.level ?? 2,
    safety_mode: toSafetyMode(deep.pain_mode),
    resultType: deep.derived?.result_type ?? 'LUMBO-PELVIS',
    primary_type: deep.primary_type,
    secondary_type: deep.secondary_type,
    priority_vector: deep.priority_vector,
    pain_mode: deep.pain_mode,
    baseline_session_anchor: BASELINE_ANCHOR,
  };

  const plan = await buildSessionPlanJson({
    templatePool: templates,
    totalSessions: 16,
    phase: 1,
    theme: 'PR2-D continuity check',
    timeBudget: 'normal',
    conditionMood: 'ok',
    focus: deep.derived?.focus_tags ?? [],
    avoid: deep.derived?.avoid_tags ?? [],
    painFlags: [],
    usedTemplateIds: [],
    scoringVersion: 'deep_v3',
    ...common,
  });

  const preview = buildSessionBootstrapSummaryFromTemplates(templates, {
    sessionNumber: 1,
    deepSummary: {
      focus: deep.derived?.focus_tags ?? [],
      avoid: deep.derived?.avoid_tags ?? [],
      deep_level: common.deep_level,
      safety_mode: common.safety_mode,
      red_flags: false,
      primary_type: deep.primary_type,
      secondary_type: deep.secondary_type,
      priority_vector: deep.priority_vector,
      pain_mode: deep.pain_mode,
      result_type: common.resultType,
      baseline_session_anchor: BASELINE_ANCHOR,
    },
  });

  const materializedMainShape = collectMainShape(plan, templateById);
  const previewMainShape = collectMainShape(preview, templateById);
  const out = {
    generated_at: new Date().toISOString(),
    purpose: 'PR2-D preview/materialized trunk-core continuity proof',
    anchor_type: deep.primary_type,
    expected_baseline_anchor: BASELINE_ANCHOR,
    materialized_first_session_intent_anchor: plan.meta?.baseline_alignment?.first_session_intent_anchor ?? null,
    materialized_focus_axes: plan.meta?.session_focus_axes ?? [],
    preview_focus_axes: preview.focus_axes ?? [],
    materialized_main_emphasis_shape: materializedMainShape,
    preview_main_emphasis_shape: previewMainShape,
    continuity_checks: {
      focus_axes_match:
        JSON.stringify(plan.meta?.session_focus_axes ?? []) === JSON.stringify(preview.focus_axes ?? []),
      intent_anchor_matches_expected:
        (plan.meta?.baseline_alignment?.first_session_intent_anchor ?? null) === BASELINE_ANCHOR,
      materialized_has_trunk_main:
        vectorCount(materializedMainShape, 'trunk_control') > 0,
      preview_has_trunk_main:
        vectorCount(previewMainShape, 'trunk_control') > 0,
      first_session_guardrail_kept:
        plan.meta?.constraint_flags?.first_session_guardrail_applied === true &&
        (preview.constraint_flags ?? []).includes('first_session_guardrail_applied'),
    },
  };

  const outPath = join(process.cwd(), 'artifacts/pr2d/core-preview-materialized-continuity.json');
  mkdirSync(join(process.cwd(), 'artifacts/pr2d'), { recursive: true });
  writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
  console.log(`Wrote continuity proof: ${outPath}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
