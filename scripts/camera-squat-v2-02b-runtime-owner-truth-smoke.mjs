/**
 * PR5-FIX - Runtime owner truth + shallow closure smoke.
 *
 * This script keeps the runtime-owner law explicit without importing camera
 * page code or legacy squat completion code:
 *   V2 usableMotionEvidence === autoProgression.progressionAllowed.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const GOLDEN_DIR = join(__dirname, '..', 'fixtures', 'camera', 'squat', 'golden');
const MANIFEST_PATH = join(GOLDEN_DIR, 'manifest.json');

/** @param {unknown} value */
function n(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/** @param {unknown} value */
function asRecord(value) {
  return value != null && typeof value === 'object' ? value : {};
}

/** @param {Record<string, unknown>} data */
function buildFrames(data) {
  if (Array.isArray(data.v2Frames)) return data.v2Frames;

  const attempts = Array.isArray(data.attempts) ? data.attempts : [];
  const firstAttempt = asRecord(attempts[0]);
  const diagnosisSummary = asRecord(firstAttempt.diagnosisSummary);
  const sc = asRecord(diagnosisSummary.squatCycle);

  if (n(sc.reversalAtMs) && n(sc.standingRecoveredAtMs)) {
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
    const frames = [];
    for (let t = keyPts[0].t; t <= keyPts[keyPts.length - 1].t; t += 33) {
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

  const obs = Array.isArray(data.squatAttemptObservations) ? data.squatAttemptObservations : [];
  if (obs.length < 1) return [];
  const lastObs = asRecord(obs[obs.length - 1]);
  const addRecoveryTail = lastObs.currentDepth === 1;
  const rawPts = obs.map((item) => {
    const o = asRecord(item);
    const observability = asRecord(o.squatCameraObservability);
    const completion = asRecord(observability.completion);
    const d = Math.max(
      n(o.relativeDepthPeak),
      n(completion.relativeDepthPeak),
      o.currentDepth === 1 ? 0.99 : n(o.currentDepth)
    );
    return {
      t: Date.parse(String(o.ts || '')) || 0,
      d,
      setup: /setup|readiness|align/i.test(String(o.phaseHint || '')),
    };
  });
  const t0 = rawPts[0].t;
  const t1 = addRecoveryTail ? rawPts[rawPts.length - 1].t + 400 : rawPts[rawPts.length - 1].t;
  const endPt = rawPts[rawPts.length - 1];
  const frames = [];
  for (let t = t0; t <= t1; t += 33.33) {
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

/** @param {unknown[]} obs */
function lastObservationBlockedReason(obs) {
  for (let i = obs.length - 1; i >= 0; i -= 1) {
    const o = asRecord(obs[i]);
    const observability = asRecord(o.squatCameraObservability);
    const passCoreTruth = asRecord(observability.pass_core_truth);
    const squatPassCore = asRecord(passCoreTruth.squatPassCore);
    const reason =
      o.completionBlockedReason ??
      o.officialShallowPathBlockedReason ??
      o.standardPathBlockedReason ??
      squatPassCore.passBlockedReason;
    if (reason != null) return String(reason);
  }
  return null;
}

/** @param {Record<string, unknown>} data */
function legacyBlockedReason(data) {
  if ('legacyBlockedReason' in data) {
    return data.legacyBlockedReason == null ? null : String(data.legacyBlockedReason);
  }
  const attempts = Array.isArray(data.attempts) ? data.attempts : [];
  for (let i = attempts.length - 1; i >= 0; i -= 1) {
    const attempt = asRecord(attempts[i]);
    const diagnosisSummary = asRecord(attempt.diagnosisSummary);
    const squatCycle = asRecord(diagnosisSummary.squatCycle);
    const reason =
      squatCycle.completionBlockedReason ??
      squatCycle.passCoreBlockedReason ??
      squatCycle.finalPassBlockedReason;
    if (reason != null) return String(reason);
  }
  const obs = Array.isArray(data.squatAttemptObservations) ? data.squatAttemptObservations : [];
  return lastObservationBlockedReason(obs);
}

/** @param {import('../src/lib/camera/squat/squat-motion-evidence-v2.types').SquatMotionEvidenceDecisionV2} decision */
function buildAutoProgressionDecision(decision) {
  return {
    owner: 'squat_motion_evidence_v2',
    consumedField: 'usableMotionEvidence',
    progressionAllowed: decision.usableMotionEvidence === true,
    blockedReason: decision.blockReason,
  };
}

function loadManifest() {
  if (!existsSync(MANIFEST_PATH)) throw new Error(`manifest not found: ${MANIFEST_PATH}`);
  return JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
}

function readFixture(file) {
  const full = join(GOLDEN_DIR, file);
  if (!existsSync(full)) throw new Error(`fixture not found: ${full}`);
  return JSON.parse(readFileSync(full, 'utf8'));
}

function pad(value, width) {
  const s = String(value ?? 'null');
  return (s + ' '.repeat(width)).slice(0, width);
}

async function main() {
  const engineUrl = pathToFileURL(
    join(__dirname, '..', 'src', 'lib', 'camera', 'squat', 'squat-motion-evidence-v2.ts')
  ).href;
  const { evaluateSquatMotionEvidenceV2 } = await import(engineUrl);
  const manifest = loadManifest();
  const list = Array.isArray(manifest.fixtures) ? manifest.fixtures : [];

  const rows = [];
  let failures = 0;
  for (const entry of list) {
    const id = String(entry.id || '');
    const expected = entry.expected === 'pass' ? 'pass' : 'fail';
    const data = readFixture(String(entry.file || ''));
    const frames = buildFrames(asRecord(data));
    const decision = evaluateSquatMotionEvidenceV2(frames);
    const autoProgression = buildAutoProgressionDecision(decision);
    const v2 = decision.usableMotionEvidence ? 'pass' : 'fail';
    const expectedOk = v2 === expected;
    const ownerOk =
      autoProgression.owner === 'squat_motion_evidence_v2' &&
      autoProgression.consumedField === 'usableMotionEvidence' &&
      autoProgression.progressionAllowed === decision.usableMotionEvidence;
    const requiredFailOk =
      (id === 'standing_must_fail_01' || id === 'seated_must_fail_01')
        ? autoProgression.progressionAllowed === false
        : true;
    const status = expectedOk && ownerOk && requiredFailOk ? 'PASS' : 'FAIL';
    if (status !== 'PASS') failures += 1;
    rows.push({
      fixture: id,
      expected,
      v2Usable: String(decision.usableMotionEvidence),
      v2Pattern: decision.motionPattern,
      v2Block: decision.blockReason,
      autoOwner: autoProgression.owner,
      autoAllowed: String(autoProgression.progressionAllowed),
      legacyBlocked: legacyBlockedReason(asRecord(data)),
      status,
    });
  }

  console.log('PR5-FIX runtime owner truth smoke\n');
  console.log(
    `${pad('fixture', 40)} ${pad('expected', 8)} ${pad('v2.usable', 10)} ${pad(
      'v2.pattern',
      18
    )} ${pad('v2.block', 24)} ${pad('auto.owner', 25)} ${pad('auto.allowed', 12)} ${pad(
      'legacyBlockedReason',
      26
    )} status`
  );
  console.log('-'.repeat(190));
  for (const row of rows) {
    console.log(
      `${pad(row.fixture, 40)} ${pad(row.expected, 8)} ${pad(row.v2Usable, 10)} ${pad(
        row.v2Pattern,
        18
      )} ${pad(row.v2Block, 24)} ${pad(row.autoOwner, 25)} ${pad(
        row.autoAllowed,
        12
      )} ${pad(row.legacyBlocked, 26)} ${row.status}`
    );
  }

  if (failures > 0) {
    console.error(`\n${failures} PR5-FIX runtime owner truth check(s) failed.`);
    process.exit(1);
  }
  console.log('\nAll PR5-FIX runtime owner truth checks passed.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
