/**
 * PR6-FIX-01 — Active Attempt Epoch Window diagnostic report.
 *
 * Runs evaluateSquatMotionEvidenceV2 on all observation fixtures and golden fixtures,
 * then outputs a tabular report of epoch-related diagnostic fields.
 *
 * Run: npx tsx scripts/camera-squat-v2-04-active-epoch-report.mjs
 *
 * Output columns:
 *   fixture, v2EpochSource, usedRollingFallback, activeAttemptEpochStartMs,
 *   inputWindowDurationMs, inputFrameCount, usableMotionEvidence, motionPattern,
 *   blockReason, romBand, relativePeak, descentStartFrameIndex, peakFrameIndex,
 *   peakDistanceFromTailFrames, framesAfterPeak, reversalFrameIndex,
 *   nearStartReturnFrameIndex, stableAfterReturnFrameIndex, cycleDurationCandidateMs,
 *   cycleCapExceeded, diagnosis
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, basename } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');
const OBS_DIR = join(ROOT, 'fixtures', 'camera', 'squat', 'observations');
const GOLDEN_DIR = join(ROOT, 'fixtures', 'camera', 'squat', 'golden');

// Import V2 engine
const { evaluateSquatMotionEvidenceV2 } = await import('../src/lib/camera/squat/squat-motion-evidence-v2.ts');

/** @param {unknown} v */
function n(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function fmt(v) {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return String(Math.round(v * 10) / 10);
  return String(v);
}

function pad(str, len) {
  const s = fmt(str);
  return s.length >= len ? s.slice(0, len) : s + ' '.repeat(len - s.length);
}

/**
 * Extract v2Frames from a fixture JSON.
 * Supports:
 *   1. data.v2Frames directly (observation fixtures)
 *   2. data.attempts[0].diagnosisSummary.squatCycle milestones (real-device pass)
 *   3. data.squatAttemptObservations series (golden observation series)
 */
function extractFrames(data) {
  if (Array.isArray(data.v2Frames)) return data.v2Frames;

  const sc = data.attempts?.[0]?.diagnosisSummary?.squatCycle;
  if (sc && n(sc.reversalAtMs) && n(sc.standingRecoveredAtMs)) {
    const peak = n(sc.rawDepthPeak) || n(sc.relativeDepthPeak) || 0.5;
    const t0 = n(sc.descendStartAtMs) || 0;
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
    const frames = [];
    for (let t = keyPts[0].t; t <= keyPts[keyPts.length - 1].t; t += 33) {
      let j = 0;
      while (j + 1 < keyPts.length && keyPts[j + 1].t < t) j += 1;
      const a = keyPts[Math.min(j + 1, keyPts.length - 1)];
      const b = keyPts[j];
      const d = b.d + (a.d - b.d) * ((t - b.t) / Math.max(1e-3, a.t - b.t));
      frames.push({ timestampMs: t, lowerBodySignal: d, bodyVisibleEnough: true, lowerBodyVisibleEnough: true, setupPhase: false });
    }
    return frames;
  }

  const obs = Array.isArray(data.squatAttemptObservations) ? data.squatAttemptObservations : [];
  if (obs.length < 1) return [];
  const lastObs = obs[obs.length - 1];
  const addRecoveryTail = lastObs?.currentDepth === 1;
  const rawPts = obs.map((o) => {
    const completion = o?.squatCameraObservability?.completion;
    const d = Math.max(
      n(o?.relativeDepthPeak) ?? 0,
      n(completion?.relativeDepthPeak) ?? 0,
      o?.currentDepth === 1 ? 0.99 : (n(o?.currentDepth) ?? 0)
    );
    return {
      t: Date.parse(o?.ts ?? '') || 0,
      d,
      setup: /setup|readiness|align/i.test(String(o?.phaseHint ?? '')),
    };
  });
  const t0 = rawPts[0]?.t ?? 0;
  const pts = rawPts.map((pt) => ({ ...pt, t: pt.t - t0 }));
  if (addRecoveryTail) {
    const last = pts[pts.length - 1];
    pts.push({ t: last.t + 200, d: 0.15, setup: false });
    pts.push({ t: last.t + 500, d: 0.02, setup: false });
    pts.push({ t: last.t + 700, d: 0.01, setup: false });
    pts.push({ t: last.t + 900, d: 0.01, setup: false });
  }
  const frames = [];
  const tMin = pts[0]?.t ?? 0;
  const tMax = pts[pts.length - 1]?.t ?? 0;
  for (let t = tMin; t <= tMax; t += 100) {
    let j = 0;
    while (j + 1 < pts.length && pts[j + 1].t < t) j += 1;
    const a = pts[Math.min(j + 1, pts.length - 1)];
    const b = pts[j];
    if (!b || !a) continue;
    const d = b.d + (a.d - b.d) * ((t - b.t) / Math.max(1e-3, a.t - b.t));
    frames.push({
      timestampMs: t,
      lowerBodySignal: Math.max(0, d),
      bodyVisibleEnough: true,
      lowerBodyVisibleEnough: true,
      setupPhase: b.setup || a.setup,
    });
  }
  return frames;
}

function diagnosisLabel(dec) {
  if (dec.usableMotionEvidence) return 'PASS';
  const r = dec.blockReason ?? dec.motionPattern ?? 'unknown';
  const m = dec.metrics;
  const ptf = m?.peakDistanceFromTailFrames ?? m?.framesAfterPeak;
  if (typeof ptf === 'number' && ptf <= 2) return `FAIL:${r}[peak@tail]`;
  if (m?.descentStartFrameIndex === 0 && !dec.evidence?.preDescentBaselineSatisfied) return `FAIL:${r}[no_baseline]`;
  return `FAIL:${r}`;
}

function runFixture(fixturePath, label) {
  const raw = JSON.parse(readFileSync(fixturePath, 'utf8'));
  const frames = extractFrames(raw);
  if (frames.length < 2) return null;

  const dec = evaluateSquatMotionEvidenceV2(frames);
  const m = dec.metrics ?? {};

  const peakIdx = m.peakFrameIndex ?? null;
  const totalFrames = m.inputFrameCount ?? frames.length;
  const lastIdx = totalFrames - 1;
  const ptf = peakIdx != null ? lastIdx - peakIdx : null;

  // Compute peakDistanceFromTailMs if not already in metrics
  const peakFrameTs = peakIdx != null ? (frames[peakIdx]?.timestampMs ?? null) : null;
  const lastFrameTs = frames[frames.length - 1]?.timestampMs ?? null;
  const ptms = peakFrameTs != null && lastFrameTs != null ? lastFrameTs - peakFrameTs : null;

  // cycleDurationCandidateMs: descentStart to lastFrame
  const dsIdx = m.descentStartFrameIndex ?? null;
  const dsTs = dsIdx != null ? (frames[dsIdx]?.timestampMs ?? null) : null;
  const cycleCand = dsTs != null && lastFrameTs != null ? lastFrameTs - dsTs : null;
  const capExceeded = (m.returnMs != null && m.returnMs > 4500) || (cycleCand != null && cycleCand > 4500);

  return {
    fixture: label,
    v2EpochSource: m.v2EpochSource ?? 'unknown',
    usedRollingFallback: m.usedRollingFallback ?? true,
    activeAttemptEpochStartMs: m.activeAttemptEpochStartMs ?? null,
    inputWindowDurationMs: m.inputWindowDurationMs ?? null,
    inputFrameCount: m.inputFrameCount ?? null,
    usableMotionEvidence: dec.usableMotionEvidence,
    motionPattern: dec.motionPattern,
    blockReason: dec.blockReason,
    romBand: dec.romBand,
    relativePeak: m.relativePeak != null ? Math.round(m.relativePeak * 1000) / 1000 : null,
    descentStartFrameIndex: m.descentStartFrameIndex ?? null,
    peakFrameIndex: m.peakFrameIndex ?? null,
    peakDistanceFromTailFrames: ptf,
    framesAfterPeak: ptf,
    reversalFrameIndex: m.reversalFrameIndex ?? null,
    nearStartReturnFrameIndex: m.nearStartReturnFrameIndex ?? null,
    stableAfterReturnFrameIndex: m.stableAfterReturnFrameIndex ?? null,
    cycleDurationCandidateMs: cycleCand,
    cycleCapExceeded: capExceeded,
    diagnosis: diagnosisLabel(dec),
    _meta: raw._meta ?? null,
  };
}

// Collect fixtures
const rows = [];

// Observation fixtures first
if (existsSync(OBS_DIR)) {
  const obsFiles = readdirSync(OBS_DIR).filter((f) => f.endsWith('.json')).sort();
  for (const f of obsFiles) {
    const result = runFixture(join(OBS_DIR, f), `obs/${f.replace('.json', '')}`);
    if (result) rows.push(result);
  }
}

// Golden fixtures
if (existsSync(GOLDEN_DIR)) {
  const goldenFiles = readdirSync(GOLDEN_DIR).filter((f) => f.endsWith('.json') && f !== 'manifest.json').sort();
  for (const f of goldenFiles) {
    const result = runFixture(join(GOLDEN_DIR, f), `golden/${f.replace('.json', '')}`);
    if (result) rows.push(result);
  }
}

if (rows.length === 0) {
  console.error('No fixtures found.');
  process.exit(1);
}

// Print tabular report
const COL_WIDTHS = {
  fixture: 55,
  v2EpochSource: 42,
  usedRollingFallback: 19,
  activeAttemptEpochStartMs: 26,
  inputWindowDurationMs: 22,
  inputFrameCount: 16,
  usableMotionEvidence: 20,
  motionPattern: 18,
  blockReason: 28,
  romBand: 10,
  relativePeak: 13,
  descentStartFrameIndex: 23,
  peakFrameIndex: 15,
  peakDistanceFromTailFrames: 27,
  framesAfterPeak: 15,
  reversalFrameIndex: 19,
  nearStartReturnFrameIndex: 25,
  stableAfterReturnFrameIndex: 27,
  cycleDurationCandidateMs: 24,
  cycleCapExceeded: 17,
  diagnosis: 30,
};

const COLS = Object.keys(COL_WIDTHS);

console.log('\nPR6-FIX-01 — Active Attempt Epoch Window Diagnostic Report');
console.log('='.repeat(120));
console.log();

// Header
console.log(COLS.map((c) => pad(c, COL_WIDTHS[c])).join(' | '));
console.log(COLS.map((c) => '-'.repeat(COL_WIDTHS[c])).join('-+-'));

// Data rows
for (const row of rows) {
  const line = COLS.map((c) => pad(row[c], COL_WIDTHS[c])).join(' | ');
  console.log(line);
}

console.log();
console.log(`Total fixtures: ${rows.length}`);
const passed = rows.filter((r) => r.usableMotionEvidence).length;
const rolling = rows.filter((r) => r.usedRollingFallback).length;
const activeEpoch = rows.filter((r) => !r.usedRollingFallback).length;
console.log(`  usableMotionEvidence=true: ${passed}  false: ${rows.length - passed}`);
console.log(`  v2EpochSource=rolling_window_fallback: ${rolling}  active_epoch*: ${activeEpoch}`);
console.log();

// Warn about fixtures where peak is at tail (the classic failure mode)
const peakAtTailWarnings = rows.filter((r) => typeof r.peakDistanceFromTailFrames === 'number' && r.peakDistanceFromTailFrames <= 2 && !r.usableMotionEvidence);
if (peakAtTailWarnings.length > 0) {
  console.log(`⚠  ${peakAtTailWarnings.length} fixture(s) still show peak@tail failure (no reversal room):`);
  for (const w of peakAtTailWarnings) {
    console.log(`   → ${w.fixture}: peakDistanceFromTailFrames=${w.peakDistanceFromTailFrames}, blockReason=${w.blockReason}`);
  }
  console.log();
}

// Summary diagnostics
const baselineFailures = rows.filter((r) => !r.usableMotionEvidence && r.descentStartFrameIndex === 0 && !rows.find((x) => x.fixture === r.fixture)?.evidence?.preDescentBaselineSatisfied);
if (baselineFailures.length > 0) {
  console.log(`⚠  ${baselineFailures.length} fixture(s) show descentStartFrameIndex=0 failures (rolling window, no pre-descent baseline):`);
  for (const b of baselineFailures) {
    console.log(`   → ${b.fixture}: motionPattern=${b.motionPattern}`);
  }
  console.log();
}
