/**
 * PR-3 -- Official Shallow Admission Promotion.
 *
 * Smoke coverage for SSOT §4.2 admission rules:
 *   - admission does NOT depend on standard peak latch / standard frame span
 *     / standard standing hold / standard reversal streak
 *   - admission DOES depend on: candidate + armed + descent + intentional
 *     downward commitment + admission-level anti-false-pass guards clear
 *       (not setup_motion_blocked, not standing_still_or_jitter_only,
 *        not seated_hold_without_descent)
 *   - admission is not closure and does not grant pass
 *
 * Run:
 *   npx tsx scripts/camera-pr-cam-squat-official-shallow-admission-promotion-03-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const {
  resolveOfficialShallowAdmissionContract,
  deriveOfficialShallowAdmission,
} = await import('../src/lib/camera/squat/squat-completion-core.ts');

const {
  readOfficialShallowAdmissionSnapshot,
  readOfficialShallowFalsePassGuardSnapshot,
} = await import('../src/lib/camera/squat/squat-progression-contract.ts');

let passed = 0;
let failed = 0;

function ok(name, cond, extra) {
  if (cond) {
    passed++;
    console.log(`  PASS: ${name}`);
    return;
  }
  failed++;
  console.error(`  FAIL: ${name}`, extra !== undefined ? JSON.stringify(extra) : '');
  process.exitCode = 1;
}

function admissionInput(overrides = {}) {
  return {
    officialShallowPathCandidate: true,
    armed: true,
    descendConfirmed: true,
    attemptStarted: true,
    officialShallowDescentEvidenceForAdmission: true,
    naturalArmed: false,
    hmmArmingAssistApplied: false,
    pr03OfficialShallowArming: true,
    setupMotionBlocked: false,
    attemptAdmissionSatisfied: true,
    downwardCommitmentDelta: 0.04,
    ...overrides,
  };
}

console.log('\nPR-3 official shallow admission promotion smoke\n');

// --- Baseline: legitimate shallow rep is promoted to admission -------------
{
  const r = resolveOfficialShallowAdmissionContract(admissionInput());
  ok('A1: legitimate shallow rep is admitted', r.admitted === true, r);
  ok('A1: admission reason reflects PR-3 contract', r.reason === 'pr03_official_shallow_contract', r);
  ok('A1: no admission guard family', r.admissionGuardFamily === null, r);
  ok('A1: no blocked reason when admitted', r.blockedReason === null, r);
}

// --- Admission is NOT closure / does not grant pass ------------------------
{
  // Admission is a structural recognition stage. Candidate=true + admitted=true
  // must be achievable without anything closure / owner-pass related being
  // satisfied. This smoke enforces that invariant at the admission-contract
  // surface itself (pass/closure are evaluated elsewhere).
  const r = resolveOfficialShallowAdmissionContract(admissionInput());
  ok('A2: admission surface has only admission fields', 'admitted' in r && 'candidate' in r && !('completionPassReason' in r) && !('officialShallowPathClosed' in r), Object.keys(r));
}

// --- Classic natural-arming path reason ------------------------------------
{
  const r = resolveOfficialShallowAdmissionContract(
    admissionInput({
      pr03OfficialShallowArming: false,
      naturalArmed: true,
    })
  );
  ok('A3: natural-arming admission reason', r.admitted === true && r.reason === 'classic_start_before_bottom', r);
}

// --- HMM arming assist reason ----------------------------------------------
{
  const r = resolveOfficialShallowAdmissionContract(
    admissionInput({
      pr03OfficialShallowArming: false,
      naturalArmed: false,
      hmmArmingAssistApplied: true,
    })
  );
  ok('A4: hmm-assist admission reason', r.admitted === true && r.reason === 'hmm_arming_assist', r);
}

// --- Admission guard family: setup_motion_blocked --------------------------
{
  const r = resolveOfficialShallowAdmissionContract(
    admissionInput({ setupMotionBlocked: true })
  );
  ok('B1: setup motion blocks admission', r.admitted === false, r);
  ok('B1: family=setup_motion_blocked', r.admissionGuardFamily === 'setup_motion_blocked', r);
  ok(
    'B1: blockedReason surfaces admission-guard label',
    r.blockedReason === 'official_shallow_admission_guard:setup_motion_blocked',
    r
  );
}

// --- Admission guard family: standing_still_or_jitter_only -----------------
{
  const r = resolveOfficialShallowAdmissionContract(
    admissionInput({ attemptAdmissionSatisfied: false })
  );
  ok('B2: standing-still/jitter blocks admission', r.admitted === false, r);
  ok('B2: family=standing_still_or_jitter_only', r.admissionGuardFamily === 'standing_still_or_jitter_only', r);
}

// --- Admission guard family: seated_hold_without_descent -------------------
{
  const r = resolveOfficialShallowAdmissionContract(
    admissionInput({ downwardCommitmentDelta: 0 })
  );
  ok('B3: seated hold without descent blocks admission', r.admitted === false, r);
  ok('B3: family=seated_hold_without_descent', r.admissionGuardFamily === 'seated_hold_without_descent', r);
}

// --- Admission does NOT depend on standard peak latch / span / standing hold
// --- / standard reversal streak --------------------------------------------
{
  // Absence of all of: peakLatchedAtIndex, standard frame span, standing hold,
  // reversal streak information is *not* an input at all for the admission
  // contract. The contract only takes structural readiness + anti-false-pass
  // guards. Exercising that invariant by admitting with a minimal input set.
  const r = resolveOfficialShallowAdmissionContract(admissionInput());
  ok('C1: admission independent of peak-latch surface', r.admitted === true, r);

  // Structural derivation (independent of PR-3 guards) stays admitted even
  // when no peak latch / span / standing-hold info is present.
  const structural = deriveOfficialShallowAdmission({
    officialShallowPathCandidate: true,
    armed: true,
    descendConfirmed: true,
    attemptStarted: true,
  });
  ok('C2: structural admission ignores peak-latch / span', structural === true);
}

// --- Structural upstream block: candidate=false surfaces no reason ---------
{
  const r = resolveOfficialShallowAdmissionContract(
    admissionInput({ officialShallowPathCandidate: false })
  );
  ok('D1: no candidate -> not admitted', r.admitted === false, r);
  ok('D1: no candidate -> no reason', r.reason === null, r);
  ok('D1: no candidate -> no blocked reason', r.blockedReason === null, r);
}

// --- Structural block: armed=false uses descent-evidence branch ------------
{
  const r = resolveOfficialShallowAdmissionContract(
    admissionInput({ armed: false, officialShallowDescentEvidenceForAdmission: true })
  );
  ok('D2: armed=false with evidence -> not_armed', r.admitted === false && r.blockedReason === 'not_armed', r);
}

{
  const r = resolveOfficialShallowAdmissionContract(
    admissionInput({
      armed: false,
      officialShallowDescentEvidenceForAdmission: false,
    })
  );
  ok(
    'D3: armed=false without evidence -> official_shallow_pending_descent_evidence',
    r.admitted === false &&
      r.blockedReason === 'official_shallow_pending_descent_evidence',
    r
  );
}

// --- Snapshot mirrors admission contract -----------------------------------
{
  const snapshot = readOfficialShallowAdmissionSnapshot({
    squatCompletionState: {
      officialShallowPathCandidate: true,
      officialShallowPathAdmitted: true,
      officialShallowPathReason: 'pr03_official_shallow_contract',
      officialShallowPathBlockedReason: null,
      officialShallowPathAdmissionGuardFamily: null,
    },
  });
  ok('E1: snapshot candidate', snapshot.officialShallowAdmissionCandidate === true, snapshot);
  ok('E1: snapshot admitted', snapshot.officialShallowAdmissionAdmitted === true, snapshot);
  ok('E1: snapshot reason', snapshot.officialShallowAdmissionReason === 'pr03_official_shallow_contract', snapshot);
  ok('E1: snapshot guard family null', snapshot.officialShallowAdmissionGuardFamily === null, snapshot);
}

{
  const snapshot = readOfficialShallowAdmissionSnapshot({
    squatCompletionState: {
      officialShallowPathCandidate: true,
      officialShallowPathAdmitted: false,
      officialShallowPathReason: null,
      officialShallowPathBlockedReason:
        'official_shallow_admission_guard:seated_hold_without_descent',
      officialShallowPathAdmissionGuardFamily: 'seated_hold_without_descent',
    },
  });
  ok(
    'E2: snapshot surfaces admission guard family',
    snapshot.officialShallowAdmissionGuardFamily === 'seated_hold_without_descent',
    snapshot
  );
  ok(
    'E2: snapshot surfaces admission blocked reason',
    snapshot.officialShallowAdmissionBlockedReason ===
      'official_shallow_admission_guard:seated_hold_without_descent',
    snapshot
  );
}

// --- Admission does not weaken downstream false-pass guard -----------------
{
  // Even if admission admits a rep, the PR-2 false-pass guard is still the
  // downstream gate for pass. Here we wire an admitted-but-not-closed state
  // through the false-pass guard and confirm it still gates pass via
  // `officialShallowPathClosed !== true`.
  const guard = readOfficialShallowFalsePassGuardSnapshot({
    squatCompletionState: {
      officialShallowPathCandidate: true,
      officialShallowPathAdmitted: true,
      officialShallowPathClosed: false,
    },
  });
  ok(
    'F1: admission does not auto-clear false-pass guard (closure still required)',
    guard.officialShallowFalsePassGuardClear === false,
    guard
  );
}

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
