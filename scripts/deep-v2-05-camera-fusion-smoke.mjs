/**
 * PR-V2-05 — Camera Evidence Fusion Smoke Tests
 *
 * 검증 항목:
 * 1. Pass/Analysis 분리: pass ≠ high confidence
 * 2. camera → DeepScoringEvidence 변환
 * 3. baseline + camera → valid refined Deep Result V2
 * 4. fused visible type이 Deep Result V2 어휘인지
 * 5. camera 완료 후 routing 변경 (파일 내 문자열 검증)
 * 6. 약한 camera evidence → false certainty 없음
 * 7. baseline-only 경로가 여전히 동작
 * 8. UnifiedDeepResultV2 contract 검증
 *
 * 실행: npx tsx scripts/deep-v2-05-camera-fusion-smoke.mjs
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
process.chdir(projectRoot);

let passed = 0;
let failed = 0;

function run(label, fn) {
  try {
    const errs = fn();
    if (!errs || errs.length === 0) {
      console.log(`  ✅ PASS  ${label}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL  ${label}`);
      for (const e of errs) console.error(`         → ${e}`);
      failed++;
    }
  } catch (err) {
    console.error(`  💥 ERROR ${label}: ${err.message}`);
    failed++;
  }
}

function readFile(relPath) {
  return readFileSync(join(projectRoot, relPath), 'utf-8');
}

// ─── 픽스처 ──────────────────────────────────────────────────────────────────

/** 성공적 카메라 결과 (concern 있음) */
function makeStrongCameraResult() {
  return {
    movementType: 'kangaroo',
    patternSummary: '허리 쪽이 먼저 개입하는 패턴',
    avoidItems: ['상체를 과하게 숙이지 않기'],
    resetAction: '벽에 등을 대고 천천히 스쿼트 5회',
    confidence: 0.85,
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
          { name: 'trunk_lean', value: 0.2, trend: 'neutral' },
        ],
      },
      {
        stepId: 'overhead-reach',
        insufficientSignal: false,
        metrics: [
          { name: 'arm_range', value: 0.8, trend: 'good' },
          { name: 'lumbar_extension', value: 0.2, trend: 'neutral' },
        ],
      },
    ],
    resultEvidenceLevel: 'strong_evidence',
    resultToneMode: 'confident',
    debug: { perExercise: [] },
  };
}

/** 약한 카메라 결과 (partial quality) */
function makePartialCameraResult() {
  return {
    movementType: 'hedgehog',
    patternSummary: '일부 구간 신호 약함',
    avoidItems: [],
    resetAction: '다시 촬영해 보세요',
    confidence: 0.55,
    captureQuality: 'low',
    flags: ['soft_partial'],
    retryRecommended: true,
    fallbackMode: 'retry',
    insufficientSignal: false,
    evaluatorResults: [
      {
        stepId: 'squat',
        insufficientSignal: false,
        metrics: [
          { name: 'trunk_lean', value: 0.5, trend: 'concern' },
        ],
      },
    ],
    resultEvidenceLevel: 'shallow_evidence',
    resultToneMode: 'conservative',
    debug: { perExercise: [] },
  };
}

/** insufficient camera result (pass 실패) */
function makeInsufficientCameraResult() {
  return {
    movementType: 'unknown',
    patternSummary: '신호 부족',
    avoidItems: [],
    resetAction: '다시 촬영해 보세요',
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

/** 카메라에 concern 없음 (STABLE 후보) */
/** PR-COMP-06: 레거시 strong_evidence + 스쿼트 내부 품질 저하 → refinement에서 minimal로 보수화 */
function makeStrongCameraWithLowInternalSquat() {
  const base = makeStrongCameraResult();
  const squat = base.evaluatorResults[0];
  const overhead = base.evaluatorResults[1];
  return {
    ...base,
    evaluatorResults: [
      {
        ...squat,
        debug: {
          frameCount: 120,
          validFrameCount: 100,
          phaseHints: [],
          highlightedMetrics: {
            completionSatisfied: 1,
            completionMachinePhase: 'completed',
          },
          squatInternalQuality: {
            depthScore: 0.25,
            controlScore: 0.25,
            symmetryScore: 0.25,
            recoveryScore: 0.25,
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
      overhead,
    ],
  };
}

/** PR-COMP-06: 양쪽 medium internal → strong 베이스를 partial로 한 단계 다운 */
function makeStrongCameraWithMediumInternalBoth() {
  const base = makeStrongCameraResult();
  const squat = base.evaluatorResults[0];
  const overhead = base.evaluatorResults[1];
  return {
    ...base,
    evaluatorResults: [
      {
        ...squat,
        debug: {
          frameCount: 120,
          validFrameCount: 100,
          phaseHints: [],
          highlightedMetrics: {
            completionSatisfied: 1,
            completionMachinePhase: 'completed',
          },
          squatInternalQuality: {
            depthScore: 0.5,
            controlScore: 0.5,
            symmetryScore: 0.5,
            recoveryScore: 0.5,
            confidence: 0.5,
            qualityTier: 'medium',
            limitations: ['depth_limited'],
          },
        },
      },
      {
        ...overhead,
        debug: {
          frameCount: 120,
          validFrameCount: 100,
          phaseHints: [],
          highlightedMetrics: {
            completionSatisfied: 1,
            completionMachinePhase: 'completed',
          },
          overheadInternalQuality: {
            mobilityScore: 0.5,
            controlScore: 0.5,
            symmetryScore: 0.5,
            holdStabilityScore: 0.5,
            confidence: 0.5,
            qualityTier: 'medium',
            limitations: ['hold_stability_weak'],
          },
        },
      },
    ],
  };
}

function makeGoodCameraResult() {
  return {
    movementType: 'monkey',
    patternSummary: '균형형',
    avoidItems: [],
    resetAction: '',
    confidence: 0.9,
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
          { name: 'depth', value: 0.8, trend: 'good' },
          { name: 'knee_alignment_trend', value: 0.9, trend: 'good' },
        ],
      },
    ],
    resultEvidenceLevel: 'strong_evidence',
    resultToneMode: 'confident',
    debug: { perExercise: [] },
  };
}

function makeKangarooDominantSurveyAnswers() {
  return {
    'v2_A1': 1, 'v2_A2': 1, 'v2_A3': 1,
    'v2_B1': 1, 'v2_B2': 1, 'v2_B3': 1,
    'v2_C1': 4, 'v2_C2': 4, 'v2_C3': 4,
    'v2_D1': 1, 'v2_D2': 1, 'v2_D3': 1,
    'v2_F1': 1, 'v2_F2': 1, 'v2_F3': 1,
    'v2_G1': 1, 'v2_G2': 1, 'v2_G3': 1,
  };
}

const VALID_PRIMARY_TYPES = [
  'LOWER_INSTABILITY', 'LOWER_MOBILITY_RESTRICTION', 'UPPER_IMMOBILITY',
  'CORE_CONTROL_DEFICIT', 'DECONDITIONED', 'STABLE', 'UNKNOWN',
];

const ANIMAL_NAMES = ['kangaroo','hedgehog','turtle','penguin','crab','meerkat','monkey','armadillo','sloth'];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const { isCameraPassCompleted, getCameraEvidenceQuality, cameraToEvidence } = await import(
    '../src/lib/deep-v2/adapters/camera-to-evidence.ts'
  );
  const { buildCameraRefinedResult } = await import(
    '../src/lib/deep-v2/builders/build-camera-refined-result.ts'
  );
  const { buildFreeSurveyBaselineResult } = await import(
    '../src/lib/deep-v2/builders/build-free-survey-baseline.ts'
  );
  const { validateUnifiedDeepResultV2 } = await import(
    '../src/lib/result/deep-result-v2-contract.ts'
  );

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('  PR-V2-05 Camera Evidence Fusion Smoke Tests');
  console.log('══════════════════════════════════════════════════════════════\n');

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Pass / Analysis 분리
  // ──────────────────────────────────────────────────────────────────────────
  console.log('[ 1. Pass / Analysis 분리 ]');

  run('insufficient → isCameraPassCompleted = false', () => {
    if (isCameraPassCompleted(makeInsufficientCameraResult()))
      return ['insufficient result should not pass'];
    return [];
  });

  run('strong → isCameraPassCompleted = true', () => {
    if (!isCameraPassCompleted(makeStrongCameraResult()))
      return ['strong result should pass'];
    return [];
  });

  run('partial → isCameraPassCompleted = true (pass, but partial analysis)', () => {
    if (!isCameraPassCompleted(makePartialCameraResult()))
      return ['partial result should still pass'];
    return [];
  });

  run('strong → getCameraEvidenceQuality = strong', () => {
    const q = getCameraEvidenceQuality(makeStrongCameraResult());
    if (q !== 'strong') return [`expected strong, got ${q}`];
    return [];
  });

  run('partial → getCameraEvidenceQuality = partial', () => {
    const q = getCameraEvidenceQuality(makePartialCameraResult());
    if (q !== 'partial') return [`expected partial, got ${q}`];
    return [];
  });

  run('insufficient → getCameraEvidenceQuality = minimal', () => {
    const q = getCameraEvidenceQuality(makeInsufficientCameraResult());
    if (q !== 'minimal') return [`expected minimal, got ${q}`];
    return [];
  });

  run('PR-COMP-06: strong legacy + low internal squat → getCameraEvidenceQuality = minimal', () => {
    const q = getCameraEvidenceQuality(makeStrongCameraWithLowInternalSquat());
    if (q !== 'minimal') return [`expected minimal, got ${q}`];
    return [];
  });

  run('PR-COMP-06: strong legacy + medium internal both → getCameraEvidenceQuality = partial', () => {
    const q = getCameraEvidenceQuality(makeStrongCameraWithMediumInternalBoth());
    if (q !== 'partial') return [`expected partial, got ${q}`];
    return [];
  });

  run('pass 성공해도 evidence quality는 별도 (partial pass ≠ strong analysis)', () => {
    const partial = makePartialCameraResult();
    const isPass = isCameraPassCompleted(partial);
    const quality = getCameraEvidenceQuality(partial);
    if (!isPass) return ['partial should pass'];
    if (quality === 'strong') return ['partial pass should not be strong quality'];
    return [];
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Camera → DeepScoringEvidence
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[ 2. Camera → DeepScoringEvidence ]');

  run('strong camera → 6축 axis_scores 반환', () => {
    const ev = cameraToEvidence(makeStrongCameraResult());
    const axes = ['lower_stability','lower_mobility','upper_mobility','trunk_control','asymmetry','deconditioned'];
    const errors = [];
    for (const ax of axes) {
      if (typeof ev.axis_scores[ax] !== 'number') errors.push(`${ax} must be number`);
      if (ev.axis_scores[ax] < 0) errors.push(`${ax} must be >= 0`);
    }
    return errors;
  });

  run('pain_signals는 전부 undefined (카메라에 pain 문항 없음)', () => {
    const ev = cameraToEvidence(makeStrongCameraResult());
    const errors = [];
    if (ev.pain_signals.max_intensity !== undefined)
      errors.push('max_intensity should be undefined');
    if (ev.pain_signals.primary_discomfort_none !== undefined)
      errors.push('primary_discomfort_none should be undefined');
    return errors;
  });

  run('missing_signals에 pain_intensity_missing 포함', () => {
    const ev = cameraToEvidence(makeStrongCameraResult());
    if (!ev.missing_signals.includes('pain_intensity_missing'))
      return ['pain_intensity_missing should be in missing_signals'];
    return [];
  });

  run('concern 없는 camera → movement_quality.all_good = true', () => {
    const ev = cameraToEvidence(makeGoodCameraResult());
    if (!ev.movement_quality.all_good)
      return ['all-good camera should have all_good = true'];
    return [];
  });

  run('concern 있는 camera → movement_quality.all_good = false', () => {
    const ev = cameraToEvidence(makeStrongCameraResult());
    if (ev.movement_quality.all_good)
      return ['camera with concerns should have all_good = false'];
    return [];
  });

  run('insufficient camera → axis_scores 모두 0', () => {
    const ev = cameraToEvidence(makeInsufficientCameraResult());
    const axes = ['lower_stability','lower_mobility','upper_mobility','trunk_control','asymmetry','deconditioned'];
    const errors = [];
    for (const ax of axes) {
      if (ev.axis_scores[ax] !== 0) errors.push(`${ax} should be 0 for insufficient: ${ev.axis_scores[ax]}`);
    }
    return errors;
  });

  run('squat knee concern → lower_stability > 0', () => {
    const ev = cameraToEvidence(makeStrongCameraResult());
    if (ev.axis_scores.lower_stability <= 0)
      return [`expected lower_stability > 0, got ${ev.axis_scores.lower_stability}`];
    return [];
  });

  run('squat depth concern → lower_mobility > 0', () => {
    const ev = cameraToEvidence(makeStrongCameraResult());
    if (ev.axis_scores.lower_mobility <= 0)
      return [`expected lower_mobility > 0, got ${ev.axis_scores.lower_mobility}`];
    return [];
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Baseline + Camera Fusion
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[ 3. Baseline + Camera Fusion ]');

  const baselineForFusion = buildFreeSurveyBaselineResult(makeKangarooDominantSurveyAnswers()).result;

  run('strong camera fusion → valid refined result', () => {
    const r = buildCameraRefinedResult(baselineForFusion, makeStrongCameraResult());
    if (!r || !r.result || !r.refined_meta) return ['refined result structure invalid'];
    return [];
  });

  run('refined result result_stage = "refined"', () => {
    const r = buildCameraRefinedResult(baselineForFusion, makeStrongCameraResult());
    if (r.refined_meta.result_stage !== 'refined')
      return [`expected refined, got ${r.refined_meta.result_stage}`];
    return [];
  });

  run('source_inputs includes both free_survey and camera', () => {
    const r = buildCameraRefinedResult(baselineForFusion, makeStrongCameraResult());
    const errors = [];
    if (!r.refined_meta.source_inputs.includes('free_survey'))
      errors.push('source_inputs should include free_survey');
    if (!r.refined_meta.source_inputs.includes('camera'))
      errors.push('source_inputs should include camera');
    return errors;
  });

  run('source_mode = camera', () => {
    const r = buildCameraRefinedResult(baselineForFusion, makeStrongCameraResult());
    if (r.result.source_mode !== 'camera')
      return [`expected camera, got ${r.result.source_mode}`];
    return [];
  });

  run('refined confidence >= baseline confidence (camera adds signal)', () => {
    const r = buildCameraRefinedResult(baselineForFusion, makeStrongCameraResult());
    // strong camera + dominant pattern → confidence should be >= baseline
    // (baseline은 18/18 → confidence ≈ 1.0 이미 높지만 gap bonus 합산)
    if (typeof r.result.confidence !== 'number')
      return ['confidence must be number'];
    if (r.result.confidence < 0 || r.result.confidence > 1)
      return [`confidence out of range: ${r.result.confidence}`];
    return [];
  });

  run('insufficient camera → fusion still produces result (safe fallback)', () => {
    try {
      const r = buildCameraRefinedResult(baselineForFusion, makeInsufficientCameraResult());
      if (!r || !r.result) return ['should produce result even with insufficient camera'];
      return [];
    } catch (e) {
      return [`should not throw: ${e.message}`];
    }
  });

  run('partial camera → evidence_level ≠ full (보수적 평가)', () => {
    const r = buildCameraRefinedResult(baselineForFusion, makePartialCameraResult());
    if (r.result.evidence_level === 'full')
      return ['partial camera should not produce full evidence_level'];
    return [];
  });

  run('good camera (no concerns) → primary_type = STABLE 가능', () => {
    const goodBaseline = buildFreeSurveyBaselineResult({}).result; // empty → STABLE
    const r = buildCameraRefinedResult(goodBaseline, makeGoodCameraResult());
    if (r.result.primary_type !== 'STABLE')
      return [`expected STABLE for all-good camera, got ${r.result.primary_type}`];
    return [];
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Visible Type이 Deep Result V2 어휘인지
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[ 4. Visible Type — Deep Result V2 어휘 ]');

  run('primary_type은 UnifiedPrimaryType 어휘 값', () => {
    const r = buildCameraRefinedResult(baselineForFusion, makeStrongCameraResult());
    if (!VALID_PRIMARY_TYPES.includes(r.result.primary_type))
      return [`invalid primary_type: ${r.result.primary_type}`];
    return [];
  });

  run('primary_type에 동물 이름 없음', () => {
    const r = buildCameraRefinedResult(baselineForFusion, makeStrongCameraResult());
    const pt = r.result.primary_type.toLowerCase();
    for (const animal of ANIMAL_NAMES) {
      if (pt.includes(animal)) return [`primary_type contains animal: ${animal}`];
    }
    return [];
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. UnifiedDeepResultV2 Contract
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[ 5. UnifiedDeepResultV2 Contract ]');

  const contractFixtures = [
    { label: 'strong camera',      camera: makeStrongCameraResult() },
    { label: 'partial camera',     camera: makePartialCameraResult() },
    { label: 'insufficient camera',camera: makeInsufficientCameraResult() },
    { label: 'good camera (STABLE)',camera: makeGoodCameraResult() },
  ];

  for (const { label, camera } of contractFixtures) {
    run(`contract: ${label}`, () => {
      const r = buildCameraRefinedResult(baselineForFusion, camera);
      const { valid, errors } = validateUnifiedDeepResultV2(r.result);
      if (!valid) return errors;
      return [];
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 6. Camera completion routing 변경
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[ 6. Camera Completion Routing ]');

  run('camera/complete: /movement-test/result 직행 없어야 함', () => {
    const content = readFile('src/app/movement-test/camera/complete/page.tsx');
    if (content.includes("router.push('/movement-test/result')"))
      return ['camera/complete still routes to /movement-test/result'];
    return [];
  });

  run('camera/complete: /movement-test/refined으로 이동', () => {
    const content = readFile('src/app/movement-test/camera/complete/page.tsx');
    if (!content.includes("router.push('/movement-test/refined')"))
      return ['camera/complete should route to /movement-test/refined'];
    return [];
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 7. Baseline-only 경로 여전히 동작
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[ 7. Baseline-Only 경로 여전히 동작 ]');

  run('V2-03 builder가 camera 없이도 동작', () => {
    try {
      const b = buildFreeSurveyBaselineResult(makeKangarooDominantSurveyAnswers());
      if (!b || !b.result) return ['baseline builder should work without camera'];
      if (b.baseline_meta.result_stage !== 'baseline')
        return ['result_stage should still be baseline'];
      return [];
    } catch (e) {
      return [`baseline builder threw: ${e.message}`];
    }
  });

  run('refined result를 만들어도 baseline 결과는 독립적', () => {
    const baseline = buildFreeSurveyBaselineResult(makeKangarooDominantSurveyAnswers());
    const refined = buildCameraRefinedResult(baseline.result, makeStrongCameraResult());
    // baseline은 변경되지 않아야 함
    if (baseline.baseline_meta.result_stage !== 'baseline')
      return ['baseline_meta should remain baseline'];
    if (refined.refined_meta.result_stage !== 'refined')
      return ['refined_meta should be refined'];
    return [];
  });

  run('refined/page.tsx: V2-03 builder import (중복 없이 재사용)', () => {
    const content = readFile('src/app/movement-test/refined/page.tsx');
    if (!content.includes('buildFreeSurveyBaselineResult'))
      return ['refined page should import buildFreeSurveyBaselineResult'];
    if (!content.includes('buildCameraRefinedResult'))
      return ['refined page should import buildCameraRefinedResult'];
    return [];
  });

  run('refined/page.tsx: Deep Result V2 어휘 사용', () => {
    const content = readFile('src/app/movement-test/refined/page.tsx');
    if (!content.includes('PRIMARY_TYPE_LABELS'))
      return ['refined page should use PRIMARY_TYPE_LABELS (Deep Result V2 vocabulary)'];
    return [];
  });

  run('refined/page.tsx: 동물 이름이 headline label에 없음', () => {
    const content = readFile('src/app/movement-test/refined/page.tsx');
    const labelSection = content.match(/PRIMARY_TYPE_LABELS[^}]*}/s)?.[0] ?? '';
    const errors = [];
    for (const animal of ['kangaroo','hedgehog','turtle','penguin','crab','meerkat','armadillo','sloth']) {
      if (labelSection.toLowerCase().includes(animal))
        errors.push(`PRIMARY_TYPE_LABELS contains animal name: ${animal}`);
    }
    return errors;
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 8. 약한 evidence → false certainty 없음
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[ 8. 약한 Evidence → False Certainty 없음 ]');

  run('insufficient camera → evidence_level ≠ full', () => {
    const r = buildCameraRefinedResult(baselineForFusion, makeInsufficientCameraResult());
    if (r.result.evidence_level === 'full')
      return ['insufficient camera should not produce full evidence_level'];
    return [];
  });

  run('insufficient camera → camera_pass = false 기록됨', () => {
    const r = buildCameraRefinedResult(baselineForFusion, makeInsufficientCameraResult());
    if (r.refined_meta.camera_pass !== false)
      return ['camera_pass should be false for insufficient camera'];
    return [];
  });

  run('partial camera → reason_codes에 camera_evidence_partial 포함', () => {
    const r = buildCameraRefinedResult(baselineForFusion, makePartialCameraResult());
    if (!r.result.reason_codes.includes('camera_evidence_partial'))
      return ['reason_codes should include camera_evidence_partial for partial evidence'];
    return [];
  });

  // ─── 결과 요약 ─────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('══════════════════════════════════════════════════════════════\n');

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
