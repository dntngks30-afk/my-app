/**
 * PR-01: Adaptive Merge Safety Fix smoke test
 * Run: npx tsx scripts/adaptive-modifier-merge-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const {
  pickStricterDifficultyCap,
  mergeVolumeModifier,
  mergeAdaptiveOverlayWithModifier,
} = await import('../src/lib/session/adaptive-modifier-resolver.ts');

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

console.log('PR-01 Adaptive Merge Safety smoke test\n');

// A. forceRecovery precedence
const a = mergeAdaptiveOverlayWithModifier(
  { forceRecovery: false },
  { volume_modifier: 0, complexity_cap: 'none', recovery_bias: true }
);
ok('A. forceRecovery: base false + modifier true => result true', a?.forceRecovery === true);

// B. stricter cap wins
const b = mergeAdaptiveOverlayWithModifier(
  { maxDifficultyCap: 'low' },
  { volume_modifier: 0, complexity_cap: 'basic', recovery_bias: false }
);
ok('B. maxDifficultyCap: base low + modifier basic(medium) => result low', b?.maxDifficultyCap === 'low');

// C. modifier introduces cap when none exists
const c = mergeAdaptiveOverlayWithModifier(
  {},
  { volume_modifier: 0, complexity_cap: 'basic', recovery_bias: false }
);
ok('C. maxDifficultyCap: base absent + modifier basic => result medium', c?.maxDifficultyCap === 'medium');

// D. volume reduction precedence
const d = mergeVolumeModifier(-0.1, -0.2);
ok('D. volume: base -0.1 + modifier -0.2 => -0.2', d === -0.2);

// E. neutral modifier no-op
const baseE = { targetLevelDelta: -1, avoidTemplateIds: ['x'] };
const e = mergeAdaptiveOverlayWithModifier(baseE, {
  volume_modifier: 0,
  complexity_cap: 'none',
  recovery_bias: false,
});
ok('E. neutral modifier: overlay unchanged', e?.targetLevelDelta === -1 && e?.avoidTemplateIds?.[0] === 'x');

// F. unrelated overlay fields preserved
const baseF = { targetLevelDelta: -1, avoidTemplateIds: ['y'] };
const f = mergeAdaptiveOverlayWithModifier(baseF, {
  volume_modifier: 0,
  complexity_cap: 'basic',
  recovery_bias: false,
});
ok('F. targetLevelDelta preserved', f?.targetLevelDelta === -1);
ok('F. avoidTemplateIds preserved', f?.avoidTemplateIds?.[0] === 'y');

// pickStricterDifficultyCap
ok('pickStricter: low vs medium => low', pickStricterDifficultyCap('low', 'medium') === 'low');
ok('pickStricter: medium vs low => low', pickStricterDifficultyCap('medium', 'low') === 'low');
ok('pickStricter: undefined vs medium => medium', pickStricterDifficultyCap(undefined, 'medium') === 'medium');

// mergeVolumeModifier
ok('mergeVolume: undefined + -0.2 => -0.2', mergeVolumeModifier(undefined, -0.2) === -0.2);
ok('mergeVolume: undefined + 0 => undefined', mergeVolumeModifier(undefined, 0) === undefined);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
