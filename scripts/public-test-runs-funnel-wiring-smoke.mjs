/**
 * PR-KPI-PUBLIC-TEST-RUNS-03B — Static smoke for public funnel ↔ public_test_runs wiring.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function fail(msg) {
  console.error(`[public-test-runs-funnel-wiring-smoke] FAILED: ${msg}`);
  process.exit(1);
}

function read(rel) {
  const p = join(root, ...rel.split('/'));
  if (!existsSync(p)) fail(`missing file: ${rel}`);
  return readFileSync(p, 'utf8');
}

const client = read('src/lib/public-test-runs/client.ts');
if (!client.includes('moveRePublicTestRun:v1')) fail('client must use storage key moveRePublicTestRun:v1');
if (!client.includes('keepalive: true')) fail('client fetch must use keepalive: true');

for (const name of [
  'startNewPublicTestRunClient',
  'markPublicTestRunMilestoneClient',
  'markPublicTestRunRefineChoiceClient',
  'getActivePublicTestRunForResult',
]) {
  if (!client.includes(`export async function ${name}`) && !client.includes(`export function ${name}`)) {
    fail(`client missing export: ${name}`);
  }
}

const startRoute = read('src/app/api/public-test-runs/start/route.ts');
if (!startRoute.includes('startPublicTestRun')) fail('start route must call startPublicTestRun');

const markRoute = read('src/app/api/public-test-runs/mark/route.ts');
if (!markRoute.includes('markPublicTestRunMilestone')) fail('mark route must call markPublicTestRunMilestone');
if (!markRoute.includes('markPublicTestRunRefineChoice')) fail('mark route must call markPublicTestRunRefineChoice');

const landing = read('src/app/(main)/page.tsx');
if (!landing.includes('startNewPublicTestRunClient')) fail('landing must use startNewPublicTestRunClient');

const survey = read('src/app/movement-test/survey/page.tsx');
if (!survey.includes('markPublicTestRunMilestoneClient')) fail('survey must use markPublicTestRunMilestoneClient');

const bridge = read('src/app/movement-test/refine-bridge/page.tsx');
if (!bridge.includes('markPublicTestRunRefineChoiceClient')) fail('refine-bridge must use markPublicTestRunRefineChoiceClient');

const persist = read('src/lib/public-results/persistPublicResult.ts');
if (!persist.includes("'use client'")) fail('persistPublicResult must be client-marked with use client');
if (!persist.includes('getActivePublicTestRunForResult')) fail('persistPublicResult must import getActivePublicTestRunForResult');
if (!persist.includes('publicTestRunId')) fail('persistPublicResult body must include publicTestRunId');
if (!persist.includes('publicTestRunAnonId')) fail('persistPublicResult body must include publicTestRunAnonId');

const publicResults = read('src/app/api/public-results/route.ts');
if (!publicResults.includes('linkPublicTestRunToResult')) fail('public-results route must call linkPublicTestRunToResult');

console.log('[public-test-runs-funnel-wiring-smoke] passed');
