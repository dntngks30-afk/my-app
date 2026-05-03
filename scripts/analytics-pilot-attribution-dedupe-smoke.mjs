/**
 * PR-KPI-PILOT-ACCURACY-01 — Static checks for pilot attribution + scoped dedupe keys.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();

function read(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
}

function fail(message) {
  console.error(`[analytics-pilot-attribution-dedupe-smoke] FAILED: ${message}`);
  process.exit(1);
}

const ctxPath = 'src/lib/analytics/client-context.ts';
try {
  assert(fs.existsSync(path.join(repoRoot, ctxPath)), `${ctxPath} must exist`);
} catch (e) {
  fail(e.message);
}

const clientCtx = read(ctxPath);
for (const fn of [
  'getAnalyticsClientPersonScope',
  'getAnalyticsPilotProps',
  'withPilotAnalyticsProps',
  'buildClientScopedDedupeKey',
]) {
  if (!clientCtx.includes(`export function ${fn}`)) {
    fail(`${ctxPath} must export function ${fn}`);
  }
}
if (!clientCtx.includes('.slice(0, MAX_DEDUPE_KEY_LENGTH)') && !clientCtx.includes('slice(0, 256)')) {
  fail(`${ctxPath} must truncate dedupe key to max length`);
}

const landing = read('src/app/(main)/page.tsx');
if (!landing.includes('buildClientScopedDedupeKey')) {
  fail('landing page must use buildClientScopedDedupeKey');
}
if (!landing.includes(`dedupe_key: buildClientScopedDedupeKey(['landing_viewed', kstDay])`)) {
  fail('landing_viewed must use buildClientScopedDedupeKey with landing_viewed + kstDay');
}
// Legacy global collision: template literal landing_viewed:${date} only (no anon scope)
if (/dedupe_key:\s*`landing_viewed:\$\{/.test(landing)) {
  fail('landing_viewed must not use date-only template dedupe_key');
}

const home = read('src/app/app/(tabs)/home/_components/HomePageClient.tsx');
if (!home.includes('buildClientScopedDedupeKey')) {
  fail('HomePageClient must use buildClientScopedDedupeKey');
}
if (!home.includes("'app_home_viewed'") || !home.includes("'reset_map_opened'")) {
  fail('HomePageClient must scope dedupe for app_home_viewed and reset_map_opened');
}

const panel = read('src/app/app/(tabs)/home/_components/reset-map-v2/SessionPanelV2.tsx');
if (!panel.includes('buildClientScopedDedupeKey') || !panel.includes("'session_panel_opened'")) {
  fail('SessionPanelV2 session_panel_opened must use buildClientScopedDedupeKey');
}

const player = read('src/app/app/(tabs)/home/_components/reset-map-v2/ExercisePlayerModal.tsx');
if (!player.includes('buildClientScopedDedupeKey') || !player.includes("'exercise_player_opened'")) {
  fail('ExercisePlayerModal exercise_player_opened must use buildClientScopedDedupeKey');
}

const funnelFiles = [
  'src/app/(main)/page.tsx',
  'src/app/movement-test/survey/page.tsx',
  'src/app/movement-test/refine-bridge/page.tsx',
  'src/app/movement-test/baseline/page.tsx',
  'src/app/movement-test/refined/page.tsx',
  'src/app/movement-test/camera/page.tsx',
  'src/app/movement-test/camera/setup/page.tsx',
  'src/app/movement-test/camera/squat/page.tsx',
  'src/app/movement-test/camera/overhead-reach/page.tsx',
];

for (const file of funnelFiles) {
  const src = read(file);
  if (!src.includes('withPilotAnalyticsProps')) {
    fail(`${file} must use withPilotAnalyticsProps`);
  }
}

const adminKpi = read('src/lib/analytics/admin-kpi.ts');
const safeBlockMatch = adminKpi.match(/const SAFE_PROP_KEYS = new Set\(\[([\s\S]*?)\]\)/);
if (!safeBlockMatch) {
  fail('admin-kpi.ts SAFE_PROP_KEYS block not found');
}
const safeBlock = safeBlockMatch[1];
if (!/"pilot_code"|'pilot_code'/.test(safeBlock)) {
  fail('SAFE_PROP_KEYS must include pilot_code');
}

const sanitize = read('src/lib/analytics/sanitize.ts');
const unsafeKeys = ['email', 'raw_trace', 'camera_trace', 'raw_scoring', 'exercise_logs', 'stripe'];
for (const key of unsafeKeys) {
  if (!sanitize.includes(`'${key}'`)) {
    fail(`sanitize.ts UNSAFE_PROP_KEYS must still include '${key}'`);
  }
}

console.log('[analytics-pilot-attribution-dedupe-smoke] passed');
