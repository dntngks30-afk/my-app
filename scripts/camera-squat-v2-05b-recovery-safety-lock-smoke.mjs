/**
 * PR-V2-INPUT-05B — Recovery safety lock smoke (candidate-local setup, dominance, micro/limb).
 *
 * Run: npx tsx scripts/camera-squat-v2-05b-recovery-safety-lock-smoke.mjs
 */
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const {
  evaluateShallowRecoverySafety05b,
  RECOVERY_SETUP_MOTION_BLOCKED,
  RECOVERY_MICRO_OR_LIMB_MOTION,
  RECOVERY_LOWER_BODY_NOT_DOMINANT_ENOUGH,
} = await import('../src/lib/camera/squat/squat-v2-shallow-recovery-window.ts');

const { computeSquatSetupMotionBlock, findFirstSquatSetupMotionBlockObservation } = await import(
  '../src/lib/camera/squat/squat-setup-motion-window.ts'
);

const {
  buildSquatV2AutoProgressionDecisionTrace,
  V2_ROLLING_FALLBACK_PASS_NOT_CONSUMABLE,
  V2_KNEE_FLEX_PROXY_UNRELIABLE_PASS,
} = await import('../src/lib/camera/auto-progression.ts');

let failed = 0;
function ok(name, cond, detail = '') {
  if (cond) console.log(`  PASS  ${name}`);
  else {
    failed += 1;
    console.error(`  FAIL  ${name}${detail ? `: ${detail}` : ''}`);
  }
}

/** Neutral frames: no setup block (stable area ~0.04). */
function neutralFrame(i) {
  return {
    timestampMs: i * 100,
    isValid: true,
    phaseHint: 'start',
    derived: { squatDepthProxy: 0.05 + (i % 10) * 0.001 },
    bodyBox: { area: 0.04, width: 0.4, height: 0.75 },
    joints: {
      hipCenter: { x: 0.5, y: 0.45, visibility: 0.95 },
      ankleCenter: { x: 0.5, y: 0.85, visibility: 0.95 },
    },
  };
}

function neutralSlice(len) {
  return Array.from({ length: len }, (_, i) => neutralFrame(i));
}

const EVIDENCE = {
  bodyVisibleEnough: true,
  lowerBodyMotionDominant: true,
  descent: true,
  meaningfulDescent: true,
  reversal: true,
  nearStartReturn: true,
  stableAfterReturn: true,
  sameRepOwnership: true,
  notSetupPhase: true,
  notUpperBodyOnly: true,
  notMicroBounce: true,
  temporalClosureSatisfied: true,
  activeAttemptWindowSatisfied: true,
  closureFreshAtTail: true,
  preDescentBaselineSatisfied: true,
};

console.log('\nPR-V2-INPUT-05B recovery safety lock smoke\n');

// ── Lock C + priority over B (micro/limb before lower-body ratio) ─────────
{
  const slice = neutralSlice(40);
  const fullRaw = slice;
  const fullSetup = computeSquatSetupMotionBlock(fullRaw);
  const fullObs = findFirstSquatSetupMotionBlockObservation(fullRaw);
  const decision = {
    usableMotionEvidence: true,
    motionPattern: 'down_up_return',
    romBand: 'shallow',
    blockReason: null,
    qualityWarnings: [],
    evidence: EVIDENCE,
    metrics: {
      framesAfterPeak: 10,
      v2LowerUpperMotionRatio: 1.04,
      v2LowerBodyMotionAmplitude: 0.0878,
      v2UpperBodyMotionAmplitude: 0.0843,
      relativePeak: 0.0399,
    },
  };
  const r = evaluateShallowRecoverySafety05b({
    decision,
    candidateSlice: slice,
    candidateStartIndexInValidRaw: 0,
    fullRawSetup: fullSetup,
    fullRawFirstSetupObs: fullObs,
  });
  ok(
    'Lock C false-pass signature → blocked with micro/limb reason',
    !r.ok && r.snapshot.safetyBlockedReason === RECOVERY_MICRO_OR_LIMB_MOTION,
    JSON.stringify(r.snapshot)
  );
}

// ── Lock B only (deep rom, moderate peak; C false) ────────────────────────
{
  const slice = neutralSlice(40);
  const fullSetup = computeSquatSetupMotionBlock(slice);
  const fullObs = findFirstSquatSetupMotionBlockObservation(slice);
  const decision = {
    usableMotionEvidence: true,
    motionPattern: 'down_up_return',
    romBand: 'deep',
    blockReason: null,
    qualityWarnings: [],
    evidence: EVIDENCE,
    metrics: {
      framesAfterPeak: 10,
      v2LowerUpperMotionRatio: 1.2,
      v2LowerBodyMotionAmplitude: 0.5,
      v2UpperBodyMotionAmplitude: 0.4,
      relativePeak: 0.8,
    },
  };
  const r = evaluateShallowRecoverySafety05b({
    decision,
    candidateSlice: slice,
    candidateStartIndexInValidRaw: 0,
    fullRawSetup: fullSetup,
    fullRawFirstSetupObs: fullObs,
  });
  ok(
    'Lock B: ratio 1.2 < 1.35 → recovery_lower_body_not_dominant_enough',
    !r.ok && r.snapshot.safetyBlockedReason === RECOVERY_LOWER_BODY_NOT_DOMINANT_ENOUGH
  );
}

// ── Lock A: candidate-local setup block (step-in spike inside window) ─────
{
  const frames = [];
  for (let i = 0; i < 20; i++) {
    frames.push({
      timestampMs: i * 100,
      isValid: true,
      phaseHint: 'start',
      derived: { squatDepthProxy: 0.05 },
      bodyBox: { area: 0.04, width: 0.4, height: 0.75 },
      joints: { hipCenter: { x: 0.5, y: 0.45, visibility: 0.95 } },
    });
  }
  for (let i = 20; i < 40; i++) {
    frames.push({
      timestampMs: i * 100,
      isValid: true,
      phaseHint: 'start',
      derived: { squatDepthProxy: 0.05 },
      bodyBox: { area: 0.08, width: 0.4, height: 0.75 },
      joints: { hipCenter: { x: 0.5, y: 0.45, visibility: 0.95 } },
    });
  }
  const candBlock = computeSquatSetupMotionBlock(frames);
  ok('fixture: candidate window has setup block', candBlock.blocked === true, candBlock.reason);

  const fullSetup = { blocked: false, reason: null };
  const fullObs = {
    blocked: false,
    reason: null,
    firstBlockedValidIndex: null,
    firstBlockedAtMs: null,
  };
  const decision = {
    usableMotionEvidence: true,
    motionPattern: 'down_up_return',
    romBand: 'deep',
    blockReason: null,
    qualityWarnings: [],
    evidence: EVIDENCE,
    metrics: {
      framesAfterPeak: 10,
      v2LowerUpperMotionRatio: 8,
      v2LowerBodyMotionAmplitude: 0.6,
      v2UpperBodyMotionAmplitude: 0.05,
      relativePeak: 0.7,
    },
  };
  const r = evaluateShallowRecoverySafety05b({
    decision,
    candidateSlice: frames,
    candidateStartIndexInValidRaw: 0,
    fullRawSetup: fullSetup,
    fullRawFirstSetupObs: fullObs,
  });
  ok(
    'Lock A: candidate setup contaminated → recovery_setup_motion_blocked',
    !r.ok && r.snapshot.safetyBlockedReason === RECOVERY_SETUP_MOTION_BLOCKED
  );
}

// ── Full-buffer blocked but no overlap → do not veto on overlap alone ────
{
  const longNeutral = neutralSlice(80);
  const fullSetup = computeSquatSetupMotionBlock(longNeutral);
  const fullObs = findFirstSquatSetupMotionBlockObservation(longNeutral);
  const candidate = longNeutral.slice(0, 40);
  const candSetup = computeSquatSetupMotionBlock(candidate);
  const decision = {
    usableMotionEvidence: true,
    motionPattern: 'down_up_return',
    romBand: 'deep',
    blockReason: null,
    qualityWarnings: [],
    evidence: EVIDENCE,
    metrics: {
      framesAfterPeak: 10,
      v2LowerUpperMotionRatio: 8,
      v2LowerBodyMotionAmplitude: 0.6,
      v2UpperBodyMotionAmplitude: 0.05,
      relativePeak: 0.7,
    },
  };
  const r = evaluateShallowRecoverySafety05b({
    decision,
    candidateSlice: candidate,
    candidateStartIndexInValidRaw: 0,
    fullRawSetup: { blocked: true, reason: 'large_framing_translation' },
    fullRawFirstSetupObs: {
      blocked: true,
      reason: 'large_framing_translation',
      firstBlockedValidIndex: 70,
      firstBlockedAtMs: 7000,
    },
  });
  const overlapWouldBe = 0 <= 70 && 70 < 40;
  ok('overlap sanity: index 70 not in [0,40)', overlapWouldBe === false);
  ok(
    'fullRaw blocked at tail, clean candidate [0,40), strong ratio → safety passes',
    r.ok === true && candSetup.blocked === false,
    JSON.stringify(r.snapshot)
  );
}

// ── PR04B unchanged ───────────────────────────────────────────────────────
{
  const rollingPass = {
    usableMotionEvidence: true,
    motionPattern: 'down_up_return',
    romBand: 'shallow',
    blockReason: null,
    qualityWarnings: [],
    evidence: { ...EVIDENCE },
    metrics: {
      usedRollingFallback: true,
      v2EpochSource: 'rolling_window_fallback',
      v2InputSelectedDepthSource: 'hip_center_baseline',
    },
  };
  const t = buildSquatV2AutoProgressionDecisionTrace(rollingPass);
  ok('PR04B rolling still blocked', t.blockedReason === V2_ROLLING_FALLBACK_PASS_NOT_CONSUMABLE);

  const kneeBad = {
    usableMotionEvidence: true,
    motionPattern: 'down_up_return',
    romBand: 'deep',
    blockReason: null,
    qualityWarnings: [],
    evidence: { ...EVIDENCE },
    metrics: {
      v2InputSelectedDepthSource: 'knee_flex_proxy',
      inputFrameCount: 10,
      peakDistanceFromTailFrames: 8,
      v2InputFiniteButUselessDepthRejected: false,
    },
  };
  const t2 = buildSquatV2AutoProgressionDecisionTrace(kneeBad);
  ok('PR04B short knee window still blocked', t2.blockedReason === V2_KNEE_FLEX_PROXY_UNRELIABLE_PASS);
}

if (failed > 0) {
  console.error(`\n05B smoke: ${failed} failure(s)\n`);
  process.exit(1);
}
console.log('\n05B smoke: all passed\n');
