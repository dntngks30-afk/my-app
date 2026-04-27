/**
 * PR-PILOT-BUILD-READY-BUNDLE-01 — final pilot readiness aggregator.
 * Runs all child pilot gates in fixed order (continues after failures), prints one FINAL STATUS line.
 *
 * Exit: READY or READY_WITH_MANUAL_CHECKS -> 0; BLOCKED -> 1
 */

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const MAXBUF = 1024 * 1024 * 20;

/** Child execution order (fixed — do not reorder). */
const STEPS = [
  { script: 'test:pilot-build', domain: 'BUILD' },
  { script: 'test:pilot-session', domain: 'SESSION' },
  { script: 'test:pilot-template-parity', domain: 'TEMPLATES' },
  { script: 'test:pilot-camera', domain: 'CAMERA' },
  { script: 'test:pilot-auth', domain: 'AUTH' },
];

/** Final summary print order (parent SSOT shape). */
const SUMMARY_DOMAIN_ORDER = ['BUILD', 'TEMPLATES', 'SESSION', 'CAMERA', 'AUTH'];

function lineIndicatesSkip(line) {
  const t = line.trim();
  if (t === 'SKIP') return true;
  if (line.includes('[SKIP]')) return true;
  if (line.includes('STATUS: SKIP')) return true;
  if (/^\s*SKIP:/.test(line)) return true;
  if (/\bSKIPPED\b/.test(line)) return true;
  return false;
}

function outputHasUnapprovedSkip(text) {
  if (/PILOT_STATUS:\s*MANUAL_REQUIRED\b/m.test(text)) return false;
  for (const line of text.split(/\r?\n/)) {
    if (lineIndicatesSkip(line)) return true;
  }
  return false;
}

function lastEnumLine(text, prefix, allowed) {
  const re = new RegExp(`^${prefix}:\\s*(${allowed.join('|')})\\s*$`, 'gm');
  let last = null;
  let m;
  while ((m = re.exec(text)) !== null) {
    last = m[1];
  }
  return last;
}

function lastManualCount(text) {
  const re = /^MANUAL_REQUIRED_COUNT:\s*(\d+)\s*$/gm;
  let last = null;
  let m;
  while ((m = re.exec(text)) !== null) {
    last = parseInt(m[1], 10);
  }
  return last;
}

function lastLiveLogin(text) {
  const re = /^LIVE_PROVIDER_LOGIN_TESTED:\s*(true|false)\s*$/gm;
  let last = null;
  let m;
  while ((m = re.exec(text)) !== null) {
    last = m[1];
  }
  return last;
}

function parseManualBullets(text) {
  const m = text.match(/^MANUAL_REQUIRED:\s*$/m);
  if (!m) return [];
  const start = m.index + m[0].length;
  const rest = text.slice(start);
  const lines = rest.split(/\r?\n/);
  const bullets = [];
  for (const line of lines) {
    const tr = line.trim();
    if (tr === '(none)') break;
    const bm = line.match(/^\s*-\s*(.+)\s*$/);
    if (bm) {
      const c = bm[1].trim();
      if (c !== '(none)') bullets.push(c);
      continue;
    }
    if (tr === '') continue;
    if (/^[A-Za-z][A-Za-z0-9_]*:/.test(tr)) break;
  }
  return bullets;
}

function runChild(script) {
  return spawnSync('npm', ['run', script], {
    cwd: root,
    shell: true,
    encoding: 'utf8',
    maxBuffer: MAXBUF,
    env: process.env,
  });
}

function analyzeChild(script, domain, out, exitCode) {
  const allowed = ['PASS', 'FAIL', 'MANUAL_REQUIRED', 'PASS_WITH_WARNINGS'];
  const status = lastEnumLine(out, 'STATUS', allowed);
  const pilotStatus = lastEnumLine(out, 'PILOT_STATUS', allowed);
  const manualCount = lastManualCount(out);
  const liveLogin = lastLiveLogin(out);
  const bullets = parseManualBullets(out);
  const skipBad = outputHasUnapprovedSkip(out);
  const missingPilot = pilotStatus == null && exitCode === 0;

  const blockers = [];
  if (typeof exitCode !== 'number' || exitCode !== 0) {
    blockers.push(`npm run ${script} exited ${exitCode ?? 'null'}`);
  }
  if (pilotStatus === 'FAIL') {
    blockers.push(`PILOT_STATUS: FAIL (${script})`);
  }
  if (skipBad) {
    blockers.push(`Unapproved SKIP in output (${script})`);
  }

  const warnings = [];
  if (missingPilot) {
    warnings.push(`PILOT_STATUS line missing with exit 0 (${script}) — verify script contract`);
  }

  let displayStatus = 'FAIL';
  if (exitCode === 0 && !skipBad && pilotStatus !== 'FAIL') {
    displayStatus = pilotStatus || status || 'UNKNOWN';
  } else if (exitCode === 0 && pilotStatus === 'FAIL') {
    displayStatus = 'FAIL';
  } else if (exitCode !== 0) {
    displayStatus = 'FAIL';
  }

  const manualLines = [];
  if (script === 'test:pilot-build' && pilotStatus === 'PASS_WITH_WARNINGS') {
    manualLines.push('TypeScript: non-pilot-critical tsc warnings — review before release');
  }
  if (script === 'test:pilot-template-parity') {
    if (pilotStatus === 'MANUAL_REQUIRED') manualLines.push('Template parity: MANUAL_REQUIRED (e.g. Supabase env or manual DB verification)');
    for (const b of bullets) manualLines.push(b);
  }
  if (script === 'test:pilot-session') {
    if (pilotStatus === 'MANUAL_REQUIRED') manualLines.push('Session bundle: MANUAL_REQUIRED');
    for (const b of bullets) manualLines.push(b);
  }
  if (script === 'test:pilot-camera') {
    if (pilotStatus === 'MANUAL_REQUIRED') manualLines.push('Camera: MANUAL_REQUIRED');
    if (manualCount != null && manualCount > 0) {
      manualLines.push(`MANUAL_REQUIRED_COUNT: ${manualCount} (real-device camera checklist)`);
    }
    for (const b of bullets) manualLines.push(b);
  }
  if (script === 'test:pilot-auth') {
    if (pilotStatus === 'MANUAL_REQUIRED') manualLines.push('Auth: MANUAL_REQUIRED');
    if (liveLogin === 'false') {
      manualLines.push('LIVE_PROVIDER_LOGIN_TESTED: false — production Google/Kakao and in-app browsers');
    }
    for (const b of bullets) manualLines.push(b);
  }

  const manualUnique = [...new Set(manualLines)];

  return {
    domain,
    script,
    exitCode,
    out,
    status,
    pilotStatus,
    manualCount,
    liveLogin,
    bullets,
    skipBad,
    missingPilot,
    blockers,
    warnings,
    displayStatus,
    manualLines: manualUnique,
  };
}

function domainHasHardFail(r) {
  if (typeof r.exitCode !== 'number' || r.exitCode !== 0) return true;
  if (r.pilotStatus === 'FAIL') return true;
  if (r.skipBad) return true;
  return false;
}

function refineManual(r) {
  if (r.script === 'test:pilot-auth') {
    return r.liveLogin === 'false' || r.pilotStatus === 'MANUAL_REQUIRED' || r.bullets.length > 0;
  }
  if (r.script === 'test:pilot-camera') {
    return (r.manualCount != null && r.manualCount > 0) || r.pilotStatus === 'MANUAL_REQUIRED' || r.bullets.length > 0;
  }
  if (r.script === 'test:pilot-template-parity') {
    return r.pilotStatus === 'MANUAL_REQUIRED' || r.bullets.length > 0;
  }
  if (r.script === 'test:pilot-build') {
    return r.pilotStatus === 'PASS_WITH_WARNINGS';
  }
  if (r.script === 'test:pilot-session') {
    return r.pilotStatus === 'MANUAL_REQUIRED' || r.bullets.length > 0;
  }
  return false;
}

function main() {
  const results = [];

  for (const { script, domain } of STEPS) {
    const child = runChild(script);
    const out = `${child.stdout || ''}\n${child.stderr || ''}`;
    const exitCode = child.status;
    if (out.trim()) process.stdout.write(out);
    results.push(analyzeChild(script, domain, out, exitCode));
  }

  let blocked = false;
  for (const r of results) {
    if (domainHasHardFail(r)) blocked = true;
  }

  let needsManual = false;
  for (const r of results) {
    if (refineManual(r)) needsManual = true;
  }

  let finalStatus;
  if (blocked) {
    finalStatus = 'BLOCKED';
  } else if (needsManual) {
    finalStatus = 'READY_WITH_MANUAL_CHECKS';
  } else {
    finalStatus = 'READY';
  }

  console.log('');
  console.log('MOVE RE PILOT READY CHECK');
  console.log('');

  const byDomain = new Map(results.map((r) => [r.domain, r]));
  for (const domain of SUMMARY_DOMAIN_ORDER) {
    const r = byDomain.get(domain);
    if (!r) continue;
    console.log(r.domain);
    console.log(`- status: ${r.displayStatus}`);
    console.log('- blockers:');
    if (r.blockers.length === 0) console.log('  - (none)');
    else for (const b of r.blockers) console.log(`  - ${b}`);
    console.log('- warnings:');
    if (r.warnings.length === 0) console.log('  - (none)');
    else for (const w of r.warnings) console.log(`  - ${w}`);
    console.log('- manual_required:');
    const ml = r.manualLines.filter(Boolean);
    if (ml.length === 0) console.log('  - (none)');
    else for (const x of ml) console.log(`  - ${x}`);
    console.log('');
  }

  console.log(`FINAL STATUS: ${finalStatus}`);

  const exit = finalStatus === 'BLOCKED' ? 1 : 0;
  process.exit(exit);
}

main();
