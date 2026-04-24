/**
 * PR4 - Shadow compare: legacy hints vs SquatMotionEvidenceEngineV2 on golden fixtures.
 * Does not import app runtime, auto-progression, or camera page code.
 * @see docs/pr/PR-SQUAT-V2-01B-SHADOW-COMPARE.md
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const GOLDEN_DIR = join(__dirname, '..', 'fixtures', 'camera', 'squat', 'golden');
const MANIFEST_PATH = join(GOLDEN_DIR, 'manifest.json');

/** @param {unknown} v */
function n(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

/**
 * V2 input frames: no camera wiring; see PR doc.
 * 1) attempts[0].diagnosisSummary.squatCycle time milestones (real-device deep export)
 * 2) else observation series + optional recovery tail when last obs currentDepth === 1 (end-of-peak token in export)
 */
function buildFramesForShadowCompare(data) {
  if (Array.isArray(data.v2Frames)) return data.v2Frames;

  const sc = data.attempts?.[0]?.diagnosisSummary?.squatCycle;
  if (sc && n(sc.reversalAtMs) && n(sc.standingRecoveredAtMs)) {
    const peak = n(sc.rawDepthPeak) || n(sc.relativeDepthPeak) || 0.5;
    const t0 = n(sc.descendStartAtMs);
    const tRev = n(sc.reversalAtMs);
    const tRec = n(sc.recoveryAtMs) || tRev + 300;
    const tStand = n(sc.standingRecoveredAtMs) || tRec + 200;
    const keyPts = [
      { t: t0, d: 0.01 },
      { t: t0 + (tRev - t0) * 0.4, d: peak * 0.5 },
      { t: tRev, d: peak },
      { t: tRec, d: 0.15 },
      { t: tStand, d: 0.02 },
      { t: tStand + 200, d: 0.02 },
    ];
    const tMin = keyPts[0].t;
    const tMax = keyPts[keyPts.length - 1].t;
    const step = 33;
    const frames = [];
    for (let t = tMin; t <= tMax; t += step) {
      let j = 0;
      while (j + 1 < keyPts.length && keyPts[j + 1].t < t) j += 1;
      const a = keyPts[Math.min(j + 1, keyPts.length - 1)];
      const b = keyPts[j];
      const d = b.d + (a.d - b.d) * ((t - b.t) / Math.max(1e-3, a.t - b.t));
      frames.push({
        timestampMs: t,
        lowerBodySignal: d,
        bodyVisibleEnough: true,
        lowerBodyVisibleEnough: true,
        setupPhase: false,
      });
    }
    return frames;
  }

  const obs = data.squatAttemptObservations || [];
  if (obs.length < 1) {
    return [];
  }
  const lastObs = obs[obs.length - 1];
  const addRecoveryTail = lastObs.currentDepth === 1;
  const rawPts = obs.map((o) => {
    const d = Math.max(
      n(o.relativeDepthPeak),
      n(o.squatCameraObservability?.completion?.relativeDepthPeak),
      o.currentDepth === 1 ? 0.99 : n(o.currentDepth)
    );
    return { t: Date.parse(o.ts) || 0, d, setup: /setup|readiness|align/i.test(String(o.phaseHint || '')) };
  });
  const t0 = rawPts[0].t;
  const t1 = addRecoveryTail ? rawPts[rawPts.length - 1].t + 400 : rawPts[rawPts.length - 1].t;
  const endPt = rawPts[rawPts.length - 1];
  const step = 33.33;
  const frames = [];
  for (let t = t0; t <= t1; t += step) {
    let j = 0;
    while (j + 1 < rawPts.length && rawPts[j + 1].t < t) j += 1;
    const a = rawPts[Math.min(j + 1, rawPts.length - 1)];
    const b = rawPts[j];
    const depthValue =
      t > endPt.t && addRecoveryTail
        ? 0.04 + 0.02 * Math.max(0, (a.d - 0.04) * (1 - (t - endPt.t) / 500))
        : a.t === b.t
          ? a.d
          : b.d + (a.d - b.d) * ((t - b.t) / Math.max(1e-3, a.t - b.t));
    frames.push({
      timestampMs: t,
      lowerBodySignal: Math.min(0.99, Math.max(0, depthValue)),
      bodyVisibleEnough: true,
      lowerBodyVisibleEnough: true,
      setupPhase: b.setup && t < t0 + 2000,
    });
  }
  return frames;
}

/**
 * Legacy: reference only (not V2, not a gate). Uses attempts + last pass_core.
 * @param {Record<string, unknown>} data
 */
function legacyLabel(data) {
  const attempts = data.attempts;
  if (Array.isArray(attempts) && attempts.length) {
    const anyPass = attempts.some(
      (a) => a && (a.progressionPassed === true || a.finalPassLatched === true)
    );
    return anyPass ? 'pass' : 'fail';
  }
  const obs = data.squatAttemptObservations;
  if (Array.isArray(obs) && obs.length) {
    const last = obs[obs.length - 1];
    const pc = last?.squatCameraObservability?.pass_core_truth?.squatPassCore;
    if (pc && pc.peakAtMs != null && pc.reversalAtMs == null && pc.standingRecoveredAtMs == null) {
      return 'late/fail';
    }
  }
  return 'unknown';
}

function loadManifest() {
  if (!existsSync(MANIFEST_PATH)) {
    throw new Error(`manifest not found: ${MANIFEST_PATH}`);
  }
  return JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
}

function readFixture(name) {
  const full = join(GOLDEN_DIR, name);
  if (!existsSync(full)) {
    return { status: 'missing', data: null, error: `missing: ${full}` };
  }
  try {
    return { status: 'ok', data: JSON.parse(readFileSync(full, 'utf8')), error: null };
  } catch (e) {
    return { status: 'error', data: null, error: e instanceof Error ? e.message : String(e) };
  }
}

function pad(s, w) {
  return (String(s) + ' '.repeat(w)).slice(0, w);
}

async function main() {
  const args = process.argv.slice(2);
  const strict = args.includes('--strict');
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`Usage:
  npx tsx scripts/camera-squat-v2-01b-shadow-compare.mjs --report
  npx tsx scripts/camera-squat-v2-01b-shadow-compare.mjs --strict
`);
    process.exit(0);
  }
  const other = args.filter((a) => a !== '--strict' && a !== '--report');
  if (other.length > 0) {
    console.error('Unknown args. Use --report and/or --strict only.');
    process.exit(2);
  }

  const manifest = loadManifest();
  const list = Array.isArray(manifest.fixtures) ? manifest.fixtures : [];
  if (list.length === 0) {
    console.error('No fixtures in manifest');
    process.exit(1);
  }

  const engineUrl = pathToFileURL(join(__dirname, '..', 'src', 'lib', 'camera', 'squat', 'squat-motion-evidence-v2.ts')).href;
  const mod = await import(engineUrl);
  const { evaluateSquatMotionEvidenceV2 } = mod;

  const rows = [];
  let v2Mismatches = 0;
  let loadErrors = 0;
  for (const entry of list) {
    const id = entry.id;
    const file = entry.file;
    const expected = entry.expected;
    if (!id || !file || (expected !== 'pass' && expected !== 'fail')) {
      console.error('Invalid manifest entry', entry);
      process.exit(1);
    }
    const loaded = readFixture(file);
    if (loaded.status !== 'ok' || !loaded.data) {
      console.error(loaded.error || 'load failed', id);
      loadErrors += 1;
      rows.push({ id, expected, legacy: '—', v2: '—', status: 'FAIL (file)' });
      continue;
    }
    const data = /** @type {Record<string, unknown>} */ (loaded.data);
    const legacy = legacyLabel(data);
    const frames = buildFramesForShadowCompare(data);
    if (frames.length < 4) {
      console.error(`[${id}] Not enough frames for V2 (need >= 4).`);
      v2Mismatches += 1;
      rows.push({ id, expected, legacy, v2: 'error', status: 'FAIL' });
      continue;
    }
    const dec = evaluateSquatMotionEvidenceV2(frames);
    const v2pass = dec.usableMotionEvidence === true;
    const v2s = v2pass ? 'pass' : 'fail';
    const wantPass = expected === 'pass';
    const okV2 = wantPass === v2pass;
    if (!okV2) v2Mismatches += 1;
    const status = okV2 ? 'PASS' : 'FAIL (V2 vs expected)';
    rows.push({ id, expected, legacy, v2: v2s, status });
  }

  const wId = 32;
  const wExp = 10;
  const wLeg = 12;
  const wV2 = 8;
  console.log('Shadow compare (V2 = SquatMotionEvidenceEngineV2 on fixture-derived frames; legacy = ref)\n');
  console.log(
    pad('fixture', wId) + pad('expected', wExp) + pad('legacy', wLeg) + pad('v2', wV2) + 'status'
  );
  for (const r of rows) {
    console.log(pad(r.id, wId) + pad(r.expected, wExp) + pad(r.legacy, wLeg) + pad(r.v2, wV2) + r.status);
  }
  if (rows.some((r) => r.legacy === '—')) {
    console.log('\nNote: one or more fixtures failed to load (see errors above).');
  }

  if (strict) {
    if (loadErrors > 0) {
      console.error(`\n--strict: ${loadErrors} fixture file error(s).`);
      process.exit(1);
    }
    if (v2Mismatches > 0) {
      console.error(`\n--strict: ${v2Mismatches} row(s) failed (V2 result vs manifest expected).`);
      process.exit(1);
    }
    console.log('\n--strict: all V2 results match expected.');
    process.exit(0);
  }
  console.log('\n--report: non-gating; use --strict for exit code gate.');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
