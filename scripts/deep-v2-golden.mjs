/**
 * Deep v2 Golden Test Runner (PR3)
 * Run: node --experimental-strip-types scripts/deep-v2-golden.mjs
 * Or: npx tsx scripts/deep-v2-golden.mjs
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

// Resolve from project root - use tsx to run .ts
const projectRoot = join(__dirname, '..');
process.chdir(projectRoot);

// Relative import from scripts/ - tsx resolves .ts
const deepV2Module = '../src/lib/deep-test/scoring/deep_v2.ts';
const fixturesPath = join(projectRoot, 'src/lib/deep-test/golden/fixtures.json');

const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf-8'));

async function run() {
  const dv = await import(deepV2Module);
  const calculateDeepV2 = dv.calculateDeepV2;
  const extendDeepV2 = dv.extendDeepV2;

  if (typeof calculateDeepV2 !== 'function' || typeof extendDeepV2 !== 'function') {
    console.error('Missing exports:', Object.keys(dv));
    process.exit(1);
  }

  let passed = 0;
  let failed = 0;

  for (const fx of fixtures) {
    try {
      const v2 = calculateDeepV2(fx.answers);
      const extended = extendDeepV2(v2);
      const actual = extended.result_type;
      const expected = fx.expected.result_type;

      if (actual === expected) {
        passed++;
        console.log(`  ✓ ${fx.id}: ${actual}`);
      } else {
        failed++;
        console.error(`  ✗ ${fx.id}: expected ${expected}, got ${actual}`);
      }
    } catch (err) {
      failed++;
      console.error(`  ✗ ${fx.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // --- Determinism test: same answers 10x → identical result ---
  const determinismAnswers = fixtures[0]?.answers ?? {};
  const results = [];
  for (let i = 0; i < 10; i++) {
    const v2 = calculateDeepV2(determinismAnswers);
    const ext = extendDeepV2(v2);
    results.push({
      result_type: ext.result_type,
      primaryFocus: ext.primaryFocus,
      secondaryFocus: ext.secondaryFocus,
      confidence: ext.confidence,
      level: ext.level,
      finalScores: JSON.stringify(ext.finalScores),
    });
  }
  const first = results[0];
  const allSame = results.every((r) =>
    r.result_type === first.result_type &&
    r.primaryFocus === first.primaryFocus &&
    r.secondaryFocus === first.secondaryFocus &&
    r.confidence === first.confidence &&
    r.level === first.level &&
    r.finalScores === first.finalScores
  );
  if (allSame) {
    passed++;
    console.log('  ✓ determinism: 10 runs identical');
  } else {
    failed++;
    console.error('  ✗ determinism: 10 runs produced different results');
  }

  // --- Tie tests: (N=L) and (N=Lo) → priority winner + tie_reason ---
  const tieNL = {
    deep_basic_age: 30,
    deep_basic_gender: '남',
    deep_basic_experience: '지금도 자주함',
    deep_basic_workstyle: '균형',
    deep_basic_primary_discomfort: '해당 없음',
    deep_squat_pain_intensity: '약간(0~3)',
    deep_squat_pain_location: ['목·어깨', '허리·골반'],
    deep_squat_knee_alignment: '발바닥이 바닥에 잘 붙은 채로 편하게 내려가서 2–3초 유지 가능',
    deep_wallangel_pain_intensity: '없음',
    deep_wallangel_pain_location: [],
    deep_wallangel_quality: '문제 없음',
    deep_sls_pain_intensity: '없음',
    deep_sls_pain_location: [],
    deep_sls_quality: '10초 안정적으로 가능',
  };
  const v2NL = calculateDeepV2(tieNL);
  const extNL = extendDeepV2(v2NL);
  const traceNL = extNL.decision_trace;
  const tieNLok =
    extNL.result_type === 'NECK-SHOULDER' &&
    traceNL?.axis?.tie_break &&
    (traceNL.axis.tie_break === 'clear' || traceNL.axis.tie_break.includes('priority') || traceNL.axis.tie_break.includes('q14') || traceNL.axis.tie_break.includes('q11'));
  if (tieNLok) {
    passed++;
    console.log(`  ✓ tie(N=L): ${extNL.result_type}, tie_break=${traceNL?.axis?.tie_break ?? '—'}`);
  } else {
    failed++;
    console.error(`  ✗ tie(N=L): expected NECK-SHOULDER+reason, got ${extNL.result_type} tie_break=${traceNL?.axis?.tie_break ?? '—'}`);
  }

  const tieNLo = {
    deep_basic_age: 30,
    deep_basic_gender: '남',
    deep_basic_experience: '지금도 자주함',
    deep_basic_workstyle: '균형',
    deep_basic_primary_discomfort: '해당 없음',
    deep_squat_pain_intensity: '약간(0~3)',
    deep_squat_pain_location: ['목·어깨'],
    deep_squat_knee_alignment: '발바닥이 바닥에 잘 붙은 채로 편하게 내려가서 2–3초 유지 가능',
    deep_wallangel_pain_intensity: '없음',
    deep_wallangel_pain_location: [],
    deep_wallangel_quality: '문제 없음',
    deep_sls_pain_intensity: '약간(0~3)',
    deep_sls_pain_location: ['무릎·발목'],
    deep_sls_quality: '10초 안정적으로 가능',
  };
  const v2NLo = calculateDeepV2(tieNLo);
  const extNLo = extendDeepV2(v2NLo);
  const traceNLo = extNLo.decision_trace;
  const tieNLook =
    (extNLo.result_type === 'NECK-SHOULDER' || extNLo.result_type === 'LOWER-LIMB') &&
    traceNLo?.axis?.tie_break &&
    (traceNLo.axis.tie_break === 'clear' || traceNLo.axis.tie_break.includes('priority') || traceNLo.axis.tie_break.includes('q14') || traceNLo.axis.tie_break.includes('q11'));
  if (tieNLook) {
    passed++;
    console.log(`  ✓ tie(N=Lo): ${extNLo.result_type}, tie_break=${traceNLo?.axis?.tie_break ?? '—'}`);
  } else {
    failed++;
    console.error(`  ✗ tie(N=Lo): expected priority winner+reason, got ${extNLo.result_type} tie_break=${traceNLo?.axis?.tie_break ?? '—'}`);
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
