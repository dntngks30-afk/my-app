/**
 * Static smoke for PR-KPI-PUBLIC-TEST-RUNS-03A — migration + server helper surface.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function fail(msg) {
  console.error(`[public-test-runs-foundation-smoke] FAILED: ${msg}`);
  process.exit(1);
}

function mustInclude(text, needle, label) {
  if (!text.includes(needle)) fail(`migration missing ${label}: ${needle}`);
}

const migDir = join(root, 'supabase', 'migrations');
let migEntries;
try {
  const { readdirSync } = await import('node:fs');
  migEntries = readdirSync(migDir, { withFileTypes: true });
} catch {
  fail(`cannot read migrations dir: ${migDir}`);
}

const migFiles = migEntries.filter((e) => e.isFile() && e.name.endsWith('.sql'));

const runMig = migFiles.map((e) => e.name).find((n) => {
  const p = join(migDir, n);
  try {
    return readFileSync(p, 'utf8').includes('public.public_test_runs');
  } catch {
    return false;
  }
});

if (!runMig) fail('no migration file creating public.public_test_runs');

const migPath = join(migDir, runMig);
const mig = readFileSync(migPath, 'utf8');

mustInclude(mig, 'create table if not exists public.public_test_runs', 'create table');
mustInclude(mig, 'public_test_runs_pilot_code_safe', 'pilot_code check');
mustInclude(mig, 'enable row level security', 'RLS');

for (const idx of [
  'public_test_runs_pilot_started_idx',
  'public_test_runs_anon_started_idx',
  'public_test_runs_public_result_idx',
  'public_test_runs_user_started_idx',
]) {
  mustInclude(mig, idx, `index ${idx}`);
}

const helperPath = join(root, 'src', 'lib', 'public-test-runs', 'server.ts');
if (!existsSync(helperPath)) fail(`missing ${helperPath}`);

const helper = readFileSync(helperPath, 'utf8');

for (const fn of [
  'startPublicTestRun',
  'markPublicTestRunMilestone',
  'markPublicTestRunRefineChoice',
  'linkPublicTestRunToResult',
  'linkPublicTestRunToUserByPublicResult',
]) {
  if (!helper.includes(`export async function ${fn}`)) {
    fail(`helper missing export async function ${fn}`);
  }
}

if (!helper.includes('sanitizePilotCode')) fail('helper must use sanitizePilotCode');
if (!helper.includes('isValidAnonIdForPublicTestProfile')) {
  fail('helper must use isValidAnonIdForPublicTestProfile');
}

console.log('[public-test-runs-foundation-smoke] passed');
