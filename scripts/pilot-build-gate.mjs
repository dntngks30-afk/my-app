/**
 * PR-PILOT-BUILD-READY-BUNDLE-01 — pilot build gate (build + tsc classification).
 * Does not change product code, next.config, tsconfig, or ignoreBuildErrors policy.
 *
 * Exit: PASS / PASS_WITH_WARNINGS -> 0; FAIL -> 1
 * Stable lines (printed once at end): STATUS, PILOT_STATUS
 */

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const MAXBUF = 1024 * 1024 * 20;

const TSC_CRITICAL_MARKERS = [
  'scripts/pilot-',
  'src/app/auth/',
  'src/app/app/auth/',
  'src/app/movement-test/',
  'src/lib/camera/',
  'src/lib/session/',
  'src/app/api/session/create/',
  'src/app/api/session/complete/',
  'middleware.ts',
  'next.config.ts',
];

function tscTouchesCritical(combined) {
  const norm = combined.replace(/\\/g, '/');
  return TSC_CRITICAL_MARKERS.some((m) => norm.includes(m));
}

function excerpt(text, max = 6000) {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}\n… (truncated; full output was streamed above)`;
}

function runBuild() {
  return spawnSync('npm', ['run', 'build'], {
    cwd: root,
    shell: true,
    encoding: 'utf8',
    maxBuffer: MAXBUF,
    env: process.env,
  });
}

function runTsc() {
  return spawnSync('npx', ['tsc', '--noEmit', '--pretty', 'false'], {
    cwd: root,
    shell: true,
    encoding: 'utf8',
    maxBuffer: MAXBUF,
    env: process.env,
  });
}

function main() {
  console.log('MOVE RE PILOT BUILD GATE');
  console.log('');

  const b = runBuild();
  const buildOut = `${b.stdout || ''}\n${b.stderr || ''}`;
  const buildOk = typeof b.status === 'number' && b.status === 0;

  if (!buildOk) {
    if (buildOut.trim()) process.stdout.write(buildOut);
    console.log('');
    console.log('BUILD:');
    console.log('- status: FAIL');
    console.log('- blockers:');
    console.log(`  - npm run build exited ${b.status ?? 'null'}`);
    console.log('- warnings:');
    console.log('  - (none)');
    console.log('');
    console.log('TSC:');
    console.log('- status: NOT_RUN (build failed)');
    console.log('- blockers:');
    console.log('  - (none)');
    console.log('- warnings:');
    console.log('  - (none)');
    console.log('');
    console.log('If the failure references missing configuration, verify required env key *names* in deploy docs (never log secret values).');
    console.log('');
    console.log('STATUS: FAIL');
    console.log('PILOT_STATUS: FAIL');
    process.exit(1);
  }

  console.log('BUILD:');
  console.log('- status: PASS');
  console.log('- blockers:');
  console.log('  - (none)');
  console.log('- warnings:');
  console.log('  - (none)');
  if (buildOut.trim()) process.stdout.write(buildOut);

  const t = runTsc();
  const tscOut = `${t.stdout || ''}\n${t.stderr || ''}`;
  const tscOk = typeof t.status === 'number' && t.status === 0;

  console.log('');
  console.log('TSC:');

  if (tscOk) {
    console.log('- status: PASS');
    console.log('- blockers:');
    console.log('  - (none)');
    console.log('- warnings:');
    console.log('  - (none)');
    if (tscOut.trim()) process.stdout.write(tscOut);
    console.log('');
    console.log('STATUS: PASS');
    console.log('PILOT_STATUS: PASS');
    process.exit(0);
  }

  process.stdout.write(tscOut);
  const critical = tscTouchesCritical(tscOut);
  console.log('');
  console.log('- status: FAIL');
  console.log('- blockers:');
  if (critical) {
    console.log('  - TypeScript errors reference pilot-critical paths (see excerpt below)');
  } else {
    console.log('  - (none — classified as non-pilot-critical for gate purposes)');
  }
  console.log('- warnings:');
  console.log('  - tsc exited non-zero; humans may still hold release if warnings are concerning');
  console.log('');
  console.log('TSC excerpt:');
  console.log(excerpt(tscOut, 4000));

  if (critical) {
    console.log('');
    console.log('STATUS: FAIL');
    console.log('PILOT_STATUS: FAIL');
    process.exit(1);
  }

  console.log('');
  console.log('STATUS: PASS_WITH_WARNINGS');
  console.log('PILOT_STATUS: PASS_WITH_WARNINGS');
  process.exit(0);
}

main();
