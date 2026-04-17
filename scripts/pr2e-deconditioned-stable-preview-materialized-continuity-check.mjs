/**
 * PR2-E continuity proof:
 * preview/bootstrap path and materialized plan path read the same deconditioned/stable truth.
 *
 * Run:
 *   npx tsx scripts/pr2e-deconditioned-stable-preview-materialized-continuity-check.mjs
 */

import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const FIXTURES = [
  { anchor_type: 'DECONDITIONED', persona_id: 'deconditioned-basic', baseline_session_anchor: 'deconditioned' },
  { anchor_type: 'STABLE', persona_id: 'stable-basic', baseline_session_anchor: 'balanced_reset' },
];

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

function collectMainShape(segmentCarrier, templateById) {
  const main = segmentCarrier.segments.find((segment) => segment.title === 'Main');
  const tags = [];
  const vectors = [];
  const templateIds = [];
  const templates = [];
  for (const item of main?.items ?? []) {
    const template = templateById.get(item.templateId);
    templateIds.push(item.templateId);
    templates.push({
      template_id: item.templateId,
      name: template?.name ?? null,
      level: template?.level ?? null,
      phase: template?.phase ?? null,
      focus_tags: template?.focus_tags ?? [],
      target_vector: template?.target_vector ?? [],
    });
    for (const tag of template?.focus_tags ?? []) tags.push(tag);
    for (const vector of template?.target_vector ?? []) vectors.push(vector);
  }
  return {
    template_ids: templateIds,
    templates,
    focus_tags_top: topCounts(tags, 8),
    target_vectors_top: topCounts(vectors),
  };
}

function topKey(list) {
  return list?.[0]?.key ?? null;
}

function vectorKeys(list) {
  return (list ?? []).map((item) => item.key);
}

function sharedKeys(a, b) {
  const setB = new Set(b);
  return a.filter((key) => setB.has(key));
}

function hasAnyVector(shape, keys) {
  const shapeKeys = new Set(vectorKeys(shape.target_vectors_top));
  return keys.some((key) => shapeKeys.has(key));
}

function hasAllVectors(shape, keys) {
  const shapeKeys = new Set(vectorKeys(shape.target_vectors_top));
  return keys.every((key) => shapeKeys.has(key));
}

function hasAnyTag(shape, keys) {
  const tagKeys = new Set((shape.focus_tags_top ?? []).map((item) => item.key));
  return keys.some((key) => tagKeys.has(key));
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

function getExpectedVectors(anchorType) {
  if (anchorType === 'DECONDITIONED') {
    return ['trunk_control', 'upper_mobility'];
  }
  return ['upper_mobility', 'trunk_control'];
}

async function run() {
  const [
    { calculateDeepV3 },
    { buildSessionPlanJson },
    { buildSessionBootstrapSummaryFromTemplates },
  ] = await Promise.all([
    import('../src/lib/deep-test/scoring/deep_v3.ts'),
    import('../src/lib/session/plan-generator.ts'),
    import('../src/lib/session/bootstrap-summary.ts'),
  ]);
  const personas = (await import('../src/lib/deep-test/scenarios/personas.json')).default;
  const personaById = new Map(personas.map((p) => [p.id, p]));
  const templates = await loadStaticTemplates();
  const templateById = new Map(templates.map((t) => [t.id, t]));

  const perAnchor = [];

  for (const fixture of FIXTURES) {
    const persona = personaById.get(fixture.persona_id);
    if (!persona) throw new Error(`Missing persona for fixture: ${fixture.persona_id}`);

    const deep = calculateDeepV3(persona.input);
    const baselineSessionAnchor = fixture.baseline_session_anchor;

    const plan = await buildSessionPlanJson({
      templatePool: templates,
      sessionNumber: 1,
      totalSessions: 16,
      phase: 1,
      theme: `PR2-E ${fixture.anchor_type}`,
      timeBudget: 'normal',
      conditionMood: 'ok',
      focus: deep.derived?.focus_tags ?? [],
      avoid: deep.derived?.avoid_tags ?? [],
      painFlags: [],
      usedTemplateIds: [],
      scoringVersion: 'deep_v3',
      deep_level: deep.derived?.level ?? 2,
      safety_mode: toSafetyMode(deep.pain_mode),
      resultType: deep.derived?.result_type ?? fixture.anchor_type,
      primary_type: deep.primary_type,
      secondary_type: deep.secondary_type,
      priority_vector: deep.priority_vector,
      pain_mode: deep.pain_mode,
      baseline_session_anchor: baselineSessionAnchor,
    });

    const preview = buildSessionBootstrapSummaryFromTemplates(templates, {
      sessionNumber: 1,
      deepSummary: {
        focus: deep.derived?.focus_tags ?? [],
        avoid: deep.derived?.avoid_tags ?? [],
        deep_level: deep.derived?.level ?? 2,
        safety_mode: toSafetyMode(deep.pain_mode),
        red_flags: false,
        primary_type: deep.primary_type,
        secondary_type: deep.secondary_type,
        priority_vector: deep.priority_vector,
        pain_mode: deep.pain_mode,
        result_type: deep.derived?.result_type ?? fixture.anchor_type,
        baseline_session_anchor: baselineSessionAnchor,
      },
    });

    const materializedMain = collectMainShape(plan, templateById);
    const previewMain = collectMainShape(preview, templateById);
    const materializedVectorKeys = vectorKeys(materializedMain.target_vectors_top);
    const previewVectorKeys = vectorKeys(previewMain.target_vectors_top);
    const sharedVectorKeys = sharedKeys(materializedVectorKeys, previewVectorKeys);
    const expectedVectors = getExpectedVectors(fixture.anchor_type);
    const materializedPrimaryVector = topKey(materializedMain.target_vectors_top);
    const previewPrimaryVector = topKey(previewMain.target_vectors_top);
    const materializedFocusAxes = plan.meta?.session_focus_axes ?? [];
    const previewFocusAxes = preview.focus_axes ?? [];
    const deconditionedActualMainAligned =
      fixture.anchor_type !== 'DECONDITIONED' ||
      (
        materializedFocusAxes.includes('trunk_control') &&
        hasAllVectors(materializedMain, ['trunk_control', 'upper_mobility']) &&
        hasAnyTag(materializedMain, ['core_control', 'core_stability', 'global_core']) &&
        materializedMain.template_ids.includes('M14')
      );

    perAnchor.push({
      anchor_type: fixture.anchor_type,
      expected_baseline_anchor: baselineSessionAnchor,
      materialized_first_session_intent_anchor: plan.meta?.baseline_alignment?.first_session_intent_anchor ?? null,
      materialized_focus_axes: materializedFocusAxes,
      preview_focus_axes: previewFocusAxes,
      materialized_segment_titles: plan.segments.map((segment) => segment.title),
      preview_segment_titles: preview.segments.map((segment) => segment.title),
      materialized_main_emphasis_shape: materializedMain,
      preview_main_emphasis_shape: previewMain,
      alignment_evidence: {
        expected_signal_vectors: expectedVectors,
        materialized_primary_vector: materializedPrimaryVector,
        preview_primary_vector: previewPrimaryVector,
        materialized_main_template_ids: materializedMain.template_ids,
        preview_main_template_ids: previewMain.template_ids,
        deconditioned_actual_main_aligned: deconditionedActualMainAligned,
      },
      continuity_checks: {
        intent_anchor_matches_expected:
          (plan.meta?.baseline_alignment?.first_session_intent_anchor ?? null) === baselineSessionAnchor,
        focus_axes_match:
          JSON.stringify(materializedFocusAxes) === JSON.stringify(previewFocusAxes),
        segment_titles_match:
          JSON.stringify(plan.segments.map((segment) => segment.title)) ===
          JSON.stringify(preview.segments.map((segment) => segment.title)),
        primary_vector_matches: materializedPrimaryVector === previewPrimaryVector,
        primary_vector_matches_expected_focus_axes:
          materializedPrimaryVector !== null && materializedFocusAxes.includes(materializedPrimaryVector),
        shared_vector_keys: sharedVectorKeys,
        shared_vector_keys_nonempty: sharedVectorKeys.length > 0,
        expected_signal_vectors_present:
          expectedVectors.every((vector) => sharedVectorKeys.includes(vector)) ||
          hasAnyVector(materializedMain, expectedVectors) ||
          hasAnyVector(previewMain, expectedVectors),
        actual_main_direction_aligned:
          expectedVectors.every((vector) => materializedVectorKeys.includes(vector)) &&
          materializedPrimaryVector !== null &&
          materializedFocusAxes.includes(materializedPrimaryVector),
        first_session_guardrail_kept:
          plan.meta?.constraint_flags?.first_session_guardrail_applied === true &&
          (preview.constraint_flags ?? []).includes('first_session_guardrail_applied'),
      },
    });
  }

  const out = {
    generated_at: new Date().toISOString(),
    purpose: 'PR2-E preview/materialized continuity proof',
    template_source: 'static_fallback_fixture',
    per_anchor: perAnchor,
  };

  const outPath = join(process.cwd(), 'artifacts/pr2e/deconditioned-stable-preview-materialized-continuity.json');
  mkdirSync(join(process.cwd(), 'artifacts/pr2e'), { recursive: true });
  writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
  console.log(`Wrote continuity proof: ${outPath}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
