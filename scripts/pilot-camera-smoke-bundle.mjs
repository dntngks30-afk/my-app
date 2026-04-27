/**
 * PR-PILOT-CAMERA-AUTH-GATE-01: pilot camera smoke bundle (required npm scripts only).
 *
 * Optional V2 direct scripts: explicit allowlist below. Default is NOT_RUN (no execution).
 * Do not add paths via filename glob; only reviewed, deterministic, allowlisted entries.
 */

import { join, dirname } from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

/** Required pilot camera gates (package.json scripts only). */
const REQUIRED_NPM_SCRIPTS = [
  'test:camera-prf-proof-gate',
  'test:camera-pr8-overhead-reach',
  'test:camera-setup-screen',
  'test:voice-waited-cue-completion',
];

/**
 * Optional V2 owner/recovery/readiness scripts — explicit paths relative to repo root.
 * PR-3 default: execute none (report NOT_RUN). Execution stays disabled unless each entry
 * is reviewed for determinism, no live hardware, and no product/tracked-artifact mutation.
 */
const OPTIONAL_V2_ALLOWLIST = [
  // Example (not executed in PR-3): { relPath: 'scripts/example.mjs', label: 'example' },
];

/** When true, allowlisted optional scripts that exist on disk may be executed. PR-3: keep false. */
const EXECUTE_OPTIONAL_V2 = false;

const APPROVED_MANUAL = /PILOT_STATUS:\s*MANUAL_REQUIRED\b/i;

function lineIndicatesSkip(line) {
  const t = line.trim();
  if (t === 'SKIP') return true;
  if (line.includes('[SKIP]')) return true;
  if (/STATUS:\s*SKIP\b/i.test(line)) return true;
  // Uppercase SKIPPED only — /i would false-positive on prose like "promoted: skipped"
  if (/\bSKIPPED\b/.test(line)) return true;
  if (/status:\s*skipped\b/i.test(line)) return true;
  // Harness-style skip lines (e.g. "SKIP: reason") without matching "(no SKIP allowed)" prose
  if (/^\s*SKIP\s*:/.test(line)) return true;
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
  return spawnSync('npm', ['run', name], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: process.env,
    shell: true,
  });
}

function runOptionalNode(relPath) {
  const abs = join(root, relPath);
  return spawnSync(process.execPath, [abs], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: process.env,
  });
}

function main() {
  const results = [];
  const optionalResults = [];
  const blockers = [];
  const warnings = [];
  let anySkip = false;

  for (const script of REQUIRED_NPM_SCRIPTS) {
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

  for (const entry of OPTIONAL_V2_ALLOWLIST) {
    const relPath = entry.relPath;
    const label = entry.label || relPath;
    if (!EXECUTE_OPTIONAL_V2) {
      optionalResults.push({ label, relPath, state: 'NOT_RUN' });
      continue;
    }
    if (!existsSync(join(root, relPath))) {
      optionalResults.push({ label, relPath, state: 'NOT_FOUND' });
      continue;
    }
    const r = runOptionalNode(relPath);
    const out = `${r.stdout || ''}\n${r.stderr || ''}`;
    const skipBad = outputHasUnapprovedSkip(out);
    if (skipBad) {
      anySkip = true;
      blockers.push(`Unapproved SKIP in optional: ${label}`);
    }
    const ok = r.status === 0 && !skipBad;
    optionalResults.push({
      label,
      relPath,
      state: ok ? 'PASS' : 'FAIL',
      code: r.status,
    });
    if (!ok) {
      blockers.push(`optional ${label} exit ${r.status}`);
    }
  }

  const manualRequiredLines = [
    'Real-device camera checklist must be completed before final pilot READY.',
  ];

  console.log('MOVE RE PILOT CAMERA SMOKE BUNDLE');
  console.log('');
  console.log('COMMANDS:');
  for (const { script, ok } of results) {
    console.log(`${script}: ${ok ? 'PASS' : 'FAIL'}`);
  }
  console.log('');
  console.log('OPTIONAL_COMMANDS:');
  if (optionalResults.length === 0) {
    console.log('- (no entries in OPTIONAL_V2_ALLOWLIST — nothing to run)');
  } else {
    for (const o of optionalResults) {
      console.log(`${o.label} (${o.relPath}): ${o.state}`);
    }
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
  for (const m of manualRequiredLines) console.log(`- ${m}`);

  const allPass = results.every((x) => x.ok);
  const status = allPass ? 'PASS' : 'FAIL';

  console.log('');
  console.log(`STATUS: ${status}`);
  console.log(`PILOT_STATUS: ${status}`);
  console.log(`SKIP_DETECTED: ${anySkip ? 'true' : 'false'}`);
  console.log(`MANUAL_REQUIRED_COUNT: ${manualRequiredLines.length}`);

  process.exit(allPass ? 0 : 1);
}

main();
