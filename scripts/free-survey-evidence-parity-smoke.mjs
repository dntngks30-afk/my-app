/**
 * PR-PUBLIC-SURVEY-EVIDENCE-DIRECT-07C
 * 도메인 점수/분기가 legacy `calculateScoresV2` 와 일치하는지 검증.
 * Run: npx tsx scripts/free-survey-evidence-parity-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { calculateScoresV2 } = await import('../src/features/movement-test/v2/scoring/scoring.v2.ts');
const { computeDomainScoresAndPatternForRegression, freeSurveyAnswersToEvidence } = await import(
  '../src/lib/deep-v2/adapters/free-survey-to-evidence.ts'
);
const { runDeepScoringCore } = await import('../src/lib/deep-scoring-core/core.ts');

const IDS = [
  'v2_A1', 'v2_A2', 'v2_A3',
  'v2_B1', 'v2_B2', 'v2_B3',
  'v2_C1', 'v2_C2', 'v2_C3',
  'v2_D1', 'v2_D2', 'v2_D3',
  'v2_F1', 'v2_F2', 'v2_F3',
  'v2_G1', 'v2_G2', 'v2_G3',
];

function all(v) {
  return Object.fromEntries(IDS.map((id) => [id, v]));
}

const fixtures = [
  { id: 'all-mid-2', answers: all(2) },
  { id: 'all-low-0', answers: all(0) },
  { id: 'all-high-4', answers: all(4) },
  { id: 'mixed-sample', answers: {
    ...all(2),
    v2_A1: 4, v2_B1: 4, v2_C1: 4, v2_D1: 4, v2_F1: 4, v2_G1: 4,
  }},
];

function axesEqual(a, b) {
  const keys = Object.keys(a);
  for (const k of keys) {
    if (Math.abs((a[k] ?? 0) - (b[k] ?? 0)) > 0.02) return false;
  }
  return true;
}

let passed = 0;
let failed = 0;

console.log('free-survey evidence parity (domain scores vs calculateScoresV2)\n');

for (const fx of fixtures) {
  const legacy = calculateScoresV2(fx.answers);
  const direct = computeDomainScoresAndPatternForRegression(fx.answers);

  const okAxes = axesEqual(legacy.axisScores, direct.axisScores);
  const okType = legacy.resultType === direct.resultType;

  if (okAxes && okType) {
    passed++;
    console.log(`  ✓ ${fx.id}: ${direct.resultType}`);
  } else {
    failed++;
    console.error(`  ✗ ${fx.id}: type legacy=${legacy.resultType} direct=${direct.resultType}`);
    if (!okAxes) console.error('    axisScores differ', legacy.axisScores, direct.axisScores);
  }

  const ev = freeSurveyAnswersToEvidence(fx.answers);
  const core = runDeepScoringCore(ev);
  if (!core.primary_type) {
    failed++;
    console.error(`  ✗ ${fx.id}: core primary_type missing`);
  }
}

console.log(`\n${passed} parity checks passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
