/**
 * PR-ALIGN-01: Result-Session Alignment regression tests.
 * Run: npx tsx scripts/result-session-alignment-regression.mjs
 *
 * Verifies resultType drives first-session composition (not priority_vector alone).
 * UPPER-LIMB user must not receive core-only first session.
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { getResultTypeFocusTags, resolveFirstSessionAlignmentPolicy } = await import(
  '../src/lib/session/priority-layer.ts'
);

let passed = 0;
let failed = 0;

function ok(name, cond) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}`);
  }
}

console.log('\n--- 0. Unit: resolveFirstSessionAlignmentPolicy (no DB) ---');
const alignUpper = resolveFirstSessionAlignmentPolicy('UPPER-LIMB', 1, { trunk_control: 3 });
ok('UPPER-LIMB session 1: alignedGoldPathVector=upper_mobility', alignUpper?.alignedGoldPathVector === 'upper_mobility');
ok('UPPER-LIMB session 1: alignedFocusAxes includes upper_mobility', alignUpper?.alignedFocusAxes?.includes('upper_mobility'));
ok('UPPER-LIMB session 1: alignedRationale has upper direction', alignUpper?.alignedRationale && /상체|손목|팔꿈치/.test(alignUpper.alignedRationale));

const alignLower = resolveFirstSessionAlignmentPolicy('LOWER-LIMB', 1, { upper_mobility: 3 });
ok('LOWER-LIMB session 1: alignedGoldPathVector=lower_stability', alignLower?.alignedGoldPathVector === 'lower_stability');
ok('LOWER-LIMB session 1: alignedFocusAxes includes lower_stability', alignLower?.alignedFocusAxes?.includes('lower_stability'));

const alignSession2 = resolveFirstSessionAlignmentPolicy('UPPER-LIMB', 2, { trunk_control: 3 });
ok('session 2: no alignment (null)', alignSession2 === null);

let mod;
try {
  mod = await import('../src/lib/session/plan-generator.ts');
} catch (e) {
  if (e?.message?.includes('SUPABASE') || e?.message?.includes('Missing')) {
    console.log('\nSKIP: Supabase env required for full plan generation tests.');
    console.log(`\n--- Summary (unit only) ---`);
    console.log(`${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
  }
  throw e;
}

const { buildSessionPlanJson } = mod;

const baseInput = {
  sessionNumber: 1,
  totalSessions: 16,
  phase: 1,
  theme: 'Phase 1',
  timeBudget: 'normal',
  conditionMood: 'ok',
  focus: [],
  avoid: [],
  painFlags: [],
  usedTemplateIds: [],
  scoringVersion: 'deep_v2',
  safety_mode: 'none',
  pain_mode: 'none',
};

function hasUpperLimbRelevantItem(plan, templatesById) {
  const upperTags = new Set(getResultTypeFocusTags('UPPER-LIMB'));
  for (const seg of plan.segments ?? []) {
    for (const item of seg.items ?? []) {
      const t = templatesById.get(item.templateId);
      if (t?.focus_tags?.some((tag) => upperTags.has(tag))) return true;
    }
  }
  return false;
}

function hasLowerLimbRelevantItem(plan, templatesById) {
  const lowerTags = new Set(getResultTypeFocusTags('LOWER-LIMB'));
  for (const seg of plan.segments ?? []) {
    for (const item of seg.items ?? []) {
      const t = templatesById.get(item.templateId);
      if (t?.focus_tags?.some((tag) => lowerTags.has(tag))) return true;
    }
  }
  return false;
}

async function runTests() {
  const { getTemplatesForSessionPlan } = await import('../src/lib/workout-routine/exercise-templates-db.ts');
  const templates = await getTemplatesForSessionPlan({ scoringVersion: 'deep_v2' });
  const byId = new Map(templates.map((t) => [t.id, t]));

  console.log('\n--- A. UPPER-LIMB synthetic (trunk_control high in priority_vector) ---');
  const upperPlan = await buildSessionPlanJson({
    ...baseInput,
    resultType: 'UPPER-LIMB',
    priority_vector: { trunk_control: 3, upper_mobility: 1 },
  });
  const upperRationale = upperPlan.meta?.session_rationale ?? '';
  const upperFocusAxes = upperPlan.meta?.session_focus_axes ?? [];
  ok(
    'session_rationale not core-only (has upper direction)',
    /상체|어깨|손목|팔꿈치|흉추|견갑|가동성/.test(upperRationale)
  );
  ok(
    'session_focus_axes not trunk_control only',
    !(upperFocusAxes.length > 0 && upperFocusAxes.every((a) => a === 'trunk_control'))
  );
  ok('session_focus_axes includes upper_mobility', upperFocusAxes.includes('upper_mobility'));
  ok('generated plan has upper-limb relevant item', hasUpperLimbRelevantItem(upperPlan, byId));
  ok('not core-only first session', !upperRationale.match(/^몸통|^코어/) || /상체|어깨/.test(upperRationale));

  console.log('\n--- B. LOWER-LIMB synthetic ---');
  const lowerPlan = await buildSessionPlanJson({
    ...baseInput,
    resultType: 'LOWER-LIMB',
    priority_vector: { upper_mobility: 2, lower_stability: 1 },
  });
  const lowerRationale = lowerPlan.meta?.session_rationale ?? '';
  const lowerFocusAxes = lowerPlan.meta?.session_focus_axes ?? [];
  ok('session_rationale has lower-body direction', /엉덩이|골반|무릎|발목|하체/.test(lowerRationale));
  ok('session_focus_axes includes lower_stability', lowerFocusAxes.includes('lower_stability'));
  ok('generated plan has lower-limb relevant item', hasLowerLimbRelevantItem(lowerPlan, byId));

  console.log('\n--- C. NECK-SHOULDER synthetic ---');
  const neckPlan = await buildSessionPlanJson({
    ...baseInput,
    resultType: 'NECK-SHOULDER',
    priority_vector: { trunk_control: 2 },
  });
  const neckRationale = neckPlan.meta?.session_rationale ?? '';
  const neckFocusAxes = neckPlan.meta?.session_focus_axes ?? [];
  ok('session_rationale has neck/shoulder direction', /어깨|목|흉추|견갑/.test(neckRationale));
  ok('session_focus_axes includes upper_mobility', neckFocusAxes.includes('upper_mobility'));

  console.log('\n--- D. pain_mode protected/caution ---');
  const protectedPlan = await buildSessionPlanJson({
    ...baseInput,
    resultType: 'UPPER-LIMB',
    priority_vector: { trunk_control: 3 },
    safety_mode: 'red',
    pain_mode: 'protected',
  });
  ok('protected: session_focus_axes still upper-aligned', protectedPlan.meta?.session_focus_axes?.includes('upper_mobility'));
  ok('protected: session_rationale has upper direction', /상체|어깨|손목|팔꿈치|흉추|견갑|가동성/.test(protectedPlan.meta?.session_rationale ?? ''));

  const cautionPlan = await buildSessionPlanJson({
    ...baseInput,
    resultType: 'UPPER-LIMB',
    priority_vector: { trunk_control: 2 },
    safety_mode: 'yellow',
    pain_mode: 'caution',
  });
  ok('caution: session_focus_axes still upper-aligned', cautionPlan.meta?.session_focus_axes?.includes('upper_mobility'));

  console.log('\n--- E. session_number > 1 uses priority_vector ---');
  const session2Plan = await buildSessionPlanJson({
    ...baseInput,
    sessionNumber: 2,
    resultType: 'UPPER-LIMB',
    priority_vector: { trunk_control: 3 },
  });
  ok('session 2: focus_axes can be trunk (no forced alignment)', session2Plan.meta?.session_focus_axes?.includes('trunk_control'));

  console.log('\n--- F. LUMBO-PELVIS alignment ---');
  const lumboPlan = await buildSessionPlanJson({
    ...baseInput,
    resultType: 'LUMBO-PELVIS',
    priority_vector: { upper_mobility: 2 },
  });
  const lumboFocusAxes = lumboPlan.meta?.session_focus_axes ?? [];
  ok('LUMBO-PELVIS focus_axes includes trunk_control', lumboFocusAxes.includes('trunk_control'));
  ok('LUMBO-PELVIS rationale has trunk/core direction', /몸통|코어|호흡/.test(lumboPlan.meta?.session_rationale ?? ''));
}

runTests()
  .then(() => {
    console.log('\n--- Summary ---');
    console.log(`${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
  })
  .catch((e) => {
    console.error('  ✗ Test run threw', e);
    process.exit(1);
  });
