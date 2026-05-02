import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const repoRoot = process.cwd();

const requiredFiles = [
  'src/app/admin/kpi/page.tsx',
  'src/app/admin/kpi/KpiDashboardClient.tsx',
  'src/app/api/admin/kpi/summary/route.ts',
  'src/app/api/admin/kpi/funnel/route.ts',
  'src/app/api/admin/kpi/retention/route.ts',
  'src/app/api/admin/kpi/raw-events/route.ts',
  'src/lib/analytics/admin-kpi.ts',
  'src/lib/analytics/admin-kpi-types.ts',
];

for (const file of requiredFiles) {
  assert(fs.existsSync(path.join(repoRoot, file)), `${file} must exist`);
}

function readFile(file) {
  return fs.readFileSync(path.join(repoRoot, file), 'utf8');
}

const apiRouteFiles = [
  'src/app/api/admin/kpi/summary/route.ts',
  'src/app/api/admin/kpi/funnel/route.ts',
  'src/app/api/admin/kpi/retention/route.ts',
  'src/app/api/admin/kpi/raw-events/route.ts',
];

for (const file of apiRouteFiles) {
  const source = readFile(file);
  assert(source.includes("requireAdmin("), `${file} must call requireAdmin`);
  assert(source.includes("Cache-Control', 'no-store"), `${file} must set no-store cache headers`);
}

const helperSource = readFile('src/lib/analytics/admin-kpi.ts');
assert(helperSource.includes("from('analytics_events')"), 'admin-kpi helper must read analytics_events');
assert(helperSource.includes("from('analytics_identity_links')"), 'admin-kpi helper must read analytics_identity_links');
assert(!helperSource.includes(".insert("), 'admin-kpi helper must not write analytics_events');
assert(!helperSource.includes('trackEvent('), 'admin-kpi helper must not track new events');
assert(!helperSource.includes('logAnalyticsEvent('), 'admin-kpi helper must not write analytics events');

const dashboardSource = readFile('src/app/admin/kpi/KpiDashboardClient.tsx');
assert(dashboardSource.includes('/api/admin/check'), 'dashboard client must use existing admin check pattern');
assert(dashboardSource.includes('/api/admin/kpi/summary'), 'dashboard client must fetch summary API');
assert(dashboardSource.includes('/api/admin/kpi/funnel'), 'dashboard client must fetch funnel API');
assert(dashboardSource.includes('/api/admin/kpi/retention'), 'dashboard client must fetch retention API');
assert(dashboardSource.includes('/api/admin/kpi/raw-events'), 'dashboard client must fetch raw events API');

const eventsSource = readFile('src/lib/analytics/events.ts');
assert(!eventsSource.includes('pwa_'), 'PR-3 must not add new analytics event names');

const changed = [
  ...execFileSync('git', ['diff', '--name-only'], { cwd: repoRoot, encoding: 'utf8' }).split(/\r?\n/).filter(Boolean),
  ...execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: repoRoot, encoding: 'utf8' }).split(/\r?\n/).filter(Boolean),
];

assert(
  changed.every((file) => !file.startsWith('supabase/migrations/')),
  `PR-3 must not add migrations: ${changed.filter((file) => file.startsWith('supabase/migrations/')).join(', ')}`
);
assert(
  changed.every((file) => !file.startsWith('src/app/movement-test/camera/') && !file.startsWith('src/lib/camera/evaluator')),
  `PR-3 must not touch camera evaluator files: ${changed.filter((file) => file.startsWith('src/app/movement-test/camera/') || file.startsWith('src/lib/camera/evaluator')).join(', ')}`
);

const productPrefixes = [
  'src/app/(main)/page.tsx',
  'src/app/movement-test/',
  'src/app/app/(tabs)/home/',
  'src/app/session-preparing/',
  'src/app/payments/',
];
assert(
  changed.every((file) => !productPrefixes.some((prefix) => file.startsWith(prefix))),
  `PR-3 must not modify product route files: ${changed.filter((file) => productPrefixes.some((prefix) => file.startsWith(prefix))).join(', ')}`
);

console.log('analytics-admin-kpi-dashboard-smoke: ok');
