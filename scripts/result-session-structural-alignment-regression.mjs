/**
 * PR-ALIGN-03: Result-Session Structural Alignment regression tests.
 * Run: npx tsx scripts/result-session-structural-alignment-regression.mjs
 *
 * Verifies gold path, session_focus_axes, session_rationale, and generated segments
 * all point in the same direction for session 1.
 * UPPER-LIMB user must not receive core-dominant first session.
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
ok('UPPER-LIMB session 1: gold path != trunk_control dominant', alignUpper?.alignedGoldPathVector !== 'trunk_control');
ok('UPPER-LIMB session 1: alignedFocusAxes includes upper_mobility', alignUpper?.alignedFocusAxes?.includes('upper_mobility'));
ok('UPPER-LIMB session 1: alignedRationale has upper direction', alignUpper?.alignedRationale && /상체|손목|팔꿈치/.test(alignUpper.alignedRationale));

const alignLower = resolveFirstSessionAlignmentPolicy('LOWER-LIMB', 1, { upper_mobility: 3 });
ok('LOWER-LIMB session 1: alignedGoldPathVector=lower_stability', alignLower?.alignedGoldPathVector === 'lower_stability');
ok('LOWER-LIMB session 1: alignedFocusAxes includes lower_stability', alignLower?.alignedFocusAxes?.includes('lower_stability'));

const alignNeck = resolveFirstSessionAlignmentPolicy('NECK-SHOULDER', 1, { trunk_control: 3 });
ok('NECK-SHOULDER session 1: alignedGoldPathVector=upper_mobility', alignNeck?.alignedGoldPathVector === 'upper_mobility');

const alignLumbo = resolveFirstSessionAlignmentPolicy('LUMBO-PELVIS', 1, { upper_mobility: 3 });
ok('LUMBO-PELVIS session 1: alignedGoldPathVector=trunk_control', alignLumbo?.alignedGoldPathVector === 'trunk_control');

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

let templatesById;

function hasRelevantItem(plan, resultType) {
  const tags = new Set(getResultTypeFocusTags(resultType));
  const byId = templatesById ?? new Map();
  for (const seg of plan.segments ?? []) {
    for (const item of seg.items ?? []) {
      const t = byId.get(item.templateId);
      if (t?.focus_tags?.some((tag) => tags.has(tag))) return true;
    }
  }
  return false;
}

async function runTests() {
  const { getTemplatesForSessionPlan } = await import('../src/lib/workout-routine/exercise-templates-db.ts');
  const templates = await getTemplatesForSessionPlan({ scoringVersion: 'deep_v2' });
  templatesById = new Map(templates.map((t) => [t.id, t]));

  console.log('\n--- A. UPPER-LIMB synthetic (gold path, focus, rationale, segments) ---');
  const upperPlan = await buildSessionPlanJson({
    ...baseInput,
    resultType: 'UPPER-LIMB',
    priority_vector: { trunk_control: 3, upper_mobility: 1 },
  });
  const upperRationale = upperPlan.meta?.session_rationale ?? '';
  const upperFocusAxes = upperPlan.meta?.session_focus_axes ?? [];
  ok('gold path != trunk_control (inferred from focus_axes)', !upperFocusAxes.every((a) => a === 'trunk_control'));
  ok('session_focus_axes != trunk_control only', !(upperFocusAxes.length > 0 && upperFocusAxes.every((a) => a === 'trunk_control')));
  ok('session_focus_axes includes upper_mobility', upperFocusAxes.includes('upper_mobility'));
  ok('session_rationale first direction = upper-limb/support', /상체|어깨|손목|팔꿈치|흉추|견갑|가동성/.test(upperRationale));
  ok('generated segments contain upper-limb relevant item', hasRelevantItem(upperPlan, 'UPPER-LIMB'));
  ok('not core-only first session', !upperRationale.match(/^몸통|^코어/) || /상체|어깨/.test(upperRationale));

  console.log('\n--- B. LOWER-LIMB synthetic ---');
  const lowerPlan = await buildSessionPlanJson({
    ...baseInput,
    resultType: 'LOWER-LIMB',
    priority_vector: { upper_mobility: 2, lower_stability: 1 },
  });
  const lowerRationale = lowerPlan.meta?.session_rationale ?? '';
  const lowerFocusAxes = lowerPlan.meta?.session_focus_axes ?? [];
  ok('LOWER-LIMB: focus/rationale/segments lower-body direction', /엉덩이|골반|무릎|발목|하체/.test(lowerRationale));
  ok('LOWER-LIMB: focus_axes includes lower_stability', lowerFocusAxes.includes('lower_stability'));
  ok('LOWER-LIMB: segments contain lower-limb relevant item', hasRelevantItem(lowerPlan, 'LOWER-LIMB'));

  console.log('\n--- C. NECK-SHOULDER synthetic ---');
  const neckPlan = await buildSessionPlanJson({
    ...baseInput,
    resultType: 'NECK-SHOULDER',
    priority_vector: { trunk_control: 2 },
  });
  const neckRationale = neckPlan.meta?.session_rationale ?? '';
  const neckFocusAxes = neckPlan.meta?.session_focus_axes ?? [];
  ok('NECK-SHOULDER: rationale has neck/shoulder direction', /어깨|목|흉추|견갑/.test(neckRationale));
  ok('NECK-SHOULDER: focus_axes includes upper_mobility', neckFocusAxes.includes('upper_mobility'));
  ok('NECK-SHOULDER: segments contain neck/shoulder relevant item', hasRelevantItem(neckPlan, 'NECK-SHOULDER'));

  console.log('\n--- D. LUMBO-PELVIS synthetic ---');
  const lumboPlan = await buildSessionPlanJson({
    ...baseInput,
    resultType: 'LUMBO-PELVIS',
    priority_vector: { upper_mobility: 2 },
  });
  const lumboFocusAxes = lumboPlan.meta?.session_focus_axes ?? [];
  const lumboRationale = lumboPlan.meta?.session_rationale ?? '';
  ok('LUMBO-PELVIS: focus_axes includes trunk_control', lumboFocusAxes.includes('trunk_control'));
  ok('LUMBO-PELVIS: rationale has trunk/core direction', /몸통|코어|호흡/.test(lumboRationale));
  ok('LUMBO-PELVIS: segments contain lumbo-pelvis relevant item', hasRelevantItem(lumboPlan, 'LUMBO-PELVIS'));

  console.log('\n--- E. pain_mode caution/protected ---');
  const protectedPlan = await buildSessionPlanJson({
    ...baseInput,
    resultType: 'UPPER-LIMB',
    priority_vector: { trunk_control: 3 },
    safety_mode: 'red',
    pain_mode: 'protected',
  });
  ok('protected: alignment maintained (focus_axes upper)', protectedPlan.meta?.session_focus_axes?.includes('upper_mobility'));
  ok('protected: rationale has upper direction', /상체|어깨|손목|팔꿈치|흉추|견갑|가동성/.test(protectedPlan.meta?.session_rationale ?? ''));

  const cautionPlan = await buildSessionPlanJson({
    ...baseInput,
    resultType: 'UPPER-LIMB',
    priority_vector: { trunk_control: 2 },
    safety_mode: 'yellow',
    pain_mode: 'caution',
  });
  ok('caution: alignment maintained', cautionPlan.meta?.session_focus_axes?.includes('upper_mobility'));
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
