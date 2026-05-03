/**
 * PR-KPI-PUBLIC-TEST-RUNS-03D1 — Static smoke for runs-first admin KPI pilot attribution.
 */
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();

function fail(message) {
  console.error(`[analytics-kpi-run-attribution-smoke] FAILED: ${message}`);
  process.exit(1);
}

function read(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
}

const runsPath = 'src/lib/analytics/admin-kpi-public-test-runs.ts';
if (!fs.existsSync(path.join(repoRoot, runsPath))) {
  fail(`${runsPath} must exist`);
}

const runsSrc = read(runsPath);
for (const needle of [
  'fetchPublicTestRunsForPilotAttribution',
  'decideRunAttributionForRow',
  'collectRunAttributionKeys',
  'RunAttributionDecision',
]) {
  if (!runsSrc.includes(needle)) {
    fail(`${runsPath} must include ${needle}`);
  }
}
for (const needle of ["'include'", "'exclude'", "'unknown'"]) {
  if (!runsSrc.includes(needle)) {
    fail(`${runsPath} must include decision literal ${needle}`);
  }
}
for (const needle of [
  'public_test_runs',
  'public_result_id',
  'claimed_at',
  'started_at',
]) {
  if (!runsSrc.includes(needle)) {
    fail(`${runsPath} must reference ${needle}`);
  }
}
if (!runsSrc.includes('user_id')) {
  fail(`${runsPath} must reference user_id`);
}
if (!runsSrc.includes('anon_id')) {
  fail(`${runsPath} must reference anon_id`);
}

const filterPath = 'src/lib/analytics/admin-kpi-pilot-filter.ts';
const filterSrc = read(filterPath);
if (!filterSrc.includes('created_at: string')) {
  fail(`${filterPath} must require created_at on filterable rows`);
}
if (!filterSrc.includes('decideRunAttributionForRow')) {
  fail(`${filterPath} must use decideRunAttributionForRow`);
}
if (!filterSrc.includes("decision === 'exclude'")) {
  fail(`${filterPath} must skip legacy when decision === 'exclude'`);
}

const adminKpi = read('src/lib/analytics/admin-kpi.ts');
const filterCalls = [...adminKpi.matchAll(/filterRowsByPilotCode\([^)]+\)/g)].map((m) => m[0]);
if (!filterCalls.every((c) => c.includes('{ range }'))) {
  fail('admin-kpi.ts every filterRowsByPilotCode call must pass { range }');
}

const types = read('src/lib/analytics/admin-kpi-types.ts');
if (!types.includes('runs_first_then_legacy')) {
  fail('admin-kpi-types must include runs_first_then_legacy');
}

const pkg = JSON.parse(read('package.json'));
if (!pkg.scripts?.['test:analytics-kpi-run-attribution']) {
  fail('package.json must define test:analytics-kpi-run-attribution');
}

console.log('[analytics-kpi-run-attribution-smoke] passed');
