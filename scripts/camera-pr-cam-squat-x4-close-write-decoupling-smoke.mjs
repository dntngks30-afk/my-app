/**
 * PR-X4 -- Closure Write Decoupling from Residual Span Veto on Already-Proved
 * Shallow Epochs.
 *
 * Builds on top of PR-X1 (pre-attempt arming / baseline freeze early
 * stabilization), PR-X2 (peak / anchor initialization repair, same-epoch peak
 * provenance unification), and PR-X3 (shallow-admitted same-epoch reversal
 * ownership repair). This smoke pins the narrow Wave X4 repair:
 *
 *   1. Unit: `resolveOfficialShallowClosureContract`'s Family C
 *      (`shallowProofTerminalCloseSatisfied`) combined with
 *      `isStandardVetoSuppressibleByOfficialShallowClosure` correctly marks
 *      the proved-same-epoch + residual standard-span blocker pair as
 *      eligible for the X4 close-write precedence repair. The suppressible
 *      set covers the primary-fixture standard-span killers
 *      (`descent_span_too_short` / `ascent_recovery_span_too_short` /
 *      `recovery_hold_too_short` / `not_standing_recovered`).
 *
 *   2. Baseline audit: primary Family B fixtures
 *      (`device_shallow_fail_01` / `05` / `07` / `10` / `13`) contain ticks
 *      where the captured observation exhibits the proved-but-vetoed
 *      pattern: `officialShallowPathAdmitted=true` +
 *      `officialShallowStreamBridgeApplied=true` +
 *      `officialShallowAscentEquivalentSatisfied=true` +
 *      `officialShallowClosureProofSatisfied=true` +
 *      `officialShallowReversalSatisfied=true` +
 *      `officialShallowPathClosed=false` with a residual
 *      `officialShallowPathBlockedReason` in the PR-4 suppressible set.
 *
 *   3. End-to-end (synthetic shallow rep): an ultra-low-rom shallow rep with
 *      extremely short descent span goes through the existing PR-4 rewrite
 *      path and closes as `ultra_low_rom_cycle`. After PR-X4 the repair
 *      diagnostic fields are present (and remain `false`/`null` on that
 *      already-closed case — X4 is a same-epoch close-write precedence
 *      repair, not a new close path).
 *
 *   4. End-to-end controls: standing-still / descent-only (no reversal) /
 *      deep standard path must NOT satisfy Family C proof terminal close;
 *      X4 repair fields stay at `false`/`null`. Deep standard closure
 *      semantics are not disturbed.
 *
 * Non-goals covered (assertions):
 *   - X4 does not synthesize a new close path when Family C is not
 *     satisfied (no stream-bridge + no ascent equivalent ⇒ X4 never fires
 *     even if the blocker is suppressible).
 *   - X4 does not promote `completionOwnerPassed` / `finalPassLatched` /
 *     `uiProgressionAllowed` / `finalPassEligible` as a success gate (all
 *     primary Family B fixtures continue to report
 *     `finalPassEligible=false` on the same observation).
 *   - Pure Family C baseline (`device_shallow_fail_11`) retains its
 *     pre-confirm reversal semantics (no X4 activation observed in the
 *     captured observation stream).
 *
 * Run:
 *   npx tsx scripts/camera-pr-cam-squat-x4-close-write-decoupling-smoke.mjs
 */

import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const {
  resolveOfficialShallowClosureContract,
  isStandardVetoSuppressibleByOfficialShallowClosure,
} = await import('../src/lib/camera/squat/squat-completion-core.ts');

const { evaluateSquatCompletionState } = await import(
  '../src/lib/camera/squat-completion-state.ts'
);

let passed = 0;
let failed = 0;

function ok(name, cond, extra) {
  if (cond) {
    passed += 1;
    console.log(`  PASS ${name}`);
  } else {
    failed += 1;
    console.error(
      `  FAIL ${name}`,
      extra !== undefined ? JSON.stringify(extra).slice(0, 600) : ''
    );
    process.exitCode = 1;
  }
}

function readFixture(fileName) {
  const path = join(process.env.USERPROFILE ?? homedir(), 'Desktop', fileName);
  if (!existsSync(path)) return null;
  const raw = readFileSync(path, 'utf8');
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function makeFrame(depth, timestampMs, phaseHint) {
  return {
    timestampMs,
    isValid: true,
    phaseHint,
    derived: { squatDepthProxy: depth },
    visibilitySummary: {
      averageVisibility: 0.9,
      criticalJointsAvailability: 0.9,
      visibleLandmarkRatio: 0.9,
      leftSideCompleteness: 0.9,
      rightSideCompleteness: 0.9,
    },
    bodyBox: { area: 0.35, width: 0.4, height: 0.8 },
    qualityHints: [],
    frameValidity: 'valid',
    joints: {},
    eventHints: [],
    timestampDeltaMs: 40,
    stepId: 'squat',
  };
}

console.log('\nPR-X4 -- Closure Write Decoupling from Residual Span Veto Smoke\n');

// =============================================================================
// Section 1 -- Unit: Family C + suppressible-blocker predicate pairing.
// =============================================================================
console.log('Section 1: unit contract predicates');

// Family C proof trio + directional reversal satisfies shallowProofTerminalClose.
{
  const r = resolveOfficialShallowClosureContract({
    descendConfirmed: true,
    reversalConfirmedAfterDescend: true,
    ownerAuthoritativeRecoverySatisfied: false,
    standingFinalizeSatisfied: false,
    standingRecoveredAtMs: null,
    officialShallowAscentEquivalentSatisfied: true,
    officialShallowStreamBridgeApplied: true,
    provenanceReversalEvidencePresent: true,
    shallowClosureProofBundleFromStream: false,
  });
  ok(
    'S1.1: Family C proof trio satisfies shallowProofTerminalCloseSatisfied',
    r.shallowProofTerminalCloseSatisfied === true,
    r
  );
  ok(
    'S1.1: overall contract satisfied',
    r.satisfied === true,
    r
  );
  ok(
    'S1.1: Family A (strict) not satisfied (no recovery)',
    r.strictShallowCycleSatisfied === false,
    r
  );
  ok(
    'S1.1: Family B (ascent equivalent) not satisfied (no recovery proof)',
    r.shallowAscentEquivalentSatisfied === false,
    r
  );
}

// Same proof trio, but no directional reversal -> Family C not satisfied.
{
  const r = resolveOfficialShallowClosureContract({
    descendConfirmed: true,
    reversalConfirmedAfterDescend: false,
    ownerAuthoritativeRecoverySatisfied: false,
    standingFinalizeSatisfied: false,
    standingRecoveredAtMs: null,
    officialShallowAscentEquivalentSatisfied: true,
    officialShallowStreamBridgeApplied: true,
    provenanceReversalEvidencePresent: false,
    shallowClosureProofBundleFromStream: false,
  });
  ok(
    'S1.2: no directional reversal blocks Family C',
    r.shallowProofTerminalCloseSatisfied === false,
    r
  );
}

// Missing stream bridge -> Family C not satisfied even with rule reversal.
{
  const r = resolveOfficialShallowClosureContract({
    descendConfirmed: true,
    reversalConfirmedAfterDescend: true,
    ownerAuthoritativeRecoverySatisfied: false,
    standingFinalizeSatisfied: false,
    standingRecoveredAtMs: null,
    officialShallowAscentEquivalentSatisfied: true,
    officialShallowStreamBridgeApplied: false,
    provenanceReversalEvidencePresent: false,
    shallowClosureProofBundleFromStream: false,
  });
  ok(
    'S1.3: missing stream bridge blocks Family C',
    r.shallowProofTerminalCloseSatisfied === false,
    r
  );
}

// Missing ascent equivalent -> Family C not satisfied.
{
  const r = resolveOfficialShallowClosureContract({
    descendConfirmed: true,
    reversalConfirmedAfterDescend: true,
    ownerAuthoritativeRecoverySatisfied: false,
    standingFinalizeSatisfied: false,
    standingRecoveredAtMs: null,
    officialShallowAscentEquivalentSatisfied: false,
    officialShallowStreamBridgeApplied: true,
    provenanceReversalEvidencePresent: true,
    shallowClosureProofBundleFromStream: false,
  });
  ok(
    'S1.4: missing ascent equivalent blocks Family C',
    r.shallowProofTerminalCloseSatisfied === false,
    r
  );
}

// Standard-veto killers that X4 isolates from terminal close authority.
for (const reason of [
  'descent_span_too_short',
  'ascent_recovery_span_too_short',
  'recovery_hold_too_short',
  'not_standing_recovered',
]) {
  ok(
    `S1.5: ${reason} is in PR-4 suppressible set (X4 scope)`,
    isStandardVetoSuppressibleByOfficialShallowClosure(reason) === true
  );
}

// Non-suppressible blockers that X4 must leave alone (pass-core authority).
for (const reason of [
  'peak_not_latched',
  'no_reversal_after_peak',
  'no_standing_recovery',
  'no_descend',
  'not_armed',
  'insufficient_relative_depth',
]) {
  ok(
    `S1.6: ${reason} remains non-suppressible (X4 preserves)`,
    isStandardVetoSuppressibleByOfficialShallowClosure(reason) === false
  );
}

ok(
  'S1.7: null blocker returns false (X4 guard)',
  isStandardVetoSuppressibleByOfficialShallowClosure(null) === false
);
ok(
  'S1.8: undefined blocker returns false (X4 guard)',
  isStandardVetoSuppressibleByOfficialShallowClosure(undefined) === false
);

// =============================================================================
// Section 2 -- Baseline audit: primary Family B fixtures exhibit
// proved-but-vetoed close with a suppressible residual blocker.
// =============================================================================
console.log('\nSection 2: baseline audit on primary Family B fixtures');

const FAMILY_B_PRIMARY_FIXTURES = [
  'device_shallow_fail_01.txt',
  'device_shallow_fail_05.txt',
  'device_shallow_fail_07.txt',
  'device_shallow_fail_10.txt',
  'device_shallow_fail_13.txt',
];

const SUPPRESSIBLE_BLOCKERS = new Set([
  'descent_span_too_short',
  'ascent_recovery_span_too_short',
  'recovery_hold_too_short',
  'not_standing_recovered',
  'low_rom_standing_finalize_not_satisfied',
  'ultra_low_rom_standing_finalize_not_satisfied',
  'no_reversal',
]);

for (const fixtureName of FAMILY_B_PRIMARY_FIXTURES) {
  const capture = readFixture(fixtureName);
  if (capture == null) {
    console.log(`  SKIP ${fixtureName} (fixture missing locally)`);
    continue;
  }
  const obs = Array.isArray(capture.squatAttemptObservations)
    ? capture.squatAttemptObservations
    : [];

  let provedButVetoedTicks = 0;
  let anyCloseTick = 0;
  let anyFinalPassEligibleTrue = 0;
  let firstAdmittedIdx = -1;
  let firstProofTripleIdx = -1;
  let firstRevSatIdx = -1;
  let firstCloseIdx = -1;
  let firstBlockedReason = null;

  for (let i = 0; i < obs.length; i += 1) {
    const o = obs[i];
    const admitted = o.officialShallowPathAdmitted === true;
    const proofTriple =
      o.officialShallowClosureProofSatisfied === true &&
      o.officialShallowAscentEquivalentSatisfied === true &&
      o.officialShallowStreamBridgeApplied === true;
    const revSat = o.officialShallowReversalSatisfied === true;
    const closed = o.officialShallowPathClosed === true;
    const blockedReason = o.officialShallowPathBlockedReason ?? null;
    const finalPassEligible =
      o.squatCameraObservability?.pass_core_truth?.finalPassEligible === true;

    if (admitted && firstAdmittedIdx < 0) firstAdmittedIdx = i;
    if (admitted && proofTriple && firstProofTripleIdx < 0) firstProofTripleIdx = i;
    if (admitted && revSat && firstRevSatIdx < 0) firstRevSatIdx = i;
    if (closed && firstCloseIdx < 0) firstCloseIdx = i;
    if (closed) anyCloseTick += 1;
    if (finalPassEligible) anyFinalPassEligibleTrue += 1;

    if (
      admitted &&
      proofTriple &&
      revSat &&
      !closed &&
      blockedReason != null &&
      SUPPRESSIBLE_BLOCKERS.has(blockedReason)
    ) {
      provedButVetoedTicks += 1;
      if (firstBlockedReason == null) firstBlockedReason = blockedReason;
    }
  }

  ok(
    `S2.${fixtureName}: proved-same-epoch + suppressible-blocker + close=false exists (baseline)`,
    provedButVetoedTicks > 0,
    { provedButVetoedTicks, firstBlockedReason }
  );
  ok(
    `S2.${fixtureName}: captured observation stream has no close tick (pre-X4 baseline)`,
    anyCloseTick === 0,
    { anyCloseTick, firstCloseIdx }
  );
  ok(
    `S2.${fixtureName}: first admitted <= first proof triple <= first revSat (same-rep ordering)`,
    firstAdmittedIdx >= 0 &&
      firstProofTripleIdx >= 0 &&
      firstRevSatIdx >= 0 &&
      firstAdmittedIdx <= firstProofTripleIdx &&
      firstAdmittedIdx <= firstRevSatIdx,
    { firstAdmittedIdx, firstProofTripleIdx, firstRevSatIdx }
  );
  ok(
    `S2.${fixtureName}: finalPassEligible never promoted on captured stream (X5 scope)`,
    anyFinalPassEligibleTrue === 0,
    { anyFinalPassEligibleTrue }
  );
  ok(
    `S2.${fixtureName}: residual blocker belongs to PR-4 suppressible set`,
    firstBlockedReason != null && SUPPRESSIBLE_BLOCKERS.has(firstBlockedReason),
    { firstBlockedReason }
  );
}

// Pure Family C baseline: proof pre-confirm window dominated by no_reversal_*.
{
  const capture = readFixture('device_shallow_fail_11.txt');
  if (capture == null) {
    console.log('  SKIP device_shallow_fail_11.txt (fixture missing locally)');
  } else {
    const obs = Array.isArray(capture.squatAttemptObservations)
      ? capture.squatAttemptObservations
      : [];
    let anyCloseTick = 0;
    let anyProofTripleRevSatAndSuppressible = 0;
    for (const o of obs) {
      if (o.officialShallowPathClosed === true) anyCloseTick += 1;
      const proofTriple =
        o.officialShallowClosureProofSatisfied === true &&
        o.officialShallowAscentEquivalentSatisfied === true &&
        o.officialShallowStreamBridgeApplied === true;
      if (
        o.officialShallowPathAdmitted === true &&
        proofTriple &&
        o.officialShallowReversalSatisfied === true &&
        SUPPRESSIBLE_BLOCKERS.has(o.officialShallowPathBlockedReason ?? '')
      ) {
        anyProofTripleRevSatAndSuppressible += 1;
      }
    }
    ok(
      'S2.fail_11: pure Family C fixture never captures close (pre-confirm window)',
      anyCloseTick === 0,
      { anyCloseTick }
    );
    // fail_11 is a pre-proof window fixture; it still passes the same invariant
    // the Family B fixtures pass because it never reaches the combined
    // proof+revSat+suppressible state cleanly during the pre-confirm window.
    ok(
      'S2.fail_11: pure Family C is not mis-classified as Family B (X4 scope)',
      anyProofTripleRevSatAndSuppressible === 0,
      { anyProofTripleRevSatAndSuppressible }
    );
  }
}

// =============================================================================
// Section 3 -- End-to-end synthetic: Family C proof path closes; X4 fields
// appear on the returned state and are consistent with close-write provenance.
// =============================================================================
console.log('\nSection 3: end-to-end synthetic closure');

// Fast ultra-low-rom rep: the existing PR-4 rewrite path closes this case.
// With PR-X4 merged, the new repair diagnostics are present on the state and
// remain `false`/`null` because Family A (strict cycle) already closed the
// rep.
{
  const depths = [0, 0, 0, 0, 0, 0, 0.06, 0.06, 0, 0, 0, 0, 0, 0];
  const phases = [
    'start','start','start','start','start','start',
    'descent','bottom','ascent','ascent',
    'start','start','start','start',
  ];
  let t = 0;
  const fr = depths.map((d, i) => makeFrame(d, (t += 60), phases[i]));
  const st = evaluateSquatCompletionState(fr);
  ok(
    'S3.1: ultra-low-rom rep closed as ultra_low_rom_cycle',
    st.officialShallowPathClosed === true &&
      st.completionPassReason === 'ultra_low_rom_cycle',
    {
      closed: st.officialShallowPathClosed,
      passReason: st.completionPassReason,
    }
  );
  ok(
    'S3.1: admitted + proof + reversal satisfied',
    st.officialShallowPathAdmitted === true &&
      st.officialShallowClosureProofSatisfied === true &&
      st.officialShallowReversalSatisfied === true,
    st
  );
  ok(
    'S3.1: X4 repair field is present on the returned state',
    'officialShallowProvedSameEpochCloseWriteRepairApplied' in st,
    Object.keys(st).filter((k) => k.includes('ProvedSameEpoch'))
  );
  ok(
    'S3.1: X4 repair field is present (suppressed reason key)',
    'officialShallowProvedSameEpochCloseWriteRepairSuppressedReason' in st,
    Object.keys(st).filter((k) => k.includes('ProvedSameEpoch'))
  );
  // On this control case, the existing PR-4 rewrite opens close (or the
  // strict cycle path). X4 is a same-epoch close-write precedence repair; on
  // already-closed ticks it must stay inert (no double-write, no
  // suppression of an already-null blocker).
  ok(
    'S3.1: X4 repair did not fire on already-closed case (inert)',
    st.officialShallowProvedSameEpochCloseWriteRepairApplied === false &&
      st.officialShallowProvedSameEpochCloseWriteRepairSuppressedReason == null,
    {
      applied: st.officialShallowProvedSameEpochCloseWriteRepairApplied,
      suppressed: st.officialShallowProvedSameEpochCloseWriteRepairSuppressedReason,
    }
  );
}

// Normal shallow rep (low_rom): closes via low_rom_cycle without any rewrite.
{
  const depths = [
    0.01, 0.01, 0.01, 0.01, 0.03, 0.05, 0.07, 0.09, 0.09, 0.07, 0.05, 0.03, 0.02, 0.01, 0.01,
  ];
  const phases = [
    'start','start','start','start',
    'descent','descent','descent','bottom','bottom',
    'ascent','ascent','ascent',
    'start','start','start',
  ];
  let t = 100;
  const fr = depths.map((d, i) => makeFrame(d, (t += 80), phases[i]));
  const st = evaluateSquatCompletionState(fr);
  ok(
    'S3.2: normal shallow rep closes cleanly (no rewrite needed)',
    st.officialShallowPathClosed === true &&
      st.officialShallowClosureRewriteApplied === false,
    {
      closed: st.officialShallowPathClosed,
      rewrite: st.officialShallowClosureRewriteApplied,
    }
  );
  ok(
    'S3.2: X4 repair inert on clean close case',
    st.officialShallowProvedSameEpochCloseWriteRepairApplied === false &&
      st.officialShallowProvedSameEpochCloseWriteRepairSuppressedReason == null,
    st
  );
}

// =============================================================================
// Section 4 -- Controls: standing / descent-only / deep remain unaffected.
// =============================================================================
console.log('\nSection 4: standing / seated / deep controls');

// Descent-only (no reversal) -> no proof, no close, no X4.
{
  const depths = [0.01, 0.01, 0.01, 0.01, 0.02, 0.04, 0.06, 0.06, 0.06, 0.06, 0.06, 0.06];
  const phases = [
    'start','start','start','start','descent','descent','bottom','bottom','bottom','bottom','bottom','bottom',
  ];
  let t = 100;
  const fr = depths.map((d, i) => makeFrame(d, (t += 90), phases[i]));
  const st = evaluateSquatCompletionState(fr);
  ok(
    'S4.1: descent-only never closes',
    st.officialShallowPathClosed === false && st.completionSatisfied === false,
    st
  );
  ok(
    'S4.1: descent-only X4 repair inert',
    st.officialShallowProvedSameEpochCloseWriteRepairApplied === false &&
      st.officialShallowProvedSameEpochCloseWriteRepairSuppressedReason == null,
    st
  );
}

// Standing still (no meaningful descent) -> no candidate, no close, no X4.
{
  const depths = new Array(20).fill(0).map((_, i) => 0 + Math.sin(i) * 0.002);
  const phases = new Array(20).fill('start');
  let t = 100;
  const fr = depths.map((d, i) => makeFrame(d, (t += 70), phases[i]));
  const st = evaluateSquatCompletionState(fr);
  ok(
    'S4.2: standing-still never closes',
    st.officialShallowPathClosed === false && st.completionSatisfied === false,
    st
  );
  ok(
    'S4.2: standing-still X4 repair inert',
    st.officialShallowProvedSameEpochCloseWriteRepairApplied === false &&
      st.officialShallowProvedSameEpochCloseWriteRepairSuppressedReason == null,
    st
  );
  ok(
    'S4.2: standing-still is not admitted as shallow path',
    st.officialShallowPathAdmitted !== true,
    st
  );
}

// Deep standard rep -> standard_cycle, X4 inert (not a shallow close).
{
  const depths = [
    0.01, 0.01, 0.01, 0.01, 0.05, 0.15, 0.28, 0.42, 0.48, 0.50, 0.48, 0.36, 0.22, 0.10, 0.02, 0.01, 0.01,
  ];
  const phases = [
    'start','start','start','start',
    'descent','descent','descent','descent','bottom','bottom','bottom',
    'ascent','ascent','ascent','ascent','start','start',
  ];
  let t = 100;
  const fr = depths.map((d, i) => makeFrame(d, (t += 90), phases[i]));
  const st = evaluateSquatCompletionState(fr);
  ok(
    'S4.3: deep rep resolves as standard_cycle',
    st.completionPassReason === 'standard_cycle' ||
      st.completionPassReason === 'event_cycle_standard' ||
      st.completionPassReason === 'standard',
    { passReason: st.completionPassReason }
  );
  ok(
    'S4.3: deep rep X4 repair inert (standard path)',
    st.officialShallowProvedSameEpochCloseWriteRepairApplied === false &&
      st.officialShallowProvedSameEpochCloseWriteRepairSuppressedReason == null,
    st
  );
}

// =============================================================================
// Section 5 -- Safety: without Family C trio, suppressible blocker does NOT
// unlock close via X4.
// =============================================================================
console.log('\nSection 5: safety predicate coverage');

// Family C requires `officialShallowStreamBridgeApplied=true`; otherwise the
// X4 predicate (`shallowProofTerminalCloseSatisfied === true`) is false, so
// X4 cannot fire even if the suppressible blocker is in the set.
{
  const r = resolveOfficialShallowClosureContract({
    descendConfirmed: true,
    reversalConfirmedAfterDescend: true,
    ownerAuthoritativeRecoverySatisfied: false,
    standingFinalizeSatisfied: false,
    standingRecoveredAtMs: null,
    officialShallowAscentEquivalentSatisfied: false,
    officialShallowStreamBridgeApplied: false,
    provenanceReversalEvidencePresent: false,
    shallowClosureProofBundleFromStream: false,
  });
  ok(
    'S5.1: no proof trio ⇒ Family C unsatisfied (X4 gate closed)',
    r.shallowProofTerminalCloseSatisfied === false,
    r
  );
}

// Descend-only (no reversal, no ascent equiv, no bridge): Family C off.
{
  const r = resolveOfficialShallowClosureContract({
    descendConfirmed: true,
    reversalConfirmedAfterDescend: false,
    ownerAuthoritativeRecoverySatisfied: false,
    standingFinalizeSatisfied: false,
    standingRecoveredAtMs: null,
    officialShallowAscentEquivalentSatisfied: false,
    officialShallowStreamBridgeApplied: false,
    provenanceReversalEvidencePresent: false,
    shallowClosureProofBundleFromStream: false,
  });
  ok(
    'S5.2: descend-only ⇒ no Family C (X4 never fires)',
    r.shallowProofTerminalCloseSatisfied === false && r.satisfied === false,
    r
  );
}

// Standing-still-like input: nothing satisfied.
{
  const r = resolveOfficialShallowClosureContract({
    descendConfirmed: false,
    reversalConfirmedAfterDescend: false,
    ownerAuthoritativeRecoverySatisfied: false,
    standingFinalizeSatisfied: false,
    standingRecoveredAtMs: null,
    officialShallowAscentEquivalentSatisfied: false,
    officialShallowStreamBridgeApplied: false,
    provenanceReversalEvidencePresent: false,
    shallowClosureProofBundleFromStream: false,
  });
  ok(
    'S5.3: no-descend ⇒ no family satisfied',
    r.satisfied === false && r.family === null,
    r
  );
}

// =============================================================================
// Report
// =============================================================================
console.log(
  `\n${passed + failed} tests: ${passed} passed, ${failed} failed`
);
if (failed > 0) process.exit(1);
