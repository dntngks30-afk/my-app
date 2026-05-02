/**
 * PR-6 Korean KPI explanations smoke — static verification only.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const repoRoot = process.cwd();

function readFile(file) {
  return fs.readFileSync(path.join(repoRoot, file), 'utf8');
}

function exists(file) {
  return fs.existsSync(path.join(repoRoot, file));
}

// 1–2. Korean labels + descriptions in dictionary
const labelsPath = 'src/lib/analytics/admin-kpi-labels.ts';
assert(exists(labelsPath), `${labelsPath} must exist`);

const labelsSrc = readFile(labelsPath);
assert(labelsSrc.includes('방문자 수'), 'summary label visitors');
assert(labelsSrc.includes('선택한 기간 동안 MOVE RE에 들어온'), 'summary description visitors');
assert(labelsSrc.includes('1일 재방문율'), 'summary label d1');
assert(labelsSrc.includes('테스트 퍼널'), 'section title public funnel');
assert(labelsSrc.includes('재방문율'), 'section title retention');
assert(labelsSrc.includes('집계 대기:'), 'help text 집계 대기');
assert(labelsSrc.includes('적격 코호트 가중 평균:'), 'help text weighted cohort');
assert(labelsSrc.includes('이벤트 건수 기준:'), 'help text event count');

// 3–4. Dashboard imports dictionary + Korean sections
const dashPath = 'src/app/admin/kpi/KpiDashboardClient.tsx';
const dashSrc = readFile(dashPath);
assert(dashSrc.includes("from '@/lib/analytics/admin-kpi-labels'"), 'dashboard must import admin-kpi-labels');
assert(dashSrc.includes('ADMIN_KPI_SUMMARY_METRICS'), 'dashboard must reference summary metric dictionary');
assert(labelsSrc.includes('핵심 요약'), 'dictionary: section core summary');
assert(labelsSrc.includes('실행 전환 퍼널'), 'dictionary: execution funnel');
assert(dashSrc.includes('ADMIN_KPI_SECTION_TITLES.coreSummary'), 'dashboard must bind core summary section');
assert(dashSrc.includes('ADMIN_KPI_SECTION_TITLES.executionFunnel'), 'dashboard must bind execution funnel');

// 5–6. Help copy surfaced in dashboard
assert(dashSrc.includes('ADMIN_KPI_HELP_TEXTS.pending'), '집계 대기 help binding');
assert(dashSrc.includes('ADMIN_KPI_HELP_TEXTS.weightedCohort'), '적격 코호트 help binding');

// Git hygiene (when there are local changes)
const changed = [
  ...execFileSync('git', ['diff', '--name-only'], { cwd: repoRoot, encoding: 'utf8' }).split(/\r?\n/).filter(Boolean),
  ...execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: repoRoot, encoding: 'utf8' }).split(/\r?\n/).filter(Boolean),
];

const allowedExact = new Set([
  'src/lib/analytics/admin-kpi-labels.ts',
  'src/app/admin/kpi/KpiDashboardClient.tsx',
  'scripts/analytics-kpi-korean-explanations-smoke.mjs',
  'scripts/analytics-detailed-tracking-smoke.mjs',
  'package.json',
  'docs/pr/PR-ANALYTICS-KPI-KOREAN-EXPLANATIONS-06.md',
]);

if (changed.length > 0) {
  const disallowed = changed.filter((f) => !allowedExact.has(f));
  assert(
    disallowed.length === 0,
    `PR-6 must only touch allowed files. Extra: ${disallowed.join(', ')}`
  );
}

// 7. No date-range logic edits in admin-kpi (should not appear in PR-6 diff)
assert(!changed.includes('src/lib/analytics/admin-kpi.ts'), 'admin-kpi.ts must not be modified in PR-6');

// 8–9. No pilot baseline / reset in new files
for (const f of ['src/lib/analytics/admin-kpi-labels.ts', dashPath]) {
  const s = readFile(f);
  assert(!/pilot.?baseline/i.test(s), `${f} must not add pilot baseline`);
  assert(!/kpi.?reset/i.test(s), `${f} must not add kpi reset`);
}

// 10. No dangerous SQL in changed analytics-facing TS
for (const f of changed.filter((x) => x.endsWith('.ts') || x.endsWith('.tsx'))) {
  const s = readFile(f);
  assert(!/\btruncate\b/i.test(s), `${f} must not contain truncate SQL`);
  assert(!/\bdelete\s+from\b/i.test(s), `${f} must not contain delete-from SQL`);
}

// 11. No new migration
assert(!changed.some((f) => f.startsWith('supabase/migrations/')), 'no new migration');

// 12. No new event names in events.ts when touched
if (changed.includes('src/lib/analytics/events.ts')) {
  throw new Error('PR-6 must not modify events.ts');
}

// 13. No product tracking routes
const forbiddenPrefixes = [
  'src/app/(main)/',
  'src/app/movement-test/',
  'src/app/app/(tabs)/home/',
  'src/app/session-preparing/',
  'src/app/payments/',
];
const badProduct = changed.filter((f) => forbiddenPrefixes.some((p) => f.startsWith(p)));
assert(badProduct.length === 0, `no product routes: ${badProduct.join(', ')}`);

// 14. Prior analytics smokes still exist
for (const script of [
  'scripts/analytics-event-infra-smoke.mjs',
  'scripts/analytics-core-funnel-tracking-smoke.mjs',
  'scripts/analytics-admin-kpi-dashboard-smoke.mjs',
  'scripts/analytics-detailed-tracking-smoke.mjs',
  'scripts/analytics-retention-hardening-smoke.mjs',
]) {
  assert(exists(script), `${script} must exist`);
}

const adminKpi = readFile('src/lib/analytics/admin-kpi.ts');
assert(adminKpi.includes('export function resolveKpiRange'), 'admin-kpi resolveKpiRange still present');

console.log('analytics-kpi-korean-explanations-smoke: ok');
