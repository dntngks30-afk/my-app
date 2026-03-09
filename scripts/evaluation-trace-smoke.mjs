/**
 * PR-ALG-06: Evaluation / Trace SSOT smoke test
 * - execution summary builder 검증
 * - 대표 payload로 execution summary builder 검증
 * Run: npx tsx scripts/evaluation-trace-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { buildExecutionSummary } = await import('../src/lib/session/execution-summary.ts');

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

console.log('Evaluation trace smoke test\n');

// 1) feedback null → defaults
const empty = buildExecutionSummary(3, '2024-01-15T10:00:00Z', 'all_done', null, false);
ok('null feedback returns summary', typeof empty === 'object');
ok('empty session_number', empty.session_number === 3);
ok('empty completed_at', empty.completed_at === '2024-01-15T10:00:00Z');
ok('empty completion_mode', empty.completion_mode === 'all_done');
ok('empty skip_count 0', empty.skip_count === 0);
ok('empty replace_count 0', empty.replace_count === 0);
ok('empty problem_exercise_keys', Array.isArray(empty.problem_exercise_keys) && empty.problem_exercise_keys.length === 0);
ok('empty feedback_saved false', empty.feedback_saved === false);
ok('empty summary_version', typeof empty.summary_version === 'string');

// 2) sessionFeedback only
const sfPayload = {
  sessionFeedback: {
    overallRpe: 7,
    painAfter: 2,
    difficultyFeedback: 'ok',
    completionRatio: 0.9,
  },
};
const sfSummary = buildExecutionSummary(1, '2024-01-15T10:00:00Z', 'partial_done', sfPayload, true);
ok('sessionFeedback overall_rpe', sfSummary.overall_rpe === 7);
ok('sessionFeedback pain_after', sfSummary.pain_after === 2);
ok('sessionFeedback difficulty_feedback', sfSummary.difficulty_feedback === 'ok');
ok('sessionFeedback completion_ratio', sfSummary.completion_ratio === 0.9);
ok('sessionFeedback feedback_saved', sfSummary.feedback_saved === true);

// 3) exerciseFeedback with skip/replace
const efPayload = {
  sessionFeedback: { overallRpe: 5 },
  exerciseFeedback: [
    { exerciseKey: 'tpl-1', skipped: true },
    { exerciseKey: 'tpl-2', wasReplaced: true },
    { exerciseKey: 'tpl-3', painDelta: 3 },
  ],
};
const efSummary = buildExecutionSummary(2, '2024-01-15T10:00:00Z', 'all_done', efPayload, true);
ok('exerciseFeedback skip_count', efSummary.skip_count === 1);
ok('exerciseFeedback replace_count', efSummary.replace_count === 1);
ok('exerciseFeedback problem_exercise_keys', efSummary.problem_exercise_keys.length === 3);
ok('problem_exercise_keys sorted', efSummary.problem_exercise_keys[0] === 'tpl-1');
ok('problem_exercise_keys deduped', efSummary.problem_exercise_keys.length === new Set(efSummary.problem_exercise_keys).size);

// 4) completionRatio 0~1
const ratioPayload = { sessionFeedback: { completionRatio: 1 } };
const ratioSummary = buildExecutionSummary(1, '2024-01-15T10:00:00Z', 'all_done', ratioPayload, true);
ok('completionRatio 1', ratioSummary.completion_ratio === 1);

// 5) deterministic
const same1 = buildExecutionSummary(1, '2024-01-15T10:00:00Z', 'all_done', sfPayload, true);
const same2 = buildExecutionSummary(1, '2024-01-15T10:00:00Z', 'all_done', sfPayload, true);
ok('deterministic same input', JSON.stringify(same1) === JSON.stringify(same2));

// 6) summary_version
ok('summary_version present', typeof empty.summary_version === 'string' && empty.summary_version.length > 0);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
