/**
 * PR-FIRST-SESSION-ANCHOR-REGRESSION-48-01: fixture-48 S1 Main anchor vs gold_path_vector.
 *
 * Run: npx tsx scripts/first-session-anchor-fixture48-regression.mjs
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
process.chdir(root);

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://harness.placeholder.supabase.co';
}
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'harness-placeholder-anon-key';
}

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

const PRIMARY_FOCUS_BY_TYPE = {
  LOWER_INSTABILITY: ['lower_chain_stability', 'glute_activation', 'glute_medius', 'basic_balance'],
  LOWER_MOBILITY_RESTRICTION: [
    'hip_mobility',
    'ankle_mobility',
    'hip_flexor_stretch',
    'lower_chain_stability',
  ],
  UPPER_IMMOBILITY: ['shoulder_mobility', 'thoracic_mobility', 'upper_back_activation', 'shoulder_stability'],
  CORE_CONTROL_DEFICIT: ['core_control', 'core_stability', 'global_core'],
  DECONDITIONED: ['full_body_reset', 'core_control', 'lower_chain_stability'],
  STABLE: ['core_stability', 'global_core', 'shoulder_mobility'],
};

const PRIORITY_BY_PRIMARY = {
  LOWER_INSTABILITY: { lower_stability: 3, lower_mobility: 1, trunk_control: 1 },
  LOWER_MOBILITY_RESTRICTION: { lower_mobility: 3, lower_stability: 1, trunk_control: 1 },
  UPPER_IMMOBILITY: { upper_mobility: 3, trunk_control: 1, lower_stability: 1 },
  CORE_CONTROL_DEFICIT: { trunk_control: 3, upper_mobility: 1, lower_stability: 1 },
  DECONDITIONED: { deconditioned: 3, trunk_control: 2, lower_stability: 1 },
  STABLE: { trunk_control: 2, upper_mobility: 2, lower_stability: 1 },
};

const BASELINE_LABELS = {
  LOWER_INSTABILITY: 'Lower instability',
  LOWER_MOBILITY_RESTRICTION: 'Lower mobility restriction',
  UPPER_IMMOBILITY: 'Upper immobility',
  CORE_CONTROL_DEFICIT: 'Core control deficit',
  DECONDITIONED: 'Deconditioned',
  STABLE: 'Stable',
};

const PRIMARY_ORDER = [
  'LOWER_INSTABILITY',
  'LOWER_MOBILITY_RESTRICTION',
  'UPPER_IMMOBILITY',
  'CORE_CONTROL_DEFICIT',
  'DECONDITIONED',
  'STABLE',
];

function buildBaselineFixture(primary_type) {
  return {
    label: BASELINE_LABELS[primary_type] ?? primary_type,
    baseline_session_anchor: PRIMARY_TO_BASELINE_ANCHOR[primary_type],
    resultType: PRIMARY_TO_RESULT_TYPE[primary_type],
    primary_type,
    secondary_type: 'HARNESS_DEFAULT_SECONDARY',
    priority_vector: { ...PRIORITY_BY_PRIMARY[primary_type] },
    pain_mode: 'none',
    safety_mode: 'none',
    deep_level: 2,
    red_flags: false,
    focus: [...PRIMARY_FOCUS_BY_TYPE[primary_type]],
    avoid: [],
    scoringVersion: 'deep_v2',
    confidence: 0.82,
  };
}

function loadFixture48Templates() {
  const fixturePath = join(__dirname, 'fixtures', 'exercise-templates-session-plan-m01-m48.v1.json');
  const raw = readFileSync(fixturePath, 'utf8');
  const data = JSON.parse(raw);
  const arr = data.templates ?? data;
  const templates = arr.map((row) => ({
    id: row.id,
    name: row.name,
    level: row.level ?? 1,
    focus_tags: [...(row.focus_tags ?? [])],
    contraindications: [...(row.contraindications ?? [])],
    duration_sec: row.duration_sec ?? 300,
    media_ref: row.media_ref ?? null,
    is_fallback: !!row.is_fallback,
    phase: row.phase ?? null,
    target_vector: row.target_vector?.length ? [...row.target_vector] : null,
    difficulty: row.difficulty ?? null,
    avoid_if_pain_mode:
      row.avoid_if_pain_mode == null
        ? null
        : Array.isArray(row.avoid_if_pain_mode)
          ? [...row.avoid_if_pain_mode]
          : null,
    progression_level: row.progression_level ?? null,
    balance_demand: row.balance_demand ?? null,
    complexity: row.complexity ?? null,
  }));
  return {
    templates,
    source: 'fixture_m01_m48_session_plan_v1',
    template_count: templates.length,
  };
}

function getMainItems(plan) {
  const m = (plan.segments ?? []).find((s) => s.title === 'Main');
  return m?.items ?? [];
}

function hasVec(t, v) {
  return (t?.target_vector ?? []).includes(v);
}

function printFail(primary, plan, byId) {
  const main = getMainItems(plan);
  const rows = main.map((it) => {
    const t = byId.get(it.templateId);
    return {
      id: it.templateId,
      name: t?.name,
      target_vector: t?.target_vector ?? [],
    };
  });
  console.error('FAIL', primary, 'Main:', JSON.stringify(rows, null, 0));
  if (plan.meta?.first_session_anchor_integrity) {
    console.error('integrity:', JSON.stringify(plan.meta.first_session_anchor_integrity, null, 2));
  }
}

function assertLowerInstabilityS1(plan, byId) {
  const m = getMainItems(plan);
  const g = plan.meta?.baseline_alignment?.gold_path_vector;
  if (g !== 'lower_stability') {
    return `expected gold_path_vector lower_stability, got ${g}`;
  }
  if (!m.some((it) => hasVec(byId.get(it.templateId), 'lower_stability'))) {
    return 'expected at least one Main item with target_vector lower_stability';
  }
  const allUpperDom =
    m.length >= 2 &&
    m.every((it) => {
      const t = byId.get(it.templateId);
      if (!t) return true;
      return hasVec(t, 'upper_mobility') && !hasVec(t, 'lower_stability') && !hasVec(t, 'trunk_control') && !hasVec(t, 'lower_mobility');
    });
  if (allUpperDom) {
    return 'Main is upper_mobility-dominant (forbidden for lower_stability S1)';
  }
  return null;
}

function assertLowerMobilityS1(plan, byId) {
  const m = getMainItems(plan);
  if (plan.meta?.baseline_alignment?.gold_path_vector !== 'lower_mobility') {
    return 'gold_path_vector not lower_mobility';
  }
  if (!m.some((it) => hasVec(byId.get(it.templateId), 'lower_mobility'))) {
    const anyPlan = (plan.segments ?? []).some((s) =>
      s.items?.some((it) => {
        const t = byId.get(it.templateId);
        return t && (hasVec(t, 'lower_mobility') || hasVec(t, 'lower_stability') || hasVec(t, 'trunk_control'));
      })
    );
    if (!anyPlan) return 'no lower_mobility visibility in plan';
  }
  if (
    m.length >= 2 &&
    m.every((it) => {
      const t = byId.get(it.templateId);
      return t && hasVec(t, 'upper_mobility') && !hasVec(t, 'lower_mobility');
    })
  ) {
    return 'Main upper_mobility-dominant for lower_mobility S1';
  }
  return null;
}

function assertUpperImmobilityS1(plan, byId) {
  const m = getMainItems(plan);
  if (plan.meta?.baseline_alignment?.gold_path_vector !== 'upper_mobility') {
    return 'gold_path_vector not upper_mobility';
  }
  if (!m.some((it) => hasVec(byId.get(it.templateId), 'upper_mobility'))) {
    return 'expected upper_mobility in Main';
  }
  if (
    m.length >= 2 &&
    m.every((it) => {
      const t = byId.get(it.templateId);
      return t && hasVec(t, 'lower_stability') && !hasVec(t, 'upper_mobility');
    })
  ) {
    return 'Main lower_stability-dominant (regression for upper S1)';
  }
  return null;
}

function assertCoreS1(plan, byId) {
  if (plan.meta?.baseline_alignment?.gold_path_vector !== 'trunk_control') {
    return 'gold not trunk_control';
  }
  if (!getMainItems(plan).some((it) => hasVec(byId.get(it.templateId), 'trunk_control'))) {
    return 'Main needs trunk_control';
  }
  return null;
}

function assertDecondS1(plan, byId) {
  if (plan.meta?.baseline_alignment?.gold_path_vector !== 'deconditioned') {
    return 'gold not deconditioned';
  }
  const m = getMainItems(plan);
  if (m.length < 2) return null;
  const bad = m.filter(
    (it) => {
      const t = byId.get(it.templateId);
      if (!t) return false;
      const singleLeg = (t.focus_tags ?? []).some((x) =>
        ['basic_balance', 'glute_medius', 'lower_chain_stability'].includes(x)
      );
      return singleLeg && (t.difficulty === 'high' || (t.progression_level ?? 1) >= 3);
    }
  );
  if (bad.length >= 2) {
    return 'high-risk unilateral lower dominant in Main';
  }
  return null;
}

function assertStableS1(plan, byId) {
  if (plan.meta?.baseline_alignment?.gold_path_vector !== 'balanced_reset') {
    return 'gold not balanced_reset';
  }
  const m = getMainItems(plan);
  if (m.length < 2) return null;
  const oneAxis = m.every((it) => {
    const t = byId.get(it.templateId);
    if (!t) return false;
    const v = t.target_vector ?? [];
    if (v.length === 1 && (v[0] === 'upper_mobility' || v[0] === 'lower_mobility')) return true;
    return false;
  });
  if (m.length === 2 && oneAxis) {
    return 'high-risk single-axis dominant';
  }
  return null;
}

async function main() {
  const { templates, source, template_count: tc } = loadFixture48Templates();
  if (source !== 'fixture_m01_m48_session_plan_v1' || tc !== 48) {
    console.error('Expected fixture-48, got', source, 'count', tc);
    process.exit(1);
  }
  const byId = new Map(templates.map((t) => [t.id, t]));

  const [{ buildSessionPlanJson }, { computePhase, resolvePhaseLengths }, { buildTheme }] = await Promise.all([
    import('../src/lib/session/plan-generator.ts'),
    import('../src/lib/session/phase.ts'),
    import('../src/app/api/session/create/_lib/helpers.ts'),
  ]);

  const totalSessions = 8;
  const sessionNumber = 1;
  const failures = [];

  for (const primary of PRIMARY_ORDER) {
    const fixture = buildBaselineFixture(primary);
    const policyOptions = {
      deepLevel: fixture.deep_level ?? null,
      safetyMode: fixture.safety_mode ?? null,
      redFlags: fixture.red_flags ?? null,
    };
    const phaseLengthsArr = resolvePhaseLengths(totalSessions, policyOptions);
    const phase = computePhase(totalSessions, sessionNumber, {
      phaseLengths: phaseLengthsArr,
      policyOptions,
    });
    const theme = buildTheme(
      sessionNumber,
      totalSessions,
      { result_type: fixture.resultType, focus: fixture.focus },
      { phaseLengths: phaseLengthsArr, policyOptions }
    );
    const plan = await buildSessionPlanJson({
      templatePool: templates,
      sessionNumber,
      totalSessions,
      phase,
      theme,
      timeBudget: 'normal',
      conditionMood: 'ok',
      focus: fixture.focus,
      avoid: fixture.avoid,
      painFlags: [],
      usedTemplateIds: [],
      resultType: fixture.resultType,
      confidence: fixture.confidence,
      scoringVersion: fixture.scoringVersion,
      deep_level: fixture.deep_level,
      red_flags: fixture.red_flags,
      safety_mode: fixture.safety_mode,
      primary_type: fixture.primary_type,
      secondary_type: fixture.secondary_type,
      priority_vector: fixture.priority_vector,
      pain_mode: fixture.pain_mode,
      baseline_session_anchor: fixture.baseline_session_anchor,
    });

    let err = null;
    if (primary === 'LOWER_INSTABILITY') err = assertLowerInstabilityS1(plan, byId);
    else if (primary === 'LOWER_MOBILITY_RESTRICTION') err = assertLowerMobilityS1(plan, byId);
    else if (primary === 'UPPER_IMMOBILITY') err = assertUpperImmobilityS1(plan, byId);
    else if (primary === 'CORE_CONTROL_DEFICIT') err = assertCoreS1(plan, byId);
    else if (primary === 'DECONDITIONED') err = assertDecondS1(plan, byId);
    else if (primary === 'STABLE') err = assertStableS1(plan, byId);

    if (err) {
      printFail(primary, plan, byId);
      failures.push({ primary, err });
    } else {
      const main = getMainItems(plan);
      const ids = main.map((i) => i.templateId);
      const integ = plan.meta?.first_session_anchor_integrity;
      console.log('PASS', primary, 'Main', ids, integ ? `repaired=${integ.repaired} anchor=${integ.main_anchor_match_count}` : '');
    }
  }

  if (failures.length) {
    for (const f of failures) {
      console.error('—', f.primary, ':', f.err);
    }
    process.exit(1);
  }
  console.log('ok fixture-48 S1 anchor regression (6 primaries).');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
