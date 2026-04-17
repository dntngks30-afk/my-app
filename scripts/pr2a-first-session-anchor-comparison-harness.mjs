/**
 * PR2-A: First-session anchor comparison harness (baseline lock).
 *
 * Run:
 *   npx tsx scripts/pr2a-first-session-anchor-comparison-harness.mjs
 *
 * Purpose:
 * - Produce comparable session-1 snapshots for representative anchor groups.
 * - Do NOT tune generator behavior; only expose comparison surface.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
process.chdir(root);

const PRIMARY_TO_RESULT_TYPE = {
  LOWER_INSTABILITY: 'LOWER-LIMB',
  LOWER_MOBILITY_RESTRICTION: 'LOWER-LIMB',
  UPPER_IMMOBILITY: 'UPPER-LIMB',
  CORE_CONTROL_DEFICIT: 'LUMBO-PELVIS',
  DECONDITIONED: 'DECONDITIONED',
  STABLE: 'STABLE',
};

const PRIMARY_TO_BASELINE_ANCHOR = {
  LOWER_INSTABILITY: 'lower_stability',
  LOWER_MOBILITY_RESTRICTION: 'lower_mobility',
  UPPER_IMMOBILITY: 'upper_mobility',
  CORE_CONTROL_DEFICIT: 'trunk_control',
  DECONDITIONED: 'deconditioned',
  STABLE: 'balanced_reset',
};

function toSafetyMode(painMode) {
  if (painMode === 'protected') return 'red';
  if (painMode === 'caution') return 'yellow';
  return 'none';
}

function getSegment(plan, title) {
  return plan.segments.find((seg) => seg.title === title);
}

function countItems(seg) {
  return seg?.items?.length ?? 0;
}

function topCounts(items, limit = 4) {
  const counts = new Map();
  for (const item of items) {
    counts.set(item, (counts.get(item) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }));
}

function collectTagShape(plan, templateById, segmentTitle, limit = 4) {
  const seg = getSegment(plan, segmentTitle);
  const tags = [];
  for (const item of seg?.items ?? []) {
    const template = templateById.get(item.templateId);
    for (const tag of template?.focus_tags ?? []) tags.push(tag);
  }
  return topCounts(tags, limit);
}

function collectVectorShape(plan, templateById, segmentTitle) {
  const seg = getSegment(plan, segmentTitle);
  const vectors = [];
  for (const item of seg?.items ?? []) {
    const template = templateById.get(item.templateId);
    for (const vector of template?.target_vector ?? []) vectors.push(vector);
  }
  return topCounts(vectors);
}

function collectTemplateShape(plan, templateById, segmentTitle) {
  const seg = getSegment(plan, segmentTitle);
  return (seg?.items ?? []).map((item) => {
    const template = templateById.get(item.templateId);
    return {
      template_id: item.templateId,
      name: template?.name ?? null,
      level: template?.level ?? null,
      phase: template?.phase ?? null,
      focus_tags: template?.focus_tags ?? [],
      target_vector: template?.target_vector ?? [],
    };
  });
}

function collectSegmentEmphasisShape(plan, templateById) {
  return plan.segments.map((seg) => ({
    title: seg.title,
    template_ids: (seg.items ?? []).map((item) => item.templateId),
    templates: collectTemplateShape(plan, templateById, seg.title),
    focus_tags_top: collectTagShape(plan, templateById, seg.title, 8),
    target_vectors_top: collectVectorShape(plan, templateById, seg.title),
  }));
}

function buildSnapshot({ fixture, persona, deep, plan, templateById }) {
  const meta = plan.meta ?? {};
  const prep = getSegment(plan, 'Prep');
  const main = getSegment(plan, 'Main');
  const cooldown = getSegment(plan, 'Cooldown');

  return {
    anchor_type: fixture.anchor_type,
    persona_id: fixture.persona_id,
    result: {
      primary_type: deep.primary_type,
      result_type: deep.derived?.result_type ?? PRIMARY_TO_RESULT_TYPE[deep.primary_type] ?? 'UNKNOWN',
      pain_mode: deep.pain_mode,
      safety_mode: toSafetyMode(deep.pain_mode),
      baseline_session_anchor: PRIMARY_TO_BASELINE_ANCHOR[deep.primary_type] ?? null,
      priority_vector: deep.priority_vector ?? {},
    },
    first_session: {
      session_number: meta.session_number,
      first_session_intent_anchor: meta?.baseline_alignment?.first_session_intent_anchor ?? null,
      intent_source: meta?.baseline_alignment?.intent_source ?? null,
      gold_path_vector: meta?.baseline_alignment?.gold_path_vector ?? null,
      rationale: meta.session_rationale ?? null,
      session_focus_axes: meta.session_focus_axes ?? [],
      segment_counts: {
        prep: countItems(prep),
        main: countItems(main),
        accessory: countItems(getSegment(plan, 'Accessory')),
        cooldown: countItems(cooldown),
        total: plan.segments.reduce((acc, seg) => acc + countItems(seg), 0),
      },
      segment_shape: plan.segments.map((seg) => ({
        title: seg.title,
        item_count: countItems(seg),
      })),
      main_emphasis_shape: {
        template_ids: collectTemplateShape(plan, templateById, 'Main').map((template) => template.template_id),
        templates: collectTemplateShape(plan, templateById, 'Main'),
        focus_tags_top: collectTagShape(
          plan,
          templateById,
          'Main',
          fixture.anchor_type === 'CORE_CONTROL_DEFICIT' ? 8 : 4
        ),
        target_vectors_top: collectVectorShape(plan, templateById, 'Main'),
      },
      segment_emphasis_shape: collectSegmentEmphasisShape(plan, templateById),
      guardrail_summary: {
        pain_mode: meta.pain_mode ?? null,
        safety_mode: meta.safety_mode ?? null,
        first_session_guardrail_applied: meta.constraint_flags?.first_session_guardrail_applied ?? null,
        pain_gate_applied: meta.constraint_flags?.pain_gate_applied ?? null,
        short_mode_applied: meta.constraint_flags?.short_mode_applied ?? null,
        recovery_mode_applied: meta.constraint_flags?.recovery_mode_applied ?? null,
        policy_rules: meta.policy_registry?.selection_rule_ids ?? [],
      },
    },
  };
}

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {
    output: null,
    anchors: null,
  };

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--output' && args[i + 1]) {
      out.output = args[i + 1];
      i += 1;
      continue;
    }
    if (a === '--anchors' && args[i + 1]) {
      out.anchors = args[i + 1]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      i += 1;
    }
  }
  return out;
}

function inferTargetVector(focusTags) {
  const hasAny = (tags) => tags.some((tag) => focusTags.includes(tag));
  const vectors = [];

  if (hasAny(['lower_chain_stability', 'glute_medius', 'glute_activation', 'basic_balance'])) {
    vectors.push('lower_stability');
  }
  if (hasAny(['hip_mobility', 'ankle_mobility', 'hip_flexor_stretch', 'calf_release'])) {
    vectors.push('lower_mobility');
  }
  if (hasAny(['core_control', 'core_stability', 'global_core'])) {
    vectors.push('trunk_control');
  }
  if (hasAny(['thoracic_mobility', 'shoulder_mobility', 'shoulder_stability', 'upper_back_activation'])) {
    vectors.push('upper_mobility');
  }
  if (hasAny(['full_body_reset'])) {
    vectors.push('deconditioned');
  }
  return [...new Set(vectors)];
}

function inferPhase(focusTags) {
  const hasAny = (tags) => tags.some((tag) => focusTags.includes(tag));
  if (hasAny(['full_body_reset', 'calf_release', 'upper_trap_release', 'neck_mobility', 'thoracic_mobility', 'shoulder_mobility', 'hip_flexor_stretch', 'hip_mobility', 'ankle_mobility'])) {
    return 'prep';
  }
  if (hasAny(['core_stability', 'global_core', 'upper_back_activation', 'shoulder_stability', 'glute_activation', 'lower_chain_stability', 'glute_medius', 'basic_balance'])) {
    return 'main';
  }
  return 'accessory';
}

function deriveDifficulty(level) {
  if (level <= 1) return 'low';
  if (level === 2) return 'medium';
  return 'high';
}

async function loadTemplates({ getTemplatesForSessionPlan }) {
  try {
    const templates = await getTemplatesForSessionPlan({ scoringVersion: 'deep_v2' });
    return { templates, source: 'supabase' };
  } catch (e) {
    const msg = String(e?.message ?? '');
    const recoverable =
      msg.includes('SUPABASE') ||
      msg.includes('Missing') ||
      msg.includes('fetch failed') ||
      msg.includes('session plan fetch failed');
    if (!recoverable) throw e;
  }

  const { EXERCISE_TEMPLATES } = await import('../src/lib/workout-routine/exercise-templates.ts');
  const templates = EXERCISE_TEMPLATES.map((t) => ({
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
  return { templates, source: 'static_fallback_fixture' };
}

async function run() {
  const args = parseArgs();
  const fixturePath = join(root, 'scripts/fixtures/pr2a-first-session-anchor-fixtures.json');
  const personasPath = join(root, 'src/lib/deep-test/scenarios/personas.json');
  const allFixtures = JSON.parse(readFileSync(fixturePath, 'utf-8'));
  const fixtures = args.anchors?.length
    ? allFixtures.filter((f) => args.anchors.includes(f.anchor_type))
    : allFixtures;
  if (fixtures.length === 0) throw new Error('No fixtures selected. Check --anchors value.');
  const personas = JSON.parse(readFileSync(personasPath, 'utf-8'));
  const personaById = new Map(personas.map((p) => [p.id, p]));

  let buildSessionPlanJson;
  let calculateDeepV3;
  let getTemplatesForSessionPlan;
  let applyTrunkCoreSession1TemplateProjection;

  try {
    ({ buildSessionPlanJson } = await import('../src/lib/session/plan-generator.ts'));
    ({ getTemplatesForSessionPlan } = await import('../src/lib/workout-routine/exercise-templates-db.ts'));
    ({ calculateDeepV3 } = await import('../src/lib/deep-test/scoring/deep_v3.ts'));
    ({ applyTrunkCoreSession1TemplateProjection } = await import('../src/lib/session/trunk-core-session1-shared.ts'));
  } catch (e) {
    throw e;
  }

  const { templates, source } = await loadTemplates({ getTemplatesForSessionPlan });

  const snapshots = [];

  for (const fixture of fixtures) {
    const persona = personaById.get(fixture.persona_id);
    if (!persona) {
      throw new Error(`Missing persona for fixture: ${fixture.persona_id}`);
    }

    const deep = calculateDeepV3(persona.input);
    if (deep.primary_type !== fixture.anchor_type) {
      throw new Error(
        `Fixture mismatch for ${fixture.anchor_type}: persona ${fixture.persona_id} produced ${deep.primary_type}`
      );
    }

    const resultType = deep.derived?.result_type ?? PRIMARY_TO_RESULT_TYPE[deep.primary_type] ?? 'UNKNOWN';
    const baselineAnchor = PRIMARY_TO_BASELINE_ANCHOR[deep.primary_type];

    const plan = await buildSessionPlanJson({
      templatePool: templates,
      sessionNumber: 1,
      totalSessions: 16,
      phase: 1,
      theme: 'Phase 1 · PR2-A baseline comparison',
      timeBudget: 'normal',
      conditionMood: 'ok',
      focus: deep.derived?.focus_tags ?? [],
      avoid: deep.derived?.avoid_tags ?? [],
      painFlags: [],
      usedTemplateIds: [],
      scoringVersion: 'deep_v3',
      deep_level: deep.derived?.level ?? 2,
      safety_mode: toSafetyMode(deep.pain_mode),
      resultType,
      primary_type: deep.primary_type,
      secondary_type: deep.secondary_type,
      priority_vector: deep.priority_vector,
      pain_mode: deep.pain_mode,
      baseline_session_anchor: baselineAnchor,
    });
    const snapshotTemplates = applyTrunkCoreSession1TemplateProjection(templates, baselineAnchor);
    const templateById = new Map(snapshotTemplates.map((t) => [t.id, t]));

    snapshots.push(
      buildSnapshot({
        fixture,
        persona,
        deep,
        plan,
        templateById,
      })
    );
  }

  const outputDir = join(root, 'artifacts');
  mkdirSync(outputDir, { recursive: true });
  const outPath = args.output
    ? (args.output.startsWith('/') ? args.output : join(root, args.output))
    : join(outputDir, 'pr2a-first-session-anchor-comparison-baseline.json');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        purpose: 'PR2-A baseline comparison harness snapshot (no tuning)',
        template_source: source,
        anchors: fixtures.map((f) => f.anchor_type),
        snapshots,
      },
      null,
      2
    ) + '\n'
  );

  console.log(`Generated baseline snapshot: ${outPath}`);
  console.log(`Template source: ${source}`);
  console.log(`Anchors covered: ${fixtures.map((f) => f.anchor_type).join(', ')}`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
