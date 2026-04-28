/**
 * Camera input quality observability smoke (OBS v03 + enrichment policy).
 *
 * Run:
 *   node scripts/camera-input-quality-observability-smoke.mjs
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

function fixtureWithBothIq() {
  return [
    {
      stepId: 'squat',
      insufficientSignal: false,
      metrics: [{ name: 'depth', value: 0.5, trend: 'neutral' }],
      debug: {
        frameCount: 100,
        validFrameCount: 90,
        phaseHints: [],
        highlightedMetrics: {
          completionSatisfied: true,
          completionMachinePhase: 'recovery',
          completionPassReason: 'rule_ok',
          finalPassEligible: true,
          progressionPassed: true,
        },
        squatInternalQuality: {
          depthScore: 0.55,
          controlScore: 0.5,
          symmetryScore: 0.52,
          recoveryScore: 0.48,
          confidence: 0.5,
          qualityTier: 'medium',
          limitations: ['depth_limited'],
          qualityWindow: {
            selectedWindowFrameCount: 12,
            selectedWindowDurationMs: 1100,
            selectedWindowScore: 0.84,
            selectedWindowSource: 'select_quality_window',
            fallbackReason: null,
            warmupExcludedFrameCount: 5,
          },
        },
      },
    },
    {
      stepId: 'overhead-reach',
      insufficientSignal: false,
      metrics: [{ name: 'arm_range', value: 0.6, trend: 'neutral' }],
      debug: {
        frameCount: 80,
        validFrameCount: 70,
        phaseHints: [],
        highlightedMetrics: {
          completionSatisfied: true,
          completionMachinePhase: 'completed',
          raiseCount: 1,
          peakCount: 1,
        },
        overheadInternalQuality: {
          mobilityScore: 0.62,
          controlScore: 0.6,
          symmetryScore: 0.61,
          holdStabilityScore: 0.59,
          confidence: 0.55,
          qualityTier: 'medium',
          limitations: [],
          qualityWindow: {
            selectedWindowFrameCount: 10,
            selectedWindowDurationMs: 900,
            selectedWindowScore: 0.82,
            selectedWindowSource: 'select_quality_window',
            fallbackReason: null,
            warmupExcludedFrameCount: 4,
          },
        },
      },
    },
  ];
}

function fixtureNoIq() {
  return [
    {
      stepId: 'squat',
      insufficientSignal: false,
      metrics: [],
      debug: {
        frameCount: 10,
        validFrameCount: 10,
        phaseHints: [],
        highlightedMetrics: { completionMachinePhase: 'idle' },
      },
    },
  ];
}

const { buildCameraInputQualityObservability } = await import(
  '../src/lib/camera/camera-evidence-summary.ts'
);
const { buildFreeSurveyBaselineResult } = await import(
  '../src/lib/deep-v2/builders/build-free-survey-baseline.ts'
);
const { buildCameraRefinedResult } = await import(
  '../src/lib/deep-v2/builders/build-camera-refined-result.ts'
);

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

console.log('\nPR-CAMERA-QUALITY-OBSERVABILITY-03 smoke\n');

run('buildCameraInputQualityObservability returns stable namespaced v1 object', () => {
  const obs = buildCameraInputQualityObservability(fixtureWithBothIq());
  const errors = [];
  if (obs.policy_version !== 'camera_input_quality_obs_03') {
    errors.push(`unexpected policy_version ${obs.policy_version}`);
  }
  if (obs.interpretation_quality_enrichment_policy == null) {
    errors.push('expected interpretation_quality_enrichment_policy');
  }
  if (obs.squat == null) errors.push('expected squat trace');
  if (obs.overheadReach == null) errors.push('expected overhead trace');
  if (obs.bridge?.refinement_evidence_strength == null) {
    errors.push('expected bridge.refinement_evidence_strength');
  }
  const ns = 'camera_input_quality_obs_03';
  if (!JSON.stringify(obs).includes(ns) && obs.policy_version !== ns) {
    errors.push('payload should be identifiable as obs v02');
  }
  return errors;
});

run('squat trace reflects IQ scores and proxies', () => {
  const obs = buildCameraInputQualityObservability(fixtureWithBothIq());
  const s = obs.squat;
  const errors = [];
  if (!s) return ['squat trace missing'];
  if (s.proxyMovementAmplitudeScore !== s.depthScore) errors.push('proxy amplitude should mirror depthScore');
  if (s.proxyBottomStabilityScore !== s.controlScore) errors.push('proxy bottom stability should mirror controlScore');
  if (s.recoveryContinuityScore !== s.recoveryScore) errors.push('recoveryContinuityScore should mirror recoveryScore');
  if (s.leftRightSignalBalance !== s.symmetryScore) errors.push('L/R balance should mirror symmetryScore');
  if (!s.signalIntegrityTier.startsWith('obs_si|tier=medium')) errors.push('signalIntegrityTier unexpected');
  if (!Array.isArray(s.limitations)) errors.push('limitations should be array');
  if (s.selectedWindow?.selectedWindowFrameCount !== 12) errors.push('selectedWindow frame count should mirror compact IQ trace');
  if ('frames' in (s.selectedWindow ?? {})) errors.push('selectedWindow should not expose raw frames');
  return errors;
});

run('overhead trace reflects hold symmetry aliases', () => {
  const obs = buildCameraInputQualityObservability(fixtureWithBothIq());
  const o = obs.overheadReach;
  const errors = [];
  if (!o) return ['overhead trace missing'];
  if (o.stableTopHoldScore !== o.holdStabilityScore) errors.push('stableTopHoldScore should mirror holdStabilityScore');
  if (o.leftRightSignalBalance !== o.symmetryScore) errors.push('L/R balance should mirror symmetryScore');
  if (o.selectedWindow?.selectedWindowDurationMs !== 900) errors.push('selectedWindow duration should mirror compact IQ trace');
  if ('landmarks' in (o.selectedWindow ?? {})) errors.push('selectedWindow should not expose raw landmarks');
  return errors;
});

run('missing IQ does not throw; traces null-safe', () => {
  try {
    const obs = buildCameraInputQualityObservability(fixtureNoIq());
    const errors = [];
    if (obs.squat != null) errors.push('squat should be null without IQ');
    if (obs.policy_version !== 'camera_input_quality_obs_03') errors.push('policy_version');
    return errors;
  } catch (e) {
    return [`threw: ${e?.message ?? e}`];
  }
});

run('highlightedMetrics and pass-ish fields unchanged after helper (deep-stable)', () => {
  const raw = fixtureWithBothIq();
  const beforeSquatHm = JSON.stringify(raw[0].debug.highlightedMetrics);
  const beforeOhHm = JSON.stringify(raw[1].debug.highlightedMetrics);
  buildCameraInputQualityObservability(raw);
  const afterSquatHm = JSON.stringify(raw[0].debug.highlightedMetrics);
  const afterOhHm = JSON.stringify(raw[1].debug.highlightedMetrics);
  const errors = [];
  if (beforeSquatHm !== afterSquatHm) errors.push('squat highlightedMetrics mutated');
  if (beforeOhHm !== afterOhHm) errors.push('overhead highlightedMetrics mutated');
  return errors;
});

run('buildCameraRefinedResult refined_meta includes camera_input_quality_observability_v1 (additive)', () => {
  const baseline = buildFreeSurveyBaselineResult(makeSurveyAnswers()).result;
  const cameraNormalized = {
    movementType: 'kangaroo',
    patternSummary: 'smoke',
    avoidItems: [],
    resetAction: 'reset',
    confidence: 0.85,
    captureQuality: 'ok',
    flags: [],
    retryRecommended: false,
    fallbackMode: null,
    insufficientSignal: false,
    evaluatorResults: fixtureWithBothIq(),
    resultEvidenceLevel: 'strong_evidence',
    resultToneMode: 'confident',
    debug: { perExercise: [] },
  };
  const refined = buildCameraRefinedResult(baseline, cameraNormalized);
  const errors = [];
  const cq = refined.refined_meta.camera_input_quality_observability_v1;
  if (cq == null) errors.push('expected camera_input_quality_observability_v1 on refined_meta');
  else if (cq.squat == null || cq.overheadReach == null) errors.push('refined IQ obs should mirror fixture');
  else if (cq.squat.selectedWindow?.selectedWindowSource !== 'select_quality_window') {
    errors.push('refined IQ obs should include compact selected-window source');
  }
  return errors;
});

console.log('');
console.log(`Done. ${passed} passed, ${failed} failed.`);

process.exit(failed > 0 ? 1 : 0);
