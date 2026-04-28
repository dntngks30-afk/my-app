/**
 * PR-CAMERA-SURVEY-FUSION-V2-05 smoke.
 *
 * Run:
 *   node scripts/camera-to-survey-axis-fusion-v2-smoke.mjs
 */

import { spawnSync } from 'child_process';
import { readFileSync } from 'fs';
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

function approxEqual(a, b, epsilon = 0.000001) {
  return Math.abs(a - b) <= epsilon;
}

function axisSum(axisScores) {
  return Object.values(axisScores).reduce((sum, value) => sum + value, 0);
}

function makeSurveyAnswers() {
  return {
    v2_A1: 1, v2_A2: 1, v2_A3: 1,
    v2_B1: 1, v2_B2: 1, v2_B3: 1,
    v2_C1: 4, v2_C2: 4, v2_C3: 4,
    v2_D1: 1, v2_D2: 1, v2_D3: 1,
    v2_F1: 1, v2_F2: 1, v2_F3: 1,
    v2_G1: 1, v2_G2: 1, v2_G3: 1,
  };
}

function qualityWindow(overrides = {}) {
  return {
    selectedWindowFrameCount: 14,
    selectedWindowDurationMs: 1050,
    selectedWindowScore: 0.86,
    selectedWindowSource: 'select_quality_window',
    fallbackReason: null,
    warmupExcludedFrameCount: 4,
    ...overrides,
  };
}

function squatIq(overrides = {}) {
  return {
    depthScore: 0.52,
    controlScore: 0.55,
    symmetryScore: 0.58,
    recoveryScore: 0.56,
    confidence: 0.76,
    qualityTier: 'high',
    limitations: [],
    qualityWindow: qualityWindow(),
    ...overrides,
  };
}

function overheadIq(overrides = {}) {
  return {
    mobilityScore: 0.54,
    controlScore: 0.56,
    symmetryScore: 0.58,
    holdStabilityScore: 0.57,
    confidence: 0.76,
    qualityTier: 'high',
    limitations: [],
    qualityWindow: qualityWindow(),
    ...overrides,
  };
}

function makeCameraResult({
  resultEvidenceLevel = 'strong_evidence',
  captureQuality = 'ok',
  retryRecommended = false,
  squatInternalQuality = squatIq(),
  overheadInternalQuality = overheadIq(),
  squatMetrics = [
    { name: 'depth', value: 0.35, trend: 'concern' },
    { name: 'knee_alignment_trend', value: 0.4, trend: 'concern' },
    { name: 'trunk_lean', value: 0.45, trend: 'concern' },
  ],
  overheadMetrics = [
    { name: 'arm_range', value: 0.35, trend: 'concern' },
    { name: 'lumbar_extension', value: 0.42, trend: 'concern' },
  ],
} = {}) {
  return {
    movementType: 'camera-pr5-smoke',
    patternSummary: 'axis-aware camera evidence',
    avoidItems: [],
    resetAction: 'reset',
    confidence: resultEvidenceLevel === 'strong_evidence' ? 0.9 : 0.56,
    captureQuality,
    flags: [],
    retryRecommended,
    fallbackMode: null,
    insufficientSignal: false,
    evaluatorResults: [
      {
        stepId: 'squat',
        insufficientSignal: false,
        metrics: squatMetrics,
        debug: {
          highlightedMetrics: {
            completionSatisfied: true,
            finalPassEligible: true,
            progressionPassed: true,
            completionMachinePhase: 'completed',
          },
          squatInternalQuality,
        },
      },
      {
        stepId: 'overhead-reach',
        insufficientSignal: false,
        metrics: overheadMetrics,
        debug: {
          highlightedMetrics: {
            completionSatisfied: true,
            completionMachinePhase: 'completed',
          },
          overheadInternalQuality,
        },
      },
    ],
    resultEvidenceLevel,
    resultToneMode: resultEvidenceLevel === 'strong_evidence' ? 'confident' : 'conservative',
    debug: { perExercise: [] },
  };
}

function makeLowQualityPassCamera() {
  return makeCameraResult({
    squatInternalQuality: squatIq({
      depthScore: 0.22,
      controlScore: 0.24,
      symmetryScore: 0.25,
      recoveryScore: 0.2,
      confidence: 0.35,
      qualityTier: 'low',
      limitations: [
        'depth_limited',
        'unstable_control',
        'asymmetry_elevated',
        'recovery_trajectory_weak',
      ],
    }),
  });
}

function makeInvalidCameraResult() {
  return {
    movementType: 'unknown',
    patternSummary: 'invalid camera signal',
    avoidItems: [],
    resetAction: 'retry',
    confidence: 0,
    captureQuality: 'invalid',
    flags: ['insufficient_signal'],
    retryRecommended: true,
    fallbackMode: 'survey',
    insufficientSignal: true,
    evaluatorResults: [],
    resultEvidenceLevel: 'insufficient_signal',
    resultToneMode: 'retry_or_reset',
    debug: { perExercise: [] },
  };
}

function pickPassFields(cameraResult) {
  const squat = cameraResult.evaluatorResults.find((r) => r.stepId === 'squat');
  const hm = squat?.debug?.highlightedMetrics ?? {};
  return {
    completionSatisfied: hm.completionSatisfied,
    finalPassEligible: hm.finalPassEligible,
    progressionPassed: hm.progressionPassed,
  };
}

const { buildFreeSurveyBaselineResult } = await import(
  '../src/lib/deep-v2/builders/build-free-survey-baseline.ts'
);
const { buildCameraRefinedResult } = await import(
  '../src/lib/deep-v2/builders/build-camera-refined-result.ts'
);
const { buildSessionDeepSummaryFromPublicResult } = await import(
  '../src/lib/deep-result/buildSessionDeepSummaryFromPublicResult.ts'
);
const { cameraToEvidence, getCameraEvidenceQuality, isCameraPassCompleted } = await import(
  '../src/lib/deep-v2/adapters/camera-to-evidence.ts'
);

console.log('\nPR-CAMERA-SURVEY-FUSION-V2-05 smoke\n');

const baseline = buildFreeSurveyBaselineResult(makeSurveyAnswers()).result;

run('strong high-quality camera evidence refines relevant axes only', () => {
  const ev = cameraToEvidence(makeCameraResult());
  const errors = [];
  if (ev.axis_scores.lower_mobility <= 0) errors.push('expected squat depth to refine lower_mobility');
  if (ev.axis_scores.lower_stability <= 0) errors.push('expected squat control to refine lower_stability');
  if (ev.axis_scores.trunk_control <= 0) errors.push('expected squat/overhead control to refine trunk_control');
  if (ev.axis_scores.upper_mobility <= 0) errors.push('expected overhead mobility to refine upper_mobility');
  if (ev.axis_scores.deconditioned !== 0) errors.push('deconditioned must not be strengthened');
  if (ev.pain_signals.max_intensity !== undefined) errors.push('camera must not infer pain intensity');
  return errors;
});

run('partial camera evidence refines weakly compared with strong evidence', () => {
  const strong = cameraToEvidence(makeCameraResult()).axis_scores;
  const partial = cameraToEvidence(
    makeCameraResult({
      resultEvidenceLevel: 'shallow_evidence',
      captureQuality: 'low',
      retryRecommended: true,
    })
  ).axis_scores;
  const errors = [];
  if (!(axisSum(partial) > 0)) errors.push('partial evidence should still be able to refine weakly');
  if (!(axisSum(partial) < axisSum(strong))) errors.push('partial evidence should be weaker than strong');
  return errors;
});

run('minimal low-quality pass produces zero camera axis contribution', () => {
  const camera = makeLowQualityPassCamera();
  const ev = cameraToEvidence(camera);
  const errors = [];
  if (!isCameraPassCompleted(camera)) errors.push('fixture should remain a completed camera pass');
  if (getCameraEvidenceQuality(camera) !== 'minimal') {
    errors.push(`expected minimal evidence quality, got ${getCameraEvidenceQuality(camera)}`);
  }
  for (const [axis, value] of Object.entries(ev.axis_scores)) {
    if (value !== 0) errors.push(`${axis} should be zero for minimal evidence, got ${value}`);
  }
  return errors;
});

run('invalid minimal camera preserves baseline-led classification axes', () => {
  const refined = buildCameraRefinedResult(baseline, makeInvalidCameraResult());
  const errors = [];
  if (refined.refined_meta.camera_evidence_quality !== 'minimal') {
    errors.push('invalid camera should be minimal evidence');
  }
  if (refined.result.primary_type !== baseline.primary_type) {
    errors.push(`primary_type should remain baseline-led: ${baseline.primary_type} -> ${refined.result.primary_type}`);
  }
  if (refined.result.secondary_type !== baseline.secondary_type) {
    errors.push('secondary_type should remain baseline-led');
  }
  return errors;
});

run('selectedWindowScore only caps weak evidence; it does not upgrade evidence', () => {
  const normal = cameraToEvidence(makeCameraResult()).axis_scores;
  const weakWindow = cameraToEvidence(
    makeCameraResult({
      squatInternalQuality: squatIq({
        qualityWindow: qualityWindow({
          selectedWindowScore: 0.38,
        }),
      }),
      overheadInternalQuality: overheadIq({
        qualityWindow: qualityWindow({
          selectedWindowScore: 0.38,
        }),
      }),
    })
  ).axis_scores;
  const errors = [];
  if (!(axisSum(weakWindow) < axisSum(normal))) {
    errors.push('weak selectedWindowScore should cap/reduce axis contribution');
  }
  return errors;
});

run('PR4 asymmetry limitations can refine asymmetry conservatively', () => {
  const ev = cameraToEvidence(
    makeCameraResult({
      squatMetrics: [],
      overheadMetrics: [],
      squatInternalQuality: squatIq({
        symmetryScore: 0.42,
        limitations: ['asymmetry_elevated'],
      }),
      overheadInternalQuality: overheadIq({
        symmetryScore: 0.44,
        limitations: ['asymmetry_elevated'],
      }),
    })
  );
  const errors = [];
  if (!(ev.axis_scores.asymmetry > 0)) errors.push('expected explicit IQ asymmetry to refine asymmetry');
  if (ev.axis_scores.asymmetry > 2.0) errors.push('asymmetry should stay capped conservatively');
  if (ev.axis_scores.deconditioned !== 0) errors.push('asymmetry should not leak into deconditioned');
  return errors;
});

run('camera_pass and pass/progression debug fields are not mutated by refinement', () => {
  const camera = makeCameraResult();
  const before = pickPassFields(camera);
  const refined = buildCameraRefinedResult(baseline, camera);
  const after = pickPassFields(camera);
  const errors = [];
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    errors.push(`pass fields mutated: before=${JSON.stringify(before)} after=${JSON.stringify(after)}`);
  }
  if (refined.refined_meta.camera_pass !== true) errors.push('camera_pass should remain true');
  return errors;
});

run('session summary effective_confidence remains coherent with refined result', () => {
  const refined = buildCameraRefinedResult(baseline, makeCameraResult());
  const summary = buildSessionDeepSummaryFromPublicResult({
    id: 'camera-pr5-fusion-v2-smoke',
    stage: 'refined',
    result: refined.result,
  });
  const errors = [];
  if (!approxEqual(summary.confidence, refined.result.confidence)) {
    errors.push('summary.confidence should equal refined result confidence');
  }
  if (!approxEqual(summary.effective_confidence, refined.result.confidence)) {
    errors.push('summary.effective_confidence should equal refined result confidence');
  }
  return errors;
});

run('source keeps cameraWeight mapping unchanged', () => {
  const source = readFileSync(
    join(projectRoot, 'src/lib/deep-v2/builders/build-camera-refined-result.ts'),
    'utf-8'
  );
  const errors = [];
  if (!/cameraQuality === 'strong'\s*\?\s*0\.6/.test(source)) {
    errors.push('strong cameraWeight should remain 0.6');
  }
  if (!/cameraQuality === 'partial'\s*\?\s*0\.4\s*:\s*0\.0/.test(source)) {
    errors.push('partial/minimal cameraWeight mapping should remain 0.4/0.0');
  }
  return errors;
});

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
