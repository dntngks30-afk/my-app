/**
 * PR-F regression proof gate.
 *
 * Purpose:
 * - Run the mandatory PR-F proof bundle in a fixed order.
 * - Hard-fail on: missing script, non-zero exit, or explicit SKIP output.
 * - Prevent representative-permanent promotion from being accepted without
 *   executable full-chain proof on the same head commit.
 */

import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

/** @typedef {{ path: string, group: string }} ProofScript */

/** @type {ProofScript[]} */
const REQUIRED_PROOF_BUNDLE = [
  // Representative / promotion
  { path: 'scripts/camera-pr-e1-shallow-lock-promotion-registry-smoke.mjs', group: 'representative/promotion' },
  { path: 'scripts/camera-pr-d-squat-regression-harness-smoke.mjs', group: 'representative/promotion' },

  // No-early-pass / shallow integrity
  { path: 'scripts/camera-squat-ultra-shallow-no-early-pass-guarantee-01-smoke.mjs', group: 'no-early-pass/shallow-integrity' },
  { path: 'scripts/camera-pr-core-pass-reason-align-01-smoke.mjs', group: 'no-early-pass/shallow-integrity' },

  // Trajectory / owner separation
  { path: 'scripts/camera-cam31-squat-guarded-trajectory-reversal-smoke.mjs', group: 'trajectory/owner-separation' },
  { path: 'scripts/camera-pr-squat-trajectory-rescue-owner-separation-01-smoke.mjs', group: 'trajectory/owner-separation' },

  // Peak-anchor / reversal chain / ultra-low policy
  { path: 'scripts/camera-e1b-peak-anchor-contamination-smoke.mjs', group: 'peak-anchor/reversal/ultra-low-policy' },
  { path: 'scripts/camera-e1c-authoritative-reversal-chain-smoke.mjs', group: 'peak-anchor/reversal/ultra-low-policy' },
  { path: 'scripts/camera-pr6-ultra-low-policy-smoke.mjs', group: 'peak-anchor/reversal/ultra-low-policy' },
  { path: 'scripts/camera-pr-cam-squat-blended-early-peak-false-pass-lock-01-smoke.mjs', group: 'peak-anchor/reversal/ultra-low-policy' },

];

let failed = 0;

function fail(message) {
  failed += 1;
  console.error(`FAIL: ${message}`);
}

function runProofScript(entry, index, total) {
  const label = `[${index + 1}/${total}] ${entry.path}`;
  if (!existsSync(entry.path)) {
    fail(`${label} missing (group=${entry.group})`);
    return;
  }

  console.log(`\n━━ Running ${label} (${entry.group}) ━━`);
  const child = spawnSync('npx', ['tsx', entry.path], {
    encoding: 'utf8',
    env: process.env,
    shell: true,
  });

  const stdout = child.stdout ?? '';
  const stderr = child.stderr ?? '';

  if (stdout.length > 0) process.stdout.write(stdout);
  if (stderr.length > 0) process.stderr.write(stderr);

  const combined = `${stdout}\n${stderr}`;
  const hasSkip = /(^|\n)\s*SKIP\b/i.test(combined);

  if (hasSkip) {
    fail(`${label} reported SKIP; SKIP is forbidden in PR-F permanent proof gate`);
  }

  if (typeof child.status !== 'number' || child.status !== 0) {
    fail(`${label} exited non-zero (status=${child.status ?? 'null'})`);
    return;
  }

  if (!hasSkip) {
    console.log(`PASS: ${label}`);
  }
}

console.log('PR-F mandatory regression proof gate: start');

for (let i = 0; i < REQUIRED_PROOF_BUNDLE.length; i += 1) {
  runProofScript(REQUIRED_PROOF_BUNDLE[i], i, REQUIRED_PROOF_BUNDLE.length);
}

if (failed > 0) {
  console.error(`\nPR-F proof gate failed: ${failed} issue(s).`);
  process.exit(1);
}

console.log('\nPR-F proof gate passed: all required scripts executed with no SKIP and no failures.');
