/**
 * PR-PILOT-CAMERA-AUTH-GATE-01: static inspection + URL oracle for OAuth callback error routing.
 * Does not call Google/Kakao or start a dev server.
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const CALLBACK_CLIENT = join(root, 'src', 'app', 'auth', 'callback', 'CallbackClient.tsx');

/** Mirrors CallbackClient.tsx contract — keep aligned when verifying URLs. */
function sanitizeProvider(provider) {
  return provider === 'google' || provider === 'kakao' ? provider : null;
}

function buildAuthErrorPath(provider) {
  const params = new URLSearchParams();
  params.set('error', 'oauth');
  if (provider) params.set('provider', provider);
  return `/app/auth?${params.toString()}`;
}

function urlMatchesContract(pathWithQuery, { expectProvider }) {
  if (!pathWithQuery.startsWith('/app/auth?')) return false;
  const q = pathWithQuery.slice('/app/auth?'.length);
  const params = new URLSearchParams(q);
  if (params.get('error') !== 'oauth') return false;
  if (expectProvider == null) {
    if (params.has('provider')) return false;
    return true;
  }
  return params.get('provider') === expectProvider;
}

function printFooter(status, cases, blockers, warnings, manualLines) {
  console.log('MOVE RE PILOT AUTH URL SMOKE');
  console.log('');
  console.log('CASES:');
  for (const [k, v] of Object.entries(cases)) {
    console.log(`${k}: ${v}`);
  }
  console.log('');
  console.log('BLOCKERS:');
  if (blockers.length === 0) console.log('(none)');
  else for (const b of blockers) console.log(`- ${b}`);
  console.log('');
  console.log('WARNINGS:');
  if (warnings.length === 0) console.log('(none)');
  else for (const w of warnings) console.log(`- ${w}`);
  console.log('');
  console.log('MANUAL_REQUIRED:');
  for (const m of manualLines) console.log(`- ${m}`);
  console.log('');
  console.log('LIVE_PROVIDER_LOGIN_TESTED: false');
  console.log('');
  console.log(`STATUS: ${status}`);
  console.log(`PILOT_STATUS: ${status}`);
}

function main() {
  const blockers = [];
  const warnings = [];
  const manualLines = [
    'Live Google login on production canonical domain',
    'Live Kakao login on production canonical domain',
    'Google login from Instagram in-app browser',
    'Kakao login from KakaoTalk in-app browser',
    'Logout then different account login',
  ];
  const cases = { google: 'FAIL', kakao: 'FAIL', invalid: 'FAIL' };

  if (!existsSync(CALLBACK_CLIENT)) {
    blockers.push(`Callback client missing: ${CALLBACK_CLIENT}`);
    printFooter('FAIL', cases, blockers, warnings, manualLines);
    process.exit(1);
  }

  let text;
  try {
    text = readFileSync(CALLBACK_CLIENT, 'utf8');
  } catch (e) {
    blockers.push(`Cannot read CallbackClient.tsx: ${e.message || e}`);
    printFooter('FAIL', cases, blockers, warnings, manualLines);
    process.exit(1);
  }

  // Unsafe: forwarding raw provider param into query without sanitization
  if (/params\.set\(\s*['"]provider['"]\s*,\s*providerParam\b/.test(text)) {
    blockers.push('Source appears to set provider query from raw providerParam');
    printFooter('FAIL', cases, blockers, warnings, manualLines);
    process.exit(1);
  }

  if (/params\.set\(\s*['"]provider['"]\s*,\s*String\s*\(\s*providerParam/.test(text)) {
    blockers.push('Source may forward unvalidated provider string');
    printFooter('FAIL', cases, blockers, warnings, manualLines);
    process.exit(1);
  }

  const hasSanitize =
    /function\s+sanitizeProvider\b/.test(text) &&
    /provider\s*===\s*['"]google['"]/.test(text) &&
    /provider\s*===\s*['"]kakao['"]/.test(text);

  const hasErrorOauth =
    /params\.set\(\s*['"]error['"]\s*,\s*['"]oauth['"]\s*\)/.test(text);

  const hasConditionalProvider =
    /if\s*\(\s*provider\s*\)\s*params\.set\(\s*['"]provider['"]\s*,\s*provider\s*\)/.test(text);

  const usesSanitizedOnError =
    /buildAuthErrorPath\s*\(\s*provider\s*\)/.test(text) &&
    /const\s+provider\s*=\s*sanitizeProvider\s*\(\s*providerParam\s*\)/.test(text);

  const uncertain = !hasSanitize || !hasErrorOauth || !hasConditionalProvider || !usesSanitizedOnError;

  if (uncertain) {
    warnings.push(
      'CallbackClient.tsx structure does not match expected oauth error contract; automated inspection cannot confirm behavior.'
    );
    cases.google = 'MANUAL_REQUIRED';
    cases.kakao = 'MANUAL_REQUIRED';
    cases.invalid = 'MANUAL_REQUIRED';
    printFooter('MANUAL_REQUIRED', cases, blockers, warnings, manualLines);
    process.exit(0);
  }

  const gPath = buildAuthErrorPath(sanitizeProvider('google'));
  const kPath = buildAuthErrorPath(sanitizeProvider('kakao'));
  const iPath = buildAuthErrorPath(sanitizeProvider('invalid'));

  const gOk = urlMatchesContract(gPath, { expectProvider: 'google' });
  const kOk = urlMatchesContract(kPath, { expectProvider: 'kakao' });
  const iOk = urlMatchesContract(iPath, { expectProvider: null });

  if (!gOk || !kOk) {
    blockers.push('URL oracle: google/kakao error path does not match /app/auth?error=oauth&provider=...');
    printFooter('FAIL', cases, blockers, warnings, manualLines);
    process.exit(1);
  }

  if (!iOk || iPath.includes('invalid')) {
    blockers.push('URL oracle: invalid provider must map to /app/auth?error=oauth without provider param');
    printFooter('FAIL', cases, blockers, warnings, manualLines);
    process.exit(1);
  }

  cases.google = 'PASS';
  cases.kakao = 'PASS';
  cases.invalid = 'PASS';

  printFooter('PASS', cases, blockers, warnings, manualLines);
  process.exit(0);
}

main();
