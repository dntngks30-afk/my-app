/**
 * PR-CAM-SHALLOW-REVERSAL-SIGNAL-01: 얕은 reversal relax 밴드 스모크
 *
 * 실행: npx tsx scripts/camera-shallow-reversal-signal-01-smoke.mjs
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { detectSquatReversalConfirmation } = await import(
  '../src/lib/camera/squat/squat-reversal-confirmation.ts'
);

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

/** @param {number} primary @param {number} rev @param {string} [phase] */
function mkFrame(primary, rev, phase = 'ascent') {
  return {
    isValid: true,
    timestampMs: 0,
    phaseHint: phase,
    derived: {
      squatDepthProxy: primary,
      squatDepthProxyBlended: rev,
    },
  };
}

console.log('PR-CAM-SHALLOW-REVERSAL-SIGNAL-01 smoke\n');

// A. ultra-shallow <0.08: strict 실패 시 ultra note, 확정 없음
const peakIdxA = 2;
const peakDepthA = 0.12;
const reqA = Math.max(0.007, 0.05 * 0.13);
const framesA = [
  mkFrame(0.04, 0.04, 'start'),
  mkFrame(0.08, 0.08, 'descent'),
  mkFrame(peakDepthA, peakDepthA, 'bottom'),
  mkFrame(0.115, 0.114, 'ascent'),
  mkFrame(0.114, 0.113, 'ascent'),
  mkFrame(0.113, 0.112, 'ascent'),
];
const rA = detectSquatReversalConfirmation({
  validFrames: framesA,
  peakValidIndex: peakIdxA,
  peakPrimaryDepth: peakDepthA,
  relativeDepthPeak: 0.05,
  reversalDropRequired: reqA,
  hmm: null,
});
ok('A: ultra-shallow no confirm', rA.reversalConfirmed === false);
ok('A: source none', rA.reversalSource === 'none');
ok('A: ultra_shallow_strict_only_no_hit', rA.notes.includes('ultra_shallow_strict_only_no_hit'));

// B. [0.08, 0.12): strict 실패 + shallow window relax 성공
const peakDepthB = 0.2;
const relB = 0.1;
const reqB = Math.max(0.007, relB * 0.13);
const framesB = [
  mkFrame(0.05, 0.05, 'start'),
  mkFrame(0.12, 0.12, 'descent'),
  mkFrame(peakDepthB, peakDepthB, 'bottom'),
  mkFrame(0.19, 0.19, 'ascent'),
  mkFrame(0.19, 0.188, 'ascent'),
  mkFrame(0.19, 0.175, 'ascent'),
  mkFrame(0.19, 0.19, 'ascent'),
];
const rB = detectSquatReversalConfirmation({
  validFrames: framesB,
  peakValidIndex: 2,
  peakPrimaryDepth: peakDepthB,
  relativeDepthPeak: relB,
  reversalDropRequired: reqB,
  hmm: null,
});
ok('B: shallow-relax confirms', rB.reversalConfirmed === true);
ok('B: source rule', rB.reversalSource === 'rule');
ok('B: shallow_window_reversal_relax', rB.notes.includes('shallow_window_reversal_relax'));

// C. [0.08, 0.12): drop 부족 → shallow_relax_no_hit
const framesC = [
  mkFrame(0.05, 0.05, 'start'),
  mkFrame(0.12, 0.12, 'descent'),
  mkFrame(peakDepthB, peakDepthB, 'bottom'),
  mkFrame(0.199, 0.199, 'ascent'),
  mkFrame(0.199, 0.199, 'ascent'),
  mkFrame(0.199, 0.199, 'ascent'),
  mkFrame(0.199, 0.199, 'ascent'),
];
const rC = detectSquatReversalConfirmation({
  validFrames: framesC,
  peakValidIndex: 2,
  peakPrimaryDepth: peakDepthB,
  relativeDepthPeak: relB,
  reversalDropRequired: reqB,
  hmm: null,
});
ok('C: shallow-relax no hit', rC.reversalConfirmed === false);
ok('C: shallow_relax_no_hit', rC.notes.includes('shallow_relax_no_hit'));

// C2. 유효 reversal depth 1개뿐 — readSquatCompletionDepthForReversal 가 null 이 되도록 primary 비유효
function mkNoRevDepth() {
  return {
    isValid: true,
    timestampMs: 0,
    phaseHint: 'ascent',
    derived: { squatDepthProxy: Number.NaN, squatDepthProxyBlended: undefined },
  };
}
const framesC2 = [
  mkFrame(0.05, 0.05, 'start'),
  mkFrame(0.12, 0.12, 'descent'),
  mkFrame(peakDepthB, peakDepthB, 'bottom'),
  mkNoRevDepth(),
  mkNoRevDepth(),
  mkNoRevDepth(),
  mkFrame(0.19, 0.15, 'ascent'),
];
const rC2 = detectSquatReversalConfirmation({
  validFrames: framesC2,
  peakValidIndex: 2,
  peakPrimaryDepth: peakDepthB,
  relativeDepthPeak: relB,
  reversalDropRequired: reqB,
  hmm: null,
});
ok('C2: one valid rev frame → no shallow ok', rC2.reversalConfirmed === false);

// D. >= 0.12: window_reversal_relax 경로 (strict 회피)
const peakDepthD = 0.3;
const relD = 0.15;
const reqD = Math.max(0.007, relD * 0.13);
const framesD = [
  mkFrame(0.05, 0.05, 'start'),
  mkFrame(0.15, 0.15, 'descent'),
  mkFrame(peakDepthD, peakDepthD, 'bottom'),
  mkFrame(0.29, 0.29, 'ascent'),
  mkFrame(0.29, 0.29, 'ascent'),
  mkFrame(0.29, 0.29, 'ascent'),
  mkFrame(0.29, 0.28, 'ascent'),
];
// primary 모두 > thrD 연속 2 없게, reversal 윈도우에서 min 0.28 → drop 0.02 >= reqD*0.92
const rD = detectSquatReversalConfirmation({
  validFrames: framesD,
  peakValidIndex: 2,
  peakPrimaryDepth: peakDepthD,
  relativeDepthPeak: relD,
  reversalDropRequired: reqD,
  hmm: null,
});
ok('D: moderate window_reversal_relax', rD.reversalConfirmed === true);
ok('D: window note', rD.notes.includes('window_reversal_relax'));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
