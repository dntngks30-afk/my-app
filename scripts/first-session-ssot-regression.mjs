/**
 * PR-SSOT-01: First-session SSOT regression tests.
 * Run: npx tsx scripts/first-session-ssot-regression.mjs
 *
 * Unit-level checks always run.
 * Full plan generation checks run only when Supabase-backed template access is available.
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const {
  getResultTypeFocusTags,
  resolveFirstSessionIntent,
} = await import('../src/lib/session/priority-layer.ts');

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

console.log('\n--- A. SSOT resolver exists and anchors session 1 ---');
const upperIntent = resolveFirstSessionIntent({
  resultType: 'UPPER-LIMB',
  sessionNumber: 1,
  priorityVector: { trunk_control: 3, upper_mobility: 1 },
  painMode: 'none',
});
ok('session 1 SSOT exists', !!upperIntent);
ok('UPPER-LIMB goldPath is not trunk_control dominant', upperIntent?.goldPath === 'upper_mobility');
ok('UPPER-LIMB focusAxes are not trunk_control only', !!upperIntent && !upperIntent.focusAxes.every((axis) => axis === 'trunk_control'));
ok(
  'UPPER-LIMB rationale starts upper-limb/support direction',
  !!upperIntent?.rationale && /상체|어깨|손목|팔꿈치|흉추|견갑/.test(upperIntent.rationale)
);
ok('UPPER-LIMB requiredTags exist', (upperIntent?.requiredTags?.length ?? 0) > 0);

console.log('\n--- B. LOWER / NECK / LUMBO session 1 SSOT ---');
const lowerIntent = resolveFirstSessionIntent({
  resultType: 'LOWER-LIMB',
  sessionNumber: 1,
  priorityVector: { upper_mobility: 2, lower_stability: 1 },
});
ok('LOWER-LIMB goldPath lower_stability', lowerIntent?.goldPath === 'lower_stability');
ok('LOWER-LIMB rationale lower-body direction', !!lowerIntent?.rationale && /무릎|발목|엉덩이|골반|하체/.test(lowerIntent.rationale));

const neckIntent = resolveFirstSessionIntent({
  resultType: 'NECK-SHOULDER',
  sessionNumber: 1,
  priorityVector: { trunk_control: 2 },
});
ok('NECK-SHOULDER goldPath upper_mobility', neckIntent?.goldPath === 'upper_mobility');
ok('NECK-SHOULDER rationale neck/shoulder direction', !!neckIntent?.rationale && /목|어깨|흉추|견갑/.test(neckIntent.rationale));

const lumboIntent = resolveFirstSessionIntent({
  resultType: 'LUMBO-PELVIS',
  sessionNumber: 1,
  priorityVector: { upper_mobility: 2 },
});
ok('LUMBO-PELVIS goldPath trunk_control', lumboIntent?.goldPath === 'trunk_control');
ok('LUMBO-PELVIS rationale trunk/core direction', !!lumboIntent?.rationale && /몸통|코어|호흡|골반/.test(lumboIntent.rationale));

console.log('\n--- C. pain_mode keeps alignment but stays conservative ---');
const protectedIntent = resolveFirstSessionIntent({
  resultType: 'UPPER-LIMB',
  sessionNumber: 1,
  priorityVector: { trunk_control: 3 },
  painMode: 'protected',
  safetyMode: 'red',
});
ok('protected keeps upper goldPath', protectedIntent?.goldPath === 'upper_mobility');
ok('protected keeps upper requiredTags', (protectedIntent?.requiredTags ?? []).some((tag) => getResultTypeFocusTags('UPPER-LIMB').includes(tag)));

const cautionIntent = resolveFirstSessionIntent({
  resultType: 'UPPER-LIMB',
  sessionNumber: 1,
  priorityVector: { trunk_control: 2 },
  painMode: 'caution',
  safetyMode: 'yellow',
});
ok('caution keeps upper focusAxes', !!cautionIntent?.focusAxes?.includes('upper_mobility'));

console.log('\n--- D. session 2+ does not force SSOT ---');
const session2Intent = resolveFirstSessionIntent({
  resultType: 'UPPER-LIMB',
  sessionNumber: 2,
  priorityVector: { trunk_control: 3 },
});
ok('session 2 returns null', session2Intent === null);

let mod;
try {
  mod = await import('../src/lib/session/plan-generator.ts');
} catch (e) {
  if (e?.message?.includes('SUPABASE') || e?.message?.includes('Missing')) {
    console.log('\nSKIP: Supabase env required for full plan generation checks.');
    console.log('\n--- Summary (unit only) ---');
    console.log(`${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
  }
  throw e;
}

const { buildSessionPlanJson } = mod;
const { getTemplatesForSessionPlan } = await import('../src/lib/workout-routine/exercise-templates-db.ts');
const templates = await getTemplatesForSessionPlan({ scoringVersion: 'deep_v2' });
const templateById = new Map(templates.map((t) => [t.id, t]));

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

function hasRelevantItem(plan, resultType) {
  const requiredTags = new Set(getResultTypeFocusTags(resultType));
  const prepAndMain = (plan.segments ?? []).filter((segment) => segment.title === 'Prep' || segment.title === 'Main');
  return prepAndMain.some((segment) =>
    segment.items.some((item) => {
      const template = templateById.get(item.templateId);
      return template?.focus_tags?.some((tag) => requiredTags.has(tag));
    })
  );
}

console.log('\n--- E. Full plan generation (if templates available) ---');
const upperPlan = await buildSessionPlanJson({
  ...baseInput,
  resultType: 'UPPER-LIMB',
  priority_vector: { trunk_control: 3, upper_mobility: 1 },
});
ok(
  'UPPER-LIMB plan focusAxes not trunk_control only',
  !((upperPlan.meta?.session_focus_axes ?? []).every((axis) => axis === 'trunk_control'))
);
ok(
  'UPPER-LIMB plan rationale upper-limb/support direction',
  /상체|어깨|손목|팔꿈치|흉추|견갑/.test(upperPlan.meta?.session_rationale ?? '')
);
ok('UPPER-LIMB prep/main include relevant item', hasRelevantItem(upperPlan, 'UPPER-LIMB'));

const lowerPlan = await buildSessionPlanJson({
  ...baseInput,
  resultType: 'LOWER-LIMB',
  priority_vector: { upper_mobility: 2, lower_stability: 1 },
});
ok('LOWER-LIMB plan lower-body direction', /무릎|발목|엉덩이|골반|하체/.test(lowerPlan.meta?.session_rationale ?? ''));
ok('LOWER-LIMB prep/main include relevant item', hasRelevantItem(lowerPlan, 'LOWER-LIMB'));

const neckPlan = await buildSessionPlanJson({
  ...baseInput,
  resultType: 'NECK-SHOULDER',
  priority_vector: { trunk_control: 2 },
});
ok('NECK-SHOULDER plan neck/shoulder direction', /목|어깨|흉추|견갑/.test(neckPlan.meta?.session_rationale ?? ''));
ok('NECK-SHOULDER prep/main include relevant item', hasRelevantItem(neckPlan, 'NECK-SHOULDER'));

const lumboPlan = await buildSessionPlanJson({
  ...baseInput,
  resultType: 'LUMBO-PELVIS',
  priority_vector: { upper_mobility: 2 },
});
ok('LUMBO-PELVIS plan trunk direction', /몸통|코어|호흡|골반/.test(lumboPlan.meta?.session_rationale ?? ''));
ok('LUMBO-PELVIS prep/main include relevant item', hasRelevantItem(lumboPlan, 'LUMBO-PELVIS'));

const protectedPlan = await buildSessionPlanJson({
  ...baseInput,
  resultType: 'UPPER-LIMB',
  priority_vector: { trunk_control: 3 },
  safety_mode: 'red',
  pain_mode: 'protected',
});
ok('protected keeps upper alignment', !!protectedPlan.meta?.session_focus_axes?.includes('upper_mobility'));

const session2Plan = await buildSessionPlanJson({
  ...baseInput,
  sessionNumber: 2,
  resultType: 'UPPER-LIMB',
  priority_vector: { trunk_control: 3 },
});
ok('session 2 is not over-forced by session-1 SSOT', !!session2Plan.meta?.session_focus_axes?.includes('trunk_control'));

console.log('\n--- Summary ---');
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
