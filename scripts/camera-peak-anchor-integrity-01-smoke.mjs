/**
 * PR-CAM-PEAK-ANCHOR-INTEGRITY-01: commitment-safe reversal peak anchor
 * Run: npx tsx scripts/camera-peak-anchor-integrity-01-smoke.mjs
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { evaluateSquatCompletionState } = await import('../src/lib/camera/squat-completion-state.ts');

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

function syntheticStateFrames(depths, phases, stepMs = 80) {
  return depths.map((depth, i) => ({
    timestampMs: 100 + i * stepMs,
    isValid: true,
    phaseHint: phases[i] ?? 'unknown',
    derived: { squatDepthProxy: depth },
  }));
}

console.log('PR-CAM-PEAK-ANCHOR-INTEGRITY-01 smoke\n');

// A: Global max depth while still `start` (pre-descent noise), then real descent/commit later.
// Old bug: reversalFrame = global peakFrame → reversalAtMs < committedAtMs.
const depthsA = [
  ...Array(6).fill(0.015),
  0.14,
  0.12,
  0.1,
  ...Array(4).fill(0.04),
  0.05,
  0.06,
  0.07,
  0.08,
  0.09,
  0.1,
  0.09,
  0.08,
  0.06,
  0.04,
  0.03,
  0.02,
  0.015,
  0.015,
  0.015,
  0.015,
  0.015,
];
const phasesA = [
  ...Array(6).fill('start'),
  'start',
  'start',
  'start',
  ...Array(4).fill('start'),
  'descent',
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
  'start',
  'start',
  'start',
];
const stateA = evaluateSquatCompletionState(syntheticStateFrames(depthsA, phasesA));
ok(
  'A: reversal anchor never before commitment (reversalAtMs >= committedAtMs or unset)',
  stateA.reversalAtMs == null ||
    stateA.committedAtMs == null ||
    stateA.reversalAtMs >= stateA.committedAtMs
);

// B: Meaningful shallow squat (PR-7 style) — success + standard or acceptable pass
const stateB = evaluateSquatCompletionState(
  syntheticStateFrames(
    [
      0.01, 0.01, 0.01, 0.01, 0.03, 0.05, 0.07, 0.09, 0.09, 0.07, 0.05, 0.03, 0.02, 0.01, 0.01,
    ],
    [
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
    ]
  )
);
ok('B: shallow meaningful cycle can still complete', stateB.completionSatisfied === true);
ok(
  'B: reversal timing integrity when both timestamps present',
  stateB.reversalAtMs == null ||
    stateB.committedAtMs == null ||
    stateB.reversalAtMs >= stateB.committedAtMs
);

// C: Standing only
const stateC = evaluateSquatCompletionState(
  syntheticStateFrames(Array(20).fill(0.015), Array(20).fill('start'))
);
ok('C: standing still does not satisfy completion', stateC.completionSatisfied === false);

// D: relativeDepthPeak >= STANDARD_OWNER_FLOOR(0.4) so standard_path wins → standard_cycle
const depthsD = [
  0.02, 0.02, 0.02, 0.02, 0.08, 0.18, 0.32, 0.46, 0.46, 0.4, 0.28, 0.14, 0.06, 0.03, 0.02,
  ...Array(12).fill(0.02),
];
const phasesD = [
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
const stateD = evaluateSquatCompletionState(syntheticStateFrames(depthsD, phasesD));
ok(
  'D: deep squat keeps standard_cycle when rule path passes',
  stateD.completionSatisfied === true && stateD.completionPassReason === 'standard_cycle'
);
ok(
  'D: reversal timing integrity',
  stateD.reversalAtMs == null ||
    stateD.committedAtMs == null ||
    stateD.reversalAtMs >= stateD.committedAtMs
);

// E: Low-ROM style depths with phase hints (event path may promote)
const depthsE = [0.02, 0.02, 0.02, 0.04, 0.06, 0.07, 0.065, 0.05, 0.04, 0.03, 0.025, 0.02, 0.02];
const phasesE = [
  'start',
  'start',
  'start',
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
];
const stateE = evaluateSquatCompletionState(syntheticStateFrames(depthsE, phasesE));
ok(
  'E: low-ROM trajectory still has a completion path (rule or event)',
  stateE.completionSatisfied === true ||
    stateE.evidenceLabel === 'low_rom' ||
    stateE.evidenceLabel === 'ultra_low_rom'
);

console.log(`\nDone: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
