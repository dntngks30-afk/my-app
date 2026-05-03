/**
 * PR-KPI-PUBLIC-TEST-RUNS-03C — Static smoke for claim → public_test_runs user link.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function fail(msg) {
  console.error(`[public-test-runs-claim-link-smoke] FAILED: ${msg}`);
  process.exit(1);
}

function read(rel) {
  const p = join(root, ...rel.split('/'));
  if (!existsSync(p)) fail(`missing file: ${rel}`);
  return readFileSync(p, 'utf8');
}

const routePath = 'src/app/api/public-results/[id]/claim/route.ts';
const route = read(routePath);

if (!route.includes('linkPublicTestRunToUserByPublicResult')) {
  fail('claim route must import/use linkPublicTestRunToUserByPublicResult');
}

const claimCallIdx = route.indexOf('const output = await claimPublicResult');
if (claimCallIdx < 0) fail('claim route must await claimPublicResult into output');
const afterClaim = route.slice(claimCallIdx);
if (!afterClaim.includes('linkPublicTestRunToUserByPublicResult')) {
  fail('linkPublicTestRunToUserByPublicResult must appear after claimPublicResult');
}

for (const bad of [
  'runLinked',
  'publicTestRun',
  'run_link',
  'runLink',
  'publicTestRunLinked',
]) {
  if (route.includes(bad)) {
    fail(`claim route must not contain forbidden response token: ${bad}`);
  }
}

if (!route.includes('public_result_claim_success')) {
  fail('claim route must keep public_result_claim_success analytics');
}

if (!route.includes('public_result_claim_success:${userId}:${output.id}')) {
  fail('claim route must keep dedupe_key pattern public_result_claim_success:${userId}:${output.id}');
}

const server = read('src/lib/public-test-runs/server.ts');
if (!server.includes('export async function linkPublicTestRunToUserByPublicResult')) {
  fail('server.ts must export linkPublicTestRunToUserByPublicResult');
}

const pkg = read('package.json');
if (!pkg.includes('"test:public-test-runs-claim-link"')) {
  fail('package.json must define test:public-test-runs-claim-link script');
}

console.log('[public-test-runs-claim-link-smoke] passed');
