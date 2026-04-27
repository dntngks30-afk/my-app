/**
 * PR-V2-INPUT-04B: synthetic consumption-guard smoke (rolling fallback + knee_flex veto).
 * Imports production `buildSquatV2AutoProgressionDecisionTrace` from auto-progression.ts.
 *
 * Run: npx tsx scripts/camera-squat-v2-04b-runtime-owner-safety-smoke.mjs
 * (tsx is required for TypeScript path/extension resolution.)
 */
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Minimal evidence bag for trace builders (not evaluated by V2 engine here). */
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
  preDescentBaselineSatisfied: false,
};

async function main() {
  const apUrl = pathToFileURL(
    join(__dirname, '..', 'src', 'lib', 'camera', 'auto-progression.ts')
  ).href;
  const {
    buildSquatV2AutoProgressionDecisionTrace,
    V2_ROLLING_FALLBACK_PASS_NOT_CONSUMABLE,
    V2_KNEE_FLEX_PROXY_UNRELIABLE_PASS,
  } = await import(apUrl);

  let failures = 0;
  /** @param {string} name @param {boolean} ok @param {string} [detail] */
  function check(name, ok, detail) {
    if (!ok) {
      failures += 1;
      console.error(`FAIL: ${name}${detail ? ` — ${detail}` : ''}`);
    } else {
      console.log(`ok: ${name}`);
    }
  }

  // 1) Rolling fallback pass must not be consumable
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
  const t1 = buildSquatV2AutoProgressionDecisionTrace(rollingPass);
  check(
    'rolling: progression blocked',
    t1.progressionAllowed === false && t1.blockedReason === V2_ROLLING_FALLBACK_PASS_NOT_CONSUMABLE,
    JSON.stringify(t1)
  );
  check(
    'rolling: owner unchanged',
    t1.owner === 'squat_motion_evidence_v2' && t1.consumedField === 'usableMotionEvidence'
  );
  check(
    'rolling: safety diagnostics',
    t1.v2ProgressionSafetyBlocked === true &&
      t1.v2ProgressionSafetyGuardVersion === 'v2-runtime-owner-safety-04b'
  );

  // 2) Unreliable knee_flex_proxy (real-device regression A shape)
  const kneeBad = {
    usableMotionEvidence: true,
    motionPattern: 'down_up_return',
    romBand: 'deep',
    blockReason: null,
    qualityWarnings: [],
    evidence: { ...EVIDENCE },
    metrics: {
      usedRollingFallback: false,
      v2EpochSource: 'active_attempt_epoch_without_baseline',
      v2InputSelectedDepthSource: 'knee_flex_proxy',
      inputFrameCount: 12,
      peakDistanceFromTailFrames: 4,
      v2InputFiniteButUselessDepthRejected: true,
      v2InputSourceStats: { knee_flex_proxy: { angleRangeDeg: 10.7 } },
    },
  };
  const t2 = buildSquatV2AutoProgressionDecisionTrace(kneeBad);
  check(
    'knee unreliable: blocked',
    t2.progressionAllowed === false && t2.blockedReason === V2_KNEE_FLEX_PROXY_UNRELIABLE_PASS,
    JSON.stringify(t2)
  );

  // 3) Valid hip_center + non-rolling epoch — consumption allowed
  const hipOk = {
    usableMotionEvidence: true,
    motionPattern: 'down_up_return',
    romBand: 'shallow',
    blockReason: null,
    qualityWarnings: [],
    evidence: { ...EVIDENCE },
    metrics: {
      usedRollingFallback: false,
      v2EpochSource: 'active_attempt_epoch_without_baseline',
      v2InputSelectedDepthSource: 'hip_center_baseline',
      inputFrameCount: 24,
      peakDistanceFromTailFrames: 10,
      v2InputFiniteButUselessDepthRejected: false,
    },
  };
  const t3 = buildSquatV2AutoProgressionDecisionTrace(hipOk);
  check(
    'hip active epoch: allowed',
    t3.progressionAllowed === true && t3.blockedReason === null,
    JSON.stringify(t3)
  );
  check('hip: no safety veto flag', t3.v2ProgressionSafetyBlocked !== true);

  if (failures > 0) {
    console.error(`\ncamera-squat-v2-04b-runtime-owner-safety-smoke: ${failures} failure(s)`);
    process.exitCode = 1;
  } else {
    console.log('\ncamera-squat-v2-04b-runtime-owner-safety-smoke: all checks passed');
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
