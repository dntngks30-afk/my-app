/**
 * PR-OH-OBS-BLOCKER-TRACE-02C: overhead blocker trace + cue snapshot fields (observability only).
 * Run: npx tsx scripts/camera-oh-obs-blocker-trace-02c-smoke.mjs
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const {
  resolveOverheadReadinessFramingHint,
  computeOverheadEvaluationWindowFramingOnly,
  getSetupFramingHint,
} = await import('../src/lib/camera/setup-framing.ts');
const { getLiveReadinessSummary, getPrimaryReadinessBlocker } = await import(
  '../src/lib/camera/live-readiness.ts'
);
const {
  buildOverheadReadinessBlockerTracePayload,
  deriveDisplayedPrimaryBlockerSource,
} = await import('../src/lib/camera/overhead/overhead-readiness-blocker-trace.ts');

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

function mockLandmark(x, y, visibility = 0.9) {
  return { x, y, visibility };
}

function goodFramingOverheadPose(timestamp) {
  const lm = Array(33)
    .fill(null)
    .map((_, j) =>
      mockLandmark(0.28 + (j % 11) * 0.035, 0.14 + Math.floor(j / 11) * 0.11, 0.9)
    );
  lm[11] = mockLandmark(0.38, 0.22, 0.9);
  lm[12] = mockLandmark(0.62, 0.22, 0.9);
  return { landmarks: lm, timestamp };
}

function fullBleedPose(timestamp) {
  const lm = Array(33)
    .fill(null)
    .map((_, j) =>
      mockLandmark(0.02 + (j % 11) * 0.096, 0.02 + Math.floor(j / 11) * 0.48, 0.9)
    );
  return { landmarks: lm, timestamp };
}

const MOCK_GUARDRAIL = {
  captureQuality: 'good',
  flags: [],
  debug: {
    validFrameCount: 20,
    visibleJointsRatio: 0.82,
    criticalJointsAvailability: 1,
    ankleYMean: 0.6,
  },
};

console.log('PR-OH-OBS-BLOCKER-TRACE-02C smoke\n');

// 1) Blocker-source trace: eval vs tail primaries differ under tail contamination
const W0 = 1000;
const W1 = 2200;
const goodInWindow = Array.from({ length: 20 }, (_, i) => {
  const p = goodFramingOverheadPose(W0 + i * 45);
  return { landmarks: p.landmarks, timestamp: p.timestamp };
});
const badTail = Array.from({ length: 12 }, (_, i) => {
  const p = fullBleedPose(9000 + i * 50);
  return { landmarks: p.landmarks, timestamp: p.timestamp };
});
const combined = [...goodInWindow, ...badTail];

const resolved = resolveOverheadReadinessFramingHint({
  landmarks: combined,
  windowStartMs: W0,
  windowEndMs: W1,
});
const ewOnly = computeOverheadEvaluationWindowFramingOnly({
  landmarks: combined,
  windowStartMs: W0,
  windowEndMs: W1,
});

ok('1a evaluationWindowApplied when window valid', resolved.evaluationWindowApplied === true);
ok('1b computeOverheadEvaluationWindowFramingOnly matches window hint', ewOnly.hint === resolved.evaluationWindowFramingHintOnly);

const tailHint = getSetupFramingHint(combined);
const summaryDisplayed = getLiveReadinessSummary({
  success: false,
  guardrail: MOCK_GUARDRAIL,
  framingHint: resolved.framingHint,
});
const summaryEval = getLiveReadinessSummary({
  success: false,
  guardrail: MOCK_GUARDRAIL,
  framingHint: resolved.evaluationWindowApplied ? resolved.evaluationWindowFramingHintOnly : null,
});
const summaryTail = getLiveReadinessSummary({
  success: false,
  guardrail: MOCK_GUARDRAIL,
  framingHint: tailHint,
});
const pDisp = getPrimaryReadinessBlocker(summaryDisplayed);
const pEval = getPrimaryReadinessBlocker(summaryEval);
const pTail = getPrimaryReadinessBlocker(summaryTail);
ok('1c tail primary is framing string', pTail === '조금 뒤로 가 주세요');
ok('1d eval-window primary differs from tail under contamination', pEval !== pTail);

const trace = buildOverheadReadinessBlockerTracePayload({
  displayedPrimaryBlocker: pDisp,
  displayedPrimaryBlockerSource: deriveDisplayedPrimaryBlockerSource({
    success: false,
    rawReadinessState: summaryDisplayed.state,
    activeBlockers: summaryDisplayed.activeBlockers,
    severeFramingInvalid: summaryDisplayed.blockers.severeFramingInvalid,
    framingHintSource: resolved.source,
  }),
  evaluationWindowFramingHint: resolved.evaluationWindowFramingHintOnly,
  evaluationWindowPrimaryBlocker: pEval,
  recentTailFramingHint: tailHint,
  recentTailPrimaryBlocker: pTail,
  blockerFirstSeenAtMs: 1,
  blockerLastSeenAtMs: 2,
  motionLatch: {
    seenDuringActiveMotion: true,
    seenAfterMotionWindow: false,
    lastSignals: {
      meaningfulRiseSatisfied: true,
      topDetected: false,
      stableTopEntered: false,
      holdStarted: false,
      holdSatisfied: false,
      completionMachinePhase: 'rising',
    },
  },
  blockerSeenNearTerminal: false,
  motionSignalsAtLastBlocker: null,
  selectedWindowStartMs: W0,
  selectedWindowEndMs: W1,
  traceWallClockMs: Date.now(),
});

ok('1e trace exposes distinct eval vs tail primaries', trace.evaluationWindowPrimaryBlocker !== trace.recentTailPrimaryBlocker);
ok('1f blockerSourceMismatch when primaries differ', trace.blockerSourceMismatch === true);

// 2) camera-trace.ts contains additive cue fields (serialization contract)
const ctPath = join(process.cwd(), 'src/lib/camera/camera-trace.ts');
const ct = readFileSync(ctPath, 'utf8');
ok('2a lastCorrectiveCueCandidateKey in diagnosis cue type', ct.includes('lastCorrectiveCueCandidateKey'));
ok('2b correctiveCueActuallyPlayed in diagnosis cue type', ct.includes('correctiveCueActuallyPlayed'));
ok('2c playbackSuccessIfKnown in diagnosis cue type', ct.includes('playbackSuccessIfKnown'));

// 3) No readiness threshold edits
const lrPath = join(process.cwd(), 'src/lib/camera/live-readiness.ts');
const lrSrc = readFileSync(lrPath, 'utf8');
ok('3a MIN_READY_VALID_FRAMES still 8', lrSrc.includes('const MIN_READY_VALID_FRAMES = 8'));

// 4) 02B smoke still valid — resolve shape includes evaluationWindowApplied
ok('4 resolve includes evaluationWindowApplied field', 'evaluationWindowApplied' in resolved);

console.log(`\nDone: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
