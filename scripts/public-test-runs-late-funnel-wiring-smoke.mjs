/**
 * PR-KPI-PILOT-RUN-CONTINUITY-01 static smoke for late-funnel public_test_runs wiring.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const warnings = [];

function fail(message) {
  console.error(`[public-test-runs-late-funnel-wiring-smoke] FAILED: ${message}`);
  process.exit(1);
}

function warn(message) {
  warnings.push(message);
  console.warn(`[public-test-runs-late-funnel-wiring-smoke] WARN: ${message}`);
}

function read(rel) {
  const path = join(root, ...rel.split('/'));
  if (!existsSync(path)) fail(`missing file: ${rel}`);
  return readFileSync(path, 'utf8');
}

function mustInclude(source, needle, label) {
  if (!source.includes(needle)) fail(`${label} missing ${needle}`);
}

const server = read('src/lib/public-test-runs/server.ts');
for (const helper of [
  'export async function markPublicTestRunMilestoneByPublicResult',
  'export async function markLatestPublicTestRunMilestoneByUser',
  'export async function linkLatestPublicTestRunToUserByAnon',
  'export async function linkPublicTestRunToUserByRun',
]) {
  mustInclude(server, helper, 'server helper');
}

const authLinkRoute = read('src/app/api/public-test-runs/auth-link/route.ts');
mustInclude(authLinkRoute, 'getCurrentUserId', 'auth-link route auth');
mustInclude(authLinkRoute, 'linkPublicTestRunToUserByRun', 'auth-link route run linker');
mustInclude(authLinkRoute, 'markAuthSuccess: true', 'auth-link route auth milestone');

const client = read('src/lib/public-test-runs/client.ts');
mustInclude(
  client,
  'export async function linkActivePublicTestRunToCurrentUserClient',
  'client auth-link helper'
);
mustInclude(
  client,
  'export async function awaitPublicTestRunAuthLinkBeforeNavigation',
  'client bounded auth-link helper'
);
mustInclude(client, 'Promise.race', 'client bounded auth-link helper');
mustInclude(client, 'timeoutMs', 'client bounded auth-link helper');
mustInclude(client, '700', 'client bounded auth-link helper');

const markRoute = read('src/app/api/public-test-runs/mark/route.ts');
const allowlistMatch = markRoute.match(/const MILESTONE_ALLOWLIST[\s\S]*?\]\);/);
if (!allowlistMatch) fail('mark route milestone allowlist not found');
const allowlistBlock = allowlistMatch[0];
for (const allowed of [
  'survey_started',
  'survey_completed',
  'result_viewed',
  'execution_cta_clicked',
  'auth_success',
  'first_app_home_viewed',
]) {
  mustInclude(allowlistBlock, `'${allowed}'`, 'client milestone allowlist');
}
for (const serverOnly of [
  'checkout_success',
  'onboarding_completed',
  'session_create_success',
  'first_session_complete_success',
]) {
  if (allowlistBlock.includes(`'${serverOnly}'`)) {
    fail(`client milestone allowlist must not include server-only milestone: ${serverOnly}`);
  }
}

const baseline = read('src/app/movement-test/baseline/page.tsx');
mustInclude(baseline, "markPublicTestRunMilestoneClient('execution_cta_clicked')", 'baseline result CTA');
const refined = read('src/app/movement-test/refined/page.tsx');
mustInclude(refined, "markPublicTestRunMilestoneClient('execution_cta_clicked')", 'refined result CTA');

for (const [rel, label] of [
  ['src/components/auth/AuthCard.tsx', 'AuthCard'],
  ['src/app/auth/callback/CallbackClient.tsx', 'CallbackClient'],
  ['src/app/signup/complete/CompleteClient.tsx', 'CompleteClient'],
]) {
  const source = read(rel);
  mustInclude(source, "markPublicTestRunMilestoneClient('auth_success')", label);
  if (label === 'CallbackClient') {
    mustInclude(source, 'linkActivePublicTestRunToCurrentUserClient', label);
  } else {
    mustInclude(source, 'awaitPublicTestRunAuthLinkBeforeNavigation', label);
  }
}

const executionStart = read('src/app/execution/start/ExecutionStartClient.tsx');
mustInclude(executionStart, 'awaitPublicTestRunAuthLinkBeforeNavigation', 'ExecutionStartClient');
const linkIndex = executionStart.indexOf('await awaitPublicTestRunAuthLinkBeforeNavigation');
const redeemIndex = executionStart.indexOf('redeemPilotAccessClient(token)');
const checkoutIndex = executionStart.indexOf("fetch('/api/stripe/checkout'");
if (linkIndex < 0 || redeemIndex < 0 || checkoutIndex < 0) {
  fail('ExecutionStartClient auth-link/redeem/checkout ordering markers not found');
}
if (linkIndex > redeemIndex || linkIndex > checkoutIndex) {
  fail('ExecutionStartClient must link active run before redeem/checkout branches');
}

for (const [source, label] of [
  [read('src/components/auth/AuthCard.tsx'), 'AuthCard'],
  [read('src/app/signup/complete/CompleteClient.tsx'), 'CompleteClient'],
  [executionStart, 'ExecutionStartClient'],
]) {
  if (source.includes('void linkActivePublicTestRunToCurrentUserClient')) {
    fail(`${label} must not fire-and-forget active run auth-link before late-funnel navigation`);
  }
}

const pilotSignup = read('src/app/api/auth/pilot-signup/route.ts');
mustInclude(pilotSignup, 'linkLatestPublicTestRunToUserByAnon', 'pilot signup route');
mustInclude(pilotSignup, 'markAuthSuccess: true', 'pilot signup auth milestone');

const verifySession = read('src/app/api/stripe/verify-session/route.ts');
mustInclude(verifySession, 'markLatestPublicTestRunMilestoneByUser', 'verify-session route');
mustInclude(verifySession, "milestone: 'checkout_success'", 'verify-session checkout milestone');

const pilotRedeem = read('src/app/api/pilot/redeem/route.ts');
if (!pilotRedeem.includes('markLatestPublicTestRunMilestoneByUser')) {
  warn('pilot redeem route has no checkout_success run milestone; verify success path manually');
} else {
  mustInclude(pilotRedeem, "milestone: 'checkout_success'", 'pilot redeem checkout milestone');
}

const profile = read('src/app/api/session/profile/route.ts');
mustInclude(profile, "milestone: 'onboarding_completed'", 'session profile onboarding milestone');

const create = read('src/app/api/session/create/route.ts');
mustInclude(create, 'markPublicTestRunMilestoneByPublicResult', 'session create public result milestone');
mustInclude(create, "milestone: 'session_create_success'", 'session create milestone');

const home = read('src/app/app/(tabs)/home/_components/HomePageClient.tsx');
mustInclude(home, "markPublicTestRunMilestoneClient('first_app_home_viewed')", 'home first view milestone');

const complete = read('src/app/api/session/complete/route.ts');
mustInclude(complete, 'if (sessionNumber === 1)', 'session complete first-session guard');
mustInclude(complete, "milestone: 'first_session_complete_success'", 'session complete first-session milestone');

console.log(
  `[public-test-runs-late-funnel-wiring-smoke] passed${warnings.length ? ` with ${warnings.length} warning(s)` : ''}`
);
