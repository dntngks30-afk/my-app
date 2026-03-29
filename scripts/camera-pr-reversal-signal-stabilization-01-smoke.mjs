/**
 * PR-CAM-REVERSAL-SIGNAL-STABILIZATION-01: post-peak monotonic reversal assist
 * Run: npx tsx scripts/camera-pr-reversal-signal-stabilization-01-smoke.mjs
 *
 * Regression (rerun manually/CI): camera-shallow-reversal-signal-01-smoke.mjs,
 * camera-pr-04e2-squat-reversal-confirmation-stabilization-smoke.mjs, camera-cam31-*.mjs
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const {
  detectSquatReversalConfirmation,
  postPeakMonotonicReversalAssist,
} = await import('../src/lib/camera/squat/squat-reversal-confirmation.ts');

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

/** primary === blended so reversal read matches primary */
function mkFrame(primary, phase = 'start') {
  return {
    isValid: true,
    timestampMs: 0,
    phaseHint: phase,
    derived: {
      squatDepthProxy: primary,
      squatDepthProxyBlended: primary,
    },
  };
}

console.log('PR-CAM-REVERSAL-SIGNAL-STABILIZATION-01 smoke\n');

const REL_MODERATE = 0.45;
const REQ_MODERATE = Math.max(0.007, REL_MODERATE * 0.13);

// ── A: moderate partial ascent — strict 2-frame miss, monotonic assist hits ──
const peakA = 0.55;
const peakIdxA = 5;
/** 피크 이후: 단조 하강 단계는 충분하나 연속 두 프레임 모두 peak-req 이하는 아님 */
const framesA = [
  mkFrame(0.02, 'start'),
  mkFrame(0.02, 'start'),
  mkFrame(0.02, 'start'),
  mkFrame(0.35, 'descent'),
  mkFrame(0.48, 'bottom'),
  mkFrame(peakA, 'bottom'),
  mkFrame(0.54, 'start'),
  mkFrame(0.53, 'start'),
  mkFrame(0.52, 'start'),
  mkFrame(0.51, 'start'),
  mkFrame(0.505, 'start'),
  mkFrame(0.495, 'start'),
];
const monoA = postPeakMonotonicReversalAssist({
  validFrames: framesA,
  peakValidIndex: peakIdxA,
  peakPrimaryDepth: peakA,
  required: REQ_MODERATE,
});
ok('A: helper ok for partial monotonic trajectory', monoA.ok === true, monoA);
const detA = detectSquatReversalConfirmation({
  validFrames: framesA,
  peakValidIndex: peakIdxA,
  peakPrimaryDepth: peakA,
  relativeDepthPeak: REL_MODERATE,
  reversalDropRequired: REQ_MODERATE,
  hmm: null,
});
ok('A: detect reversalConfirmed via new assist', detA.reversalConfirmed === true, detA);
ok('A: note post_peak_monotonic_reversal_assist', detA.notes.includes('post_peak_monotonic_reversal_assist'));
ok('A: source rule not hmm owner', detA.reversalSource === 'rule');
ok('A: reversalIndex peak anchor', detA.reversalIndex === peakIdxA);

// ── B: deep standard — early strict path, unchanged owner chain ──
const peakB = 0.82;
const peakIdxB = 4;
const framesB = [
  mkFrame(0.02, 'start'),
  mkFrame(0.02, 'start'),
  mkFrame(0.4, 'descent'),
  mkFrame(0.65, 'bottom'),
  mkFrame(peakB, 'bottom'),
  mkFrame(0.72, 'ascent'),
  mkFrame(0.71, 'ascent'),
  mkFrame(0.5, 'ascent'),
];
const relB = 0.78;
const reqB = Math.max(0.007, relB * 0.13);
const detB = detectSquatReversalConfirmation({
  validFrames: framesB,
  peakValidIndex: peakIdxB,
  peakPrimaryDepth: peakB,
  relativeDepthPeak: relB,
  reversalDropRequired: reqB,
  hmm: null,
});
ok('B: deep reversal confirmed', detB.reversalConfirmed === true, detB);
ok(
  'B: does not depend on post_peak_monotonic only',
  detB.notes.includes('strict_primary_hit') ||
    detB.notes.includes('strict_blended_hit') ||
    detB.notes.includes('window_reversal_relax'),
  detB.notes
);
ok('B: source rule (not spurious hmm_bridge as first path)', detB.reversalSource === 'rule');

// ── C: standing noise ──
const peakC = 0.035;
const framesC = [
  mkFrame(0.03, 'start'),
  mkFrame(0.032, 'start'),
  mkFrame(peakC, 'start'),
  mkFrame(0.034, 'start'),
  mkFrame(0.033, 'start'),
  mkFrame(0.032, 'start'),
];
const detC = detectSquatReversalConfirmation({
  validFrames: framesC,
  peakValidIndex: 2,
  peakPrimaryDepth: peakC,
  relativeDepthPeak: 0.02,
  reversalDropRequired: 0.007,
  hmm: null,
});
ok('C: standing noise no reversal', detC.reversalConfirmed === false, detC);

// ── D: bottom stall — flat at depth, no monotonic steps ──
const peakD = 0.5;
const framesD = [
  mkFrame(0.02, 'start'),
  mkFrame(0.3, 'descent'),
  mkFrame(peakD, 'bottom'),
  mkFrame(peakD, 'bottom'),
  mkFrame(peakD, 'bottom'),
  mkFrame(peakD, 'bottom'),
  mkFrame(peakD, 'bottom'),
  mkFrame(peakD, 'bottom'),
];
const detD = detectSquatReversalConfirmation({
  validFrames: framesD,
  peakValidIndex: 2,
  peakPrimaryDepth: peakD,
  relativeDepthPeak: 0.42,
  reversalDropRequired: Math.max(0.007, 0.42 * 0.13),
  hmm: null,
});
ok('D: bottom stall no reversal', detD.reversalConfirmed === false, detD);

// ── E: single spike after peak ──
const peakE = 0.5;
const framesE = [
  mkFrame(0.02, 'start'),
  mkFrame(0.3, 'descent'),
  mkFrame(peakE, 'bottom'),
  mkFrame(0.45, 'ascent'),
  mkFrame(0.49, 'ascent'),
];
const detE = detectSquatReversalConfirmation({
  validFrames: framesE,
  peakValidIndex: 2,
  peakPrimaryDepth: peakE,
  relativeDepthPeak: 0.42,
  reversalDropRequired: Math.max(0.007, 0.42 * 0.13),
  hmm: null,
});
ok('E: single-spike / thin post-peak no assist pass', detE.reversalConfirmed === false, detE);

// ── F: weak partial real-like (same family as A, integration) ──
const detF = detectSquatReversalConfirmation({
  validFrames: framesA,
  peakValidIndex: peakIdxA,
  peakPrimaryDepth: peakA,
  relativeDepthPeak: 0.42,
  reversalDropRequired: Math.max(0.007, 0.42 * 0.13),
  hmm: null,
});
ok(
  'F: moderate rel~0.42 partial ascent still reversal (JSON-shaped bottleneck)',
  detF.reversalConfirmed === true,
  detF
);
ok('F: uses post_peak_monotonic_reversal_assist', detF.notes.includes('post_peak_monotonic_reversal_assist'));

console.log(`\nDone: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
