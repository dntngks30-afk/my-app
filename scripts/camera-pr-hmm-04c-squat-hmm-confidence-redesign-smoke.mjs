/**
 * PR-HMM-04C — HMM confidence 재설계 회귀 (excursion·시퀀스·커버리지·노이즈)
 *
 * npx tsx scripts/camera-pr-hmm-04c-squat-hmm-confidence-redesign-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { decodeSquatHmm } = await import('../src/lib/camera/squat/squat-hmm.ts');
const { evaluateSquatCompletionState } = await import('../src/lib/camera/squat-completion-state.ts');
const { buildSquatCalibrationTraceCompact } = await import('../src/lib/camera/squat/squat-calibration-trace.ts');

let passed = 0;
let failed = 0;

function ok(name, cond, extra) {
  if (cond) {
    passed++;
    console.log(`  PASS: ${name}`);
  } else {
    failed++;
    const detail = extra !== undefined ? ` | got: ${JSON.stringify(extra)}` : '';
    console.error(`  FAIL: ${name}${detail}`);
    process.exitCode = 1;
  }
}

function makeFrame(depth, timestampMs = 0, phaseHint = 'start') {
  return {
    timestampMs,
    isValid: typeof depth === 'number',
    phaseHint,
    derived: { squatDepthProxy: typeof depth === 'number' ? depth : undefined },
    visibilitySummary: {
      averageVisibility: 0.9,
      criticalJointsAvailability: 0.9,
      visibleLandmarkRatio: 0.9,
      leftSideCompleteness: 0.9,
      rightSideCompleteness: 0.9,
    },
    bodyBox: { area: 0.35, width: 0.4, height: 0.8 },
    qualityHints: [],
    frameValidity: typeof depth === 'number' ? 'valid' : 'invalid',
    joints: {},
    eventHints: [],
    timestampDeltaMs: 33,
    stepId: 'squat',
  };
}

function buildFrames(depthArray, startMs = 0, stepMs = 33) {
  return depthArray.map((d, i) => makeFrame(d, startMs + i * stepMs));
}

function framesDeepStandard() {
  return buildFrames([
    0.005, 0.006, 0.005, 0.007, 0.006,
    0.025, 0.05, 0.085, 0.115,
    0.14, 0.145, 0.142,
    0.11, 0.075, 0.04, 0.015,
    0.007, 0.006, 0.007, 0.005,
  ]);
}

function framesShallowMeaningful() {
  return buildFrames([
    0.004, 0.005, 0.004, 0.006, 0.005,
    0.018, 0.032, 0.045,
    0.055, 0.058,
    0.038, 0.022, 0.008,
    0.005, 0.006, 0.005, 0.004, 0.005,
  ]);
}

function framesStandingJitter() {
  return buildFrames([
    0.004, 0.006, 0.005, 0.007, 0.006, 0.005, 0.004, 0.006,
    0.005, 0.004, 0.006, 0.005, 0.007, 0.005, 0.006, 0.004,
  ]);
}

console.log('\n-- A. deep standard confidence > shallow meaningful --');
{
  const deep = decodeSquatHmm(framesDeepStandard());
  const shallow = decodeSquatHmm(framesShallowMeaningful());
  ok('A: deep > shallow', deep.confidence > shallow.confidence, { deep: deep.confidence, shallow: shallow.confidence });
}

console.log('\n-- B. shallow meaningful > jitter, shallow mid+ --');
{
  const shallow = decodeSquatHmm(framesShallowMeaningful());
  const jitter = decodeSquatHmm(framesStandingJitter());
  ok('B: shallow > jitter', shallow.confidence > jitter.confidence, {
    shallow: shallow.confidence,
    jitter: jitter.confidence,
  });
  ok('B: shallow mid confidence (>=0.45)', shallow.confidence >= 0.45, shallow.confidence);
}

console.log('\n-- C. jitter confidence stays low --');
{
  const jitter = decodeSquatHmm(framesStandingJitter());
  ok('C: jitter low (<=0.25)', jitter.confidence <= 0.25, jitter.confidence);
}

console.log('\n-- D. completionCandidate semantics unchanged --');
{
  const deep = decodeSquatHmm(framesDeepStandard());
  const shallow = decodeSquatHmm(framesShallowMeaningful());
  const jitter = decodeSquatHmm(framesStandingJitter());
  ok('D: deep candidate', deep.completionCandidate === true, deep);
  ok('D: shallow candidate', shallow.completionCandidate === true, shallow);
  ok('D: jitter not candidate', jitter.completionCandidate === false, jitter);
}

console.log('\n-- E. breakdown + compact hcb shape --');
{
  const fr = framesDeepStandard();
  const hmm = decodeSquatHmm(fr);
  const st = evaluateSquatCompletionState(fr, { hmm });
  const bd = hmm.confidenceBreakdown;
  ok('E: breakdown keys', bd != null && 'excursionScore' in bd && 'sequenceScore' in bd, bd);
  ok('E: coverage + noise', typeof bd.coverageScore === 'number' && typeof bd.noisePenalty === 'number', bd);
  const compact = buildSquatCalibrationTraceCompact(st, hmm);
  ok('E: hcb present', compact.hcb != null, compact);
  ok('E: hcb x,s,c,n', 'x' in compact.hcb && 's' in compact.hcb && 'c' in compact.hcb && 'n' in compact.hcb, compact.hcb);
}

console.log(`\n== PR-HMM-04C confidence redesign smoke: ${passed} passed, ${failed} failed ==\n`);
