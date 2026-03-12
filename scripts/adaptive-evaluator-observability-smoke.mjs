/**
 * PR-03: Adaptive evaluator observability smoke test
 * Verifies ratio_denom, rpe_sample_count, discomfort_sample_count, summary_status
 * Run: npx tsx scripts/adaptive-evaluator-observability-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { evaluateSession, runEvaluatorAndUpsert } = await import('../src/lib/session/adaptive-evaluator.ts');

const ctx = { userId: 'u1', sessionPlanId: 'p1', sessionNumber: 1 };

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

console.log('PR-03 Adaptive evaluator observability smoke test\n');

// A. ratio_denom matches denominator for completion_ratio
const eventsA = [
  { execution_granularity: 'exercise', data_quality: 'full', completed: true, skipped: false, actual_reps: 10, prescribed_reps: 10, rpe: 6, discomfort: 2 },
  { execution_granularity: 'exercise', data_quality: 'full', completed: true, skipped: false, actual_reps: 10, prescribed_reps: 10, rpe: 7, discomfort: 3 },
  { execution_granularity: 'exercise', data_quality: 'full', completed: false, skipped: false, actual_reps: 5, prescribed_reps: 10, rpe: 8, discomfort: 4 },
];
const summaryA = evaluateSession(eventsA, ctx);
ok('A. ratio_denom present', typeof summaryA?.ratio_denom === 'number');
ok('A. ratio_denom = 3 (fullQuality.length)', summaryA?.ratio_denom === 3);
ok('A. completion_ratio = 2/3', Math.abs((summaryA?.completion_ratio ?? 0) - 2 / 3) < 0.01);

// B. rpe_sample_count reflects valid RPE samples
ok('B. rpe_sample_count = 3', summaryA?.rpe_sample_count === 3);

// C. discomfort_sample_count reflects valid discomfort samples
ok('C. discomfort_sample_count = 3', summaryA?.discomfort_sample_count === 3);

// A. full: both RPE and discomfort samples present
ok('A. summary_status full (both rpe and discomfort)', summaryA?.summary_status === 'full');

// B. partial (RPE only)
const eventsRpeOnly = [
  { execution_granularity: 'exercise', data_quality: 'full', completed: true, skipped: false, actual_reps: 10, prescribed_reps: 10, rpe: 6, discomfort: null },
];
const summaryRpeOnly = evaluateSession(eventsRpeOnly, ctx);
ok('B. partial RPE-only: rpe_sample_count > 0, discomfort_sample_count === 0', summaryRpeOnly?.rpe_sample_count === 1 && summaryRpeOnly?.discomfort_sample_count === 0);
ok('B. partial RPE-only: summary_status === partial', summaryRpeOnly?.summary_status === 'partial');

// C. partial (discomfort only)
const eventsDiscomfortOnly = [
  { execution_granularity: 'exercise', data_quality: 'full', completed: true, skipped: false, actual_reps: 10, prescribed_reps: 10, rpe: null, discomfort: 3 },
];
const summaryDiscomfortOnly = evaluateSession(eventsDiscomfortOnly, ctx);
ok('C. partial discomfort-only: rpe_sample_count === 0, discomfort_sample_count > 0', summaryDiscomfortOnly?.rpe_sample_count === 0 && summaryDiscomfortOnly?.discomfort_sample_count === 1);
ok('C. partial discomfort-only: summary_status === partial', summaryDiscomfortOnly?.summary_status === 'partial');

// D. insufficient_data: events.length === 0
const summaryNull = evaluateSession([], ctx);
ok('D. insufficient_data: evaluateSession returns null', summaryNull === null);
// runEvaluatorAndUpsert returns { summary_status: 'insufficient_data' } when no events
const mockSupabaseEmpty = {
  from: () => ({
    select: () => ({ eq: () => Promise.resolve({ data: [] }) }),
    upsert: () => Promise.resolve({ error: null }),
  }),
};
const insufficientResult = await runEvaluatorAndUpsert(mockSupabaseEmpty, ctx);
ok('D. insufficient_data: runEvaluatorAndUpsert returns summary_status insufficient_data', insufficientResult?.summary_status === 'insufficient_data');

// partial: no RPE/discomfort samples
const eventsPartial = [
  { execution_granularity: 'exercise', data_quality: 'full', completed: true, skipped: false, actual_reps: 10, prescribed_reps: 10, rpe: null, discomfort: null },
];
const summaryPartial = evaluateSession(eventsPartial, ctx);
ok('D. partial when no rpe/discomfort', summaryPartial?.summary_status === 'partial');

// E. existing scores unchanged
ok('E. completion_ratio formula unchanged', Math.abs((summaryA?.completion_ratio ?? 0) - 0.667) < 0.01);
ok('E. avg_rpe present', summaryA?.avg_rpe != null);
ok('E. dropout_risk_score present', typeof summaryA?.dropout_risk_score === 'number');
ok('E. discomfort_burden_score present', typeof summaryA?.discomfort_burden_score === 'number');

// F. ratio_denom with mixed data_quality
const eventsMixed = [
  { execution_granularity: 'exercise', data_quality: 'full', completed: true, skipped: false, actual_reps: 10, prescribed_reps: 10, rpe: 5, discomfort: 1 },
  { execution_granularity: 'exercise', data_quality: 'partial', completed: false, skipped: false, actual_reps: null, prescribed_reps: 10, rpe: null, discomfort: null },
];
const summaryMixed = evaluateSession(eventsMixed, ctx);
ok('F. ratio_denom uses fullQuality when fullQuality.length > 0', summaryMixed?.ratio_denom === 1);
// When all partial, ratio_denom = events.length
const eventsAllPartial = [
  { execution_granularity: 'exercise', data_quality: 'partial', completed: true, skipped: false, actual_reps: 10, prescribed_reps: 10, rpe: null, discomfort: null },
  { execution_granularity: 'exercise', data_quality: 'partial', completed: false, skipped: false, actual_reps: null, prescribed_reps: 10, rpe: null, discomfort: null },
];
const summaryAllPartial = evaluateSession(eventsAllPartial, ctx);
ok('F. ratio_denom = events.length when no full quality', summaryAllPartial?.ratio_denom === 2);

// G. rpe/discomfort filtering — both present => full, one only => partial
const eventsBoth = [
  { execution_granularity: 'exercise', data_quality: 'full', completed: true, skipped: false, actual_reps: 10, prescribed_reps: 10, rpe: 6, discomfort: 2 },
  { execution_granularity: 'exercise', data_quality: 'full', completed: true, skipped: false, actual_reps: 10, prescribed_reps: 10, rpe: 7, discomfort: 1 },
];
const summaryBoth = evaluateSession(eventsBoth, ctx);
ok('G. both rpe and discomfort => full', summaryBoth?.rpe_sample_count === 2 && summaryBoth?.discomfort_sample_count === 2 && summaryBoth?.summary_status === 'full');
const eventsOneType = [
  { execution_granularity: 'exercise', data_quality: 'full', completed: true, skipped: false, actual_reps: 10, prescribed_reps: 10, rpe: 6, discomfort: null },
  { execution_granularity: 'exercise', data_quality: 'full', completed: true, skipped: false, actual_reps: 10, prescribed_reps: 10, rpe: 7, discomfort: null },
];
const summaryOneType = evaluateSession(eventsOneType, ctx);
ok('G. rpe only => partial', summaryOneType?.rpe_sample_count === 2 && summaryOneType?.discomfort_sample_count === 0 && summaryOneType?.summary_status === 'partial');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
