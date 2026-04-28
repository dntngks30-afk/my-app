/**
 * PR-JOURNEY-BACKEND-01: Journey summary 순수 함수 스모크 (DB 없음)
 * Run: npx tsx scripts/journey-summary-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const {
  rpe10ToDifficultyFive,
  painAfterToQualityFive,
  difficultyLabelFromAvg,
  qualityLabelFromAggregate,
} = await import('../src/lib/journey/journeyMetrics.ts');
const { buildJourneyRecent7dSummary } = await import('../src/lib/journey/journeySummaryText.ts');
const { getJourneyMovementCopy } = await import('../src/lib/journey/journeyLabels.ts');

let passed = 0;
let failed = 0;

function ok(name, cond) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}`);
  }
}

console.log('Journey summary smoke (pure helpers)\n');

// RPE normalization
ok('rpe10ToDifficultyFive(1) === 1', Math.abs(rpe10ToDifficultyFive(1) - 1) < 1e-9);
ok(
  'rpe10ToDifficultyFive(10) === 5',
  Math.abs(rpe10ToDifficultyFive(10) - 5) < 1e-9
);
const rpeMid = rpe10ToDifficultyFive(5.5);
ok('rpe 5.5 roughly mid', rpeMid >= 2 && rpeMid <= 4);

// pain → quality 1~5
ok('pain 0 → quality 5', Math.abs(painAfterToQualityFive(0) - 5) < 1e-9);
ok('pain 10 → quality 1', Math.abs(painAfterToQualityFive(10) - 1) < 1e-9);

// difficulty labels
ok('difficulty no data', difficultyLabelFromAvg(null, 0) === '기록 부족');
ok('difficulty easy', difficultyLabelFromAvg(2, 3) === '쉬운 편');
ok('difficulty ok band', difficultyLabelFromAvg(3, 2) === '적절함');
ok('difficulty hard', difficultyLabelFromAvg(4.1, 2) === '어려운 편');

// quality aggregate
ok('quality worse', qualityLabelFromAggregate({ hasPainWorse: true, avgScore: 4, sourceCount: 1 }) === '주의 필요');

// labels UPPER vs LOWER_INSTABILITY
const u = getJourneyMovementCopy('UPPER_IMMOBILITY', null);
ok('UPPER label', u.label === '상체 긴장형');
const l = getJourneyMovementCopy('LOWER_INSTABILITY', null);
ok('LOWER_INSTABILITY label', l.label === '하체 불안정형');

// summary priority
const s0 = buildJourneyRecent7dSummary({
  completed_count: 0,
  target_frequency: 3,
  difficultyLabel: '기록 부족',
  qualityLabel: '기록 부족',
});
ok('summary empty', s0.includes('첫 세션을 완료하면'));

const s1 = buildJourneyRecent7dSummary({
  completed_count: 2,
  target_frequency: 3,
  difficultyLabel: '어려운 편',
  qualityLabel: '보통',
});
ok('summary hard', s1.includes('어렵게 느껴질'));

console.log(`\nDone: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
