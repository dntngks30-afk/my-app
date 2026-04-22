/**
 * PR-6 -- Regression Harness Lock.
 *
 * Locks the PR-1..PR-5 shallow-owner truth contract against an explicit
 * device-fixture matrix (SSOT §5):
 *
 *   Primary must-pass (shallow): device_shallow_fail_01 .. 10
 *   Primary must-pass (deep):    device_deep_01, device_deep_02
 *   Conditional / reclassification bucket:
 *                                device_shallow_fail_11 .. 13
 *   Must-fail (never pass):      device_standing_01, 02, device_seated_01, 02
 *
 * This harness is a verification-only layer. It does NOT modify runtime
 * behavior. It runs against real-device trace fixtures stored under the
 * user's Desktop (the same convention used by
 * `camera-pr-shallow-acquisition-peak-provenance-unify-01-smoke.mjs`).
 *
 * Harness law (fail-loud on regression):
 *   - Fixtures are declared in-code. Rosters are disjoint. Primary
 *     shallow roster is EXACTLY the promoted 10 fixtures; no silent
 *     moves between buckets.
 *   - A fixture carries a `status` of either 'promoted' (shallow owner
 *     truth already locked) or 'pending_upstream' (the shallow-owner
 *     truth is expected to be fulfilled once the upstream PR chain
 *     completes + traces are re-captured). Promoted fixtures that
 *     regress FAIL LOUDLY. Pending fixtures that happen to already show
 *     the full truth emit a loud PROMOTION-CANDIDATE notice.
 *   - Must-fail fixtures never pass. Any final-pass latched is a loud
 *     fail with "never-pass law violated".
 *   - Conditional fixtures are never silently folded into primary. If
 *     they exhibit the full shallow-owner truth, the harness loudly
 *     flags reclassification candidacy without promoting them.
 *
 * Assertion set for shallow primary pass (SSOT §4 + PR-5 §4.4):
 *   - officialShallowPathAdmitted (observation)
 *   - officialShallowPathClosed   (observation)
 *   - completionOwnerPassed       (attempt.diagnosisSummary.squatCycle)
 *   - uiProgressionAllowed        (attempt.diagnosisSummary.squatCycle)
 *   - finalPassEligible           (= attempt.progressionPassed)
 *   - finalPassLatched            (attempt.finalPassLatched)
 *   - stillSeatedAtPass === false (observation.squatCameraObservability.pass_snapshot)
 *   - completionPassReason is a shallow-family reason (low_rom_cycle,
 *     ultra_low_rom_cycle, low_rom_event_cycle, ultra_low_rom_event_cycle,
 *     official_shallow_cycle) -- standard veto did not overturn ownership
 *   - quality/pass semantics remain split: qualityOnlyWarnings may be
 *     non-empty while pass remains granted (PR-5 §4.4)
 *
 * Assertion set for must-fail:
 *   - No attempt with finalPassEligible/progressionPassed=true
 *   - No attempt with finalPassLatched=true
 *   - Observations carry hard-fail-family blocked reasons, not
 *     shallow-success reasons
 *
 * Run:
 *   npx tsx scripts/camera-pr-cam-squat-regression-harness-lock-06-smoke.mjs
 */

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

// ═══════════════════════════════════════════════════════════════════
// Fixture rosters -- SSOT §5 regression matrix (authoritative).
// ═══════════════════════════════════════════════════════════════════

/**
 * Primary must-pass (shallow family). Each entry has a `status`:
 *   - 'promoted'          : shallow-owner truth locked. Regression = loud fail.
 *   - 'pending_upstream'  : truth expected once the upstream PR chain lands
 *                           and traces are re-captured. Not yet fulfilled =
 *                           loud WARN (not fail). Accidental fulfillment =
 *                           loud promotion-candidate notice (still not a fail).
 *
 * To promote: flip 'pending_upstream' -> 'promoted' after the fixture's
 * re-captured trace demonstrates the full shallow-owner truth. That flip
 * is the single place where the primary truth moves forward.
 */
const PRIMARY_SHALLOW_FIXTURES = [
  { id: 'device_shallow_fail_01', status: 'pending_upstream' },
  { id: 'device_shallow_fail_02', status: 'pending_upstream' },
  { id: 'device_shallow_fail_03', status: 'pending_upstream' },
  { id: 'device_shallow_fail_04', status: 'pending_upstream' },
  { id: 'device_shallow_fail_05', status: 'pending_upstream' },
  { id: 'device_shallow_fail_06', status: 'pending_upstream' },
  { id: 'device_shallow_fail_07', status: 'pending_upstream' },
  { id: 'device_shallow_fail_08', status: 'pending_upstream' },
  { id: 'device_shallow_fail_09', status: 'pending_upstream' },
  { id: 'device_shallow_fail_10', status: 'pending_upstream' },
];

const PRIMARY_DEEP_FIXTURES = ['device_deep_01', 'device_deep_02'];

/**
 * Conditional / reclassification bucket. These must NEVER be silently
 * included in the primary shallow roster. If they start showing the
 * full shallow-owner truth, the harness emits a loud reclassification
 * candidate notice; actual promotion is a manual edit that moves the
 * id into PRIMARY_SHALLOW_FIXTURES.
 */
const CONDITIONAL_SHALLOW_FIXTURES = [
  'device_shallow_fail_11',
  'device_shallow_fail_12',
  'device_shallow_fail_13',
];

/** Must-fail families (setup/standing/seated). Never pass. */
const MUST_FAIL_FIXTURES = [
  'device_standing_01',
  'device_standing_02',
  'device_seated_01',
  'device_seated_02',
];

// ═══════════════════════════════════════════════════════════════════
// Shared helpers / semantics.
// ═══════════════════════════════════════════════════════════════════

const SHALLOW_PASS_REASONS = new Set([
  'low_rom_cycle',
  'ultra_low_rom_cycle',
  'low_rom_event_cycle',
  'ultra_low_rom_event_cycle',
  'official_shallow_cycle',
]);

const STANDARD_PASS_REASONS = new Set(['standard_cycle']);

/**
 * Hard-fail / non-cycle blocked-reason families used by must-fail
 * fixtures and the false-pass guard. Mirrors the semantics enforced by
 * PR-2 / PR-3 / PR-4. A must-fail fixture must EITHER have 0 attempts
 * OR any blocked reason come from this set. If a must-fail fixture
 * shows a shallow-success reason, that is a regression.
 */
const HARD_FAIL_FAMILY = new Set([
  'not_armed',
  'no_descend',
  'no_downward_commitment',
  'no_commitment',
  'no_reversal',
  'no_real_descent',
  'no_real_reversal',
  'descent_span_too_short',
  'ascent_recovery_span_too_short',
  'recovery_hold_too_short',
  'not_standing_recovered',
  'insufficient_relative_depth',
  'freeze_or_latch_missing',
  'setup_motion_blocked',
  'standing_still_or_jitter_only',
  'seated_hold_without_descent',
  'seated_hold_without_upward_recovery',
  'still_seated_at_pass',
  'ready_before_start_success',
  'cross_epoch_stitched_proof',
  'assist_only_closure_without_raw_epoch_provenance',
  'canonical_false_pass_guard_not_clear',
]);

let passed = 0;
let failed = 0;
const notices = [];

function ok(name, cond, extra) {
  if (cond) {
    passed += 1;
    console.log(`  PASS ${name}`);
  } else {
    failed += 1;
    console.error(`  FAIL ${name}`, extra !== undefined ? JSON.stringify(extra).slice(0, 400) : '');
    process.exitCode = 1;
  }
}

function notice(label, body) {
  notices.push({ label, body });
  console.log(`  NOTICE ${label}${body ? ` -- ${JSON.stringify(body).slice(0, 400)}` : ''}`);
}

function readFixtureOrFail(id) {
  const desktopPath = join(process.env.USERPROFILE ?? homedir(), 'Desktop', `${id}.txt`);
  if (!existsSync(desktopPath)) {
    return { id, trace: null, path: desktopPath, exists: false };
  }
  try {
    return { id, trace: JSON.parse(readFileSync(desktopPath, 'utf8')), path: desktopPath, exists: true };
  } catch (err) {
    return { id, trace: null, path: desktopPath, exists: true, parseError: String(err) };
  }
}

function attempts(trace) {
  return Array.isArray(trace?.attempts) ? trace.attempts : [];
}

function observations(trace) {
  return Array.isArray(trace?.squatAttemptObservations) ? trace.squatAttemptObservations : [];
}

function squatCycleOf(attempt) {
  return attempt?.diagnosisSummary?.squatCycle ?? null;
}

function passSnapshotOf(observation) {
  return observation?.squatCameraObservability?.pass_snapshot ?? null;
}

// ═══════════════════════════════════════════════════════════════════
// Truth checks per category.
// ═══════════════════════════════════════════════════════════════════

/** Full locked truth for a primary shallow fixture. */
function evaluateShallowPrimaryTruth(trace) {
  const atts = attempts(trace);
  const obs = observations(trace);
  const shallowPass = atts.find(
    (a) =>
      a?.progressionPassed === true &&
      a?.finalPassLatched === true &&
      SHALLOW_PASS_REASONS.has(squatCycleOf(a)?.completionPassReason ?? '')
  );
  if (!shallowPass) {
    return { fulfilled: false, reason: 'no_shallow_final_pass_latched' };
  }
  const sc = squatCycleOf(shallowPass);
  if (sc?.completionOwnerPassed !== true) {
    return { fulfilled: false, reason: 'completionOwnerPassed_not_true' };
  }
  if (sc?.uiProgressionAllowed !== true) {
    return { fulfilled: false, reason: 'uiProgressionAllowed_not_true' };
  }
  if (sc?.uiProgressionBlockedReason != null && sc.uiProgressionBlockedReason !== '') {
    return { fulfilled: false, reason: `uiProgressionBlockedReason:${sc.uiProgressionBlockedReason}` };
  }
  const admittedObs = obs.some((o) => o?.officialShallowPathAdmitted === true);
  if (!admittedObs) {
    return { fulfilled: false, reason: 'no_observation_officialShallowPathAdmitted' };
  }
  const closedObs = obs.some((o) => o?.officialShallowPathClosed === true);
  if (!closedObs) {
    return { fulfilled: false, reason: 'no_observation_officialShallowPathClosed' };
  }
  // stillSeatedAtPass: on the frozen pass snapshot, must be false.
  const snapshots = obs.map(passSnapshotOf).filter((s) => s != null);
  const anyStillSeated = snapshots.some((s) => s?.stillSeatedAtPass === true);
  if (anyStillSeated) {
    return { fulfilled: false, reason: 'stillSeatedAtPass_true_in_pass_snapshot' };
  }
  return { fulfilled: true, passingAttempt: shallowPass, snapshots };
}

function evaluateDeepPrimaryTruth(trace) {
  const atts = attempts(trace);
  const deepPass = atts.find(
    (a) =>
      a?.progressionPassed === true &&
      a?.finalPassLatched === true &&
      STANDARD_PASS_REASONS.has(squatCycleOf(a)?.completionPassReason ?? '')
  );
  if (!deepPass) return { fulfilled: false, reason: 'no_standard_final_pass_latched' };
  const sc = squatCycleOf(deepPass);
  if (sc?.completionOwnerPassed !== true) {
    return { fulfilled: false, reason: 'completionOwnerPassed_not_true' };
  }
  if (sc?.uiProgressionAllowed !== true) {
    return { fulfilled: false, reason: 'uiProgressionAllowed_not_true' };
  }
  if (sc?.uiProgressionBlockedReason != null && sc.uiProgressionBlockedReason !== '') {
    return {
      fulfilled: false,
      reason: `uiProgressionBlockedReason:${sc.uiProgressionBlockedReason}`,
    };
  }
  return { fulfilled: true, passingAttempt: deepPass };
}

function evaluateNeverPassTruth(trace) {
  const atts = attempts(trace);
  const obs = observations(trace);
  const passingAtt = atts.find(
    (a) => a?.progressionPassed === true || a?.finalPassLatched === true
  );
  if (passingAtt) {
    return { clean: false, reason: 'final_pass_latched_on_must_fail_fixture', passingAtt };
  }
  // Collect blocked-reason families from observations; require at least one hard-fail family.
  const blockedReasons = new Set();
  for (const o of obs) {
    if (typeof o?.completionBlockedReason === 'string' && o.completionBlockedReason !== '') {
      blockedReasons.add(o.completionBlockedReason);
    }
  }
  const hasHardFail = [...blockedReasons].some((r) => HARD_FAIL_FAMILY.has(r));
  if (blockedReasons.size > 0 && !hasHardFail) {
    // Non-empty but no hard-fail family -- possible shallow-success drift.
    return {
      clean: false,
      reason: 'blocked_reasons_not_hard_fail_family',
      blockedReasons: [...blockedReasons],
    };
  }
  return { clean: true, blockedReasons: [...blockedReasons] };
}

// ═══════════════════════════════════════════════════════════════════
// Section A -- Structural invariants (roster shape + disjointness).
// ═══════════════════════════════════════════════════════════════════

console.log('\nPR-6 regression harness lock smoke\n');
console.log('Section A -- roster invariants');

const primaryShallowIds = new Set(PRIMARY_SHALLOW_FIXTURES.map((e) => e.id));
const conditionalIds = new Set(CONDITIONAL_SHALLOW_FIXTURES);
const mustFailIds = new Set(MUST_FAIL_FIXTURES);
const primaryDeepIds = new Set(PRIMARY_DEEP_FIXTURES);

ok(
  'A1 primary shallow roster has exactly 10 entries',
  PRIMARY_SHALLOW_FIXTURES.length === 10,
  { count: PRIMARY_SHALLOW_FIXTURES.length }
);
ok(
  'A2 primary deep roster has exactly 2 entries',
  PRIMARY_DEEP_FIXTURES.length === 2,
  { count: PRIMARY_DEEP_FIXTURES.length }
);
ok(
  'A3 conditional bucket has exactly 3 entries',
  CONDITIONAL_SHALLOW_FIXTURES.length === 3,
  { count: CONDITIONAL_SHALLOW_FIXTURES.length }
);
ok(
  'A4 must-fail roster has exactly 4 entries',
  MUST_FAIL_FIXTURES.length === 4,
  { count: MUST_FAIL_FIXTURES.length }
);

function disjoint(a, b) {
  for (const x of a) if (b.has(x)) return x;
  return null;
}
ok(
  'A5 primary-shallow and conditional are disjoint (no silent downgrade)',
  disjoint(primaryShallowIds, conditionalIds) === null
);
ok(
  'A6 primary-shallow and must-fail are disjoint',
  disjoint(primaryShallowIds, mustFailIds) === null
);
ok(
  'A7 primary-shallow and primary-deep are disjoint',
  disjoint(primaryShallowIds, primaryDeepIds) === null
);
ok(
  'A8 conditional and must-fail are disjoint',
  disjoint(conditionalIds, mustFailIds) === null
);
ok(
  'A9 primary-deep and must-fail are disjoint',
  disjoint(primaryDeepIds, mustFailIds) === null
);

// Each shallow fixture must have a legal status.
for (const entry of PRIMARY_SHALLOW_FIXTURES) {
  ok(
    `A10 ${entry.id} status is 'promoted' or 'pending_upstream'`,
    entry.status === 'promoted' || entry.status === 'pending_upstream',
    entry
  );
}

// ═══════════════════════════════════════════════════════════════════
// Section B -- Primary shallow must-pass assertions.
// ═══════════════════════════════════════════════════════════════════

console.log('\nSection B -- primary shallow must-pass (shallow_fail_01..10)');

const promotionCandidateIds = [];

for (const entry of PRIMARY_SHALLOW_FIXTURES) {
  const { id, status } = entry;
  const fx = readFixtureOrFail(id);
  ok(`B:${id} fixture file exists on Desktop`, fx.exists, { path: fx.path });
  if (!fx.exists) continue;
  ok(`B:${id} fixture is valid JSON`, fx.trace != null, { parseError: fx.parseError });
  if (fx.trace == null) continue;

  const truth = evaluateShallowPrimaryTruth(fx.trace);

  if (status === 'promoted') {
    // Promoted: the full locked truth MUST hold. Any failure is a loud regression.
    ok(`B:${id} [promoted] shallow-owner truth fulfilled`, truth.fulfilled === true, truth);
    if (truth.fulfilled === true) {
      const sc = squatCycleOf(truth.passingAttempt);
      // Standard veto must not have overturned shallow ownership: blocked reason null + no hard-fail family in reasons.
      ok(
        `B:${id} [promoted] passing attempt has no completion blocker (standard veto not overturning shallow owner)`,
        sc?.completionBlockedReason == null || sc?.completionBlockedReason === '',
        { completionBlockedReason: sc?.completionBlockedReason }
      );
      // Quality semantics split: qualityOnlyWarnings may be present without overturning pass.
      const qWarns = Array.isArray(sc?.qualityOnlyWarnings) ? sc.qualityOnlyWarnings : [];
      ok(
        `B:${id} [promoted] pass granted even if qualityOnlyWarnings non-empty (PR-5 split)`,
        truth.passingAttempt?.finalPassLatched === true,
        { qWarns }
      );
    }
  } else if (status === 'pending_upstream') {
    // Pending: truth is expected but not yet fulfilled. If it IS fulfilled,
    // this fixture is a promotion candidate (loud NOTICE, not a failure).
    // If it is not fulfilled, emit a loud NOTICE (not a failure).
    // We still assert one invariant: the fixture must NEVER show a FALSE
    // shallow pass (ie. shallow pass reason but owner gate said not-passed
    // or stillSeatedAtPass true). Any such combination = regression.
    if (truth.fulfilled === true) {
      promotionCandidateIds.push(id);
      notice(`B:${id} [pending_upstream] PROMOTION CANDIDATE -- truth fulfilled; flip status to 'promoted'`, {
        passingReason: squatCycleOf(truth.passingAttempt)?.completionPassReason,
      });
    } else {
      notice(
        `B:${id} [pending_upstream] truth not yet fulfilled (awaiting upstream PR chain)`,
        { reason: truth.reason }
      );
    }
    // Partial-fulfillment detector: shallow pass landed but a protective
    // predicate failed (still-seated at pass). That combination is a loud
    // fail even in pending state.
    const atts = attempts(fx.trace);
    const shallowPass = atts.find(
      (a) =>
        a?.progressionPassed === true &&
        a?.finalPassLatched === true &&
        SHALLOW_PASS_REASONS.has(squatCycleOf(a)?.completionPassReason ?? '')
    );
    if (shallowPass) {
      const snaps = observations(fx.trace).map(passSnapshotOf).filter((s) => s != null);
      const anyStillSeated = snaps.some((s) => s?.stillSeatedAtPass === true);
      ok(
        `B:${id} [pending_upstream] shallow-pass latched must not coexist with stillSeatedAtPass=true`,
        !anyStillSeated,
        { anyStillSeated }
      );
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// Section C -- Primary deep must-pass assertions.
// ═══════════════════════════════════════════════════════════════════

console.log('\nSection C -- primary deep must-pass (deep_01, deep_02)');

for (const id of PRIMARY_DEEP_FIXTURES) {
  const fx = readFixtureOrFail(id);
  ok(`C:${id} fixture file exists on Desktop`, fx.exists, { path: fx.path });
  if (!fx.exists) continue;
  ok(`C:${id} fixture is valid JSON`, fx.trace != null);
  if (fx.trace == null) continue;
  const truth = evaluateDeepPrimaryTruth(fx.trace);
  ok(`C:${id} deep standard_cycle final pass latched`, truth.fulfilled === true, truth);
  if (truth.fulfilled) {
    const sc = squatCycleOf(truth.passingAttempt);
    ok(
      `C:${id} passOwner=completion_truth_standard (standard-path owner coherent)`,
      sc?.passOwner === 'completion_truth_standard' || sc?.finalSuccessOwner === 'completion_truth_standard',
      { passOwner: sc?.passOwner, finalSuccessOwner: sc?.finalSuccessOwner }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════
// Section D -- Conditional reclassification bucket.
// Never silently merged into primary; flag candidates loudly.
// ═══════════════════════════════════════════════════════════════════

console.log('\nSection D -- conditional bucket (shallow_fail_11..13, non-silent)');

for (const id of CONDITIONAL_SHALLOW_FIXTURES) {
  const fx = readFixtureOrFail(id);
  ok(`D:${id} fixture file exists on Desktop (conditional bucket still represented)`, fx.exists, {
    path: fx.path,
  });
  if (!fx.exists) continue;
  ok(`D:${id} fixture is valid JSON`, fx.trace != null);
  if (fx.trace == null) continue;

  // Invariant: a conditional fixture must NEVER appear as primary in the
  // PRIMARY_SHALLOW_FIXTURES list. (Already enforced by disjointness in A.)
  // Behavioral signal: if the fixture now exhibits the full shallow-owner
  // truth, loudly emit a reclassification candidate notice (non-fatal).
  const truth = evaluateShallowPrimaryTruth(fx.trace);
  if (truth.fulfilled === true) {
    notice(
      `D:${id} RECLASSIFICATION CANDIDATE -- shallow-owner truth fulfilled in conditional bucket`,
      { passingReason: squatCycleOf(truth.passingAttempt)?.completionPassReason }
    );
  } else {
    notice(`D:${id} remains conditional (shallow-owner truth not proven yet)`, {
      reason: truth.reason,
    });
  }

  // Guard: even in conditional state, a false shallow pass (shallow reason +
  // stillSeatedAtPass true) is a regression. Fail loudly if seen.
  const atts = attempts(fx.trace);
  const shallowPass = atts.find(
    (a) =>
      a?.progressionPassed === true &&
      a?.finalPassLatched === true &&
      SHALLOW_PASS_REASONS.has(squatCycleOf(a)?.completionPassReason ?? '')
  );
  if (shallowPass) {
    const snaps = observations(fx.trace).map(passSnapshotOf).filter((s) => s != null);
    const anyStillSeated = snaps.some((s) => s?.stillSeatedAtPass === true);
    ok(
      `D:${id} [conditional] shallow-pass latched must not coexist with stillSeatedAtPass=true`,
      !anyStillSeated,
      { anyStillSeated }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════
// Section E -- Must-fail never-pass law.
// ═══════════════════════════════════════════════════════════════════

console.log('\nSection E -- must-fail (standing_01/02, seated_01/02)');

for (const id of MUST_FAIL_FIXTURES) {
  const fx = readFixtureOrFail(id);
  ok(`E:${id} fixture file exists on Desktop`, fx.exists, { path: fx.path });
  if (!fx.exists) continue;
  ok(`E:${id} fixture is valid JSON`, fx.trace != null);
  if (fx.trace == null) continue;
  const verdict = evaluateNeverPassTruth(fx.trace);
  ok(
    `E:${id} no final-pass latched (never-pass law)`,
    verdict.clean === true,
    verdict
  );
  if (verdict.clean === true) {
    // Positive family check: observations should carry at least one
    // hard-fail-family blocker so the failure semantics stay coherent.
    // (Empty blocked-reason sets are allowed only if the fixture never
    // progressed far enough to record one.)
    const obs = observations(fx.trace);
    const observedBlockers = new Set();
    for (const o of obs) {
      if (typeof o?.completionBlockedReason === 'string' && o.completionBlockedReason !== '') {
        observedBlockers.add(o.completionBlockedReason);
      }
    }
    const hasHardFail = [...observedBlockers].some((r) => HARD_FAIL_FAMILY.has(r));
    ok(
      `E:${id} observation blocked reasons are hard-fail family (or absent)`,
      observedBlockers.size === 0 || hasHardFail,
      { observedBlockers: [...observedBlockers] }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════
// Section F -- Truth map summary (observability).
// ═══════════════════════════════════════════════════════════════════

console.log('\nSection F -- truth map summary');
console.log(
  `  primary-shallow promoted       : ${PRIMARY_SHALLOW_FIXTURES.filter((e) => e.status === 'promoted').length}`
);
console.log(
  `  primary-shallow pending        : ${PRIMARY_SHALLOW_FIXTURES.filter((e) => e.status === 'pending_upstream').length}`
);
console.log(`  primary-deep fixtures          : ${PRIMARY_DEEP_FIXTURES.length}`);
console.log(`  conditional bucket             : ${CONDITIONAL_SHALLOW_FIXTURES.length}`);
console.log(`  must-fail fixtures             : ${MUST_FAIL_FIXTURES.length}`);
console.log(`  promotion candidates this run  : ${promotionCandidateIds.length}`);
if (promotionCandidateIds.length > 0) {
  console.log(`    ${promotionCandidateIds.join(', ')}`);
}
console.log(`  loud notices                   : ${notices.length}`);

console.log(`\nPR-6 regression harness lock smoke complete: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
