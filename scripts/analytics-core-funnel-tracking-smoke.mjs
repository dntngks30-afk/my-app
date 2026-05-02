import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const repoRoot = process.cwd();

const eventsModule = await import('../src/lib/analytics/events.ts');
const events = eventsModule.default ?? eventsModule;
const { ANALYTICS_EVENT_NAMES } = events;

const clientBoundaryFiles = [
  'src/app/(main)/page.tsx',
  'src/app/movement-test/survey/page.tsx',
  'src/app/movement-test/refine-bridge/page.tsx',
  'src/app/movement-test/baseline/page.tsx',
  'src/app/movement-test/refined/page.tsx',
  'src/app/app/(tabs)/home/_components/HomePageClient.tsx',
  'src/app/app/(tabs)/home/_components/reset-map-v2/SessionPanelV2.tsx',
  'src/app/app/(tabs)/home/_components/reset-map-v2/ExercisePlayerModal.tsx',
  'src/components/auth/AuthCard.tsx',
  'src/app/auth/callback/CallbackClient.tsx',
  'src/app/signup/complete/CompleteClient.tsx',
];

const serverSuccessFiles = [
  'src/app/api/stripe/verify-session/route.ts',
  'src/app/api/public-results/[id]/claim/route.ts',
  'src/app/api/session/profile/route.ts',
  'src/app/api/session/create/route.ts',
  'src/app/api/session/complete/route.ts',
];

const expectedClientTrackFiles = new Set([
  'src/app/(main)/page.tsx',
  'src/app/movement-test/survey/page.tsx',
  'src/app/movement-test/refine-bridge/page.tsx',
  'src/app/movement-test/baseline/page.tsx',
  'src/app/movement-test/refined/page.tsx',
  'src/app/app/(tabs)/home/_components/HomePageClient.tsx',
  'src/app/app/(tabs)/home/_components/reset-map-v2/SessionPanelV2.tsx',
  'src/app/app/(tabs)/home/_components/reset-map-v2/ExercisePlayerModal.tsx',
  'src/components/auth/AuthCard.tsx',
  'src/app/auth/callback/CallbackClient.tsx',
  'src/app/signup/complete/CompleteClient.tsx',
]);

const expectedServerLogFiles = new Set(serverSuccessFiles);

function readFile(filePath) {
  return fs.readFileSync(path.join(repoRoot, filePath), 'utf8');
}

function extractEventNames(source) {
  const names = new Set();
  const patterns = [
    /trackEvent\(\s*'([a-z_]+)'/g,
    /event_name:\s*'([a-z_]+)'/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      names.add(match[1]);
    }
  }
  return names;
}

for (const file of clientBoundaryFiles) {
  const source = readFile(file);
  if (expectedClientTrackFiles.has(file)) {
    assert(
      source.includes("from '@/lib/analytics/trackEvent'"),
      `${file} must import trackEvent helper`
    );
    assert(
      source.includes('trackEvent('),
      `${file} must use trackEvent`
    );
  }
  assert(
    !source.includes("fetch('/api/analytics/track'"),
    `${file} must use trackEvent helper instead of direct analytics fetch`
  );
  assert(
    !source.includes('await trackEvent('),
    `${file} must not await analytics before navigation`
  );
}

for (const file of serverSuccessFiles) {
  const source = readFile(file);
  assert(
    source.includes("from '@/lib/analytics/logAnalyticsEvent'"),
    `${file} must import logAnalyticsEvent`
  );
  assert(
    source.includes('logAnalyticsEvent('),
    `${file} must use logAnalyticsEvent`
  );
}

const trackedChanged = execFileSync('git', ['diff', '--name-only'], {
  cwd: repoRoot,
  encoding: 'utf8',
})
  .split(/\r?\n/)
  .filter(Boolean);
const untrackedChanged = execFileSync(
  'git',
  ['ls-files', '--others', '--exclude-standard'],
  {
    cwd: repoRoot,
    encoding: 'utf8',
  }
)
  .split(/\r?\n/)
  .filter(Boolean);
const changed = [...trackedChanged, ...untrackedChanged];
const adminKpiSmokeExists = changed.includes('scripts/analytics-admin-kpi-dashboard-smoke.mjs')
  || execFileSync('git', ['ls-files', 'scripts/analytics-admin-kpi-dashboard-smoke.mjs'], {
    cwd: repoRoot,
    encoding: 'utf8',
  }).trim() === 'scripts/analytics-admin-kpi-dashboard-smoke.mjs';
const detailedSmokeExists = changed.includes('scripts/analytics-detailed-tracking-smoke.mjs')
  || execFileSync('git', ['ls-files', 'scripts/analytics-detailed-tracking-smoke.mjs'], {
    cwd: repoRoot,
    encoding: 'utf8',
  }).trim() === 'scripts/analytics-detailed-tracking-smoke.mjs';

assert(
  changed.every((file) => !file.startsWith('supabase/migrations/')),
  `PR-2 must not add migrations: ${changed.filter((file) => file.startsWith('supabase/migrations/')).join(', ')}`
);

if (!adminKpiSmokeExists) {
  assert(
    changed.every(
      (file) =>
        !file.startsWith('src/app/admin/kpi') &&
        !file.startsWith('src/app/api/admin/kpi')
    ),
    `PR-2 must not add admin KPI files: ${changed.filter((file) => file.includes('/admin/kpi')).join(', ')}`
  );
}

if (!detailedSmokeExists) {
  assert(
    changed.every(
      (file) =>
        !file.startsWith('src/app/movement-test/camera/') &&
        !file.startsWith('src/lib/camera/evaluator')
    ),
    `PR-2 must not touch camera evaluator files: ${changed.filter((file) => file.startsWith('src/app/movement-test/camera/') || file.startsWith('src/lib/camera/evaluator')).join(', ')}`
  );
}

const eventNamesUsed = new Set();
for (const file of [...clientBoundaryFiles, ...serverSuccessFiles]) {
  for (const eventName of extractEventNames(readFile(file))) {
    eventNamesUsed.add(eventName);
  }
}

for (const eventName of eventNamesUsed) {
  assert(
    ANALYTICS_EVENT_NAMES.includes(eventName),
    `event ${eventName} must exist in analytics allow-list`
  );
}

assert(fs.existsSync(path.join(repoRoot, 'src/app/app/(tabs)/home/_components/reset-map-v2/SessionPanelV2.tsx')));
assert(fs.existsSync(path.join(repoRoot, 'src/app/app/(tabs)/home/_components/reset-map-v2/ExercisePlayerModal.tsx')));
if (!adminKpiSmokeExists) {
  assert(
    !fs.existsSync(path.join(repoRoot, 'src/app/admin/kpi')),
    'PR-2 must not create /admin/kpi'
  );
}

console.log('analytics-core-funnel-tracking-smoke: ok');
