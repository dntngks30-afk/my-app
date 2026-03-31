/**
 * PR-SQUAT-COMPLETION-REARCH-01 — Subcontract A smoke
 * npx tsx scripts/camera-squat-admission-contract-smoke.mjs
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const {
  computeSquatAttemptAdmission,
  deriveOfficialShallowCandidate,
  deriveOfficialShallowAdmission,
  evaluateSquatCompletionState,
  computeSquatSetupMotionBlock,
} = await import('../src/lib/camera/squat-completion-state.ts');

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

console.log('\ncamera-squat-admission-contract-smoke\n');

{
  const adm = computeSquatAttemptAdmission({
    armed: true,
    descendConfirmed: true,
    attemptAdmissionSatisfied: true,
    downwardCommitmentReached: true,
    committedFrame: { index: 5, depth: 0.1, timestampMs: 200, phaseHint: 'bottom' },
  });
  ok('admission: satisfied chain → no block', adm.admissionBlockedReason == null, adm);
  ok('admission: attemptStarted', adm.attemptStarted === true, adm);
}

{
  const adm = computeSquatAttemptAdmission({
    armed: false,
    descendConfirmed: true,
    attemptAdmissionSatisfied: true,
    downwardCommitmentReached: true,
    committedFrame: { index: 5, depth: 0.1, timestampMs: 200, phaseHint: 'bottom' },
  });
  ok('admission: not armed', adm.admissionBlockedReason === 'not_armed', adm);
}

{
  const bandLow = 'low_rom';
  ok(
    'derive candidate: shallow band + baseline',
    deriveOfficialShallowCandidate({
      baselineFrameCount: 6,
      attemptAdmissionSatisfied: true,
      standingRecoveryFinalizeBand: bandLow,
    }) === true
  );
  ok(
    'derive candidate: standard finalize band → false',
    deriveOfficialShallowCandidate({
      baselineFrameCount: 6,
      attemptAdmissionSatisfied: true,
      standingRecoveryFinalizeBand: 'standard',
    }) === false
  );
}

{
  ok(
    'derive admitted: all true',
    deriveOfficialShallowAdmission({
      officialShallowPathCandidate: true,
      armed: true,
      descendConfirmed: true,
      attemptStarted: true,
    }) === true
  );
  ok(
    'derive admitted: missing descend',
    deriveOfficialShallowAdmission({
      officialShallowPathCandidate: true,
      armed: true,
      descendConfirmed: false,
      attemptStarted: false,
    }) === false
  );
}

{
  const depths = [0.01, 0.01, 0.01, 0.01, 0.03, 0.05, 0.07, 0.09, 0.09, 0.07, 0.05, 0.03, 0.02, 0.01, 0.01];
  const phases = [
    'start', 'start', 'start', 'start', 'descent', 'descent', 'descent', 'bottom', 'bottom', 'ascent', 'ascent', 'ascent', 'start', 'start', 'start',
  ];
  let t = 100;
  const fr = depths.map((d, i) => makeFrame(d, (t += 80), phases[i]));
  const st = evaluateSquatCompletionState(fr);
  ok('integration: shallow candidate+admitted', st.officialShallowPathCandidate && st.officialShallowPathAdmitted, st);
}

{
  const standing = Array(12).fill(0.01);
  const fr = standing.map((d, i) => makeFrame(d, 100 + i * 50, 'start'));
  const st = evaluateSquatCompletionState(fr);
  ok('integration: standing-only no attempt start', st.attemptStarted === false, st);
}

{
  const many = Array(30)
    .fill(0)
    .map((_, i) => makeFrame(0.02 + (i % 3) * 0.001, 1000 + i * 40, 'start'));
  const { blocked } = computeSquatSetupMotionBlock(many);
  ok('setup motion helper returns boolean', typeof blocked === 'boolean', blocked);
}

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
