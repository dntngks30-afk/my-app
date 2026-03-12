/**
 * PR: adaptive-modifier-weighting-v1
 * Smoke test for resolveAdaptiveModifier (discomfort_burden_score recovery_bias path)
 * Run: npx tsx scripts/adaptive-modifier-resolver-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { resolveAdaptiveModifier } = await import('../src/lib/session/adaptive-modifier-resolver.ts');

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

console.log('Adaptive modifier resolver smoke test\n');

// 1) null → neutral
const neutral = resolveAdaptiveModifier(null);
ok('null returns neutral', neutral.volume_modifier === 0 && neutral.complexity_cap === 'none' && neutral.recovery_bias === false);

// 2) completion_ratio < 0.6 → volume_modifier -0.2
const lowCompletion = resolveAdaptiveModifier({ completion_ratio: 0.5, skipped_exercises: 0, dropout_risk_score: 0 });
ok('completion 0.5 → volume_modifier -0.2', lowCompletion.volume_modifier === -0.2);

// 3) completion_ratio 0.6-0.8 → volume_modifier -0.1
const modCompletion = resolveAdaptiveModifier({ completion_ratio: 0.7, skipped_exercises: 0, dropout_risk_score: 0 });
ok('completion 0.7 → volume_modifier -0.1', modCompletion.volume_modifier === -0.1);

// 4) skipped_exercises >= 2 → complexity_cap basic
const highSkip = resolveAdaptiveModifier({ completion_ratio: 0.9, skipped_exercises: 2, dropout_risk_score: 0 });
ok('skipped 2 → complexity_cap basic', highSkip.complexity_cap === 'basic');

// 5) dropout_risk >= 50 → recovery_bias
const highDropout = resolveAdaptiveModifier({ completion_ratio: 0.9, skipped_exercises: 0, dropout_risk_score: 60 });
ok('dropout_risk 60 → recovery_bias', highDropout.recovery_bias === true);

// 6) discomfort_burden >= 60 → recovery_bias (NEW: event-level discomfort alone triggers recovery)
const highDiscomfort = resolveAdaptiveModifier({
  completion_ratio: 0.9,
  skipped_exercises: 0,
  dropout_risk_score: 0,
  discomfort_burden_score: 70,
});
ok('discomfort_burden 70 → recovery_bias (without dropout)', highDiscomfort.recovery_bias === true);

// 7) discomfort_burden 40, dropout 0 → no recovery_bias
const mildDiscomfort = resolveAdaptiveModifier({
  completion_ratio: 0.9,
  skipped_exercises: 0,
  dropout_risk_score: 0,
  discomfort_burden_score: 40,
});
ok('discomfort_burden 40 → no recovery_bias', mildDiscomfort.recovery_bias === false);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
