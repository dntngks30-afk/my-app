/**
 * PR-KPI-PILOT-DASHBOARD-FILTER-02 — Static checks for admin KPI pilot_code filter.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();

function fail(message) {
  console.error(`[analytics-kpi-pilot-filter-smoke] FAILED: ${message}`);
  process.exit(1);
}

function read(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
}

const filterPath = 'src/lib/analytics/admin-kpi-pilot-filter.ts';
if (!fs.existsSync(path.join(repoRoot, filterPath))) {
  fail(`${filterPath} must exist`);
}

const pilotFilterSrc = read(filterPath);
for (const needle of ['resolveKpiPilotCodeFilter', 'filterRowsByPilotCode', 'InvalidKpiPilotCodeError']) {
  if (!pilotFilterSrc.includes(needle)) {
    fail(`${filterPath} must define ${needle}`);
  }
}

const adminKpi = read('src/lib/analytics/admin-kpi.ts');
const pilotParamMatches = [...adminKpi.matchAll(/pilotCode\?\: string \| null/g)];
assert(pilotParamMatches.length >= 5, 'admin-kpi.ts KPI getters must accept pilotCode');
if (!adminKpi.includes('filterRowsByPilotCode')) {
  fail('admin-kpi.ts must call filterRowsByPilotCode');
}

const routes = [
  'src/app/api/admin/kpi/summary/route.ts',
  'src/app/api/admin/kpi/funnel/route.ts',
  'src/app/api/admin/kpi/details/route.ts',
  'src/app/api/admin/kpi/retention/route.ts',
  'src/app/api/admin/kpi/raw-events/route.ts',
];

for (const route of routes) {
  const src = read(route);
  if (!src.includes('resolveKpiPilotCodeFilter')) {
    fail(`${route} must call resolveKpiPilotCodeFilter`);
  }
  if (!src.includes('InvalidKpiPilotCodeError')) {
    fail(`${route} must handle InvalidKpiPilotCodeError`);
  }
}

const dashboard = read('src/app/admin/kpi/KpiDashboardClient.tsx');
for (const needle of ['pilotCodeInput', 'pilotCodeFilter', 'pilot_code', 'INVALID_PILOT_CODE']) {
  if (!dashboard.includes(needle)) {
    fail(`KpiDashboardClient.tsx must reference ${needle}`);
  }
}

const types = read('src/lib/analytics/admin-kpi-types.ts');
if (!types.includes('export type KpiResponseFilters')) {
  fail('admin-kpi-types must export KpiResponseFilters');
}
for (const resp of ['KpiSummaryResponse', 'KpiFunnelResponse', 'KpiRetentionResponse', 'KpiRawEventsResponse', 'KpiDetailsResponse']) {
  const block = types.split(`export type ${resp}`)[1]?.slice(0, 800) ?? '';
  if (!block.includes('filters?:')) {
    fail(`${resp} must include optional filters field`);
  }
}

const pkg = JSON.parse(read('package.json'));
if (!pkg.scripts?.['test:analytics-kpi-pilot-filter']) {
  fail('package.json must define test:analytics-kpi-pilot-filter script');
}

const migrationsDir = path.join(repoRoot, 'supabase', 'migrations');
if (fs.existsSync(migrationsDir)) {
  const migrationFiles = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'));
  const suspicious = migrationFiles.filter((f) => /pilot.*dashboard|kpi.*pilot.*filter/i.test(f));
  if (suspicious.length > 0) {
    fail(`unexpected migration filenames for this PR: ${suspicious.join(', ')}`);
  }
}

console.log('[analytics-kpi-pilot-filter-smoke] passed');
