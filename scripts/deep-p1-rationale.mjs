/**
 * P1 Confidence/Rationale Foundation Tests
 * Run: npx tsx scripts/deep-p1-rationale.mjs
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
process.chdir(projectRoot);

const deepV2Module = '../src/lib/deep-test/scoring/deep_v2.ts';
const fixturesPath = join(projectRoot, 'src/lib/deep-test/golden/fixtures.json');

async function run() {
  const dv = await import(deepV2Module);
  const { calculateDeepV2, extendDeepV2 } = dv;

  if (typeof calculateDeepV2 !== 'function' || typeof extendDeepV2 !== 'function') {
    console.error('Missing exports:', Object.keys(dv));
    process.exit(1);
  }

  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf-8'));

  let passed = 0;
  let failed = 0;

  function ok(name) {
    passed++;
    console.log(`  ✓ ${name}`);
  }

  function fail(name, msg) {
    failed++;
    console.error(`  ✗ ${name}: ${msg}`);
  }

  const BASE_ANSWERS = {
    deep_basic_age: 35,
    deep_basic_gender: '남',
    deep_basic_experience: '지금도 자주함',
    deep_basic_workstyle: '균형',
    deep_basic_primary_discomfort: '해당 없음',
    deep_squat_pain_intensity: '없음',
    deep_squat_pain_location: [],
    deep_squat_knee_alignment: '발바닥이 바닥에 잘 붙은 채로 편하게 내려가서 2–3초 유지 가능',
    deep_wallangel_pain_intensity: '없음',
    deep_wallangel_pain_location: [],
    deep_wallangel_quality: '문제 없음',
    deep_sls_pain_intensity: '없음',
    deep_sls_pain_location: [],
    deep_sls_quality: '10초 안정적으로 가능',
  };

  // 1. Strong objective evidence → confidence_breakdown, rationale, decision_trace exist
  {
    const answers = { ...BASE_ANSWERS };
    answers.deep_basic_primary_discomfort = '목·어깨';
    answers.deep_wallangel_pain_intensity = '약간(0~3)';
    answers.deep_wallangel_pain_location = ['목·어깨'];
    answers.deep_wallangel_quality = '어깨가 위로 들리거나 목이 긴장됨';

    const v2 = calculateDeepV2(answers);
    extendDeepV2(v2);

    if (v2.confidence_breakdown) ok('strong evidence: confidence_breakdown exists');
    else fail('strong evidence', 'confidence_breakdown missing');

    if (v2.rationale?.summary) ok('strong evidence: rationale.summary exists');
    else fail('strong evidence', 'rationale.summary missing');

    if ((v2.decision_trace?.top_positive_signals?.length ?? 0) >= 1)
      ok('strong evidence: top_positive_signals >= 1');
    else fail('strong evidence', 'top_positive_signals empty');
  }

  // 2. Weak evidence + missing answers → coverage lower
  {
    const partialAnswers = {
      deep_basic_age: 30,
      deep_basic_gender: '남',
      deep_basic_experience: '없음',
      deep_basic_workstyle: '대부분 앉아서',
      deep_basic_primary_discomfort: '허리·골반',
    };

    const v2 = calculateDeepV2(partialAnswers);
    const fullAnswers = { ...BASE_ANSWERS };
    fullAnswers.deep_basic_primary_discomfort = '허리·골반';

    const v2Full = calculateDeepV2(fullAnswers);

    const partialCov = v2.confidence_breakdown?.coverage_score ?? 0;
    const fullCov = v2Full.confidence_breakdown?.coverage_score ?? 1;

    if (partialCov < fullCov) ok('missing answers: coverage lower');
    else fail('missing answers', `expected partial coverage < full, got ${partialCov} vs ${fullCov}`);
  }

  // 3. rationale / decision_trace present for fixtures
  for (const fx of fixtures.slice(0, 5)) {
    const v2 = calculateDeepV2(fx.answers);
    if (!v2.rationale?.summary) {
      fail(`fixture ${fx.id}`, 'rationale.summary empty');
    } else if ((v2.decision_trace?.top_positive_signals?.length ?? 0) < 1) {
      fail(`fixture ${fx.id}`, 'top_positive_signals empty');
    } else {
      ok(`fixture ${fx.id}: rationale + decision_trace present`);
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
