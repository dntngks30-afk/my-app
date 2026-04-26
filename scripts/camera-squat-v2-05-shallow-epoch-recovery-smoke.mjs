/**
 * PR-V2-INPUT-05 — Shallow validRaw window recovery + PR04B guard module smoke.
 *
 * Run: npx tsx scripts/camera-squat-v2-05-shallow-epoch-recovery-smoke.mjs
 */
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
process.chdir(root);

const {
  shouldAttemptShallowV2Recovery,
  tryFindShallowV2RecoveryWindow,
} = await import('../src/lib/camera/squat/squat-v2-shallow-recovery-window.ts');

const { evaluateSquatV2RuntimeOwnerSafetyConsumption } = await import(
  '../src/lib/camera/squat/squat-v2-pr04b-consumption-guard.ts'
);

const {
  buildSquatV2AutoProgressionDecisionTrace,
  V2_ROLLING_FALLBACK_PASS_NOT_CONSUMABLE,
  evaluateSquatV2RuntimeOwnerSafetyConsumption: evaluateFromAutoProgression,
} = await import('../src/lib/camera/auto-progression.ts');

let failed = 0;
function ok(name, cond, detail = '') {
  if (cond) {
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.error(`  FAIL  ${name}${detail ? `: ${detail}` : ''}`);
  }
}

const EVIDENCE_BASE = {
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

console.log('\nPR-V2-INPUT-05 shallow recovery + PR04B module smoke\n');

// ── Guard module matches auto-progression re-export ───────────────────────
{
  const rollingPass = {
    usableMotionEvidence: true,
    motionPattern: 'down_up_return',
    romBand: 'shallow',
    blockReason: null,
    qualityWarnings: [],
    evidence: { ...EVIDENCE_BASE },
    metrics: {
      usedRollingFallback: true,
      v2EpochSource: 'rolling_window_fallback',
      v2InputSelectedDepthSource: 'hip_center_baseline',
    },
  };
  const a = evaluateSquatV2RuntimeOwnerSafetyConsumption(rollingPass);
  const b = evaluateFromAutoProgression(rollingPass);
  ok(
    'PR04B guard: direct module === auto-progression re-export',
    a.consumptionAllowed === b.consumptionAllowed && a.blockedReason === b.blockedReason,
    JSON.stringify({ a, b })
  );
}

{
  const t = buildSquatV2AutoProgressionDecisionTrace({
    usableMotionEvidence: true,
    motionPattern: 'down_up_return',
    romBand: 'shallow',
    blockReason: null,
    qualityWarnings: [],
    evidence: { ...EVIDENCE_BASE },
    metrics: {
      usedRollingFallback: true,
      v2EpochSource: 'rolling_window_fallback',
      v2InputSelectedDepthSource: 'hip_center_baseline',
    },
  });
  ok(
    'progression trace still blocks rolling fallback',
    t.progressionAllowed === false && t.blockedReason === V2_ROLLING_FALLBACK_PASS_NOT_CONSUMABLE
  );
}

// ── shouldAttempt: no attempt when pass ───────────────────────────────────
{
  const owned = {
    selectedDepthSource: 'hip_center_baseline',
    depthCurveUsable: true,
    finiteButUselessDepthRejected: false,
    sourceStats: {},
    legacyDepthSelection: null,
    v2InputSwitchReason: null,
    frames: [],
  };
  const decision = {
    usableMotionEvidence: true,
    metrics: {
      peakFrameIndex: 2,
      inputFrameCount: 10,
      framesAfterPeak: 4,
      peakDistanceFromTailFrames: 4,
    },
  };
  ok(
    'shouldAttempt false when usableMotionEvidence',
    !shouldAttemptShallowV2Recovery({
      validRawLength: 80,
      decision,
      owned,
      v2EvalFrameCount: 10,
    })
  );
}

// ── shouldAttempt: peak-at-tail stall → false ─────────────────────────────
{
  const owned = {
    selectedDepthSource: 'none',
    depthCurveUsable: false,
    finiteButUselessDepthRejected: true,
    sourceStats: { none: {} },
    legacyDepthSelection: null,
    v2InputSwitchReason: null,
    frames: [],
  };
  const decision = {
    usableMotionEvidence: false,
    metrics: {
      peakFrameIndex: 9,
      inputFrameCount: 10,
      framesAfterPeak: 0,
      peakDistanceFromTailFrames: 0,
    },
  };
  ok(
    'shouldAttempt false when peak-at-tail stall',
    !shouldAttemptShallowV2Recovery({
      validRawLength: 80,
      decision,
      owned,
      v2EvalFrameCount: 10,
    })
  );
}

// ── shouldAttempt: none + failed pass + not tail stall → true ─────────────
{
  const owned = {
    selectedDepthSource: 'none',
    depthCurveUsable: false,
    finiteButUselessDepthRejected: true,
    sourceStats: { none: {} },
    legacyDepthSelection: null,
    v2InputSwitchReason: null,
    frames: [],
  };
  const decision = {
    usableMotionEvidence: false,
    blockReason: 'no_reversal',
    metrics: {
      peakFrameIndex: 4,
      inputFrameCount: 20,
      framesAfterPeak: 5,
      peakDistanceFromTailFrames: 10,
    },
  };
  ok(
    'shouldAttempt true when source none and not tail stall',
    shouldAttemptShallowV2Recovery({
      validRawLength: 80,
      decision,
      owned,
      v2EvalFrameCount: 20,
    })
  );
}

// ── tryFind: short buffer ─────────────────────────────────────────────────
{
  const { hit, diagnostics } = tryFindShallowV2RecoveryWindow({
    validRaw: [],
    latestValidTs: 0,
    primaryDecision: { blockReason: 'x', metrics: {} },
  });
  ok('tryFind short validRaw → no hit', hit === null);
  ok(
    'tryFind diagnostics.valid_raw_too_short',
    diagnostics.blockedReason === 'valid_raw_too_short'
  );
}

// ── Regression bundle (04b / 04c / 04d / 02b / 01) ───────────────────────
const bundle = [
  'scripts/camera-squat-v2-04b-runtime-owner-safety-smoke.mjs',
  'scripts/camera-squat-v2-04c-peak-tail-window-recovery-smoke.mjs',
  'scripts/camera-squat-v2-04d-depth-source-alignment-smoke.mjs',
  'scripts/camera-squat-v2-02b-runtime-owner-truth-smoke.mjs',
  'scripts/camera-squat-v2-01-motion-evidence-engine-smoke.mjs',
  'scripts/camera-squat-v2-05b-recovery-safety-lock-smoke.mjs',
];

console.log('\nRunning bundled V2 regression smokes…\n');
for (const rel of bundle) {
  try {
    execSync(`npx tsx ${rel}`, { stdio: 'inherit', cwd: root });
    console.log(`  PASS  bundle: ${rel}`);
  } catch {
    failed += 1;
    console.error(`  FAIL  bundle: ${rel}`);
  }
}

if (failed > 0) {
  console.error(`\nPR-V2-INPUT-05: ${failed} failure(s)\n`);
  process.exit(1);
}
console.log('\nPR-V2-INPUT-05: all checks passed\n');
