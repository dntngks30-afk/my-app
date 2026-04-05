/**
 * PR-OH-READINESS-BLOCKER-ALIGN-02B: overhead readiness primary blocker must use
 * guardrail evaluation-window-aligned framing hint, not recent buffer tail.
 *
 * Run: npx tsx scripts/camera-oh-readiness-blocker-align-02b-smoke.mjs
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const {
  resolveOverheadReadinessFramingHint,
  getSetupFramingHint,
} = await import('../src/lib/camera/setup-framing.ts');
const { getLiveReadinessSummary, getPrimaryReadinessBlocker } = await import(
  '../src/lib/camera/live-readiness.ts'
);

let passed = 0;
let failed = 0;

function ok(name, cond) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}`);
  }
}

function mockLandmark(x, y, visibility = 0.9) {
  return { x, y, visibility };
}

/**
 * Moderate full-body bbox: area between AREA_TOO_SMALL and AREA_TOO_LARGE,
 * visibility high (matches “legitimate attempt” in device reports).
 */
function goodFramingOverheadPose(timestamp, armAngle = 120) {
  const lm = Array(33)
    .fill(null)
    .map((_, j) =>
      mockLandmark(0.28 + (j % 11) * 0.035, 0.14 + Math.floor(j / 11) * 0.11, 0.9)
    );
  lm[11] = mockLandmark(0.38, 0.22, 0.9);
  lm[12] = mockLandmark(0.62, 0.22, 0.9);
  lm[13] = mockLandmark(0.32, 0.22 + 0.12 * Math.sin((armAngle * Math.PI) / 180), 0.9);
  lm[14] = mockLandmark(0.68, 0.22 + 0.12 * Math.sin((armAngle * Math.PI) / 180), 0.9);
  lm[15] = mockLandmark(0.26, 0.12, 0.9);
  lm[16] = mockLandmark(0.74, 0.12, 0.9);
  return { landmarks: lm, timestamp };
}

/** Wide landmark spread → bodyBox area > AREA_TOO_LARGE (too close). */
function fullBleedPose(timestamp) {
  const lm = Array(33)
    .fill(null)
    .map((_, j) =>
      mockLandmark(0.02 + (j % 11) * 0.096, 0.02 + Math.floor(j / 11) * 0.48, 0.9)
    );
  return { landmarks: lm, timestamp };
}

const MOCK_GUARDRAIL = {
  captureQuality: 'good',
  flags: [],
  debug: {
    validFrameCount: 20,
    visibleJointsRatio: 0.82,
    criticalJointsAvailability: 1,
    ankleYMean: 0.6,
  },
};

console.log('PR-OH-READINESS-BLOCKER-ALIGN-02B smoke\n');

// --- 1) Tail contamination: good attempt window, late full-bleed tail ---
const W0 = 1000;
const W1 = 2000;
const goodInWindow = Array.from({ length: 20 }, (_, i) => {
  const t = W0 + i * 45;
  return goodFramingOverheadPose(t, 130);
});
const tailStart = 9000;
const badTail = Array.from({ length: 12 }, (_, i) => fullBleedPose(tailStart + i * 50));
const combined = goodInWindow.map((p) => ({ landmarks: p.landmarks, timestamp: p.timestamp }));
for (const p of badTail) {
  combined.push({ landmarks: p.landmarks, timestamp: p.timestamp });
}

const tailHint = getSetupFramingHint(combined);
const aligned = resolveOverheadReadinessFramingHint({
  landmarks: combined,
  windowStartMs: W0,
  windowEndMs: W1,
});

ok(
  '1a tail-based setup hint sees full-bleed tail (too close)',
  tailHint === '조금 뒤로 가 주세요'
);
ok('1b aligned uses evaluation window only', aligned.source === 'evaluation_window');
ok(
  '1c aligned hint not overwritten by tail (null or non–too-close)',
  aligned.framingHint !== '조금 뒤로 가 주세요'
);

const summaryTail = getLiveReadinessSummary({
  success: false,
  guardrail: MOCK_GUARDRAIL,
  framingHint: tailHint,
});
const summaryAligned = getLiveReadinessSummary({
  success: false,
  guardrail: MOCK_GUARDRAIL,
  framingHint: aligned.framingHint,
});
ok(
  '1d primary blocker with tail hint is framing message',
  getPrimaryReadinessBlocker(summaryTail) === '조금 뒤로 가 주세요'
);
ok(
  '1e primary blocker with aligned hint is not tail-only framing',
  getPrimaryReadinessBlocker(summaryAligned) !== '조금 뒤로 가 주세요'
);
ok('1f aligned + strong readiness → ready (no idle framing blocker)', summaryAligned.state === 'ready');

// --- 2) True framing invalid inside window ---
const badOnly = Array.from({ length: 20 }, (_, i) => fullBleedPose(W0 + i * 45));
const badLandmarks = badOnly.map((p) => ({ landmarks: p.landmarks, timestamp: p.timestamp }));
const alignedBad = resolveOverheadReadinessFramingHint({
  landmarks: badLandmarks,
  windowStartMs: W0,
  windowEndMs: W0 + 19 * 45,
});
ok('2a invalid framing throughout window still reported', alignedBad.framingHint === '조금 뒤로 가 주세요');
ok('2b source is evaluation_window', alignedBad.source === 'evaluation_window');

// --- 3) Threshold literals unchanged (readiness honesty) ---
const lrPath = join(process.cwd(), 'src/lib/camera/live-readiness.ts');
const lrSrc = readFileSync(lrPath, 'utf8');
ok('3a MIN_READY_VALID_FRAMES still 8', lrSrc.includes('const MIN_READY_VALID_FRAMES = 8'));
ok('3b MIN_READY_VISIBLE_JOINTS_RATIO still 0.70', lrSrc.includes('const MIN_READY_VISIBLE_JOINTS_RATIO = 0.70'));
ok(
  '3c MIN_READY_CRITICAL_AVAILABILITY still 0.65',
  lrSrc.includes('const MIN_READY_CRITICAL_AVAILABILITY = 0.65')
);

console.log(`\nDone: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
