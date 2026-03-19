/**
 * PR-V2-04 — Baseline Gate + Renderer Smoke Tests
 *
 * 검증 항목:
 * 1. V2-03 builder가 baseline page에서 올바르게 호출되는지
 * 2. baseline 결과에서 visible type이 Deep Result V2 어휘로만 구성되는지
 * 3. 동물 타입(kangaroo/hedgehog 등)이 headline identity가 아닌지
 * 4. result_stage = 'baseline'인지
 * 5. camera 경로(refinement_available=true)가 존재하는지
 * 6. 카메라 없이도 baseline 렌더가 가능한지
 * 7. gate와 result view 분기가 올바른지 (논리 검증)
 * 8. UnifiedDeepResultV2 계약 만족 확인
 * 9. survey completion 경로 변경 확인 (파일 내 문자열 검증)
 *
 * 실행: npx tsx scripts/deep-v2-04-baseline-gate-smoke.mjs
 */

import { readFileSync } from 'fs';
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
    failed++;
  }
}

// ─── 정적 파일 검증 헬퍼 ─────────────────────────────────────────────────────

function readFile(relPath) {
  return readFileSync(join(projectRoot, relPath), 'utf-8');
}

// ─── 픽스처 ─────────────────────────────────────────────────────────────────

function makeKangarooDominantAnswers() {
  return {
    'v2_A1': 1, 'v2_A2': 1, 'v2_A3': 1,
    'v2_B1': 1, 'v2_B2': 1, 'v2_B3': 1,
    'v2_C1': 4, 'v2_C2': 4, 'v2_C3': 4, // kangaroo 강함
    'v2_D1': 1, 'v2_D2': 1, 'v2_D3': 1,
    'v2_F1': 1, 'v2_F2': 1, 'v2_F3': 1,
    'v2_G1': 1, 'v2_G2': 1, 'v2_G3': 1,
  };
}

function makeMonkeyAnswers() {
  const ans = {};
  const ids = ['v2_A1','v2_A2','v2_A3','v2_B1','v2_B2','v2_B3','v2_C1','v2_C2','v2_C3','v2_D1','v2_D2','v2_D3','v2_F1','v2_F2','v2_F3','v2_G1','v2_G2','v2_G3'];
  for (const id of ids) ans[id] = 2;
  return ans;
}

function makePenguinDominantAnswers() {
  return {
    'v2_A1': 1, 'v2_A2': 1, 'v2_A3': 1,
    'v2_B1': 1, 'v2_B2': 1, 'v2_B3': 1,
    'v2_C1': 1, 'v2_C2': 1, 'v2_C3': 1,
    'v2_D1': 4, 'v2_D2': 4, 'v2_D3': 4, // penguin 강함
    'v2_F1': 1, 'v2_F2': 1, 'v2_F3': 1,
    'v2_G1': 1, 'v2_G2': 1, 'v2_G3': 1,
  };
}

// Deep Result V2 어휘 (동물 이름 포함하지 않아야 하는 목록)
const VALID_PRIMARY_TYPES = [
  'LOWER_INSTABILITY', 'LOWER_MOBILITY_RESTRICTION', 'UPPER_IMMOBILITY',
  'CORE_CONTROL_DEFICIT', 'DECONDITIONED', 'STABLE', 'UNKNOWN',
];

const ANIMAL_NAMES = ['kangaroo', 'hedgehog', 'turtle', 'penguin', 'crab', 'meerkat', 'monkey', 'armadillo', 'sloth'];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const { buildFreeSurveyBaselineResult } = await import(
    '../src/lib/deep-v2/builders/build-free-survey-baseline.ts'
  );
  const { validateUnifiedDeepResultV2 } = await import(
    '../src/lib/result/deep-result-v2-contract.ts'
  );

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('  PR-V2-04 Baseline Gate + Renderer Smoke Tests');
  console.log('══════════════════════════════════════════════════════════════\n');

  // ──────────────────────────────────────────────────────────────────────────
  // 1. V2-03 builder 재사용 확인
  // ──────────────────────────────────────────────────────────────────────────
  console.log('[ 1. V2-03 Builder 재사용 확인 ]');

  run('builder는 baseline + baseline_meta 반환', () => {
    const baseline = buildFreeSurveyBaselineResult(makeKangarooDominantAnswers());
    if (!baseline || !baseline.result || !baseline.baseline_meta)
      return ['baseline 구조 invalid'];
    return [];
  });

  run('builder 파이프라인이 중복 없이 호출 가능', () => {
    // 여러 번 호출해도 동일한 구조 반환
    const a = buildFreeSurveyBaselineResult(makeKangarooDominantAnswers());
    const b = buildFreeSurveyBaselineResult(makeKangarooDominantAnswers());
    if (a.result.primary_type !== b.result.primary_type)
      return ['동일 입력에서 primary_type 불일치'];
    if (a.result.source_mode !== b.result.source_mode)
      return ['동일 입력에서 source_mode 불일치'];
    return [];
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. visible type이 Deep Result V2 어휘인지 확인
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[ 2. Visible Type — Deep Result V2 어휘 확인 ]');

  run('primary_type은 UnifiedPrimaryType 어휘 값이어야 함', () => {
    const fixtures = [
      makeKangarooDominantAnswers(),
      makeMonkeyAnswers(),
      makePenguinDominantAnswers(),
    ];
    const errors = [];
    for (const answers of fixtures) {
      const baseline = buildFreeSurveyBaselineResult(answers);
      if (!VALID_PRIMARY_TYPES.includes(baseline.result.primary_type))
        errors.push(`invalid primary_type: ${baseline.result.primary_type}`);
    }
    return errors;
  });

  run('primary_type은 동물 이름이 아닌 Deep Result V2 타입이어야 함', () => {
    const fixtures = [
      makeKangarooDominantAnswers(),
      makeMonkeyAnswers(),
      makePenguinDominantAnswers(),
    ];
    const errors = [];
    for (const answers of fixtures) {
      const baseline = buildFreeSurveyBaselineResult(answers);
      const pt = baseline.result.primary_type.toLowerCase();
      for (const animal of ANIMAL_NAMES) {
        if (pt.includes(animal))
          errors.push(`primary_type "${baseline.result.primary_type}" contains animal name "${animal}"`);
      }
    }
    return errors;
  });

  run('secondary_type도 Deep Result V2 어휘이거나 null', () => {
    const baseline = buildFreeSurveyBaselineResult(makeKangarooDominantAnswers());
    const st = baseline.result.secondary_type;
    if (st !== null && !VALID_PRIMARY_TYPES.includes(st))
      return [`secondary_type invalid: ${st}`];
    return [];
  });

  run('source_mode = "free_survey" (동물 채널명 아님)', () => {
    const baseline = buildFreeSurveyBaselineResult(makeKangarooDominantAnswers());
    if (baseline.result.source_mode !== 'free_survey')
      return [`expected free_survey, got ${baseline.result.source_mode}`];
    return [];
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. baseline_meta 확인
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[ 3. Baseline Metadata ]');

  run('result_stage = "baseline" (final certainty 아님)', () => {
    const baseline = buildFreeSurveyBaselineResult(makeKangarooDominantAnswers());
    if (baseline.baseline_meta.result_stage !== 'baseline')
      return [`expected baseline, got ${baseline.baseline_meta.result_stage}`];
    return [];
  });

  run('refinement_available = true (camera 경로 제공)', () => {
    const baseline = buildFreeSurveyBaselineResult(makeKangarooDominantAnswers());
    if (!baseline.baseline_meta.refinement_available)
      return ['refinement_available should be true'];
    return [];
  });

  run('source_inputs에 free_survey 포함', () => {
    const baseline = buildFreeSurveyBaselineResult(makeKangarooDominantAnswers());
    if (!baseline.baseline_meta.source_inputs.includes('free_survey'))
      return ['source_inputs should include free_survey'];
    return [];
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. 카메라 없이도 baseline 렌더 가능한지 확인
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[ 4. 카메라 없이 Baseline 렌더 가능 ]');

  run('camera-only 필드 없이 baseline 생성 가능', () => {
    const baseline = buildFreeSurveyBaselineResult(makeKangarooDominantAnswers());
    const compat = baseline.result._compat ?? {};
    const errors = [];
    if ('captureQuality' in compat) errors.push('_compat should not have captureQuality');
    if ('movementType' in compat) errors.push('_compat should not have movementType');
    if ('retryRecommended' in compat) errors.push('_compat should not have retryRecommended');
    return errors;
  });

  run('빈 답변으로도 baseline 생성 가능 (카메라 없는 경우)', () => {
    try {
      const baseline = buildFreeSurveyBaselineResult({});
      if (!baseline || !baseline.result) return ['baseline is null'];
      return [];
    } catch (e) {
      return [`unexpected error: ${e.message}`];
    }
  });

  run('카메라 답변 없이 모든 필수 필드 존재', () => {
    const baseline = buildFreeSurveyBaselineResult(makePenguinDominantAnswers());
    const r = baseline.result;
    const errors = [];
    if (!r.primary_type) errors.push('primary_type missing');
    if (r.confidence === undefined) errors.push('confidence missing');
    if (!r.evidence_level) errors.push('evidence_level missing');
    if (!Array.isArray(r.missing_signals)) errors.push('missing_signals missing');
    if (!Array.isArray(r.reason_codes)) errors.push('reason_codes missing');
    if (typeof r.summary_copy !== 'string') errors.push('summary_copy missing');
    return errors;
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. UnifiedDeepResultV2 계약 검증
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[ 5. UnifiedDeepResultV2 Contract ]');

  const contractFixtures = [
    { label: 'kangaroo(체간)', answers: makeKangarooDominantAnswers() },
    { label: 'monkey(균형형)', answers: makeMonkeyAnswers() },
    { label: 'penguin(하체)', answers: makePenguinDominantAnswers() },
    { label: '빈 답변',       answers: {} },
  ];

  for (const { label, answers } of contractFixtures) {
    run(`contract: ${label}`, () => {
      const baseline = buildFreeSurveyBaselineResult(answers);
      const { valid, errors } = validateUnifiedDeepResultV2(baseline.result);
      if (!valid) return errors;
      return [];
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 6. survey completion 경로 변경 확인 (정적 파일 검증)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[ 6. Survey Completion 경로 변경 확인 ]');

  run('survey/page.tsx: /movement-test/result 직행 없어야 함', () => {
    const content = readFile('src/app/movement-test/survey/page.tsx');
    if (content.includes("router.push('/movement-test/result')"))
      return ["survey/page.tsx still routes to /movement-test/result"];
    return [];
  });

  run('survey/page.tsx: /movement-test/baseline으로 이동', () => {
    const content = readFile('src/app/movement-test/survey/page.tsx');
    if (!content.includes("router.push('/movement-test/baseline')"))
      return ['survey/page.tsx should route to /movement-test/baseline'];
    return [];
  });

  run('self-test/page.tsx: /movement-test/result 직행 없어야 함', () => {
    const content = readFile('src/app/movement-test/self-test/page.tsx');
    if (content.includes("router.push('/movement-test/result')"))
      return ['self-test/page.tsx still routes to /movement-test/result'];
    return [];
  });

  run('self-test/page.tsx: /movement-test/baseline으로 이동', () => {
    const content = readFile('src/app/movement-test/self-test/page.tsx');
    if (!content.includes("router.push('/movement-test/baseline')"))
      return ['self-test/page.tsx should route to /movement-test/baseline'];
    return [];
  });

  run('camera/complete: 여전히 /movement-test/result로 이동 (변경 안 함)', () => {
    const content = readFile('src/app/movement-test/camera/complete/page.tsx');
    if (!content.includes("router.push('/movement-test/result')"))
      return ['camera/complete should still route to /movement-test/result'];
    return [];
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 7. baseline page 파일 구조 확인
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[ 7. Baseline Page 파일 구조 ]');

  run('baseline/page.tsx 파일 존재', () => {
    try {
      readFile('src/app/movement-test/baseline/page.tsx');
      return [];
    } catch {
      return ['baseline/page.tsx does not exist'];
    }
  });

  run('baseline/page.tsx: V2-03 builder import', () => {
    const content = readFile('src/app/movement-test/baseline/page.tsx');
    if (!content.includes('buildFreeSurveyBaselineResult'))
      return ['baseline page should import buildFreeSurveyBaselineResult'];
    return [];
  });

  run('baseline/page.tsx: UnifiedPrimaryType 어휘 사용 (PRIMARY_TYPE_LABELS)', () => {
    const content = readFile('src/app/movement-test/baseline/page.tsx');
    if (!content.includes('PRIMARY_TYPE_LABELS'))
      return ['baseline page should use PRIMARY_TYPE_LABELS (Deep Result V2 vocabulary)'];
    return [];
  });

  run('baseline/page.tsx: 동물 이름이 headline label에 포함되지 않음', () => {
    const content = readFile('src/app/movement-test/baseline/page.tsx');
    // PRIMARY_TYPE_LABELS 값들에 동물 이름이 포함되어서는 안 됨
    const labelSection = content.match(/PRIMARY_TYPE_LABELS[^}]*}/s)?.[0] ?? '';
    const errors = [];
    for (const animal of ['kangaroo', 'hedgehog', 'turtle', 'penguin', 'crab', 'meerkat', 'armadillo', 'sloth']) {
      if (labelSection.toLowerCase().includes(animal))
        errors.push(`PRIMARY_TYPE_LABELS contains animal name: ${animal}`);
    }
    return errors;
  });

  run('baseline/page.tsx: 카메라 경로 CTA 존재', () => {
    const content = readFile('src/app/movement-test/baseline/page.tsx');
    if (!content.includes('/movement-test/camera'))
      return ['baseline page should have camera refine CTA'];
    return [];
  });

  run('baseline/page.tsx: gate와 result view 두 가지 분기 존재', () => {
    const content = readFile('src/app/movement-test/baseline/page.tsx');
    const errors = [];
    if (!content.includes("'gate'")) errors.push('gate view state missing');
    if (!content.includes("'result'")) errors.push('result view state missing');
    return errors;
  });

  run('baseline/page.tsx: result_stage baseline 안내 표시', () => {
    const content = readFile('src/app/movement-test/baseline/page.tsx');
    if (!content.includes('baseline_meta.result_stage'))
      return ['baseline page should display result_stage from baseline_meta'];
    return [];
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 8. 동물 타입이 headline이 아닌지 확인
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[ 8. 동물 타입이 Headline Identity가 아님 ]');

  run('kangaroo 강함 → primary_type이 kangaroo가 아닌 CORE_CONTROL_DEFICIT', () => {
    const baseline = buildFreeSurveyBaselineResult(makeKangarooDominantAnswers());
    const pt = baseline.result.primary_type;
    if (pt !== 'CORE_CONTROL_DEFICIT')
      return [`expected CORE_CONTROL_DEFICIT (not 'kangaroo'), got ${pt}`];
    return [];
  });

  run('penguin 강함 → primary_type이 penguin이 아닌 LOWER_INSTABILITY', () => {
    const baseline = buildFreeSurveyBaselineResult(makePenguinDominantAnswers());
    const pt = baseline.result.primary_type;
    if (pt !== 'LOWER_INSTABILITY')
      return [`expected LOWER_INSTABILITY (not 'penguin'), got ${pt}`];
    return [];
  });

  run('monkey(균형형) → primary_type이 monkey가 아닌 STABLE', () => {
    const baseline = buildFreeSurveyBaselineResult(makeMonkeyAnswers());
    const pt = baseline.result.primary_type;
    if (pt !== 'STABLE')
      return [`expected STABLE (not 'monkey'), got ${pt}`];
    return [];
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 결과 요약
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('══════════════════════════════════════════════════════════════\n');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Unexpected error in smoke test:', err);
  process.exit(1);
});
