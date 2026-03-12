/**
 * PR-04: Session generation cache key integrity smoke test.
 * Verifies canonical serialization: same semantic inputs => same key; different => different.
 * Run: npx tsx scripts/session-gen-cache-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { getCachedPlan, setCachedPlan } = await import('../src/lib/session-gen-cache.ts');

const base = {
  userId: 'u1',
  sessionNumber: 1,
  totalSessions: 16,
  phase: 1,
  theme: 'Phase 1 · trunk_control 안정화',
  timeBudget: 'normal',
  conditionMood: 'ok',
  focus: ['trunk_control', 'lower_stability'],
  avoid: ['a', 'b'],
  painFlags: [],
  usedTemplateIds: [],
};

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

console.log('PR-04 Session gen cache key integrity smoke test\n');

// CASE A: priority_vector same semantics, different key order => same cache key
setCachedPlan(
  { ...base, priority_vector: { lower_stability: 0.8, trunk_control: 0.6 } },
  { planA: true }
);
const hitA = getCachedPlan({
  ...base,
  priority_vector: { trunk_control: 0.6, lower_stability: 0.8 },
});
ok('A. priority_vector different key order => same key (cache hit)', hitA?.planA === true);

// CASE B: adaptiveOverlay same semantics, different key order => same cache key
setCachedPlan(
  {
    ...base,
    adaptiveOverlay: {
      targetLevelDelta: -1,
      avoidTemplateIds: ['t1', 't2'],
      forceRecovery: true,
    },
  },
  { planB: true }
);
const hitB = getCachedPlan({
  ...base,
  adaptiveOverlay: {
    avoidTemplateIds: ['t2', 't1'],
    forceRecovery: true,
    targetLevelDelta: -1,
  },
});
ok('B. adaptiveOverlay different key order => same key (cache hit)', hitB?.planB === true);

// CASE C: volumeModifier absent vs 0 vs -0.1 => different keys
setCachedPlan({ ...base, volumeModifier: undefined }, { planC1: true });
setCachedPlan({ ...base, volumeModifier: 0 }, { planC2: true });
setCachedPlan({ ...base, volumeModifier: -0.1 }, { planC3: true });
const c1 = getCachedPlan({ ...base, volumeModifier: undefined });
const c2 = getCachedPlan({ ...base, volumeModifier: 0 });
const c3 = getCachedPlan({ ...base, volumeModifier: -0.1 });
ok('C1. volumeModifier undefined => distinct key', c1?.planC1 === true && !c1?.planC2);
ok('C2. volumeModifier 0 => distinct key', c2?.planC2 === true && !c2?.planC1);
ok('C3. volumeModifier -0.1 => distinct key', c3?.planC3 === true);

// CASE D: avoidTemplateIds order differs, contents equal => same key
setCachedPlan(
  {
    ...base,
    adaptiveOverlay: { avoidTemplateIds: ['x', 'y'] },
  },
  { planD: true }
);
const hitD = getCachedPlan({
  ...base,
  adaptiveOverlay: { avoidTemplateIds: ['y', 'x'] },
});
ok('D. avoidTemplateIds same contents different order => same key', hitD?.planD === true);

// CASE E: pain_mode changed => different key
setCachedPlan({ ...base, pain_mode: 'none' }, { planE1: true });
setCachedPlan({ ...base, pain_mode: 'caution' }, { planE2: true });
const e1 = getCachedPlan({ ...base, pain_mode: 'none' });
const e2 = getCachedPlan({ ...base, pain_mode: 'caution' });
ok('E. pain_mode none vs caution => different keys', e1?.planE1 === true && e2?.planE2 === true);

// CASE F: priority_vector value changed => different key
setCachedPlan({ ...base, priority_vector: { lower_stability: 0.8 } }, { planF1: true });
setCachedPlan({ ...base, priority_vector: { lower_stability: 0.8, trunk_control: 0.6 } }, { planF2: true });
const f1 = getCachedPlan({ ...base, priority_vector: { lower_stability: 0.8 } });
const f2 = getCachedPlan({ ...base, priority_vector: { lower_stability: 0.8, trunk_control: 0.6 } });
ok('F. priority_vector different values => different keys', f1?.planF1 === true && f2?.planF2 === true);

// CASE G: set-like arrays (avoid, painFlags, usedTemplateIds) deduped + sorted
setCachedPlan(
  { ...base, avoid: ['a', 'b', 'a'], painFlags: ['p1', 'p2'], usedTemplateIds: ['u2', 'u1'] },
  { planG: true }
);
const hitG = getCachedPlan({
  ...base,
  avoid: ['b', 'a'],
  painFlags: ['p2', 'p1'],
  usedTemplateIds: ['u1', 'u2'],
});
ok('G. set-like arrays deduped+sorted => same key', hitG?.planG === true);

// CASE H: focus order preserved (different order => different key)
setCachedPlan({ ...base, focus: ['trunk_control', 'lower_stability'] }, { planH1: true });
const hitH1 = getCachedPlan({ ...base, focus: ['trunk_control', 'lower_stability'] });
const hitH2 = getCachedPlan({ ...base, focus: ['lower_stability', 'trunk_control'] });
ok('H. focus same order => same key', hitH1?.planH1 === true);
ok('H. focus different order => different key', hitH2?.planH1 !== true);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
