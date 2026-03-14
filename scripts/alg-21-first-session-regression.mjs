/**
 * PR-ALG-21: First Session Intensity Recalibration regression tests.
 * Run: npx tsx scripts/alg-21-first-session-regression.mjs
 *
 * Tests tier logic, resultType alignment, volume limits.
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { getResultTypeFocusTags } = await import('../src/lib/session/priority-layer.ts');
const {
  VOLUME_LIMITS_CONSERVATIVE,
  VOLUME_LIMITS_MODERATE,
  VOLUME_LIMITS_NORMAL,
} = await import('../src/core/session-guardrail/guardrailRules.ts');
const { exceedsVolumeLimits, clampVolume } = await import('../src/core/session-guardrail/volumeClamp.ts');

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

console.log('\n--- A. resultType focus tags ---');
ok('UPPER-LIMB has shoulder tags', getResultTypeFocusTags('UPPER-LIMB').some((t) => t.includes('shoulder')));
ok('NECK-SHOULDER has neck/thoracic', getResultTypeFocusTags('NECK-SHOULDER').some((t) => t.includes('neck') || t.includes('thoracic')));
ok('LOWER-LIMB has lower/glute', getResultTypeFocusTags('LOWER-LIMB').some((t) => t.includes('lower') || t.includes('glute')));
ok('unknown returns empty', getResultTypeFocusTags('UNKNOWN').length === 0);
ok('null returns empty', getResultTypeFocusTags(null).length === 0);

console.log('\n--- B. Volume limits tiered ---');
ok('conservative max_main=1', VOLUME_LIMITS_CONSERVATIVE.max_main_exercises === 1);
ok('moderate max_main=2', VOLUME_LIMITS_MODERATE.max_main_exercises === 2);
ok('normal max_main=2', VOLUME_LIMITS_NORMAL.max_main_exercises === 2);
ok('normal max_exercises=6', VOLUME_LIMITS_NORMAL.max_exercises === 6);

console.log('\n--- C. Volume clamp tier ---');
const segsWith2Main = [
  { title: 'Prep', duration_sec: 120, items: [{ templateId: 'a', sets: 2, reps: 12 }] },
  { title: 'Main', duration_sec: 300, items: [{ templateId: 'b', sets: 2, reps: 12 }, { templateId: 'c', sets: 2, reps: 12 }] },
  { title: 'Accessory', duration_sec: 120, items: [{ templateId: 'd', sets: 2, reps: 12 }] },
  { title: 'Cooldown', duration_sec: 60, items: [{ templateId: 'e', sets: 1, hold_seconds: 30 }] },
];
ok('2 main exceeds conservative', exceedsVolumeLimits(segsWith2Main, 'conservative'));
ok('2 main within normal', !exceedsVolumeLimits(segsWith2Main, 'normal'));

const clamped = clampVolume(segsWith2Main, 'conservative');
const mainCount = clamped.find((s) => s.title === 'Main')?.items.length ?? 0;
ok('clamp conservative reduces main to 1', mainCount === 1);

console.log('\n--- D. Same input deterministic (requires Supabase) ---');
try {
  const mod = await import('../src/lib/session/plan-generator.ts');
  const base = {
    sessionNumber: 1,
    totalSessions: 16,
    phase: 1,
    theme: 'Phase 1',
    timeBudget: 'normal',
    conditionMood: 'ok',
    focus: ['glute_medius'],
    avoid: [],
    painFlags: [],
    usedTemplateIds: [],
    safety_mode: 'none',
    pain_mode: 'none',
    resultType: 'LOWER-LIMB',
  };
  const p1 = await mod.buildSessionPlanJson(base);
  const p2 = await mod.buildSessionPlanJson(base);
  const ids1 = p1.segments.flatMap((s) => s.items.map((i) => i.templateId)).sort();
  const ids2 = p2.segments.flatMap((s) => s.items.map((i) => i.templateId)).sort();
  ok('same input deterministic', JSON.stringify(ids1) === JSON.stringify(ids2));
} catch (e) {
  if (e?.message?.includes('SUPABASE') || e?.message?.includes('Missing') || e?.code === 'PGRST301') {
    console.log('  (SKIP: Supabase env required for full plan test)');
  } else {
    throw e;
  }
}

console.log('\n--- Summary ---');
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
