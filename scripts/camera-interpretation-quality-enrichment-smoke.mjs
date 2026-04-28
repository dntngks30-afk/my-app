/**
 * PR-CAMERA-QUALITY-ENRICHMENT-04 smoke — interpretation IQ only (QualityWindow trace).
 *
 * Run:
 *   node scripts/camera-interpretation-quality-enrichment-smoke.mjs
 */

import { spawnSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

if (process.env.MOVE_RE_TSX_LOADED !== '1') {
  const result = spawnSync('npx', ['tsx', __filename], {
    cwd: projectRoot,
    env: { ...process.env, MOVE_RE_TSX_LOADED: '1' },
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  process.exit(result.status ?? 1);
}

process.chdir(projectRoot);

let passed = 0;
let failed = 0;

function run(label, fn) {
  try {
    const errors = fn();
    if (!errors || errors.length === 0) {
      console.log(`  PASS  ${label}`);
      passed++;
    } else {
      console.error(`  FAIL  ${label}`);
      for (const error of errors) console.error(`        - ${error}`);
      failed++;
    }
  } catch (error) {
    console.error(`  ERROR ${label}: ${error?.message ?? error}`);
    failed++;
  }
}

/** Strong select_quality_window slice — enrichment should leave tier/scores sane (non-degrading). */
function baseSquatInput() {
  return {
    peakDepthProxy: 0.72,
    meanDepthProxy: 0.5,
    bottomStability: 0.7,
    trunkLeanDegMeanAbs: 10,
    kneeTrackingMean: 1,
    asymmetryDegMean: 8,
    weightShiftMean: 0.12,
    validFrameRatio: 0.9,
    descentCount: 2,
    bottomCount: 2,
    ascentCount: 2,
    recoveryDropRatio: 0.6,
    returnContinuityFrames: 10,
    signalIntegrityMultiplier: 0.95,
  };
}

async function imports() {
  const { computeSquatInternalQuality } = await import(
    '../src/lib/camera/squat/squat-internal-quality.ts'
  );
  const { computeOverheadInternalQuality } = await import(
    '../src/lib/camera/overhead/overhead-internal-quality.ts'
  );
  const {
    CAMERA_INTERPRETATION_QUALITY_ENRICHMENT_POLICY_VERSION,
  } = await import(
    '../src/lib/camera/interpretation-quality-window-enrichment.ts'
  );
  const { buildCameraInputQualityObservability } = await import(
    '../src/lib/camera/camera-evidence-summary.ts'
  );
  return {
    computeSquatInternalQuality,
    computeOverheadInternalQuality,
    CAMERA_INTERPRETATION_QUALITY_ENRICHMENT_POLICY_VERSION,
    buildCameraInputQualityObservability,
  };
}

const {
  computeSquatInternalQuality,
  computeOverheadInternalQuality,
  CAMERA_INTERPRETATION_QUALITY_ENRICHMENT_POLICY_VERSION,
  buildCameraInputQualityObservability,
} = await imports();

console.log('\nPR-CAMERA-QUALITY-ENRICHMENT-04 smoke\n');

run('policy version constant exported', () => {
  const errors = [];
  if (
    CAMERA_INTERPRETATION_QUALITY_ENRICHMENT_POLICY_VERSION !==
    'camera_interpretation_quality_enrichment_pr4_01'
  ) {
    errors.push(`unexpected policy slug ${CAMERA_INTERPRETATION_QUALITY_ENRICHMENT_POLICY_VERSION}`);
  }
  return errors;
});

run('select_quality_window + strong slice: no undue tier collapse', () => {
  const iq = computeSquatInternalQuality({
    ...baseSquatInput(),
    qualityWindow: {
      selectedWindowFrameCount: 14,
      selectedWindowDurationMs: 950,
      selectedWindowScore: 0.86,
      selectedWindowSource: 'select_quality_window',
      fallbackReason: null,
      warmupExcludedFrameCount: 4,
    },
  });
  const errors = [];
  if (iq.qualityTier !== 'high') errors.push(`expected high tier,got ${iq.qualityTier}`);
  if (iq.limitations.some((x) => x.startsWith('interpretation_window')))
    errors.push('strong window should not add interpretation penalties');
  return errors;
});

run('fallback_sparse_frames adds interpretation limitation + lowers confidence vs no-trace baseline', () => {
  const noTrace = computeSquatInternalQuality({ ...baseSquatInput() });
  const withFb = computeSquatInternalQuality({
    ...baseSquatInput(),
    qualityWindow: {
      selectedWindowFrameCount: 10,
      selectedWindowDurationMs: 810,
      selectedWindowScore: 0.6,
      selectedWindowSource: 'fallback_sparse_frames',
      fallbackReason: 'selected_window_too_sparse',
      warmupExcludedFrameCount: 12,
    },
  });
  const errors = [];
  if (!withFb.limitations.includes('interpretation_window_fallback')) {
    errors.push('missing interpretation_window_fallback');
  }
  if (!withFb.limitations.includes('interpretation_window_sparse_or_empty')) {
    errors.push('missing sparse_or_empty linkage');
  }
  if (!(withFb.confidence <= noTrace.confidence))
    errors.push('fallback path should not increase confidence vs no-trace');
  if (withFb.qualityTier === 'high')
    errors.push('high tier should downgrade when enrichment marks fallback');
  return errors;
});

run('unavailable trace forces conservative interpretation tier', () => {
  const iq = computeSquatInternalQuality({
    ...baseSquatInput(),
    qualityWindow: {
      selectedWindowFrameCount: 0,
      selectedWindowDurationMs: null,
      selectedWindowScore: null,
      selectedWindowSource: 'unavailable',
      fallbackReason: null,
      warmupExcludedFrameCount: 0,
    },
  });
  const errors = [];
  if (!iq.limitations.includes('interpretation_window_unavailable')) errors.push('unavailable limitation');
  if (iq.qualityTier !== 'low') errors.push('unavailable slice should coerce low tier');
  return errors;
});

run('overhead: low selectedWindowScore yields weak limitation + penalties', () => {
  const iq = computeOverheadInternalQuality({
    peakArmElevationDeg: 140,
    meanAsymmetryDeg: 5,
    lumbarExtensionDeviationDeg: 6,
    holdDurationMs: 950,
    stableTopDwellMs: 500,
    stableTopSegmentCount: 2,
    dwellCoherent: true,
    validFrameRatio: 0.88,
    signalIntegrityMultiplier: 0.96,
    raiseCount: 1,
    peakCount: 1,
    qualityWindow: {
      selectedWindowFrameCount: 12,
      selectedWindowDurationMs: 980,
      selectedWindowScore: 0.38,
      selectedWindowSource: 'select_quality_window',
      fallbackReason: null,
    },
  });
  const errors = [];
  if (!iq.limitations.includes('interpretation_window_score_weak')) errors.push('expected score_weak limitation');
  if (!(iq.confidence <= 0.88 * 0.96)) errors.push('should apply score weak penalty (< base conf)');
  return errors;
});

run('buildCameraInputQualityObservability stamps obs_03 + enrichment policy', () => {
  const obs = buildCameraInputQualityObservability([
    {
      stepId: 'squat',
      insufficientSignal: false,
      metrics: [],
      debug: {
        frameCount: 10,
        validFrameCount: 10,
        phaseHints: [],
        highlightedMetrics: {},
        squatInternalQuality: computeSquatInternalQuality({
          ...baseSquatInput(),
          qualityWindow: {
            selectedWindowFrameCount: 11,
            selectedWindowDurationMs: 910,
            selectedWindowScore: 0.8,
            selectedWindowSource: 'select_quality_window',
          },
        }),
      },
    },
  ]);
  const errors = [];
  if (obs.policy_version !== 'camera_input_quality_obs_03')
    errors.push(`policy_version expected obs_03, got ${obs.policy_version}`);
  if (
    obs.interpretation_quality_enrichment_policy !==
    'camera_interpretation_quality_enrichment_pr4_01'
  ) {
    errors.push('missing interpretation_quality_enrichment_policy');
  }
  return errors;
});

console.log('');
console.log(`Done. ${passed} passed, ${failed} failed.`);

process.exit(failed > 0 ? 1 : 0);
