/**
 * PR-5 analytics-retention-hardening-smoke
 *
 * Static repository verification for PR-5 retention cohort hardening.
 * All checks are read-only file inspections and git status checks.
 * No product routes, camera evaluator files, or DB schemas are modified.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const repoRoot = process.cwd();

function readFile(file) {
  return fs.readFileSync(path.join(repoRoot, file), 'utf8');
}

function fileExists(file) {
  return fs.existsSync(path.join(repoRoot, file));
}

// ────────────────────────────────────────────────────────────────
// 1. Canonical admin person_key helper exists
// ────────────────────────────────────────────────────────────────
assert(
  fileExists('src/lib/analytics/admin-person-key.ts'),
  'admin-person-key.ts must exist'
);

const personKeySource = readFile('src/lib/analytics/admin-person-key.ts');
assert(
  personKeySource.includes('resolveAnalyticsPersonKeyForKpi'),
  'admin-person-key.ts must export resolveAnalyticsPersonKeyForKpi'
);
assert(
  personKeySource.includes('user:${'),
  'resolveAnalyticsPersonKeyForKpi must use user: prefix'
);
assert(
  personKeySource.includes('anon:${'),
  'resolveAnalyticsPersonKeyForKpi must use anon: prefix'
);
assert(
  personKeySource.includes('event:${'),
  'resolveAnalyticsPersonKeyForKpi must use event: fallback'
);

// ────────────────────────────────────────────────────────────────
// 2. admin-kpi.ts imports and uses canonical person_key helper
// ────────────────────────────────────────────────────────────────
const adminKpiSource = readFile('src/lib/analytics/admin-kpi.ts');

assert(
  adminKpiSource.includes("from './admin-person-key'"),
  'admin-kpi.ts must import from admin-person-key'
);
assert(
  adminKpiSource.includes('resolveAnalyticsPersonKeyForKpi'),
  'admin-kpi.ts must use resolveAnalyticsPersonKeyForKpi'
);
assert(
  !adminKpiSource.includes('function buildPersonKey('),
  'admin-kpi.ts must not contain the old private buildPersonKey function'
);

// ────────────────────────────────────────────────────────────────
// 3. eligible_d1 / eligible_d3 / eligible_d7 in types and logic
// ────────────────────────────────────────────────────────────────
const typesSource = readFile('src/lib/analytics/admin-kpi-types.ts');
assert(typesSource.includes('eligible_d1'), 'admin-kpi-types.ts must include eligible_d1');
assert(typesSource.includes('eligible_d3'), 'admin-kpi-types.ts must include eligible_d3');
assert(typesSource.includes('eligible_d7'), 'admin-kpi-types.ts must include eligible_d7');

assert(adminKpiSource.includes('eligible_d1'), 'admin-kpi.ts logic must include eligible_d1');
assert(adminKpiSource.includes('eligible_d3'), 'admin-kpi.ts logic must include eligible_d3');
assert(adminKpiSource.includes('eligible_d7'), 'admin-kpi.ts logic must include eligible_d7');

// ────────────────────────────────────────────────────────────────
// 4. Retention rates are null for ineligible cohorts
// ────────────────────────────────────────────────────────────────
assert(
  adminKpiSource.includes('eligible_d1 ? percentage('),
  'admin-kpi.ts must use eligible_d1 guard before percentage for d1_rate'
);
assert(
  adminKpiSource.includes('eligible_d3 ? percentage('),
  'admin-kpi.ts must use eligible_d3 guard before percentage for d3_rate'
);
assert(
  adminKpiSource.includes('eligible_d7 ? percentage('),
  'admin-kpi.ts must use eligible_d7 guard before percentage for d7_rate'
);

// ────────────────────────────────────────────────────────────────
// 5. session_number null is NOT accepted as session 1
// ────────────────────────────────────────────────────────────────
assert(
  !adminKpiSource.includes('session_number === 1 || row.session_number == null'),
  'admin-kpi.ts must not accept null session_number as first session in retention cohort'
);
assert(
  !adminKpiSource.includes("session_number === 1 || row.session_number == null"),
  'admin-kpi.ts cohort filter must not include null session_number'
);

// ────────────────────────────────────────────────────────────────
// 6. Summary retention does not use only latestRetention.at(-1)
// ────────────────────────────────────────────────────────────────
assert(
  !adminKpiSource.includes('appHomeRetention.at(-1)'),
  'admin-kpi.ts must not use appHomeRetention.at(-1) for summary D1/D3/D7 — use weighted eligible cohorts'
);
assert(
  adminKpiSource.includes('computeWeightedRetentionRates'),
  'admin-kpi.ts must use computeWeightedRetentionRates for summary retention cards'
);

// ────────────────────────────────────────────────────────────────
// 7. generated_at / source / range_clamped in types and logic
// ────────────────────────────────────────────────────────────────
assert(typesSource.includes('generated_at'), 'admin-kpi-types.ts must include generated_at');
assert(typesSource.includes("source: 'raw_events'"), 'admin-kpi-types.ts must include source raw_events');
assert(typesSource.includes('range_clamped'), 'admin-kpi-types.ts must include range_clamped');

assert(adminKpiSource.includes('generated_at'), 'admin-kpi.ts must produce generated_at');
assert(adminKpiSource.includes('range_clamped'), 'admin-kpi.ts must produce range_clamped');
assert(adminKpiSource.includes("source: 'raw_events'"), 'admin-kpi.ts must set source to raw_events');

// ────────────────────────────────────────────────────────────────
// 8. Date range clamp consistency — toExclusiveIso always uses cappedToDay
// ────────────────────────────────────────────────────────────────
assert(
  adminKpiSource.includes('toExclusiveIso: kstDayToUtcIso(cappedToDay, true)'),
  'admin-kpi.ts resolveKpiRange must always derive toExclusiveIso from cappedToDay'
);
assert(
  adminKpiSource.includes('rangeClamped'),
  'admin-kpi.ts must track rangeClamped flag'
);

// ────────────────────────────────────────────────────────────────
// 9. No new migration was added in this PR
// ────────────────────────────────────────────────────────────────
const changedFiles = [
  ...execFileSync('git', ['diff', '--name-only'], { cwd: repoRoot, encoding: 'utf8' }).split(/\r?\n/).filter(Boolean),
  ...execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: repoRoot, encoding: 'utf8' }).split(/\r?\n/).filter(Boolean),
];

const newMigrations = changedFiles.filter((f) => f.startsWith('supabase/migrations/'));
assert(
  newMigrations.length === 0,
  `PR-5 must not add migrations: ${newMigrations.join(', ')}`
);

// ────────────────────────────────────────────────────────────────
// 10. No product route tracking added
// ────────────────────────────────────────────────────────────────
const forbiddenNewTrackingPrefixes = [
  'src/app/(main)/',
  'src/app/movement-test/',
  'src/app/session-preparing/',
  'src/app/payments/',
  'src/app/auth/',
  'src/app/signup/',
];
const newProductFiles = changedFiles.filter((f) =>
  forbiddenNewTrackingPrefixes.some((prefix) => f.startsWith(prefix))
);
assert(
  newProductFiles.length === 0,
  `PR-5 must not modify product route tracking files: ${newProductFiles.join(', ')}`
);

// ────────────────────────────────────────────────────────────────
// 11. No camera evaluator files modified
// ────────────────────────────────────────────────────────────────
const cameraEvaluatorFiles = changedFiles.filter((f) =>
  f.startsWith('src/lib/camera/') || f.startsWith('src/lib/camera/evaluator')
);
assert(
  cameraEvaluatorFiles.length === 0,
  `PR-5 must not touch camera evaluator internals: ${cameraEvaluatorFiles.join(', ')}`
);

// ────────────────────────────────────────────────────────────────
// 12. No payment / claim / session / readiness files modified
// ────────────────────────────────────────────────────────────────
const forbiddenSemanticFiles = changedFiles.filter((f) =>
  f.includes('/stripe/') ||
  f.includes('/claim/') ||
  f.includes('/session/create') ||
  f.includes('/readiness/')
);
assert(
  forbiddenSemanticFiles.length === 0,
  `PR-5 must not touch payment/claim/session-create/readiness files: ${forbiddenSemanticFiles.join(', ')}`
);

// ────────────────────────────────────────────────────────────────
// 13. Previous PR-1/2/3/4 smoke files still coexist
// ────────────────────────────────────────────────────────────────
const priorSmokes = [
  'scripts/analytics-event-infra-smoke.mjs',
  'scripts/analytics-core-funnel-tracking-smoke.mjs',
  'scripts/analytics-admin-kpi-dashboard-smoke.mjs',
  'scripts/analytics-detailed-tracking-smoke.mjs',
];
for (const smoke of priorSmokes) {
  assert(fileExists(smoke), `Prior smoke script must still exist: ${smoke}`);
}

// ────────────────────────────────────────────────────────────────
// 14. Admin KPI routes still require admin auth and no-store cache
// ────────────────────────────────────────────────────────────────
const adminKpiRoutes = [
  'src/app/api/admin/kpi/summary/route.ts',
  'src/app/api/admin/kpi/funnel/route.ts',
  'src/app/api/admin/kpi/retention/route.ts',
  'src/app/api/admin/kpi/details/route.ts',
  'src/app/api/admin/kpi/raw-events/route.ts',
];
for (const routeFile of adminKpiRoutes) {
  const src = readFile(routeFile);
  assert(src.includes('requireAdmin('), `${routeFile} must still call requireAdmin`);
  assert(src.includes("Cache-Control', 'no-store"), `${routeFile} must still set no-store`);
}

// ────────────────────────────────────────────────────────────────
// 15. admin-kpi.ts must not write analytics events
// ────────────────────────────────────────────────────────────────
assert(!adminKpiSource.includes('.insert('), 'admin-kpi.ts must not insert analytics_events');
assert(!adminKpiSource.includes('trackEvent('), 'admin-kpi.ts must not call trackEvent');
assert(!adminKpiSource.includes('logAnalyticsEvent('), 'admin-kpi.ts must not call logAnalyticsEvent');

// ────────────────────────────────────────────────────────────────
// 16. No new analytics event names added in this PR
// ────────────────────────────────────────────────────────────────
const eventsSource = readFile('src/lib/analytics/events.ts');
// spot-check: PR-5 should not define new event constants
// We verify by checking git diff for events.ts
const eventsChanged = changedFiles.some((f) => f === 'src/lib/analytics/events.ts');
if (eventsChanged) {
  // If events.ts was changed, ensure only non-event-name changes (comments, types)
  const diffOutput = execFileSync('git', ['diff', 'src/lib/analytics/events.ts'], { cwd: repoRoot, encoding: 'utf8' });
  const addedEventLines = diffOutput.split('\n')
    .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
    .filter((line) => line.includes("'") && line.includes(':') && !line.includes('//'));
  assert(
    addedEventLines.length === 0,
    `PR-5 must not add new event name constants in events.ts. Added lines: ${addedEventLines.join('; ')}`
  );
}

// ────────────────────────────────────────────────────────────────
// Done
// ────────────────────────────────────────────────────────────────
console.log('analytics-retention-hardening-smoke: ok');
