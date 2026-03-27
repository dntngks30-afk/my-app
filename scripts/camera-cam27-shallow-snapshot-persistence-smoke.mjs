/**
 * CAM-27 shallow snapshot persistence — hasShallowSquatObservation vs attempt evidence, observation shape
 *
 * npx tsx scripts/camera-cam27-shallow-snapshot-persistence-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { hasShallowSquatObservation, hasSquatAttemptEvidence } = await import(
  '../src/lib/camera/camera-success-diagnostic.ts'
);
const {
  buildSquatAttemptObservation,
  buildAttemptSnapshot,
} = await import('../src/lib/camera/camera-trace.ts');

let passed = 0;
let failed = 0;

function ok(name, cond, extra) {
  if (cond) {
    passed++;
    console.log(`  PASS: ${name}`);
  } else {
    failed++;
    console.error(`  FAIL: ${name}${extra !== undefined ? ` | ${JSON.stringify(extra)}` : ''}`);
    process.exitCode = 1;
  }
}

function forbiddenPayload(json) {
  const s = JSON.stringify(json);
  return ['"landmarks"', '"frames":', 'videoBlob'].some((x) => s.includes(x));
}

/** descend/recovery 플래그는 true인데 relativeDepthPeak 0·attempt 미충족 — 실기기 얕은 케이스 근사 */
function mockShallowMotionGateNoAttemptEvidence() {
  return {
    status: 'retry',
    progressionState: 'retry_required',
    completionSatisfied: false,
    nextAllowed: false,
    flags: [],
    reasons: [],
    failureReasons: ['rep_incomplete'],
    userGuidance: [],
    retryRecommended: true,
    evaluatorResult: {
      stepId: 'squat',
      metrics: [],
      debug: {
        highlightedMetrics: {
          relativeDepthPeak: 0,
          rawDepthPeak: 0,
          baselineStandingDepth: 0.35,
          attemptStarted: false,
          descendConfirmed: false,
          descentCount: 1,
          firstDescentIdx: -1,
          currentSquatPhase: 'ascending',
          completionMachinePhase: 'descending_candidate',
          evidenceLabel: 'insufficient_signal',
          completionBlockedReason: 'no_descend',
        },
      },
    },
    guardrail: {
      captureQuality: 'ok',
      flags: [],
      retryRecommended: false,
      completionStatus: 'partial',
      debug: { sampledFrameCount: 24, validFrameCount: 20 },
    },
    squatCycleDebug: {
      armingSatisfied: true,
      startPoseSatisfied: true,
      descendDetected: true,
      bottomDetected: false,
      recoveryDetected: true,
      ascendDetected: true,
      completionStatus: 'partial',
      depthBand: 'shallow',
      passBlockedReason: 'no_descend',
      attemptStarted: false,
      descendConfirmed: false,
      currentSquatPhase: 'ascending',
      completionBlockedReason: 'no_descend',
      evidenceLabel: 'insufficient_signal',
    },
    uiMessage: 'retry',
    autoAdvanceDelayMs: 0,
    passConfirmationSatisfied: false,
    passConfirmationFrameCount: 0,
    passConfirmationWindowCount: 0,
    finalPassEligible: false,
    finalPassBlockedReason: 'completion',
    confidence: 0.75,
  };
}

function mockIdleStandingGate() {
  const g = mockShallowMotionGateNoAttemptEvidence();
  g.squatCycleDebug = {
    ...g.squatCycleDebug,
    descendDetected: false,
    recoveryDetected: false,
    currentSquatPhase: 'idle',
  };
  g.evaluatorResult.debug.highlightedMetrics = {
    ...g.evaluatorResult.debug.highlightedMetrics,
    descentCount: 0,
    completionMachinePhase: 'idle',
  };
  return g;
}

console.log('\nA. Shallow motion below attempt-evidence threshold still has shallow observation contract');
{
  const gate = mockShallowMotionGateNoAttemptEvidence();
  ok('hasSquatAttemptEvidence false', !hasSquatAttemptEvidence(gate), gate);
  ok('hasShallowSquatObservation true', hasShallowSquatObservation(gate), gate);
  const obs = buildSquatAttemptObservation(gate, 'capture_session_terminal', {
    captureTerminalKind: 'gate_retry',
    shallowObservationContract: true,
  });
  ok('observation builds', obs != null, obs);
  ok('traceKind attempt_observation', obs?.traceKind === 'attempt_observation');
  ok('no privacy-heavy keys', !forbiddenPayload(obs));
  ok('motion flags preserved', obs?.motionDescendDetected === true && obs?.motionRecoveryDetected === true);
}

console.log('\nB. Terminal observation includes terminal kind + blocked reason');
{
  const gate = mockShallowMotionGateNoAttemptEvidence();
  const obs = buildSquatAttemptObservation(gate, 'shallow_observed', { shallowObservationContract: true });
  ok('shallow_observed event', obs?.eventType === 'shallow_observed');
  ok('completionBlockedReason passed through', obs?.completionBlockedReason === 'no_descend');
}

console.log('\nC. Pure idle-style gate — no shallow observation contract');
{
  const gate = mockIdleStandingGate();
  ok('hasShallowSquatObservation false', !hasShallowSquatObservation(gate), gate);
}

console.log('\nD. buildAttemptSnapshot unchanged for squat');
{
  const gate = mockShallowMotionGateNoAttemptEvidence();
  const snap = buildAttemptSnapshot('squat', gate, {
    state: 'ready',
    blocker: null,
    framingHint: null,
    smoothingApplied: false,
  });
  ok('snapshot exists', snap != null);
  ok('diagnosis shallowObservationEligible', snap?.diagnosisSummary?.squatCycle?.shallowObservationEligible === true);
}

console.log(`\nDone. passed=${passed} failed=${failed}`);
