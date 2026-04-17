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

function collectTagShape(plan, templateById, segmentTitle) {
  const seg = getSegment(plan, segmentTitle);
  const tags = [];
  for (const item of seg?.items ?? []) {
    const template = templateById.get(item.templateId);
    for (const tag of template?.focus_tags ?? []) tags.push(tag);
  }
  return topCounts(tags);
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
        focus_tags_top: collectTagShape(plan, templateById, 'Main'),
        target_vectors_top: collectVectorShape(plan, templateById, 'Main'),
      },
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

async function run() {
  const fixturePath = join(root, 'scripts/fixtures/pr2a-first-session-anchor-fixtures.json');
  const personasPath = join(root, 'src/lib/deep-test/scenarios/personas.json');
  const fixtures = JSON.parse(readFileSync(fixturePath, 'utf-8'));
  const personas = JSON.parse(readFileSync(personasPath, 'utf-8'));
  const personaById = new Map(personas.map((p) => [p.id, p]));

  let buildSessionPlanJson;
  let getTemplatesForSessionPlan;
  let calculateDeepV3;

  try {
    ({ buildSessionPlanJson } = await import('../src/lib/session/plan-generator.ts'));
    ({ getTemplatesForSessionPlan } = await import('../src/lib/workout-routine/exercise-templates-db.ts'));
    ({ calculateDeepV3 } = await import('../src/lib/deep-test/scoring/deep_v3.ts'));
  } catch (e) {
    if (e?.message?.includes('SUPABASE') || e?.message?.includes('Missing')) {
      console.log('SKIP: Supabase env required for PR2-A comparison harness output.');
      return;
    }
    throw e;
  }

  const templates = await getTemplatesForSessionPlan({ scoringVersion: 'deep_v2' });
  const templateById = new Map(templates.map((t) => [t.id, t]));

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

    const plan = await buildSessionPlanJson({
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
      baseline_session_anchor: PRIMARY_TO_BASELINE_ANCHOR[deep.primary_type],
    });

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
  const outPath = join(outputDir, 'pr2a-first-session-anchor-comparison-baseline.json');
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        purpose: 'PR2-A baseline comparison harness snapshot (no tuning)',
        anchors: fixtures.map((f) => f.anchor_type),
        snapshots,
      },
      null,
      2
    ) + '\n'
  );

  console.log(`Generated baseline snapshot: ${outPath}`);
  console.log(`Anchors covered: ${fixtures.map((f) => f.anchor_type).join(', ')}`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
