import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const repoRoot = process.cwd();

function readFile(filePath) {
  return fs.readFileSync(path.join(repoRoot, filePath), 'utf8');
}

const eventsModule = await import('../src/lib/analytics/events.ts');
const { ANALYTICS_EVENT_NAMES } = eventsModule;

const requiredEventNames = [
  'exercise_logged',
  'exercise_next_clicked',
  'exercise_skipped',
  'exercise_player_closed',
  'session_complete_clicked',
  'session_complete_blocked',
  'camera_flow_started',
  'camera_setup_viewed',
  'camera_step_started',
  'camera_step_completed',
  'camera_refine_completed',
  'camera_refine_failed_or_fallback',
  'pwa_install_card_shown',
  'pwa_install_cta_clicked',
  'pwa_install_dismissed',
  'pwa_install_prompt_accepted',
  'pwa_install_prompt_dismissed',
  'push_card_shown',
  'push_permission_requested',
  'push_permission_granted',
  'push_permission_denied',
  'push_subscribe_success',
  'push_subscribe_failed',
];

for (const eventName of requiredEventNames) {
  assert(
    ANALYTICS_EVENT_NAMES.includes(eventName),
    `${eventName} must exist in analytics allow-list`
  );
}

const requiredFiles = [
  'src/app/admin/kpi/page.tsx',
  'src/app/api/admin/kpi/details/route.ts',
  'src/app/admin/kpi/KpiDashboardClient.tsx',
  'src/lib/analytics/admin-kpi.ts',
  'src/app/app/(tabs)/home/_components/reset-map-v2/SessionPanelV2.tsx',
  'src/app/app/(tabs)/home/_components/reset-map-v2/ExercisePlayerModal.tsx',
  'src/app/movement-test/camera/page.tsx',
  'src/app/movement-test/camera/setup/page.tsx',
  'src/app/movement-test/camera/squat/page.tsx',
  'src/app/movement-test/camera/overhead-reach/page.tsx',
  'src/app/movement-test/camera/complete/page.tsx',
  'src/components/pwa/PwaInstallGuideCard.tsx',
  'src/lib/pwa/usePwaPushPermissionState.ts',
  'src/app/api/session/complete/route.ts',
];

for (const file of requiredFiles) {
  assert(fs.existsSync(path.join(repoRoot, file)), `${file} must exist`);
}

const clientTrackingFiles = [
  'src/app/app/(tabs)/home/_components/reset-map-v2/SessionPanelV2.tsx',
  'src/app/app/(tabs)/home/_components/reset-map-v2/ExercisePlayerModal.tsx',
  'src/app/movement-test/camera/page.tsx',
  'src/app/movement-test/camera/setup/page.tsx',
  'src/app/movement-test/camera/squat/page.tsx',
  'src/app/movement-test/camera/overhead-reach/page.tsx',
  'src/app/movement-test/camera/complete/page.tsx',
  'src/components/pwa/PwaInstallGuideCard.tsx',
  'src/lib/pwa/usePwaPushPermissionState.ts',
];

for (const file of clientTrackingFiles) {
  const source = readFile(file);
  assert(source.includes("trackEvent("), `${file} must use trackEvent`);
  if (!file.startsWith('src/lib/')) {
    assert(
      source.includes("from '@/lib/analytics/trackEvent'"),
      `${file} must import trackEvent helper`
    );
  }
  assert(
    !source.includes("fetch('/api/analytics/track'"),
    `${file} must not call analytics endpoint directly`
  );
  assert(
    !source.includes('await trackEvent('),
    `${file} must not await analytics before navigation`
  );
}

const serverSource = readFile('src/app/api/session/complete/route.ts');
assert(serverSource.includes("from '@/lib/analytics/logAnalyticsEvent'"), 'session complete route must import logAnalyticsEvent');
assert(serverSource.includes('logAnalyticsEvent('), 'session complete route must use logAnalyticsEvent');

const detailsRouteSource = readFile('src/app/api/admin/kpi/details/route.ts');
assert(detailsRouteSource.includes('requireAdmin('), 'details route must require admin');
assert(detailsRouteSource.includes("Cache-Control', 'no-store"), 'details route must set no-store');

const dashboardSource = readFile('src/app/admin/kpi/KpiDashboardClient.tsx');
const labelsKoSource = readFile('src/lib/analytics/admin-kpi-labels.ts');
assert(dashboardSource.includes('/api/admin/kpi/details'), 'dashboard client must fetch KPI details API');
assert(labelsKoSource.includes('세션 이탈 진단'), 'labels must define session drop-off section title');
assert(dashboardSource.includes('ADMIN_KPI_SECTION_TITLES.sessionDropoff'), 'dashboard must bind session drop-off section');
assert(labelsKoSource.includes('카메라 분석 진단'), 'labels must define camera refine section title');
assert(dashboardSource.includes('ADMIN_KPI_SECTION_TITLES.cameraRefine'), 'dashboard must bind camera refine section');
assert(labelsKoSource.includes('PWA 설치'), 'labels must define PWA install section title');
assert(dashboardSource.includes('ADMIN_KPI_SECTION_TITLES.pwaInstall'), 'dashboard must bind PWA install section');
assert(labelsKoSource.includes('알림 권한'), 'labels must define push permission section title');
assert(dashboardSource.includes('ADMIN_KPI_SECTION_TITLES.pushPermission'), 'dashboard must bind push permission section');

const adminHelperSource = readFile('src/lib/analytics/admin-kpi.ts');
assert(adminHelperSource.includes('getKpiDetails'), 'admin KPI helper must expose details query');
assert(adminHelperSource.includes("from('analytics_events')"), 'details helper must read analytics_events');
assert(adminHelperSource.includes("from('analytics_identity_links')"), 'details helper must link anon identities');

const unsafeTrackingChecks = [
  ['src/components/pwa/PwaInstallGuideCard.tsx', ['endpoint', 'p256dh', 'camera_trace', 'raw_trace', 'raw_scoring']],
  ['src/lib/pwa/usePwaPushPermissionState.ts', ['endpoint', 'p256dh', 'camera_trace', 'raw_trace', 'raw_scoring']],
  ['src/app/movement-test/camera/page.tsx', ['raw_trace', 'camera_trace', 'raw_scoring']],
  ['src/app/movement-test/camera/setup/page.tsx', ['raw_trace', 'camera_trace', 'raw_scoring']],
  ['src/app/movement-test/camera/squat/page.tsx', ['raw_trace', 'camera_trace', 'raw_scoring']],
  ['src/app/movement-test/camera/overhead-reach/page.tsx', ['raw_trace', 'camera_trace', 'raw_scoring']],
  ['src/app/movement-test/camera/complete/page.tsx', ['raw_trace', 'camera_trace', 'raw_scoring']],
];

for (const [file, bannedTerms] of unsafeTrackingChecks) {
  const source = readFile(file);
  for (const term of bannedTerms) {
    assert(!source.includes(term), `${file} must not store sensitive analytics field ${term}`);
  }
}

const trackedChanged = execFileSync('git', ['diff', '--name-only'], {
  cwd: repoRoot,
  encoding: 'utf8',
}).split(/\r?\n/).filter(Boolean);
const untrackedChanged = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], {
  cwd: repoRoot,
  encoding: 'utf8',
}).split(/\r?\n/).filter(Boolean);
const changed = [...trackedChanged, ...untrackedChanged];

assert(
  changed.every((file) => !file.startsWith('supabase/migrations/')),
  `PR-4 must not add migrations: ${changed.filter((file) => file.startsWith('supabase/migrations/')).join(', ')}`
);
assert(
  changed.every((file) => !file.startsWith('src/lib/camera/')),
  `PR-4 must not touch camera evaluator internals: ${changed.filter((file) => file.startsWith('src/lib/camera/')).join(', ')}`
);

console.log('analytics-detailed-tracking-smoke: ok');
