/**
 * PR2 - Golden trace harness.
 * - Does not import camera app code, pass-core, or V2 (PR3+ wires adapter).
 * @see docs/pr/PR-SQUAT-V2-00-GOLDEN-TRACE-HARNESS.md
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const GOLDEN_DIR = join(__dirname, '..', 'fixtures', 'camera', 'squat', 'golden');
const MANIFEST_PATH = join(GOLDEN_DIR, 'manifest.json');

/**
 * PR3+ SquatMotionEvidenceEngineV2: replace body with real evaluation.
 * PR2: stub only — no runtime authority, no product behavior change.
 *
 * @param {unknown} _traceJson
 * @returns {Promise<{ implemented: boolean, pass?: boolean, reason?: string }>}
 */
export async function evaluateSquatMotionEvidenceV2(_traceJson) {
  return {
    implemented: false,
    reason:
      'PR2 stub: SquatMotionEvidenceEngineV2 not wired. Implement in PR3+ and set implemented:true.',
  };
}

/**
 * Read-only: serialized `attempts` progression flags in the export (not V2, not a gate).
 * @param {unknown} traceJson
 * @returns {{ kind: 'pass' | 'fail' | 'unknown', note: string }}
 */
function legacySerializedAttemptsHint(traceJson) {
  const data = traceJson && typeof traceJson === 'object' ? traceJson : null;
  if (!data || !Array.isArray(data.attempts)) {
    return { kind: 'unknown', note: 'no attempts array' };
  }
  if (data.attempts.length === 0) {
    return { kind: 'unknown', note: 'attempts: [] (observation-only or no closed attempt in export)' };
  }
  for (const a of data.attempts) {
    if (!a || typeof a !== 'object') continue;
    if (a.progressionPassed === true || a.finalPassLatched === true) {
      return { kind: 'pass', note: 'attempt has progressionPassed/finalPassLatched' };
    }
  }
  return { kind: 'fail', note: 'no attempt with progressionPassed/finalPassLatched' };
}

function loadManifest() {
  if (!existsSync(MANIFEST_PATH)) {
    throw new Error(`manifest not found: ${MANIFEST_PATH}`);
  }
  const raw = readFileSync(MANIFEST_PATH, 'utf8');
  return JSON.parse(raw);
}

/**
 * @param {string} relFile
 */
function readFixtureJson(relFile) {
  const full = join(GOLDEN_DIR, relFile);
  if (!existsSync(full)) {
    return { status: 'missing', path: full, data: null, error: 'file missing' };
  }
  try {
    const raw = readFileSync(full, 'utf8');
    const data = JSON.parse(raw);
    return { status: 'ok', path: full, data, error: null };
  } catch (e) {
    return { status: 'unreadable', path: full, data: null, error: e instanceof Error ? e.message : String(e) };
  }
}

function rowLabel(expected) {
  return expected === 'pass' ? 'pass' : 'fail';
}

/**
 * @param {{ kind: 'pass' | 'fail' | 'unknown', note: string }} leg
 * @param {'pass' | 'fail'} expected
 */
function infoLegacySerializedVsContract(leg, expected) {
  const wantPass = expected === 'pass';
  if (leg.kind === 'unknown') {
    if (wantPass) {
      return 'gap: contract=pass, legacy in-file has no pass (attempts[] empty) — V2 TBD. Not a strict failure in --report.';
    }
    return 'n/a: contract=fail, legacy in-file unknown; compare after V2.';
  }
  if (wantPass && leg.kind === 'pass') {
    return 'info: in-file shows progression pass (not V2).';
  }
  if (wantPass && leg.kind === 'fail') {
    return 'info: contract pass vs in-file no pass (observation).';
  }
  if (!wantPass && leg.kind === 'pass') {
    return 'info: contract fail vs in-file pass — compare when V2 lands.';
  }
  return 'info: in-file has no pass flag (roughly aligned for fail).';
}

async function runReport() {
  console.log('Golden trace harness — REPORT mode (non-gating; main may still be wrong)\n');
  const manifest = loadManifest();
  const list = Array.isArray(manifest.fixtures) ? manifest.fixtures : [];
  if (list.length === 0) {
    console.error('No fixtures in manifest');
    process.exit(1);
  }

  const rows = [];
  for (const entry of list) {
    const id = entry.id;
    const file = entry.file;
    const expected = entry.expected;
    if (!id || !file || (expected !== 'pass' && expected !== 'fail')) {
      console.error('Invalid manifest entry:', entry);
      process.exit(1);
    }
    const read = readFixtureJson(file);
    if (read.status === 'missing' || read.status === 'unreadable') {
      rows.push({
        id,
        file,
        expected: rowLabel(expected),
        v2: '—',
        legacyHint: '—',
        fileStatus: read.status,
        detail: read.error ?? read.path,
        mismatch: entry.required ? 'missing/unreadable' : 'n/a',
        infoGap: '—',
      });
      continue;
    }
    const v2 = await evaluateSquatMotionEvidenceV2(read.data);
    const leg = legacySerializedAttemptsHint(read.data);
    const legacyStr = `${leg.kind} (${leg.note})`;

    const v2s = v2.implemented ? (v2.pass ? 'pass' : 'fail') : 'deferred (V2 stub)';
    let mismatch = 'n/a';
    if (v2.implemented) {
      const wantPass = expected === 'pass';
      const gotPass = v2.pass === true;
      mismatch = wantPass === gotPass ? 'no' : 'yes (V2 vs contract)';
    } else {
      mismatch = 'n/a (V2 not run)';
    }

    const infoGap = infoLegacySerializedVsContract(leg, expected);
    rows.push({
      id,
      file,
      expected: rowLabel(expected),
      v2: v2s,
      legacyHint: legacyStr,
      fileStatus: 'ok',
      detail: v2.implemented ? '' : (v2.reason ?? ''),
      mismatch,
      infoGap,
    });
  }

  const pad = (s, n) => (String(s) + ' '.repeat(n)).slice(0, n);
  const w = 36;
  console.log(
    pad('id', w) + pad('file', 38) + pad('exp', 6) + pad('V2', 22) + pad('legacyHint', 28) + 'mismatch (V2)\n' +
    '-'.repeat(140)
  );
  for (const r of rows) {
    const shortLeg = (r.legacyHint && r.legacyHint.split(' (')[0]) || r.legacyHint;
    console.log(
      pad(r.id, w) + pad(r.file, 38) + pad(r.expected, 6) + pad(r.v2, 22) + pad(shortLeg || '', 28) + r.mismatch
    );
    if (r.fileStatus !== 'ok') {
      console.log(`  >>> ${r.fileStatus}: ${r.detail}`);
    } else {
      if (r.detail) console.log(`  >>> ${r.detail}`);
      if (r.infoGap && r.infoGap !== '—') console.log(`  ... contract↔export (not V2): ${r.infoGap}`);
    }
  }

  const missing = rows.filter((r) => r.fileStatus === 'missing' || r.fileStatus === 'unreadable');
  if (missing.length) {
    console.log(`\n--- Summary: ${missing.length} file(s) missing or unreadable (fix paths under ${GOLDEN_DIR})`);
  } else {
    console.log(`\n--- Summary: all manifest files present and JSON-parseable.`);
  }
  console.log('--- V2 contract comparison: deferred until SquatMotionEvidenceEngineV2 is implemented.');
  return 0;
}

async function runStrict() {
  console.log('Golden trace harness — STRICT mode (required files + V2 match when implemented)\n');
  const manifest = loadManifest();
  const list = Array.isArray(manifest.fixtures) ? manifest.fixtures : [];
  let fileErrors = 0;
  let v2Mismatches = 0;

  for (const entry of list) {
    const { id, file, expected, required } = entry;
    if (!id || !file || (expected !== 'pass' && expected !== 'fail')) {
      console.error('Invalid manifest entry:', entry);
      process.exit(1);
    }
    if (required === false) continue;

    const read = readFixtureJson(file);
    if (read.status === 'missing' || read.status === 'unreadable') {
      console.error(`[FAIL] required fixture unreadable: ${id} -> ${read.path}`);
      if (read.error) console.error(`       ${read.error}`);
      fileErrors++;
      continue;
    }
  }

  if (fileErrors > 0) {
    console.error(`\nSTRICT: ${fileErrors} required fixture file error(s).`);
    process.exit(1);
  }

  for (const entry of list) {
    if (entry.required === false) continue;
    const read = readFixtureJson(entry.file);
    if (read.status !== 'ok' || !read.data) continue;

    const v2 = await evaluateSquatMotionEvidenceV2(read.data);
    if (!v2.implemented) {
      continue;
    }
    const wantPass = entry.expected === 'pass';
    const gotPass = v2.pass === true;
    if (wantPass !== gotPass) {
      console.error(
        `[FAIL] ${entry.id}: expected ${entry.expected}, V2 got ${gotPass ? 'pass' : 'fail'}`
      );
      v2Mismatches++;
    }
  }

  if (v2Mismatches > 0) {
    console.error(`\nSTRICT: ${v2Mismatches} V2 contract mismatch(es).`);
    process.exit(1);
  }

  const anyEval = await (async () => {
    for (const entry of list) {
      if (entry.required === false) continue;
      const read = readFixtureJson(entry.file);
      if (read.status === 'ok' && read.data) {
        const v2 = await evaluateSquatMotionEvidenceV2(read.data);
        if (v2.implemented) return true;
      }
    }
    return false;
  })();

  if (!anyEval) {
    console.log(
      'STRICT: all required golden JSON files are present and valid.\n' +
        'V2 evaluation is still stub (implemented:false) — no pass/fail comparison yet. Wire evaluateSquatMotionEvidenceV2 in a later PR.\n' +
        'Exit 0 (structure gate only).'
    );
  } else {
    console.log('STRICT: all required contracts satisfied.');
  }
  return 0;
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`Usage:
  npx tsx scripts/camera-squat-v2-00-golden-trace-harness.mjs --report
  npx tsx scripts/camera-squat-v2-00-golden-trace-harness.mjs --strict
`);
    process.exit(0);
  }
  const isStrict = args.includes('--strict');
  const isReport = args.includes('--report') || !isStrict;
  if (isReport && isStrict) {
    console.error('Use only one of --report or --strict');
    process.exit(2);
  }
  (async () => {
    if (isStrict) {
      const code = await runStrict();
      process.exit(code);
    } else {
      const code = await runReport();
      process.exit(code);
    }
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

main();
