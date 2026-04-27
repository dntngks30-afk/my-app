/**
 * PR-SESSION-2PLUS-CONTINUITY-GUARD-01: fixture-48 S2/S3 type continuity (rolling freq2 model).
 *
 * Run: npx tsx scripts/session-2plus-continuity-fixture48-regression.mjs
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

const FREQUENCY_TO_TOTAL = { 2: 8, 3: 12, 4: 16, 5: 20 };
const USED_WINDOW_K = 4;

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

function planHasVector(plan, byId, vec) {
  for (const s of plan.segments ?? []) {
    for (const it of s.items ?? []) {
      if (hasVec(byId.get(it.templateId), vec)) return true;
    }
  }
  return false;
}

function isUpperOnlyDominantMain(mainItems, byId) {
  if (mainItems.length < 2) return false;
  return mainItems.every((it) => {
    const t = byId.get(it.templateId);
    if (!t) return true;
    return hasVec(t, 'upper_mobility') && !hasVec(t, 'lower_stability') && !hasVec(t, 'trunk_control') && !hasVec(t, 'lower_mobility');
  });
}

function isMainUpperDomLowerMob(mainItems, byId) {
  if (mainItems.length < 2) return false;
  return mainItems.every((it) => {
    const t = byId.get(it.templateId);
    return t && hasVec(t, 'upper_mobility') && !hasVec(t, 'lower_mobility');
  });
}

function isMainLowerStabDomUpper(mainItems, byId) {
  if (mainItems.length < 2) return false;
  return mainItems.every((it) => {
    const t = byId.get(it.templateId);
    return t && hasVec(t, 'lower_stability') && !hasVec(t, 'upper_mobility');
  });
}

function mainHasLowerStabilityFamily(mainItems, byId) {
  return mainItems.some((it) => {
    const t = byId.get(it.templateId);
    if (!t) return false;
    const v = new Set(t.target_vector ?? []);
    if (v.has('lower_stability')) return true;
    if (v.has('lower_mobility') || v.has('trunk_control')) return true;
    return false;
  });
}

function hasSingleLegLoad(t) {
  return (t.focus_tags ?? []).some((x) => ['basic_balance', 'glute_medius', 'lower_chain_stability'].includes(x));
}

function computeUsedTemplateIdsForNextSession(sessionRecords, nextSessionNumber) {
  if (nextSessionNumber <= 1) return [];
  const K = Math.max(1, Math.min(8, USED_WINDOW_K));
  const low = Math.max(1, nextSessionNumber - K);
  const high = nextSessionNumber - 1;
  const set = new Set();
  for (const rec of sessionRecords) {
    if (rec.session_number >= low && rec.session_number <= high) {
      for (const id of rec.used_template_ids ?? []) {
        set.add(id);
      }
    }
  }
  return Array.from(set);
}

function printFail(primary, sn, plan, byId) {
  const main = getMainItems(plan);
  const rows = main.map((it) => {
    const t = byId.get(it.templateId);
    return {
      id: it.templateId,
      name: t?.name,
      target_vector: t?.target_vector ?? [],
    };
  });
  console.error('FAIL', primary, 'session', sn, 'Main:', JSON.stringify(rows, null, 0));
  const m = plan.meta?.session_type_continuity;
  if (m) console.error('session_type_continuity:', JSON.stringify(m, null, 2));
}

function assertCoreS2S3(sn, plan, byId) {
  const main = getMainItems(plan);
  if (!main.some((it) => hasVec(byId.get(it.templateId), 'trunk_control'))) {
    return `S${sn} Main needs direct trunk_control`;
  }
  return null;
}

function assertLowerInstS2S3(plan, byId) {
  const main = getMainItems(plan);
  if (isUpperOnlyDominantMain(main, byId)) {
    return 'Main is upper_mobility-dominant (forbidden for lower_stability S2/S3)';
  }
  if (!mainHasLowerStabilityFamily(main, byId)) {
    return 'Main lacks lower_stability family (anchor/support)';
  }
  return null;
}

function assertLowerMobS2S3(plan, byId) {
  if (!planHasVector(plan, byId, 'lower_mobility')) {
    return 'full plan lacks lower_mobility';
  }
  if (isMainUpperDomLowerMob(getMainItems(plan), byId)) {
    return 'Main upper_mobility-dominant (lower_mobility type)';
  }
  return null;
}

function assertUpperS2S3(plan, byId) {
  if (!planHasVector(plan, byId, 'upper_mobility')) {
    return 'full plan lacks upper_mobility';
  }
  if (isMainLowerStabDomUpper(getMainItems(plan), byId)) {
    return 'Main lower_stability-dominant (upper type)';
  }
  return null;
}

function assertDecondS2S3(plan, byId) {
  const m = getMainItems(plan);
  if (m.length < 2) return null;
  const bad = m.filter((it) => {
    const t = byId.get(it.templateId);
    if (!t) return false;
    return hasSingleLegLoad(t) && (t.difficulty === 'high' || (t.progression_level ?? 1) >= 3);
  });
  if (bad.length >= 2) {
    return 'high-risk unilateral lower-dominant early Main (>=2)';
  }
  return null;
}

function assertStableS2S3(plan, byId) {
  const m = getMainItems(plan);
  if (m.length < 2) return null;
  const oneAxis = m.every((it) => {
    const t = byId.get(it.templateId);
    if (!t) return false;
    const v = t.target_vector ?? [];
    return v.length === 1 && (v[0] === 'upper_mobility' || v[0] === 'lower_mobility');
  });
  if (m.length === 2 && oneAxis) {
    return 'single-axis-dominant Main (stable S2/S3 guard)';
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

  const targetFrequency = 2;
  const totalSessions = FREQUENCY_TO_TOTAL[targetFrequency];
  const failures = [];

  for (const primary of PRIMARY_ORDER) {
    const baseFixture = buildBaselineFixture(primary);
    const policyOptions = {
      deepLevel: baseFixture.deep_level ?? null,
      safetyMode: baseFixture.safety_mode ?? null,
      redFlags: baseFixture.red_flags ?? null,
    };
    const phaseLengthsArr = resolvePhaseLengths(totalSessions, policyOptions);
    const recordsForWindow = [];

    for (let sessionNumber = 1; sessionNumber <= totalSessions; sessionNumber += 1) {
      const phase = computePhase(totalSessions, sessionNumber, {
        phaseLengths: phaseLengthsArr,
        policyOptions,
      });
      const theme = buildTheme(
        sessionNumber,
        totalSessions,
        { result_type: baseFixture.resultType, focus: baseFixture.focus },
        { phaseLengths: phaseLengthsArr, policyOptions }
      );
      const usedTemplateIds = computeUsedTemplateIdsForNextSession(recordsForWindow, sessionNumber);

      const plan = await buildSessionPlanJson({
        templatePool: templates,
        sessionNumber,
        totalSessions,
        phase,
        theme,
        timeBudget: 'normal',
        conditionMood: 'ok',
        focus: baseFixture.focus,
        avoid: baseFixture.avoid,
        painFlags: [],
        usedTemplateIds,
        resultType: baseFixture.resultType,
        confidence: baseFixture.confidence,
        scoringVersion: baseFixture.scoringVersion,
        deep_level: baseFixture.deep_level,
        red_flags: baseFixture.red_flags,
        safety_mode: baseFixture.safety_mode,
        primary_type: baseFixture.primary_type,
        secondary_type: baseFixture.secondary_type,
        priority_vector: baseFixture.priority_vector,
        pain_mode: baseFixture.pain_mode,
        baseline_session_anchor: baseFixture.baseline_session_anchor,
      });
      const usedIds = plan.meta?.used_template_ids ?? [];
      recordsForWindow.push({ session_number: sessionNumber, used_template_ids: usedIds });

      if (sessionNumber !== 2 && sessionNumber !== 3) continue;

      let err = null;
      if (primary === 'LOWER_INSTABILITY') err = assertLowerInstS2S3(plan, byId);
      else if (primary === 'LOWER_MOBILITY_RESTRICTION') err = assertLowerMobS2S3(plan, byId);
      else if (primary === 'UPPER_IMMOBILITY') err = assertUpperS2S3(plan, byId);
      else if (primary === 'CORE_CONTROL_DEFICIT') err = assertCoreS2S3(sessionNumber, plan, byId);
      else if (primary === 'DECONDITIONED') err = assertDecondS2S3(plan, byId);
      else if (primary === 'STABLE') err = assertStableS2S3(plan, byId);

      if (err) {
        printFail(primary, sessionNumber, plan, byId);
        failures.push({ primary, sessionNumber, err });
      } else {
        const main = getMainItems(plan);
        const ids = main.map((i) => i.templateId);
        const cont = plan.meta?.session_type_continuity;
        console.log(
          'PASS',
          primary,
          `S${sessionNumber}`,
          'Main',
          ids,
          cont ? `repaired=${cont.repaired} off_axis=${cont.main_off_axis_count}` : ''
        );
      }
    }
  }

  if (failures.length) {
    for (const f of failures) {
      console.error('—', f.primary, f.sessionNumber, ':', f.err);
    }
    process.exit(1);
  }
  console.log('ok fixture-48 S2/S3 type continuity (6 primaries × S2+S3).');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
