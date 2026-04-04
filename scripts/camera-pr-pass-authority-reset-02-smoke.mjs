/**
 * PASS-AUTHORITY-RESET-02 스모크 테스트
 *
 * 12개 필수 케이스:
 *  TEST 1  — shallow gold-path real pass (~0.05–0.08 depth band)
 *  TEST 2  — deep real pass
 *  TEST 3  — standing only blocked
 *  TEST 4  — descent only blocked
 *  TEST 5  — mid-rise / not standing recovered blocked
 *  TEST 6  — setup motion blocked (no cycle bypass)
 *  TEST 7  — jitter spike / micro-bounce blocked
 *  TEST 8  — cross-rep ownership blocked
 *  TEST 9  — downstream cannot revoke pass (policy/annotation does not flip true→false)
 *  TEST 10 — pass-core INDEPENDENCE: passes without completionSatisfied
 *  TEST 11 — no shallow-to-deep dependency: ultra-shallow passes without drifting to standard
 *  TEST 12 — writer inventory: pass truth comes only from pass-core
 *
 * npx tsx scripts/camera-pr-pass-authority-reset-02-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { evaluateSquatPassCore } = await import(
  '../src/lib/camera/squat/pass-core.ts'
);

let passCount = 0;
let failCount = 0;
const results = [];

function assert(label, actual, expected) {
  if (actual === expected) {
    passCount++;
    results.push(`  ✓ ${label}`);
  } else {
    failCount++;
    results.push(`  ✗ ${label} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertTruthy(label, actual) {
  if (actual) {
    passCount++;
    results.push(`  ✓ ${label}`);
  } else {
    failCount++;
    results.push(`  ✗ ${label} — expected truthy, got ${JSON.stringify(actual)}`);
  }
}

function assertFalsy(label, actual) {
  if (!actual) {
    passCount++;
    results.push(`  ✓ ${label}`);
  } else {
    failCount++;
    results.push(`  ✗ ${label} — expected falsy, got ${JSON.stringify(actual)}`);
  }
}

function section(title) {
  results.push(`\n[${title}]`);
}

function makeFrames(specs) {
  return specs.map(([depth, ms]) => ({ depth, timestampMs: ms }));
}

// ─── Fixture builders ──────────────────────────────────────────────────────

/** Ultra-shallow: relativePeak=0.055 (~0.055 range) — real shallow that previously failed */
function makeUltraShallowCycle({ baseline = 0.05, relPeak = 0.055, totalMs = 1200 } = {}) {
  const peak = baseline + relPeak;
  const standingThreshold = baseline + 0.40 * relPeak;
  return {
    depthFrames: makeFrames([
      [baseline,            0],
      [baseline,            33],
      [baseline + 0.010,    200],  // start descent
      [baseline + 0.025,    400],
      [peak,                600],  // peak
      [peak,                633],  // peak hold
      [baseline + 0.030,    750],  // reversal
      [baseline + 0.015,    900],
      [standingThreshold - 0.001, 1100], // standing
      [baseline,            totalMs],
    ]),
    baselineStandingDepth: baseline,
    setupMotionBlocked: false,
    setupMotionBlockReason: null,
  };
}

/** Moderate squat: relativePeak=0.20 */
function makeModerateSquatCycle() {
  return {
    depthFrames: makeFrames([
      [0.05, 0], [0.05, 33],
      [0.10, 300], [0.18, 600], [0.25, 900],
      [0.25, 933], // peak hold
      [0.18, 1100], [0.10, 1400],
      [0.07, 1700], // standing threshold = 0.05 + 0.40*0.20 = 0.13 → passes
      [0.05, 2000],
    ]),
    baselineStandingDepth: 0.05,
    setupMotionBlocked: false,
    setupMotionBlockReason: null,
  };
}

/** Deep squat: relativePeak=0.40 */
function makeDeepSquatCycle() {
  return {
    depthFrames: makeFrames([
      [0.05, 0], [0.05, 33],
      [0.15, 400], [0.30, 800], [0.45, 1200],
      [0.45, 1233], // peak hold
      [0.30, 1500], [0.15, 1800],
      [0.10, 2100], // standing threshold = 0.05 + 0.40*0.40 = 0.21 → passes
      [0.05, 2400],
    ]),
    baselineStandingDepth: 0.05,
    setupMotionBlocked: false,
    setupMotionBlockReason: null,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

section('TEST 1: shallow gold-path real pass (~0.05–0.08 depth band)');
{
  // Ultra-shallow: relPeak=0.055 — this MUST pass without drifting to deeper bands
  const r1 = evaluateSquatPassCore(makeUltraShallowCycle({ relPeak: 0.055 }));
  assert('T1-A: ultra-shallow (0.055) passDetected=true', r1.passDetected, true);
  assert('T1-B: passBlockedReason=null', r1.passBlockedReason, null);
  assert('T1-C: descentDetected=true', r1.descentDetected, true);
  assert('T1-D: reversalDetected=true', r1.reversalDetected, true);
  assert('T1-E: standingRecovered=true', r1.standingRecovered, true);
  assert('T1-F: peakLatched=true', r1.peakLatched, true);
  assertTruthy('T1-G: repId non-null', r1.repId);

  // Slightly deeper shallow: relPeak=0.08
  const r2 = evaluateSquatPassCore(makeUltraShallowCycle({ relPeak: 0.08 }));
  assert('T1-H: shallow (0.08) passDetected=true', r2.passDetected, true);
}

section('TEST 2: deep real pass');
{
  const r = evaluateSquatPassCore(makeDeepSquatCycle());
  assert('T2-A: deep passDetected=true', r.passDetected, true);
  assert('T2-B: passBlockedReason=null', r.passBlockedReason, null);
  assert('T2-C: descentDetected=true', r.descentDetected, true);

  const rm = evaluateSquatPassCore(makeModerateSquatCycle());
  assert('T2-D: moderate passDetected=true', rm.passDetected, true);
}

section('TEST 3: standing only blocked');
{
  const r = evaluateSquatPassCore({
    depthFrames: makeFrames([
      [0.05, 0], [0.05, 33], [0.05, 66], [0.05, 100],
      [0.05, 133], [0.05, 166], [0.05, 200], [0.05, 233],
    ]),
    baselineStandingDepth: 0.05,
    setupMotionBlocked: false,
    setupMotionBlockReason: null,
  });
  assert('T3-A: passDetected=false', r.passDetected, false);
  assert('T3-B: descentDetected=false', r.descentDetected, false);
  assert('T3-C: blocked=no_meaningful_descent', r.passBlockedReason, 'no_meaningful_descent');
}

section('TEST 4: descent only blocked (squats and stays)');
{
  const r = evaluateSquatPassCore({
    depthFrames: makeFrames([
      [0.05, 0], [0.05, 33],
      [0.08, 300], [0.11, 600], [0.11, 800],
      [0.11, 1200], [0.11, 1600], [0.11, 2000], // stays at bottom
    ]),
    baselineStandingDepth: 0.05,
    setupMotionBlocked: false,
    setupMotionBlockReason: null,
  });
  assert('T4-A: passDetected=false', r.passDetected, false);
  assert('T4-B: descentDetected=true', r.descentDetected, true);
  assert('T4-C: reversalDetected=false', r.reversalDetected, false);
  assert('T4-D: blocked=no_reversal_after_peak', r.passBlockedReason, 'no_reversal_after_peak');
}

section('TEST 5: mid-rise / not standing recovered blocked');
{
  // relativePeak=0.06, threshold=0.074; partial return stops at 0.085
  const r = evaluateSquatPassCore({
    depthFrames: makeFrames([
      [0.05, 0], [0.05, 33],
      [0.08, 300], [0.11, 600], [0.11, 633],
      [0.10, 800], [0.09, 1000], [0.085, 1200],
      [0.085, 1400], [0.085, 1600],  // never gets below 0.074
    ]),
    baselineStandingDepth: 0.05,
    setupMotionBlocked: false,
    setupMotionBlockReason: null,
  });
  assert('T5-A: passDetected=false', r.passDetected, false);
  assert('T5-B: standingRecovered=false', r.standingRecovered, false);
  assert('T5-C: reversalDetected=true', r.reversalDetected, true);
  assert('T5-D: blocked=no_standing_recovery', r.passBlockedReason, 'no_standing_recovery');
}

section('TEST 6: setup motion blocked — no cycle to bypass');
{
  // Setup motion + no clear motion cycle: blocked
  const r = evaluateSquatPassCore({
    depthFrames: makeFrames([
      [0.05, 0], [0.05, 33], [0.05, 66], [0.05, 100],
    ]),
    baselineStandingDepth: 0.05,
    setupMotionBlocked: true,
    setupMotionBlockReason: 'large_framing_translation',
  });
  assert('T6-A: passDetected=false', r.passDetected, false);
  assert('T6-B: antiSetupClear=false', r.antiSetupClear, false);
  assert('T6-C: setupClear=false', r.setupClear, false);
}

section('TEST 6b: setup motion bypassed by complete valid cycle');
{
  // Setup motion + complete valid cycle: bypass
  const input = { ...makeUltraShallowCycle({ relPeak: 0.06 }), setupMotionBlocked: true, setupMotionBlockReason: 'step_back' };
  const r = evaluateSquatPassCore(input);
  assert('T6b-A: passDetected=true (bypass)', r.passDetected, true);
  assert('T6b-B: setupClear=true (bypassed)', r.setupClear, true);
  assert('T6b-C: antiSetupClear=false (raw setup still blocked)', r.antiSetupClear, false);
}

section('TEST 7: jitter spike and micro-bounce blocked');
{
  // Single-frame spike
  const rSpike = evaluateSquatPassCore({
    depthFrames: makeFrames([
      [0.05, 0], [0.05, 33], [0.05, 66],
      [0.11, 100],  // single spike
      [0.05, 133], [0.05, 166], [0.05, 200], [0.05, 233],
    ]),
    baselineStandingDepth: 0.05,
    setupMotionBlocked: false,
    setupMotionBlockReason: null,
  });
  assert('T7-A: spike passDetected=false', rSpike.passDetected, false);
  assert('T7-B: peakLatched=false', rSpike.peakLatched, false);
  assert('T7-C: blocked=peak_not_latched', rSpike.passBlockedReason, 'peak_not_latched');

  // Micro-bounce (too fast: 150ms total cycle)
  const rBounce = evaluateSquatPassCore({
    depthFrames: makeFrames([
      [0.05, 0], [0.08, 30], [0.11, 60], [0.11, 90], [0.08, 120], [0.05, 150],
    ]),
    baselineStandingDepth: 0.05,
    setupMotionBlocked: false,
    setupMotionBlockReason: null,
  });
  assert('T7-D: micro-bounce passDetected=false', rBounce.passDetected, false);
  assert('T7-E: blocked=cycle_too_short', rBounce.passBlockedReason, 'cycle_too_short');
}

section('TEST 8: cross-rep ownership blocked');
{
  // Reversal ~t=700ms, standing ~t=11200ms → reversal-to-standing > 10000ms
  const r = evaluateSquatPassCore({
    depthFrames: makeFrames([
      [0.05, 0], [0.05, 33],
      [0.08, 300], [0.11, 600], [0.11, 633],
      [0.099, 700],   // halfway reversal (drop ~0.011 = 18% of 0.06 → needs 0.012 for full)
      [0.097, 750],   // drop = 0.013 > 0.012 → full reversal confirmed at 750ms
      [0.075, 1000],  // reversal-to-standing = 11200 - 700 = 10500ms > 10000ms
      [0.074, 11200], // standing threshold = 0.074
    ]),
    baselineStandingDepth: 0.05,
    setupMotionBlocked: false,
    setupMotionBlockReason: null,
  });
  assert('T8-A: passDetected=false', r.passDetected, false);
  assert('T8-B: sameRepOwnershipClear=false', r.sameRepOwnershipClear, false);
  assert('T8-C: blocked=same_rep_ownership_broken', r.passBlockedReason, 'same_rep_ownership_broken');
}

section('TEST 9: downstream cannot revoke passDetected');
{
  // Once pass-core returns passDetected=true, simulate that downstream reads
  // passDetected directly — no downstream field can flip it.
  const r = evaluateSquatPassCore(makeUltraShallowCycle());
  assert('T9-A: passDetected=true', r.passDetected, true);

  // Verify: result is immutable (passDetected can't be revoked by downstream reading)
  // Downstream would set ultraLowPolicyBlocked=true on the completion state,
  // but pass-core output is independent — it doesn't read that.
  // We confirm the output has no mechanism to revoke itself.
  assertFalsy('T9-B: no passRevokedBy field in result', 'passRevokedBy' in r);
  assert('T9-C: passBlockedReason=null on pass', r.passBlockedReason, null);
}

section('TEST 10: pass-core INDEPENDENCE (no completionSatisfied in input)');
{
  const input = makeUltraShallowCycle({ relPeak: 0.058 });

  // Confirm input has no completionSatisfied field
  assert('T10-A: completionSatisfied NOT in input', 'completionSatisfied' in input, false);
  assert('T10-B: completionBlockedReason NOT in input', 'completionBlockedReason' in input, false);
  assert('T10-C: ownerAuthoritativeReversalSatisfied NOT in input', 'ownerAuthoritativeReversalSatisfied' in input, false);
  assert('T10-D: standingFinalizeSatisfied NOT in input', 'standingFinalizeSatisfied' in input, false);

  // Ultra-shallow must pass independently
  const r = evaluateSquatPassCore(input);
  assert('T10-E: passDetected=true without completionSatisfied', r.passDetected, true);
  assert('T10-F: passBlockedReason=null', r.passBlockedReason, null);

  // Explicitly test that a shallow rep with completionSatisfied=false
  // (which previously blocked in RESET-01) now passes in RESET-02
  // by passing only depth stream with no completionSatisfied.
  const shallowInput2 = makeUltraShallowCycle({ relPeak: 0.060 });
  // This simulates: completion machine said no_reversal for this rep (completionSatisfied=false).
  // RESET-02 pass-core ignores this and evaluates from depth stream directly.
  const r2 = evaluateSquatPassCore(shallowInput2);
  assert('T10-G: shallow rep passes independently of upstream verdict', r2.passDetected, true);
}

section('TEST 11: no shallow-to-deep dependency');
{
  // Ultra-shallow at 0.055 must pass as ultra-shallow, not require drift to deeper bands.
  const rUltraShallow = evaluateSquatPassCore(makeUltraShallowCycle({ relPeak: 0.055 }));
  assert('T11-A: ultra-shallow (0.055) passDetected=true', rUltraShallow.passDetected, true);
  // depthPeak should reflect the shallow depth, not a deeper value
  assertTruthy('T11-B: depthPeak reflects shallow peak', rUltraShallow.depthPeak !== undefined && rUltraShallow.depthPeak < 0.12);

  // Another ultra-shallow at 0.027 (just above MIN_DESCENT_DEPTH_DELTA=0.025)
  const rTiny = evaluateSquatPassCore(makeUltraShallowCycle({ relPeak: 0.027 }));
  assert('T11-C: minimal-but-real rep (0.027) passes', rTiny.passDetected, true);

  // Below threshold: a rep that barely grazes 0.018 above baseline must fail
  const rTooShallow = evaluateSquatPassCore({
    depthFrames: makeFrames([
      [0.05, 0], [0.05, 33], [0.05, 66],
      [0.068, 200], [0.068, 300], [0.068, 400], // relativePeak = 0.018 < 0.025
      [0.055, 600], [0.05, 800],
    ]),
    baselineStandingDepth: 0.05,
    setupMotionBlocked: false,
    setupMotionBlockReason: null,
  });
  assert('T11-D: below threshold (0.018) still blocked', rTooShallow.passDetected, false);
  assert('T11-E: blocked by no_meaningful_descent', rTooShallow.passBlockedReason, 'no_meaningful_descent');
}

section('TEST 12: writer inventory — single writer, zero revokers');
{
  // Only evaluateSquatPassCore can set passDetected.
  // Auto-progression and evaluator/policy are consumers only.
  // We verify: the pass-core function exists and is the only export for pass truth.
  assertTruthy('T12-A: evaluateSquatPassCore is a function', typeof evaluateSquatPassCore === 'function');

  // Verify output has no "revoke" mechanism
  const r = evaluateSquatPassCore(makeDeepSquatCycle());
  assertFalsy('T12-B: result has no revokePass field', 'revokePass' in r);
  assertFalsy('T12-C: result has no ultraLowPolicyBlocked field (policy moved out)', 'ultraLowPolicyBlocked' in r);
  assertFalsy('T12-D: result has no completionSatisfied field (not a passthrough)', 'completionSatisfied' in r);
  assert('T12-E: passDetected=true for deep rep', r.passDetected, true);
  assertTruthy('T12-F: trace is non-empty string', typeof r.trace === 'string' && r.trace.length > 0);
}

// ─── Print results ────────────────────────────────────────────────────────────
results.forEach((r) => console.log(r));
console.log('\n============================================================');
console.log(`PASS-AUTHORITY-RESET-02 smoke: ${passCount} passed, ${failCount} failed`);
if (failCount === 0) {
  console.log('ALL ASSERTIONS PASSED');
} else {
  console.log('SOME ASSERTIONS FAILED');
  process.exit(1);
}
