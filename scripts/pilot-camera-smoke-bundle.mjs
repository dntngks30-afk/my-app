/**
 * PR-PILOT-CAMERA-GATE-V2-REALIGN-01 — V2-centered pilot camera smoke bundle.
 *
 * Intent: this PR does not weaken camera readiness. It replaces the legacy PR-F
 * V1/V1.5 internal-contract full proof bundle with a fixed V2-centered pilot bundle.
 *
 * test:camera-prf-proof-gate (camera-pr-f-regression-proof-gate.mjs, 22-script bundle)
 * is intentionally NOT run here — it remains a useful engineer diagnostic via
 * npm run test:camera-prf-proof-gate but is not V2 pilot readiness truth.
 * Do not add it back as required, optional, warning, or in-bundle diagnostic execution.
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

/**
 * Fixed pilot camera steps — explicit types; display strings are not parsed for execution.
 * @typedef {{ type: 'direct', label: string, command: string, args: string[], display: string }} DirectStep
 * @typedef {{ type: 'npm', label: string, script: string, display: string }} NpmStep
 */
const REQUIRED_CAMERA_STEPS = [
  {
    type: 'direct',
    label: 'camera-squat-v2-01-motion-evidence-engine',
    command: 'npx',
    args: ['tsx', 'scripts/camera-squat-v2-01-motion-evidence-engine-smoke.mjs'],
    display: 'npx tsx scripts/camera-squat-v2-01-motion-evidence-engine-smoke.mjs',
  },
  {
    type: 'direct',
    label: 'camera-squat-v2-04b-runtime-owner-safety',
    command: 'npx',
    args: ['tsx', 'scripts/camera-squat-v2-04b-runtime-owner-safety-smoke.mjs'],
    display: 'npx tsx scripts/camera-squat-v2-04b-runtime-owner-safety-smoke.mjs',
  },
  {
    type: 'npm',
    label: 'camera-pr-x-squat-authority',
    script: 'test:camera-pr-x-squat-authority',
    display: 'npm run test:camera-pr-x-squat-authority',
  },
  {
    type: 'npm',
    label: 'camera-pr7-squat-completion',
    script: 'test:camera-pr7-squat-completion',
    display: 'npm run test:camera-pr7-squat-completion',
  },
  {
    type: 'npm',
    label: 'camera-pr8-overhead-reach',
    script: 'test:camera-pr8-overhead-reach',
    display: 'npm run test:camera-pr8-overhead-reach',
  },
  {
    type: 'npm',
    label: 'camera-setup-screen',
    script: 'test:camera-setup-screen',
    display: 'npm run test:camera-setup-screen',
  },
  {
    type: 'npm',
    label: 'voice-waited-cue-completion',
    script: 'test:voice-waited-cue-completion',
    display: 'npm run test:voice-waited-cue-completion',
  },
];

const APPROVED_MANUAL = /PILOT_STATUS:\s*MANUAL_REQUIRED\b/i;

function lineIndicatesSkip(line) {
  const t = line.trim();
  if (t === 'SKIP') return true;
  if (line.includes('[SKIP]')) return true;
  if (/STATUS:\s*SKIP\b/i.test(line)) return true;
  if (/\bSKIPPED\b/.test(line)) return true;
  if (/status:\s*skipped\b/i.test(line)) return true;
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

function loadPackageScripts() {
  const raw = readFileSync(join(root, 'package.json'), 'utf8');
  const pkg = JSON.parse(raw);
  return pkg.scripts && typeof pkg.scripts === 'object' ? pkg.scripts : {};
}

function preflightOrExit() {
  const scripts = loadPackageScripts();
  const blockers = [];

  for (const step of REQUIRED_CAMERA_STEPS) {
    if (step.type === 'direct') {
      const rel = step.args[1];
      if (typeof rel !== 'string') {
        blockers.push(`direct step ${step.label}: missing script path in args`);
        continue;
      }
      const abs = join(root, rel);
      if (!existsSync(abs)) {
        blockers.push(`required file missing: ${rel}`);
      }
    } else if (step.type === 'npm') {
      if (!scripts[step.script]) {
        blockers.push(`required npm script missing from package.json: ${step.script}`);
      }
    } else {
      blockers.push(`unknown step type: ${step.type}`);
    }
  }

  if (blockers.length > 0) {
    console.log('MOVE RE PILOT CAMERA SMOKE BUNDLE');
    console.log('');
    console.log('BLOCKERS:');
    for (const b of blockers) console.log(`- ${b}`);
    console.log('');
    console.log('STATUS: FAIL');
    console.log('PILOT_STATUS: FAIL');
    console.log('SKIP_DETECTED: false');
    console.log('MANUAL_REQUIRED_COUNT: 1');
    console.log('LEGACY_PRF_PROOF_GATE_RUN: false');
    console.log('');
    console.log(
      'LEGACY_PRF_PROOF_GATE: not run by pilot camera gate; use npm run test:camera-prf-proof-gate only as separate legacy diagnostic.'
    );
    process.exit(1);
  }
}

function runDirectStep(step) {
  return spawnSync(step.command, step.args, {
    cwd: root,
    shell: true,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: process.env,
  });
}

function runNpmStep(step) {
  return spawnSync('npm', ['run', step.script], {
    cwd: root,
    shell: true,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: process.env,
  });
}

function main() {
  try {
    preflightOrExit();
  } catch (e) {
    console.error('MOVE RE PILOT CAMERA SMOKE BUNDLE');
    console.error('');
    console.error('BLOCKERS:');
    console.error(`- Runner exception: ${e.message || e}`);
    console.error('');
    console.error('STATUS: FAIL');
    console.error('PILOT_STATUS: FAIL');
    console.error('SKIP_DETECTED: false');
    console.error('MANUAL_REQUIRED_COUNT: 1');
    console.error('LEGACY_PRF_PROOF_GATE_RUN: false');
    console.error('');
    console.error(
      'LEGACY_PRF_PROOF_GATE: not run by pilot camera gate; use npm run test:camera-prf-proof-gate only as separate legacy diagnostic.'
    );
    process.exit(1);
  }

  const results = [];
  const blockers = [];
  const warnings = [];
  let anySkip = false;

  for (const step of REQUIRED_CAMERA_STEPS) {
    const r = step.type === 'direct' ? runDirectStep(step) : runNpmStep(step);
    const out = `${r.stdout || ''}\n${r.stderr || ''}`;
    const skipBad = outputHasUnapprovedSkip(out);
    if (skipBad) {
      anySkip = true;
      blockers.push(`Unapproved SKIP pattern in output: ${step.display}`);
    }
    const codeOk = typeof r.status === 'number' && r.status === 0;
    const ok = codeOk && !skipBad;
    results.push({ display: step.display, ok, code: r.status });
    if (!codeOk) {
      blockers.push(`exit ${r.status}: ${step.display}`);
    }
    if (!ok && out.trim()) {
      process.stdout.write(out);
    }
  }

  const manualRequiredLines = [
    'Real-device camera checklist must be completed before final pilot READY.',
  ];

  console.log('MOVE RE PILOT CAMERA SMOKE BUNDLE');
  console.log('');
  console.log('COMMANDS:');
  for (const { display, ok } of results) {
    console.log(`- ${display}: ${ok ? 'PASS' : 'FAIL'}`);
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
  console.log('LEGACY_PRF_PROOF_GATE_RUN: false');
  console.log('');
  console.log(
    'LEGACY_PRF_PROOF_GATE: not run by pilot camera gate; use npm run test:camera-prf-proof-gate only as separate legacy diagnostic.'
  );

  process.exit(allPass ? 0 : 1);
}

main();
