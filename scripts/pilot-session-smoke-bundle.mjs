/**
 * PR-PILOT-TEMPLATE-SESSION-GATE-01: run session fixture smokes in fixed order (detection-only).
 */

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const NPM_SCRIPTS = [
  'validate:session-template-fixture',
  'test:first-session-anchor-fixture-48',
  'test:session-2plus-continuity-fixture-48',
  'test:full-rail-type-continuity-fixture-48',
  'test:full-rail-adaptive-branch-fixture-48',
  'test:adaptive-real-next-session',
  'test:session-rationale-copy',
  'test:session-rail-fixture-48',
];

const APPROVED_MANUAL = /PILOT_STATUS:\s*MANUAL_REQUIRED\b/i;

function lineIndicatesSkip(line) {
  const t = line.trim();
  if (t === 'SKIP') return true;
  if (line.includes('[SKIP]')) return true;
  if (/STATUS:\s*SKIP\b/i.test(line)) return true;
  if (/\bSKIPPED\b/i.test(line)) return true;
  if (/status:\s*skipped\b/i.test(line)) return true;
  return false;
}

function outputHasUnapprovedSkip(text) {
  const lines = text.split(/\r?\n/);
  let hit = false;
  for (const line of lines) {
    if (lineIndicatesSkip(line)) {
      hit = true;
      break;
    }
  }
  if (!hit) return false;
  if (APPROVED_MANUAL.test(text)) return false;
  return true;
}

function runNpmScript(name) {
  // Windows: npm is a .cmd shim; shell:true avoids spawnSync status null / ENOENT.
  return spawnSync('npm', ['run', name], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: process.env,
    shell: true,
  });
}

function main() {
  const results = [];
  const blockers = [];
  const warnings = [];
  let anySkip = false;

  for (const script of NPM_SCRIPTS) {
    const r = runNpmScript(script);
    const out = `${r.stdout || ''}\n${r.stderr || ''}`;
    const skipBad = outputHasUnapprovedSkip(out);
    if (skipBad) {
      anySkip = true;
      blockers.push(`Unapproved SKIP pattern in output: ${script}`);
    }
    const ok = r.status === 0 && !skipBad;
    results.push({ script, ok, code: r.status });
    if (r.status !== 0) {
      blockers.push(`exit ${r.status}: ${script}`);
    }
  }

  printHeader('MOVE RE PILOT SESSION SMOKE BUNDLE');
  console.log('COMMANDS:');
  for (const { script, ok } of results) {
    console.log(`${script}: ${ok ? 'PASS' : 'FAIL'}`);
  }
  console.log('');
  console.log('BLOCKERS:');
  if (blockers.length === 0) console.log('(none)');
  else for (const b of blockers) console.log(`- ${b}`);
  console.log('');
  console.log('WARNINGS:');
  if (warnings.length === 0) console.log('(none)');
  else for (const w of warnings) console.log(`- ${w}`);

  const allPass = results.every((x) => x.ok);
  const status = allPass ? 'PASS' : 'FAIL';
  console.log('');
  console.log(`STATUS: ${status}`);
  console.log(`PILOT_STATUS: ${status}`);

  if (anySkip) {
    console.log('');
    console.log('SKIP_DETECTED: true');
  } else {
    console.log('');
    console.log('SKIP_DETECTED: false');
  }

  process.exit(allPass ? 0 : 1);
}

function printHeader(title) {
  console.log(title);
}

main();
