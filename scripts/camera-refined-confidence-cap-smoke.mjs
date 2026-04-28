/**
 * PR-CAMERA-REFINE-CONFIDENCE-CAP-01 smoke.
 *
 * Run:
 *   node scripts/camera-refined-confidence-cap-smoke.mjs
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

function makeStrongCameraResult() {
  return {
    movementType: 'kangaroo',
    patternSummary: 'strong camera signal',
    avoidItems: [],
    resetAction: 'reset',
    confidence: 0.92,
    captureQuality: 'ok',
    flags: [],
    retryRecommended: false,
    fallbackMode: null,
    insufficientSignal: false,
    evaluatorResults: [
      {
        stepId: 'squat',
        insufficientSignal: false,
        metrics: [
          { name: 'depth', value: 0.3, trend: 'concern' },
          { name: 'knee_alignment_trend', value: 0.4, trend: 'concern' },
        ],
        debug: {
          highlightedMetrics: {
            completionSatisfied: 1,
            completionMachinePhase: 'completed',
            finalPassEligible: true,
            progressionPassed: true,
          },
          squatInternalQuality: {
            depthScore: 0.7,
            controlScore: 0.72,
            symmetryScore: 0.7,
            recoveryScore: 0.72,
            confidence: 0.72,
            qualityTier: 'high',
            limitations: [],
          },
        },
      },
      {
        stepId: 'overhead-reach',
        insufficientSignal: false,
        metrics: [
          { name: 'arm_range', value: 0.8, trend: 'good' },
          { name: 'lumbar_extension', value: 0.2, trend: 'neutral' },
        ],
        debug: {
          highlightedMetrics: {
            completionSatisfied: 1,
            completionMachinePhase: 'completed',
          },
          overheadInternalQuality: {
            mobilityScore: 0.72,
            controlScore: 0.72,
            symmetryScore: 0.72,
            holdStabilityScore: 0.72,
            confidence: 0.72,
            qualityTier: 'high',
            limitations: [],
          },
        },
      },
    ],
    resultEvidenceLevel: 'strong_evidence',
    resultToneMode: 'confident',
    debug: { perExercise: [] },
  };
}

function makeLowQualityCompletedCameraResult() {
  const result = makeStrongCameraResult();
  return {
    ...result,
    evaluatorResults: [
      {
        ...result.evaluatorResults[0],
        debug: {
          ...result.evaluatorResults[0].debug,
          squatInternalQuality: {
            depthScore: 0.22,
            controlScore: 0.24,
            symmetryScore: 0.25,
            recoveryScore: 0.2,
            confidence: 0.35,
            qualityTier: 'low',
            limitations: [
              'depth_limited',
              'unstable_control',
              'low_tracking_confidence',
              'recovery_trajectory_weak',
            ],
          },
        },
      },
      result.evaluatorResults[1],
    ],
  };
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
const { getCameraEvidenceQuality, isCameraPassCompleted, cameraToEvidence } = await import(
  '../src/lib/deep-v2/adapters/camera-to-evidence.ts'
);
const { buildSessionDeepSummaryFromPublicResult } = await import(
  '../src/lib/deep-result/buildSessionDeepSummaryFromPublicResult.ts'
);

console.log('\nPR-CAMERA-REFINE-CONFIDENCE-CAP-01 smoke\n');

const baseline = buildFreeSurveyBaselineResult(makeSurveyAnswers()).result;
const lowQualityCamera = makeLowQualityCompletedCameraResult();
const strongCamera = makeStrongCameraResult();
const invalidCamera = makeInvalidCameraResult();

run('low-quality completed camera remains camera_pass=true', () => {
  const refined = buildCameraRefinedResult(baseline, lowQualityCamera);
  const errors = [];
  if (!isCameraPassCompleted(lowQualityCamera)) errors.push('input should be pass-completed');
  if (refined.refined_meta.camera_pass !== true) errors.push('refined camera_pass should stay true');
  if (getCameraEvidenceQuality(lowQualityCamera) !== 'minimal') {
    errors.push(`expected minimal quality, got ${getCameraEvidenceQuality(lowQualityCamera)}`);
  }
  return errors;
});

run('low-quality completed camera refined confidence is capped', () => {
  const refined = buildCameraRefinedResult(baseline, lowQualityCamera);
  const cap = refined.refined_meta.confidence_cap;
  const errors = [];
  if (!cap?.applied) errors.push('confidence cap should be applied');
  if (cap?.cap_value !== 0.62) errors.push(`expected cap_value 0.62, got ${cap?.cap_value}`);
  if (refined.result.confidence > 0.62) {
    errors.push(`refined confidence should be <= 0.62, got ${refined.result.confidence}`);
  }
  if (!approxEqual(refined.result.confidence, cap?.capped_confidence ?? -1)) {
    errors.push('result.confidence should equal cap.capped_confidence');
  }
  return errors;
});

run('low-quality completed camera does not promote evidence_level to full', () => {
  const refined = buildCameraRefinedResult(baseline, lowQualityCamera);
  if (refined.result.evidence_level === 'full') {
    return ['low-quality camera should not produce full evidence_level'];
  }
  return [];
});

run('strong-quality camera preserves current confidence/evidence behavior', () => {
  const refined = buildCameraRefinedResult(baseline, strongCamera);
  const errors = [];
  if (refined.refined_meta.confidence_cap != null) {
    errors.push('strong camera should not carry confidence_cap trace');
  }
  if (refined.result.confidence <= 0.78) {
    errors.push(`strong confidence unexpectedly low: ${refined.result.confidence}`);
  }
  if (refined.result.evidence_level !== 'full') {
    errors.push(`strong camera over partial baseline should remain full, got ${refined.result.evidence_level}`);
  }
  return errors;
});

run('minimal invalid/missing evidence preserves baseline-led axis behavior', () => {
  const refined = buildCameraRefinedResult(baseline, invalidCamera);
  const errors = [];
  if (refined.refined_meta.camera_evidence_quality !== 'minimal') {
    errors.push(`expected minimal quality, got ${refined.refined_meta.camera_evidence_quality}`);
  }
  if (refined.refined_meta.confidence_cap != null) {
    errors.push('invalid/missing minimal path should not get an extra confidence cap');
  }
  if (refined.refined_meta.baseline_confidence !== baseline.confidence) {
    errors.push('baseline_confidence trace should be preserved');
  }
  const ev = cameraToEvidence(invalidCamera);
  const axisValues = Object.values(ev.axis_scores);
  if (axisValues.some((value) => value !== 0)) {
    errors.push('invalid/minimal camera evidence should not add camera axis influence');
  }
  return errors;
});

run('source keeps cameraWeight minimal mapping at 0.0', () => {
  const source = readFileSync(
    join(projectRoot, 'src/lib/deep-v2/builders/build-camera-refined-result.ts'),
    'utf-8'
  );
  if (!/cameraQuality === 'partial'\s*\?\s*0\.4\s*:\s*0\.0/.test(source)) {
    return ['cameraWeight mapping for minimal should remain 0.0'];
  }
  return [];
});

run('pass/progression fields are not mutated by refined packaging', () => {
  const before = pickPassFields(lowQualityCamera);
  const refined = buildCameraRefinedResult(baseline, lowQualityCamera);
  const after = pickPassFields(lowQualityCamera);
  const errors = [];
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    errors.push(`pass fields mutated: before=${JSON.stringify(before)} after=${JSON.stringify(after)}`);
  }
  if (refined.refined_meta.camera_pass !== true) {
    errors.push('camera_pass should stay true after cap');
  }
  return errors;
});

run('session summary effective_confidence reflects capped refined confidence', () => {
  const refined = buildCameraRefinedResult(baseline, lowQualityCamera);
  const summary = buildSessionDeepSummaryFromPublicResult({
    id: 'cap-smoke-public-result',
    stage: 'refined',
    result: refined.result,
  });
  const errors = [];
  if (!approxEqual(summary.confidence, refined.result.confidence)) {
    errors.push('summary.confidence should equal refined result confidence');
  }
  if (!approxEqual(summary.effective_confidence, refined.result.confidence)) {
    errors.push('summary.effective_confidence should equal capped refined confidence');
  }
  return errors;
});

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
