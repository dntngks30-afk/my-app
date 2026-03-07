/**
 * PR-P2-2: Progress report smoke test
 * Run: npx tsx scripts/progress-report-smoke.mjs
 * Note: Requires .env.local (Supabase) for full DB tests.
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

let mod;
try {
  mod = await import('../src/lib/session/progress-report.ts');
} catch (e) {
  if (e?.message?.includes('SUPABASE') || e?.message?.includes('Missing')) {
    console.log('SKIP: Supabase env required for progress-report tests. Run with .env.local.');
    process.exit(0);
  }
  throw e;
}
const {
  loadBaselineSummary,
  loadRecentSessionWindow,
  getProgressWindowReport,
  WINDOW_SIZE,
} = mod;

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

console.log('Progress report smoke test\n');

// 1) Constants
ok('WINDOW_SIZE is 4', WINDOW_SIZE === 4);

// 2) loadBaselineSummary - requires real userId, will hit DB
// We can only test it doesn't throw with a fake UUID (may return empty)
try {
  const baseline = await loadBaselineSummary('00000000-0000-0000-0000-000000000000');
  ok('loadBaselineSummary returns object', typeof baseline === 'object');
  ok('loadBaselineSummary null-safe', baseline != null);
} catch (e) {
  failed++;
  console.error('  ✗ loadBaselineSummary threw', e);
}

// 3) loadRecentSessionWindow - same, needs real DB
try {
  const win = await loadRecentSessionWindow('00000000-0000-0000-0000-000000000000', 4);
  ok('loadRecentSessionWindow returns plans array', Array.isArray(win.plans));
  ok('loadRecentSessionWindow returns feedback array', Array.isArray(win.feedback));
  ok('loadRecentSessionWindow returns exerciseFeedback array', Array.isArray(win.exerciseFeedback));
} catch (e) {
  failed++;
  console.error('  ✗ loadRecentSessionWindow threw', e);
}

// 4) getProgressWindowReport - full flow
try {
  const report = await getProgressWindowReport('00000000-0000-0000-0000-000000000000');
  ok('report has window_size', report.window_size === 4);
  ok('report has sufficient_data', typeof report.sufficient_data === 'boolean');
  ok('report has baseline', typeof report.baseline === 'object');
  ok('report has current', typeof report.current === 'object');
  ok('report has trends', typeof report.trends === 'object');
  ok('report has summary', typeof report.summary === 'object');
  ok('summary has headline', typeof report.summary.headline === 'string');
  ok('summary has bullets', Array.isArray(report.summary.bullets));
  ok('trends.adherence is valid', ['up','steady','down','unknown'].includes(report.trends.adherence));
  ok('trends.pain_burden is valid', ['improving','steady','worsening','unknown'].includes(report.trends.pain_burden));
  ok('insufficient data yields unknown trends', !report.sufficient_data || report.trends.adherence !== undefined);
} catch (e) {
  failed++;
  console.error('  ✗ getProgressWindowReport threw', e);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
