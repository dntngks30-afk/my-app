/**
 * PR-V2-06 — Unified Public Result Renderer Smoke Tests
 *
 * 검증 항목:
 * 1. PublicResultRenderer가 baseline/refined/fallback stage를 지원하는지
 * 2. 레이블 SSOT에 동물 이름이 headline label로 없는지
 * 3. baseline page가 PublicResultRenderer를 import하는지
 * 4. refined page가 PublicResultRenderer를 import하는지
 * 5. 중복 컴포넌트(ConfidenceBar, PriorityVectorBars 등)가 제거되었는지
 * 6. public-result-labels.ts가 레이블 SSOT인지
 * 7. renderer가 UnifiedDeepResultV2를 직접 소비하는지
 * 8. renderer가 route 가정 없이 actions prop으로 CTA를 분리하는지
 * 9. baseline stage / refined stage / fallback stage별 framing이 다른지
 * 10. V2-03/V2-05 builder가 여전히 정상 동작하는지
 *
 * 실행: npx tsx scripts/deep-v2-06-unified-renderer-smoke.mjs
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

const ANIMAL_NAMES = ['kangaroo','hedgehog','turtle','penguin','crab','meerkat','monkey','armadillo','sloth'];
const VALID_PRIMARY_TYPES = [
  'LOWER_INSTABILITY','LOWER_MOBILITY_RESTRICTION','UPPER_IMMOBILITY',
  'CORE_CONTROL_DEFICIT','DECONDITIONED','STABLE','UNKNOWN',
];

// ─── 픽스처 ──────────────────────────────────────────────────────────────────

function makeAnswers(pattern = 'kangaroo_dominant') {
  if (pattern === 'empty') return {};
  if (pattern === 'kangaroo_dominant') {
    return {
      'v2_A1': 1,'v2_A2': 1,'v2_A3': 1,
      'v2_B1': 1,'v2_B2': 1,'v2_B3': 1,
      'v2_C1': 4,'v2_C2': 4,'v2_C3': 4,
      'v2_D1': 1,'v2_D2': 1,'v2_D3': 1,
      'v2_F1': 1,'v2_F2': 1,'v2_F3': 1,
      'v2_G1': 1,'v2_G2': 1,'v2_G3': 1,
    };
  }
  return {};
}

function makeStrongCameraResult() {
  return {
    movementType: 'kangaroo', patternSummary: '허리 주도', avoidItems: [],
    resetAction: '', confidence: 0.85, captureQuality: 'ok', flags: [],
    retryRecommended: false, fallbackMode: null, insufficientSignal: false,
    evaluatorResults: [{
      stepId: 'squat', insufficientSignal: false,
      metrics: [
        { name: 'depth', value: 0.3, trend: 'concern' },
        { name: 'knee_alignment_trend', value: 0.4, trend: 'concern' },
      ],
    }],
    resultEvidenceLevel: 'strong_evidence', resultToneMode: 'confident',
    debug: { perExercise: [] },
  };
}

function makeInsufficientCameraResult() {
  return {
    movementType: 'unknown', patternSummary: '', avoidItems: [],
    resetAction: '', confidence: 0, captureQuality: 'invalid', flags: ['insufficient_signal'],
    retryRecommended: true, fallbackMode: 'survey', insufficientSignal: true,
    evaluatorResults: [], resultEvidenceLevel: 'insufficient_signal', resultToneMode: 'retry_or_reset',
    debug: { perExercise: [] },
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const { buildFreeSurveyBaselineResult } = await import(
    '../src/lib/deep-v2/builders/build-free-survey-baseline.ts'
  );
  const { buildCameraRefinedResult } = await import(
    '../src/lib/deep-v2/builders/build-camera-refined-result.ts'
  );
  const { validateUnifiedDeepResultV2 } = await import(
    '../src/lib/result/deep-result-v2-contract.ts'
  );
  const labels = await import(
    '../src/components/public-result/public-result-labels.ts'
  );

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('  PR-V2-06 Unified Public Result Renderer Smoke Tests');
  console.log('══════════════════════════════════════════════════════════════\n');

  // ──────────────────────────────────────────────────────────────────────────
  // 1. 레이블 SSOT 검증
  // ──────────────────────────────────────────────────────────────────────────
  console.log('[ 1. 레이블 SSOT — public-result-labels.ts ]');

  run('PRIMARY_TYPE_LABELS가 모든 UnifiedPrimaryType를 포함', () => {
    const errors = [];
    for (const type of VALID_PRIMARY_TYPES) {
      if (!labels.PRIMARY_TYPE_LABELS[type])
        errors.push(`${type} missing in PRIMARY_TYPE_LABELS`);
    }
    return errors;
  });

  run('PRIMARY_TYPE_LABELS에 동물 이름 headline 없음', () => {
    const errors = [];
    for (const [type, label] of Object.entries(labels.PRIMARY_TYPE_LABELS)) {
      for (const animal of ANIMAL_NAMES) {
        if (label.toLowerCase().includes(animal))
          errors.push(`PRIMARY_TYPE_LABELS[${type}] contains animal: ${animal}`);
      }
    }
    return errors;
  });

  run('AXIS_LABELS가 6축 모두 포함', () => {
    const axes = ['lower_stability','lower_mobility','upper_mobility','trunk_control','asymmetry','deconditioned'];
    return axes.filter((ax) => !labels.AXIS_LABELS[ax]).map((ax) => `${ax} missing in AXIS_LABELS`);
  });

  run('EVIDENCE_LEVEL_LABELS가 lite/partial/full 포함', () => {
    const levels = ['lite','partial','full'];
    return levels.filter((l) => !labels.EVIDENCE_LEVEL_LABELS[l]).map((l) => `${l} missing`);
  });

  run('filterDisplayableMissingSignals — _empty / _step_ 제외', () => {
    const input = ['pain_intensity_missing','some_step_done','some_value_empty','camera_evidence_partial'];
    const result = labels.filterDisplayableMissingSignals(input);
    const errors = [];
    if (result.includes('some_step_done')) errors.push('_step_ should be filtered');
    if (result.includes('some_value_empty')) errors.push('_empty should be filtered');
    if (!result.includes('pain_intensity_missing')) errors.push('pain_intensity_missing should pass');
    return errors;
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. PublicResultRenderer 구조 검증 (파일 내 문자열)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[ 2. PublicResultRenderer 구조 검증 ]');

  const rendererContent = readFile('src/components/public-result/PublicResultRenderer.tsx');

  run('PublicResultStage 타입 정의 (baseline/refined/fallback)', () => {
    const errors = [];
    if (!rendererContent.includes("'baseline'")) errors.push('baseline stage missing');
    if (!rendererContent.includes("'refined'")) errors.push('refined stage missing');
    if (!rendererContent.includes("'fallback'")) errors.push('fallback stage missing');
    return errors;
  });

  run('renderer가 public-result-labels import', () => {
    if (!rendererContent.includes('public-result-labels'))
      return ['renderer should import from public-result-labels'];
    return [];
  });

  run('renderer가 UnifiedDeepResultV2를 result prop으로 받음', () => {
    if (!rendererContent.includes('UnifiedDeepResultV2'))
      return ['renderer should reference UnifiedDeepResultV2'];
    return [];
  });

  run('renderer에 동물 이름 headline label 없음', () => {
    const errors = [];
    for (const animal of ANIMAL_NAMES) {
      if (rendererContent.toLowerCase().includes(`'${animal}'`) || rendererContent.toLowerCase().includes(`"${animal}"`))
        errors.push(`renderer contains animal string literal: ${animal}`);
    }
    return errors;
  });

  run('renderer에 actions prop이 있음 (routing 분리)', () => {
    if (!rendererContent.includes('actions')) return ['renderer should have actions prop'];
    return [];
  });

  run('stage별 provenanceCopy가 다름', () => {
    const baselineCopy = rendererContent.includes('설문 기반 기초 분석입니다');
    const refinedCopy = rendererContent.includes('카메라 동작 분석이 융합된');
    const errors = [];
    if (!baselineCopy) errors.push('baseline provenance copy missing');
    if (!refinedCopy) errors.push('refined provenance copy missing');
    return errors;
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. baseline/page.tsx 리팩토링 검증
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[ 3. baseline/page.tsx 리팩토링 ]');

  const baselineContent = readFile('src/app/movement-test/baseline/page.tsx');

  run('baseline page가 PublicResultRenderer import', () => {
    if (!baselineContent.includes('PublicResultRenderer'))
      return ['baseline page should import PublicResultRenderer'];
    return [];
  });

  run('baseline page가 public-result-labels import', () => {
    if (!baselineContent.includes('public-result-labels'))
      return ['baseline page should import from public-result-labels'];
    return [];
  });

  run('baseline page: 중복 ConfidenceBar 컴포넌트 함수 없음', () => {
    // baseline page 내에 function ConfidenceBar 정의가 있으면 중복
    if (baselineContent.includes('function ConfidenceBar'))
      return ['baseline page should not define ConfidenceBar (moved to renderer)'];
    return [];
  });

  run('baseline page: 중복 PriorityVectorBars 컴포넌트 함수 없음', () => {
    if (baselineContent.includes('function PriorityVectorBars'))
      return ['baseline page should not define PriorityVectorBars (moved to renderer)'];
    return [];
  });

  run('baseline page: 중복 ReasonCodeChips 컴포넌트 함수 없음', () => {
    if (baselineContent.includes('function ReasonCodeChips'))
      return ['baseline page should not define ReasonCodeChips (moved to renderer)'];
    return [];
  });

  run('baseline page: stage="baseline" 전달', () => {
    if (!baselineContent.includes('stage="baseline"'))
      return ['baseline page should pass stage="baseline" to renderer'];
    return [];
  });

  run('baseline page: BaselineGateView 여전히 존재 (gate 보존)', () => {
    if (!baselineContent.includes('BaselineGateView'))
      return ['baseline gate should still exist'];
    return [];
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. refined/page.tsx 리팩토링 검증
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[ 4. refined/page.tsx 리팩토링 ]');

  const refinedContent = readFile('src/app/movement-test/refined/page.tsx');

  run('refined page가 PublicResultRenderer import', () => {
    if (!refinedContent.includes('PublicResultRenderer'))
      return ['refined page should import PublicResultRenderer'];
    return [];
  });

  run('refined page: stage="refined" 전달', () => {
    if (!refinedContent.includes('stage="refined"'))
      return ['refined page should pass stage="refined" to renderer'];
    return [];
  });

  run('refined page: stage="fallback" 전달 (camera 불충분 시)', () => {
    if (!refinedContent.includes('stage="fallback"'))
      return ['refined page should pass stage="fallback" for insufficient camera'];
    return [];
  });

  run('refined page: 중복 RefinedResultView 함수 없음', () => {
    if (refinedContent.includes('function RefinedResultView'))
      return ['refined page should not define RefinedResultView (moved to renderer)'];
    return [];
  });

  run('refined page: 중복 BaselineFallbackView 함수 없음', () => {
    if (refinedContent.includes('function BaselineFallbackView'))
      return ['refined page should not define BaselineFallbackView (moved to renderer)'];
    return [];
  });

  run('refined page: 중복 ConfidenceBar 없음', () => {
    if (refinedContent.includes('function ConfidenceBar'))
      return ['refined page should not define ConfidenceBar'];
    return [];
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. UnifiedDeepResultV2 contract — baseline/refined/fallback 모두 통과
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[ 5. UnifiedDeepResultV2 Contract ]');

  const baseline = buildFreeSurveyBaselineResult(makeAnswers('kangaroo_dominant'));
  const emptyBaseline = buildFreeSurveyBaselineResult(makeAnswers('empty'));

  run('baseline result contract 통과', () => {
    const { valid, errors } = validateUnifiedDeepResultV2(baseline.result);
    if (!valid) return errors;
    return [];
  });

  run('empty answers baseline contract 통과', () => {
    const { valid, errors } = validateUnifiedDeepResultV2(emptyBaseline.result);
    if (!valid) return errors;
    return [];
  });

  run('refined result (strong camera) contract 통과', () => {
    const refined = buildCameraRefinedResult(baseline.result, makeStrongCameraResult());
    const { valid, errors } = validateUnifiedDeepResultV2(refined.result);
    if (!valid) return errors;
    return [];
  });

  run('fallback (insufficient camera) result contract 통과', () => {
    const fallbackBaseline = buildFreeSurveyBaselineResult(makeAnswers('kangaroo_dominant'));
    // insufficient camera → fusion still produces result (V2-05 검증됨)
    const refined = buildCameraRefinedResult(fallbackBaseline.result, makeInsufficientCameraResult());
    const { valid, errors } = validateUnifiedDeepResultV2(refined.result);
    if (!valid) return errors;
    return [];
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 6. primary_type이 Deep Result V2 어휘인지
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[ 6. Visible Type — Deep Result V2 어휘 ]');

  run('baseline primary_type이 valid V2 타입', () => {
    if (!VALID_PRIMARY_TYPES.includes(baseline.result.primary_type))
      return [`invalid primary_type: ${baseline.result.primary_type}`];
    return [];
  });

  run('baseline primary_type에 동물 이름 없음', () => {
    const pt = baseline.result.primary_type.toLowerCase();
    for (const animal of ANIMAL_NAMES) {
      if (pt.includes(animal)) return [`primary_type contains animal: ${animal}`];
    }
    return [];
  });

  run('refined primary_type이 valid V2 타입', () => {
    const refined = buildCameraRefinedResult(baseline.result, makeStrongCameraResult());
    if (!VALID_PRIMARY_TYPES.includes(refined.result.primary_type))
      return [`invalid primary_type: ${refined.result.primary_type}`];
    return [];
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 7. renderer가 route 가정 없이 동작 (FLOW-01/02 준비)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[ 7. Future-Load Readiness ]');

  run('renderer가 router/navigation import 없음', () => {
    if (rendererContent.includes("'next/navigation'") || rendererContent.includes('"next/navigation"'))
      return ['renderer should not import next/navigation (routing should be in parent)'];
    return [];
  });

  run('renderer가 localStorage 직접 접근 없음', () => {
    if (rendererContent.includes('localStorage'))
      return ['renderer should not access localStorage (data should be passed in)'];
    return [];
  });

  run('renderer가 UnifiedDeepResultV2 result prop으로 plain object 수용 가능', () => {
    // renderer의 result prop은 UnifiedDeepResultV2만 요구 → FLOW-01/02가 persistence에서 로드한 결과도 전달 가능
    if (!rendererContent.includes('result: UnifiedDeepResultV2'))
      return ['renderer should have result: UnifiedDeepResultV2 in props'];
    return [];
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 8. V2-03/V2-04/V2-05 이전 작업 regression
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[ 8. Regression — V2-03/V2-04/V2-05 ]');

  run('V2-03 builder 여전히 동작 (camera 없이 baseline 생성)', () => {
    try {
      const b = buildFreeSurveyBaselineResult(makeAnswers());
      if (!b || !b.result) return ['baseline builder failed'];
      if (b.baseline_meta.result_stage !== 'baseline') return ['result_stage should be baseline'];
      return [];
    } catch (e) {
      return [`V2-03 builder threw: ${e.message}`];
    }
  });

  run('V2-05 fusion builder 여전히 동작', () => {
    try {
      const b = buildFreeSurveyBaselineResult(makeAnswers());
      const r = buildCameraRefinedResult(b.result, makeStrongCameraResult());
      if (r.refined_meta.result_stage !== 'refined') return ['refined_meta.result_stage should be refined'];
      return [];
    } catch (e) {
      return [`V2-05 builder threw: ${e.message}`];
    }
  });

  run('camera/complete routing → /movement-test/refined 여전히 유효', () => {
    const completeContent = readFile('src/app/movement-test/camera/complete/page.tsx');
    if (!completeContent.includes("'/movement-test/refined'"))
      return ['camera/complete should still route to /movement-test/refined'];
    return [];
  });

  run('survey/page routing → /movement-test/baseline 여전히 유효', () => {
    const surveyContent = readFile('src/app/movement-test/survey/page.tsx');
    if (!surveyContent.includes("'/movement-test/baseline'"))
      return ['survey page should still route to /movement-test/baseline'];
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
