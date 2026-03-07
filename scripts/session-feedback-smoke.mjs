/**
 * PR-P2-1: Session feedback validation smoke test
 * Run: npx tsx scripts/session-feedback-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { normalizeSessionFeedbackPayload } = await import('../src/lib/session/feedback.ts');

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

console.log('Session feedback validation smoke test\n');

// 1) feedback 없음 → null (complete는 feedback 없이 성공)
ok('null feedback returns null', normalizeSessionFeedbackPayload(null) === null);
ok('undefined feedback returns null', normalizeSessionFeedbackPayload(undefined) === null);
ok('empty object returns null', normalizeSessionFeedbackPayload({}) === null);

// 2) sessionFeedback only
const sfOnly = normalizeSessionFeedbackPayload({
  sessionFeedback: { overallRpe: 7, painAfter: 2, difficultyFeedback: 'ok' },
});
ok('sessionFeedback only parsed', sfOnly?.sessionFeedback?.overallRpe === 7);
ok('sessionFeedback painAfter', sfOnly?.sessionFeedback?.painAfter === 2);
ok('sessionFeedback difficultyFeedback', sfOnly?.sessionFeedback?.difficultyFeedback === 'ok');
ok('sessionFeedback only no exerciseFeedback', !sfOnly?.exerciseFeedback?.length);

// 3) RPE clamp 1~10
const rpeClamped = normalizeSessionFeedbackPayload({
  sessionFeedback: { overallRpe: 15, painAfter: -1 },
});
ok('RPE clamped to 10', rpeClamped?.sessionFeedback?.overallRpe === 10);
ok('painAfter clamped to 0', rpeClamped?.sessionFeedback?.painAfter === 0);

// 4) completionRatio 0~1
const ratioClamped = normalizeSessionFeedbackPayload({
  sessionFeedback: { completionRatio: 1.5 },
});
ok('completionRatio clamped to 1', ratioClamped?.sessionFeedback?.completionRatio === 1);

// 5) exerciseFeedback
const efPayload = normalizeSessionFeedbackPayload({
  exerciseFeedback: [
    { exerciseKey: 'tpl-1', perceivedDifficulty: 3, skipped: true },
    { exerciseKey: 'tpl-2', completionRatio: 0.8 },
  ],
});
ok('exerciseFeedback parsed', efPayload?.exerciseFeedback?.length === 2);
ok('exerciseFeedback exerciseKey', efPayload?.exerciseFeedback?.[0]?.exerciseKey === 'tpl-1');
ok('exerciseFeedback perceivedDifficulty', efPayload?.exerciseFeedback?.[0]?.perceivedDifficulty === 3);
ok('exerciseFeedback skipped', efPayload?.exerciseFeedback?.[0]?.skipped === true);
ok('exerciseFeedback completionRatio', efPayload?.exerciseFeedback?.[1]?.completionRatio === 0.8);

// 6) perceivedDifficulty 1~5 clamp
const pdClamped = normalizeSessionFeedbackPayload({
  exerciseFeedback: [{ exerciseKey: 'x', perceivedDifficulty: 10 }],
});
ok('perceivedDifficulty clamped to 5', pdClamped?.exerciseFeedback?.[0]?.perceivedDifficulty === 5);

// 7) invalid difficultyFeedback ignored
const invalidDiff = normalizeSessionFeedbackPayload({
  sessionFeedback: { difficultyFeedback: 'invalid' },
});
ok('invalid difficultyFeedback not set', invalidDiff?.sessionFeedback?.difficultyFeedback === undefined);

// 8) duplicate exerciseKey deduped
const dupKeys = normalizeSessionFeedbackPayload({
  exerciseFeedback: [
    { exerciseKey: 'same', completionRatio: 0.5 },
    { exerciseKey: 'same', completionRatio: 0.8 },
  ],
});
ok('duplicate exerciseKey deduped', dupKeys?.exerciseFeedback?.length === 1);

// 9) empty exerciseKey skipped
const emptyKey = normalizeSessionFeedbackPayload({
  exerciseFeedback: [{ exerciseKey: '  ', perceivedDifficulty: 3 }],
});
ok('empty exerciseKey skipped', !emptyKey?.exerciseFeedback?.length);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
