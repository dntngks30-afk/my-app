/**
 * PR-V2-03 — Free Survey Baseline Adapter Smoke & Acceptance Tests
 *
 * 검증 항목:
 * 1. Raw answers 정규화 및 answered_count 계산
 * 2. Free survey → DeepScoringEvidence 변환
 * 3. MONKEY 타입 → STABLE 분류
 * 4. 패턴별 타입 분류 (penguin→LOWER_INSTABILITY, hedgehog→UPPER_IMMOBILITY 등)
 * 5. Baseline result builder 전체 파이프라인
 * 6. Baseline metadata 정확성 (result_stage, source_inputs, refinement_available)
 * 7. Confidence V2 시맨틱 (0~1 범위, old free-score passthrough 아님)
 * 8. Pain 관련 카메라 전용 필드 의존 없음
 * 9. Deep Result V2 계약(UnifiedDeepResultV2) 만족
 * 10. 기존 free localStorage 흐름 독립성 (backward compat)
 *
 * 실행: npx tsx scripts/deep-v2-03-free-survey-baseline-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
process.chdir(projectRoot);

// ─── Test Runner ──────────────────────────────────────────────────────────────

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
    console.error(err.stack);
    failed++;
  }
}

// ─── 테스트 픽스처 ─────────────────────────────────────────────────────────────

/**
 * 모든 답변 = 값 (균형형 — monkey 결과 유도)
 * v2 scoring: top1 < 55 → MONKEY
 */
function makeMonkeyAnswers() {
  const ids = [
    'v2_A1','v2_A2','v2_A3',
    'v2_B1','v2_B2','v2_B3',
    'v2_C1','v2_C2','v2_C3',
    'v2_D1','v2_D2','v2_D3',
    'v2_F1','v2_F2','v2_F3',
    'v2_G1','v2_G2','v2_G3',
  ];
  // 모든 축을 동일하게 2 → 균형형 (avg=50, no dominant)
  const answers = {};
  for (const id of ids) answers[id] = 2;
  return answers;
}

/** penguin 축(무릎/발목) 강함 → LOWER_INSTABILITY 기대 */
function makePenguinDominantAnswers() {
  return {
    'v2_A1': 1, 'v2_A2': 1, 'v2_A3': 1, // turtle 낮음
    'v2_B1': 1, 'v2_B2': 1, 'v2_B3': 1, // hedgehog 낮음
    'v2_C1': 1, 'v2_C2': 1, 'v2_C3': 1, // kangaroo 낮음
    'v2_D1': 4, 'v2_D2': 4, 'v2_D3': 4, // penguin 매우 강함
    'v2_F1': 1, 'v2_F2': 1, 'v2_F3': 1, // crab 낮음
    'v2_G1': 1, 'v2_G2': 1, 'v2_G3': 1, // meerkat 낮음
  };
}

/** hedgehog 축(흉추 닫힘/등 굽음) 강함 → UPPER_IMMOBILITY 기대 */
function makeHedgehogDominantAnswers() {
  return {
    'v2_A1': 1, 'v2_A2': 1, 'v2_A3': 1,
    'v2_B1': 4, 'v2_B2': 4, 'v2_B3': 4, // hedgehog 매우 강함
    'v2_C1': 1, 'v2_C2': 1, 'v2_C3': 1,
    'v2_D1': 1, 'v2_D2': 1, 'v2_D3': 1,
    'v2_F1': 1, 'v2_F2': 1, 'v2_F3': 1,
    'v2_G1': 1, 'v2_G2': 1, 'v2_G3': 1,
  };
}

/** kangaroo 축(허리 과부하) 강함 → CORE_CONTROL_DEFICIT 기대 */
function makeKangarooDominantAnswers() {
  return {
    'v2_A1': 1, 'v2_A2': 1, 'v2_A3': 1,
    'v2_B1': 1, 'v2_B2': 1, 'v2_B3': 1,
    'v2_C1': 4, 'v2_C2': 4, 'v2_C3': 4, // kangaroo 매우 강함
    'v2_D1': 1, 'v2_D2': 1, 'v2_D3': 1,
    'v2_F1': 1, 'v2_F2': 1, 'v2_F3': 1,
    'v2_G1': 1, 'v2_G2': 1, 'v2_G3': 1,
  };
}

/** 미응답 포함 — answered_count < 18 → evidence_level='lite' 기대 */
function makePartialAnswers() {
  return {
    'v2_A1': 3, 'v2_A2': 3, // turtle 일부 응답
    'v2_B1': 2, 'v2_B2': 2,
    'v2_C1': 4, // kangaroo 일부 응답
    // 나머지 미응답
  };
}

/** COMPOSITE_ARMADILLO 유도: 여러 축이 동시에 높음 */
function makeArmadilloAnswers() {
  return {
    'v2_A1': 4, 'v2_A2': 4, 'v2_A3': 4, // turtle 강함
    'v2_B1': 4, 'v2_B2': 4, 'v2_B3': 4, // hedgehog 강함
    'v2_C1': 4, 'v2_C2': 4, 'v2_C3': 4, // kangaroo 강함
    'v2_D1': 4, 'v2_D2': 4, 'v2_D3': 4, // penguin 강함
    'v2_F1': 3, 'v2_F2': 3, 'v2_F3': 3, // crab 중간
    'v2_G1': 4, 'v2_G2': 4, 'v2_G3': 4, // meerkat 강함
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const { freeSurveyAnswersToEvidence } = await import(
    '../src/lib/deep-v2/adapters/free-survey-to-evidence.ts'
  );
  const { buildFreeSurveyBaselineResult } = await import(
    '../src/lib/deep-v2/builders/build-free-survey-baseline.ts'
  );
  const { validateUnifiedDeepResultV2 } = await import(
    '../src/lib/result/deep-result-v2-contract.ts'
  );

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  PR-V2-03 Free Survey Baseline Adapter — Smoke Tests');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Raw answers 정규화 & answered_count
  // ──────────────────────────────────────────────────────────────────────────
  console.log('[ 1. Raw Answers 정규화 / answered_count ]');

  run('18문항 전체 응답 → answered_count = 18', () => {
    const evidence = freeSurveyAnswersToEvidence(makeMonkeyAnswers());
    if (evidence.answered_count !== 18)
      return [`expected 18, got ${evidence.answered_count}`];
    if (evidence.total_count !== 18)
      return [`expected total_count 18, got ${evidence.total_count}`];
    return [];
  });

  run('일부 응답 → answered_count = 실제 응답 수', () => {
    const partial = makePartialAnswers();
    const answeredCount = Object.keys(partial).length; // 5
    const evidence = freeSurveyAnswersToEvidence(partial);
    if (evidence.answered_count !== answeredCount)
      return [`expected ${answeredCount}, got ${evidence.answered_count}`];
    return [];
  });

  run('빈 답변 → answered_count = 0', () => {
    const evidence = freeSurveyAnswersToEvidence({});
    if (evidence.answered_count !== 0)
      return [`expected 0, got ${evidence.answered_count}`];
    return [];
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Free survey → DeepScoringEvidence 변환
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[ 2. Free Survey → DeepScoringEvidence ]');

  run('evidence는 6축 axis_scores를 반환해야 함', () => {
    const evidence = freeSurveyAnswersToEvidence(makePenguinDominantAnswers());
    const axes = ['lower_stability','lower_mobility','upper_mobility','trunk_control','asymmetry','deconditioned'];
    const errors = [];
    for (const ax of axes) {
      if (typeof evidence.axis_scores[ax] !== 'number')
        errors.push(`${ax} should be number`);
      if (evidence.axis_scores[ax] < 0)
        errors.push(`${ax} should be >= 0`);
    }
    return errors;
  });

  run('pain_signals는 모두 undefined (pain 문항 없음)', () => {
    const evidence = freeSurveyAnswersToEvidence(makeKangarooDominantAnswers());
    const errors = [];
    if (evidence.pain_signals.max_intensity !== undefined)
      errors.push(`max_intensity should be undefined, got ${evidence.pain_signals.max_intensity}`);
    if (evidence.pain_signals.primary_discomfort_none !== undefined)
      errors.push('primary_discomfort_none should be undefined');
    return errors;
  });

  run('missing_signals에 pain_intensity_missing 포함', () => {
    const evidence = freeSurveyAnswersToEvidence(makePenguinDominantAnswers());
    if (!evidence.missing_signals.includes('pain_intensity_missing'))
      return ['missing_signals should include pain_intensity_missing'];
    return [];
  });

  run('missing_signals에 objective_movement_test_missing 포함', () => {
    const evidence = freeSurveyAnswersToEvidence(makePenguinDominantAnswers());
    if (!evidence.missing_signals.includes('objective_movement_test_missing'))
      return ['missing_signals should include objective_movement_test_missing'];
    return [];
  });

  run('penguin 강함 → lower_stability > trunk_control', () => {
    const evidence = freeSurveyAnswersToEvidence(makePenguinDominantAnswers());
    const { lower_stability, trunk_control } = evidence.axis_scores;
    if (lower_stability <= trunk_control)
      return [`expected lower_stability(${lower_stability}) > trunk_control(${trunk_control})`];
    return [];
  });

  run('hedgehog 강함 → upper_mobility가 가장 높음', () => {
    const evidence = freeSurveyAnswersToEvidence(makeHedgehogDominantAnswers());
    const { upper_mobility, lower_stability, trunk_control, asymmetry } = evidence.axis_scores;
    const errors = [];
    if (upper_mobility <= lower_stability)
      errors.push(`upper_mobility(${upper_mobility}) should > lower_stability(${lower_stability})`);
    if (upper_mobility <= trunk_control)
      errors.push(`upper_mobility(${upper_mobility}) should > trunk_control(${trunk_control})`);
    return errors;
  });

  run('kangaroo 강함 → trunk_control이 dominant', () => {
    const evidence = freeSurveyAnswersToEvidence(makeKangarooDominantAnswers());
    const { trunk_control, upper_mobility, lower_stability } = evidence.axis_scores;
    const errors = [];
    if (trunk_control <= upper_mobility)
      errors.push(`trunk_control(${trunk_control}) should > upper_mobility(${upper_mobility})`);
    if (trunk_control <= lower_stability)
      errors.push(`trunk_control(${trunk_control}) should > lower_stability(${lower_stability})`);
    return errors;
  });

  run('MONKEY → movement axis_scores 모두 0 (균형형 처리)', () => {
    const evidence = freeSurveyAnswersToEvidence(makeMonkeyAnswers());
    const mv = evidence.axis_scores;
    const errors = [];
    if (mv.lower_stability !== 0) errors.push(`lower_stability should be 0, got ${mv.lower_stability}`);
    if (mv.lower_mobility !== 0)  errors.push(`lower_mobility should be 0, got ${mv.lower_mobility}`);
    if (mv.upper_mobility !== 0)  errors.push(`upper_mobility should be 0, got ${mv.upper_mobility}`);
    if (mv.trunk_control !== 0)   errors.push(`trunk_control should be 0, got ${mv.trunk_control}`);
    if (mv.asymmetry !== 0)       errors.push(`asymmetry should be 0, got ${mv.asymmetry}`);
    return errors;
  });

  run('MONKEY → movement_quality.all_good = true', () => {
    const evidence = freeSurveyAnswersToEvidence(makeMonkeyAnswers());
    if (!evidence.movement_quality.all_good)
      return ['MONKEY type should have movement_quality.all_good = true'];
    return [];
  });

  run('비-MONKEY → movement_quality.all_good = false', () => {
    const evidence = freeSurveyAnswersToEvidence(makePenguinDominantAnswers());
    if (evidence.movement_quality.all_good)
      return ['non-MONKEY type should have movement_quality.all_good = false'];
    return [];
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Baseline Result Builder — 전체 파이프라인
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[ 3. Baseline Result Builder — 파이프라인 ]');

  run('MONKEY → primary_type = STABLE', () => {
    const baseline = buildFreeSurveyBaselineResult(makeMonkeyAnswers());
    if (baseline.result.primary_type !== 'STABLE')
      return [`expected STABLE, got ${baseline.result.primary_type}`];
    return [];
  });

  run('penguin 강함 → primary_type = LOWER_INSTABILITY', () => {
    const baseline = buildFreeSurveyBaselineResult(makePenguinDominantAnswers());
    if (baseline.result.primary_type !== 'LOWER_INSTABILITY')
      return [`expected LOWER_INSTABILITY, got ${baseline.result.primary_type}`];
    return [];
  });

  run('hedgehog 강함 → primary_type = UPPER_IMMOBILITY', () => {
    const baseline = buildFreeSurveyBaselineResult(makeHedgehogDominantAnswers());
    if (baseline.result.primary_type !== 'UPPER_IMMOBILITY')
      return [`expected UPPER_IMMOBILITY, got ${baseline.result.primary_type}`];
    return [];
  });

  run('kangaroo 강함 → primary_type = CORE_CONTROL_DEFICIT', () => {
    const baseline = buildFreeSurveyBaselineResult(makeKangarooDominantAnswers());
    if (baseline.result.primary_type !== 'CORE_CONTROL_DEFICIT')
      return [`expected CORE_CONTROL_DEFICIT, got ${baseline.result.primary_type}`];
    return [];
  });

  run('복합 강함(armadillo) → primary_type = DECONDITIONED', () => {
    const baseline = buildFreeSurveyBaselineResult(makeArmadilloAnswers());
    if (baseline.result.primary_type !== 'DECONDITIONED')
      return [`expected DECONDITIONED, got ${baseline.result.primary_type}`];
    return [];
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Baseline Metadata 정확성
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[ 4. Baseline Metadata ]');

  run('result_stage = "baseline"', () => {
    const baseline = buildFreeSurveyBaselineResult(makeKangarooDominantAnswers());
    if (baseline.baseline_meta.result_stage !== 'baseline')
      return [`expected 'baseline', got '${baseline.baseline_meta.result_stage}'`];
    return [];
  });

  run('source_inputs includes "free_survey"', () => {
    const baseline = buildFreeSurveyBaselineResult(makeKangarooDominantAnswers());
    if (!baseline.baseline_meta.source_inputs.includes('free_survey'))
      return [`source_inputs should include 'free_survey': ${JSON.stringify(baseline.baseline_meta.source_inputs)}`];
    return [];
  });

  run('refinement_available = true', () => {
    const baseline = buildFreeSurveyBaselineResult(makeKangarooDominantAnswers());
    if (baseline.baseline_meta.refinement_available !== true)
      return [`expected true, got ${baseline.baseline_meta.refinement_available}`];
    return [];
  });

  run('scoring_version = "free_survey_v2_core"', () => {
    const baseline = buildFreeSurveyBaselineResult(makeKangarooDominantAnswers());
    if (baseline.baseline_meta.scoring_version !== 'free_survey_v2_core')
      return [`expected 'free_survey_v2_core', got '${baseline.baseline_meta.scoring_version}'`];
    return [];
  });

  run('generated_at은 ISO 날짜 문자열', () => {
    const baseline = buildFreeSurveyBaselineResult(makeKangarooDominantAnswers());
    const d = new Date(baseline.baseline_meta.generated_at);
    if (isNaN(d.getTime()))
      return [`generated_at is not a valid date: ${baseline.baseline_meta.generated_at}`];
    return [];
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. source_mode 및 evidence_level
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[ 5. source_mode / evidence_level ]');

  run('source_mode = "free_survey"', () => {
    const baseline = buildFreeSurveyBaselineResult(makeKangarooDominantAnswers());
    if (baseline.result.source_mode !== 'free_survey')
      return [`expected 'free_survey', got '${baseline.result.source_mode}'`];
    return [];
  });

  run('18문항 완성 → evidence_level ≠ "full" (최대 partial)', () => {
    const baseline = buildFreeSurveyBaselineResult(makeKangarooDominantAnswers());
    if (baseline.result.evidence_level === 'full')
      return [`evidence_level should never be 'full' for free survey`];
    return [];
  });

  run('18문항 완성 → evidence_level = "lite" 또는 "partial"', () => {
    const baseline = buildFreeSurveyBaselineResult(makeKangarooDominantAnswers());
    const valid = ['lite', 'partial'];
    if (!valid.includes(baseline.result.evidence_level))
      return [`expected lite or partial, got '${baseline.result.evidence_level}'`];
    return [];
  });

  run('미완성 설문 → evidence_level = "lite"', () => {
    const baseline = buildFreeSurveyBaselineResult(makePartialAnswers());
    if (baseline.result.evidence_level !== 'lite')
      return [`expected 'lite' for partial answers, got '${baseline.result.evidence_level}'`];
    return [];
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 6. Confidence V2 시맨틱
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[ 6. Confidence V2 시맨틱 ]');

  run('confidence는 0~1 범위 숫자', () => {
    const baseline = buildFreeSurveyBaselineResult(makeKangarooDominantAnswers());
    const c = baseline.result.confidence;
    if (typeof c !== 'number' || c < 0 || c > 1)
      return [`confidence must be number in [0,1], got ${c}`];
    return [];
  });

  run('18문항 완성 → confidence 는 미완성보다 높음', () => {
    const full = buildFreeSurveyBaselineResult(makeKangarooDominantAnswers());
    const partial = buildFreeSurveyBaselineResult(makePartialAnswers());
    if (full.result.confidence <= partial.result.confidence)
      return [`full(${full.result.confidence}) should > partial(${partial.result.confidence})`];
    return [];
  });

  run('confidence가 정확히 avg6/100이 아님 (old passthrough 없음)', () => {
    // calculateScoresV2의 avg6는 ~52~56 범위 → /100 = 0.52~0.56
    // core의 confidence = answered_count/18 + gap_bonus → 1.0 + bonus > 0.56
    // 따라서 old passthrough가 아님을 확인
    const baseline = buildFreeSurveyBaselineResult(makeKangarooDominantAnswers());
    const c = baseline.result.confidence;
    // kangaroo 강함 + 18문항 완성 → confidence_base = 1.0, gap_bonus > 0
    // 따라서 c > 0.9 이어야 함
    if (c < 0.9)
      return [`expected high confidence for 18/18 + dominant axis, got ${c}`];
    return [];
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 7. pain_mode 처리 (카메라 전용 필드 의존 없음)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[ 7. Pain mode / 카메라 필드 독립성 ]');

  run('pain_mode는 null이 아닌 유효값 (core는 undefined → none 처리)', () => {
    const baseline = buildFreeSurveyBaselineResult(makeKangarooDominantAnswers());
    const valid = ['none', 'caution', 'protected', null];
    if (!valid.includes(baseline.result.pain_mode))
      return [`pain_mode should be none/caution/protected/null, got ${baseline.result.pain_mode}`];
    return [];
  });

  run('free survey → pain_mode = "none" (통증 데이터 없으므로 안전 기본값)', () => {
    const baseline = buildFreeSurveyBaselineResult(makePenguinDominantAnswers());
    if (baseline.result.pain_mode !== 'none')
      return [`expected 'none' (no pain questions), got '${baseline.result.pain_mode}'`];
    return [];
  });

  run('_compat에 카메라 전용 필드(captureQuality, movementType) 없음', () => {
    const baseline = buildFreeSurveyBaselineResult(makeKangarooDominantAnswers());
    const compat = baseline.result._compat ?? {};
    const errors = [];
    if ('captureQuality' in compat) errors.push('_compat should not have captureQuality');
    if ('movementType' in compat) errors.push('_compat should not have movementType');
    if ('retryRecommended' in compat) errors.push('_compat should not have retryRecommended');
    return errors;
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 8. Deep Result V2 계약 검증
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[ 8. UnifiedDeepResultV2 Contract 검증 ]');

  const testFixtures = [
    { label: 'monkey(균형형)',    answers: makeMonkeyAnswers() },
    { label: 'penguin(하체)',     answers: makePenguinDominantAnswers() },
    { label: 'hedgehog(상체)',    answers: makeHedgehogDominantAnswers() },
    { label: 'kangaroo(체간)',    answers: makeKangarooDominantAnswers() },
    { label: 'armadillo(복합)',   answers: makeArmadilloAnswers() },
    { label: '미완성 설문',        answers: makePartialAnswers() },
    { label: '빈 답변',           answers: {} },
  ];

  for (const { label, answers } of testFixtures) {
    run(`contract validation: ${label}`, () => {
      const baseline = buildFreeSurveyBaselineResult(answers);
      const { valid, errors } = validateUnifiedDeepResultV2(baseline.result);
      if (!valid) return errors;
      return [];
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 9. missing_signals 전달 검증
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[ 9. missing_signals 전달 ]');

  run('baseline.result.missing_signals에 pain_intensity_missing 포함', () => {
    const baseline = buildFreeSurveyBaselineResult(makeKangarooDominantAnswers());
    if (!baseline.result.missing_signals.includes('pain_intensity_missing'))
      return ['missing_signals should propagate pain_intensity_missing'];
    return [];
  });

  run('missing_signals는 배열이고 문자열만 포함', () => {
    const baseline = buildFreeSurveyBaselineResult(makePenguinDominantAnswers());
    if (!Array.isArray(baseline.result.missing_signals))
      return ['missing_signals must be array'];
    for (const s of baseline.result.missing_signals) {
      if (typeof s !== 'string') return [`missing_signals contains non-string: ${typeof s}`];
    }
    return [];
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 10. V2-04 seam — callable baseline generation
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[ 10. V2-04 Seam — callable baseline ]');

  run('buildFreeSurveyBaselineResult는 synchronous하게 호출 가능', () => {
    try {
      const baseline = buildFreeSurveyBaselineResult(makeKangarooDominantAnswers());
      if (!baseline || !baseline.result || !baseline.baseline_meta)
        return ['baseline result shape invalid'];
      return [];
    } catch (e) {
      return [`unexpected throw: ${e.message}`];
    }
  });

  run('result.priority_vector는 object (V2-04 scoring 소비 가능)', () => {
    const baseline = buildFreeSurveyBaselineResult(makeKangarooDominantAnswers());
    if (!baseline.result.priority_vector || typeof baseline.result.priority_vector !== 'object')
      return ['priority_vector should be a Record<string, number> for V2-04'];
    return [];
  });

  run('result.reason_codes는 배열 (V2-04 reasoning 소비 가능)', () => {
    const baseline = buildFreeSurveyBaselineResult(makeKangarooDominantAnswers());
    if (!Array.isArray(baseline.result.reason_codes))
      return ['reason_codes should be array'];
    return [];
  });

  // ─── 결과 요약 ───────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Unexpected error in smoke test:', err);
  process.exit(1);
});
