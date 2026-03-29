/**
 * PR-CAM-ARMING-BASELINE-HANDOFF-01: arming standing baseline → completion-state seed
 * Run: npx tsx scripts/camera-pr-arming-baseline-handoff-01-smoke.mjs
 *
 * Regression: camera-peak-anchor-integrity-01-smoke, camera-cam31-squat-guarded-trajectory-reversal-smoke, camera-pr-04e2-squat-reversal-confirmation-stabilization-smoke
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { evaluateSquatCompletionState } = await import('../src/lib/camera/squat-completion-state.ts');

let passed = 0;
let failed = 0;

function ok(name, cond, extra) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}`, extra ?? '');
    process.exitCode = 1;
  }
}

let ts = 0;
function mkFrame(primary, phase, blended = primary) {
  ts += 40;
  return {
    isValid: true,
    timestampMs: ts,
    phaseHint: phase,
    derived: { squatDepthProxy: primary, squatDepthProxyBlended: blended },
  };
}

console.log('PR-CAM-ARMING-BASELINE-HANDOFF-01 smoke\n');

// ── A: slice front already descended — seed low baseline inflates relative vs window fallback ──
const sliceFrontHigh = [
  ...Array.from({ length: 6 }, () => mkFrame(0.22, 'descent', 0.22)),
  mkFrame(0.25, 'descent', 0.25),
  mkFrame(0.32, 'bottom', 0.32),
  mkFrame(0.45, 'bottom', 0.45),
  mkFrame(0.44, 'ascent', 0.44),
  mkFrame(0.4, 'ascent', 0.4),
  mkFrame(0.15, 'start', 0.15),
  mkFrame(0.06, 'start', 0.06),
  mkFrame(0.05, 'start', 0.05),
];
const noSeedA = evaluateSquatCompletionState(sliceFrontHigh, {});
const seedA = evaluateSquatCompletionState(sliceFrontHigh, {
  seedBaselineStandingDepthPrimary: 0.04,
  seedBaselineStandingDepthBlended: 0.04,
});
ok(
  'A: without seed, baseline follows slice-front (higher)',
  noSeedA.baselineStandingDepth >= 0.18,
  noSeedA.baselineStandingDepth
);
ok('A: with seed, baseline uses standing handoff', Math.abs(seedA.baselineStandingDepth - 0.04) < 0.02, seedA.baselineStandingDepth);
ok('A: seeded relativeDepthPeak >= unseeded', seedA.relativeDepthPeak >= noSeedA.relativeDepthPeak - 1e-6);
ok('A: baselineSeeded flag', seedA.baselineSeeded === true);

// ── B: blended source follows blended seed when different from primary seed ──
const blendFrames = [
  ...Array.from({ length: 6 }, (_, i) => mkFrame(0.06, 'start', 0.05 + i * 0.002)),
  mkFrame(0.08, 'descent', 0.12),
  mkFrame(0.1, 'descent', 0.22),
  mkFrame(0.11, 'descent', 0.38),
  mkFrame(0.11, 'bottom', 0.42),
  mkFrame(0.1, 'ascent', 0.35),
  mkFrame(0.08, 'ascent', 0.2),
  mkFrame(0.06, 'start', 0.08),
  mkFrame(0.055, 'start', 0.055),
];
const seedB = evaluateSquatCompletionState(blendFrames, {
  seedBaselineStandingDepthPrimary: 0.04,
  seedBaselineStandingDepthBlended: 0.07,
});
ok('B: uses blended stream when relativeDepthPeakSource is blended', seedB.relativeDepthPeakSource === 'blended');
ok(
  'B: baselineStandingDepth matches blended seed',
  Math.abs(seedB.baselineStandingDepth - 0.07) < 0.02,
  { baseline: seedB.baselineStandingDepth, src: seedB.relativeDepthPeakSource }
);

// ── C: no seed — behavior unchanged vs explicit undefined ──
const simple = [
  ...Array.from({ length: 8 }, () => mkFrame(0.02, 'start', 0.02)),
  mkFrame(0.2, 'descent', 0.2),
  mkFrame(0.45, 'bottom', 0.45),
  mkFrame(0.44, 'ascent', 0.44),
  mkFrame(0.1, 'start', 0.1),
  mkFrame(0.03, 'start', 0.03),
];
const noOpt = evaluateSquatCompletionState(simple, {});
const explicitNone = evaluateSquatCompletionState(simple, {
  seedBaselineStandingDepthPrimary: undefined,
  seedBaselineStandingDepthBlended: undefined,
});
ok(
  'C: no seed fallback matches explicit undefined',
  Math.abs(noOpt.baselineStandingDepth - explicitNone.baselineStandingDepth) < 1e-9 &&
    noOpt.baselineSeeded === false
);

// ── D: freeze uses same seed when attempt freezes ──
const longSquat = [
  ...Array.from({ length: 10 }, () => mkFrame(0.02, 'start', 0.02)),
  ...Array.from({ length: 6 }, (_, j) => mkFrame(0.055 + j * 0.002, 'descent', 0.055 + j * 0.002)),
  mkFrame(0.15, 'descent', 0.15),
  mkFrame(0.35, 'bottom', 0.35),
  mkFrame(0.48, 'bottom', 0.48),
  mkFrame(0.46, 'ascent', 0.46),
  mkFrame(0.35, 'ascent', 0.35),
  mkFrame(0.2, 'ascent', 0.2),
  ...Array.from({ length: 10 }, () => mkFrame(0.04, 'start', 0.04)),
];
const SEED_D = 0.035;
const stateD = evaluateSquatCompletionState(longSquat, {
  seedBaselineStandingDepthPrimary: SEED_D,
  seedBaselineStandingDepthBlended: SEED_D,
});
ok(
  'D: when frozen, baselineFrozenDepth matches seeded standing baseline',
  stateD.baselineFrozen !== true ||
    stateD.baselineFrozenDepth == null ||
    Math.abs(stateD.baselineFrozenDepth - SEED_D) < 0.02,
  { frozen: stateD.baselineFrozenDepth, seeded: SEED_D, frozenFlag: stateD.baselineFrozen }
);

// ── E: deep standard_cycle ──
const depthsE = [
  0.02, 0.02, 0.02, 0.02, 0.08, 0.18, 0.32, 0.46, 0.46, 0.4, 0.28, 0.14, 0.06, 0.03, 0.02,
  ...Array(12).fill(0.02),
];
const phasesE = [
  'start',
  'start',
  'start',
  'start',
  'descent',
  'descent',
  'descent',
  'bottom',
  'bottom',
  'ascent',
  'ascent',
  'ascent',
  'start',
  'start',
  'start',
  ...Array(12).fill('start'),
];
const framesE = depthsE.map((d, i) => mkFrame(d, phasesE[i], d));
const seedE = 0.02;
const stateE = evaluateSquatCompletionState(framesE, {
  seedBaselineStandingDepthPrimary: seedE,
  seedBaselineStandingDepthBlended: seedE,
});
ok('E: deep standard_cycle preserved', stateE.completionPassReason === 'standard_cycle' && stateE.completionSatisfied);

// ── F: standing noise ──
const stateF = evaluateSquatCompletionState(
  Array.from({ length: 20 }, () => mkFrame(0.015, 'start', 0.015)),
  { seedBaselineStandingDepthPrimary: 0.01, seedBaselineStandingDepthBlended: 0.01 }
);
ok('F: standing still not complete', stateF.completionSatisfied === false);

// ── G: observational mismatch — seed vs slice-front baseline jump ──
ok(
  'G: seeded baseline not inflated to late slice front',
  seedA.baselineStandingDepth < noSeedA.baselineStandingDepth - 0.05,
  { seeded: seedA.baselineStandingDepth, unseeded: noSeedA.baselineStandingDepth }
);

console.log(`\nDone: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
