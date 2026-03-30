/**
 * PR-CAM-RETRO-ARMING-ASSIST-01 — retro-arm: 짧은 standing + 강한 motion 슬라이스 복구
 *
 * npx tsx scripts/camera-pr-retro-arming-assist-01-smoke.mjs
 *
 * 회귀(문서에만 안내, 본 스크립트에서 재실행하지 않음):
 * - npx tsx scripts/camera-pr-hmm-04a-squat-arming-assist-smoke.mjs
 * - npx tsx scripts/camera-cam28-shallow-completion-slice-smoke.mjs
 * - npx tsx scripts/camera-pr-arming-baseline-handoff-01-smoke.mjs
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const {
  computeSquatCompletionArming,
  tryRetroArmingFromMeaningfulMotion,
} = await import('../src/lib/camera/squat/squat-completion-arming.ts');
const { buildSquatArmingAssistTraceCompact } = await import('../src/lib/camera/squat/squat-arming-assist.ts');

let passed = 0;
let failed = 0;

function ok(name, cond, extra) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}`, extra !== undefined ? extra : '');
    process.exitCode = 1;
  }
}

let ts = 0;
function mkFrame(depth) {
  ts += 40;
  return {
    isValid: true,
    timestampMs: ts,
    phaseHint: 'start',
    derived: { squatDepthProxy: depth, squatDepthProxyBlended: depth },
  };
}

console.log('PR-CAM-RETRO-ARMING-ASSIST-01 smoke\n');

const peakAnchoredFixtureDepths = [
  ...Array.from({ length: 12 }, () => 0.02),
  0.05,
  0.12,
  0.22,
  0.35,
  0.42,
  0.4,
  0.28,
  0.12,
  0.04,
  0.03,
  0.025,
  0.02,
];

// A: 3-frame standing 직후 의미 있는 피크 — 10/4 rule로는 놓치기 쉬운 짧은 선행 구간
const retroRescueDepths = [
  ...Array.from({ length: 6 }, () => 0.1),
  0.04,
  0.042,
  0.041,
  0.12,
  0.18,
  0.28,
  0.38,
  0.42,
  0.44,
  0.35,
  0.25,
  0.15,
  0.1,
  0.06,
  0.05,
];
ts = 0;
const retroFrames = retroRescueDepths.map(mkFrame);

{
  const direct = tryRetroArmingFromMeaningfulMotion(retroFrames);
  ok('A: tryRetro non-null', direct != null, direct);
  ok('A: armingRetroApplied', direct?.arming.armingRetroApplied === true, direct?.arming);
  ok('A: armed', direct?.arming.armed === true, direct?.arming);
  const full = computeSquatCompletionArming(retroFrames);
  ok('A: compute armed + retro', full.arming.armed === true && full.arming.armingRetroApplied === true, full.arming);
}

// B: standing sway — 피크/ excursion 부족
{
  ts = 0;
  const sway = Array.from({ length: 24 }, () => 0.04).map(mkFrame);
  ts = 0;
  const sway2 = Array.from({ length: 24 }, (_, i) => 0.04 + (i % 2) * 0.002).map(mkFrame);
  ok('B: flat sway → retro null', tryRetroArmingFromMeaningfulMotion(sway) == null);
  ok('B: micro sway → retro null', tryRetroArmingFromMeaningfulMotion(sway2) == null);
}

// C: tiny bend / fake dip
{
  ts = 0;
  const tinyPeak = [
    ...Array.from({ length: 6 }, () => 0.1),
    0.04,
    0.041,
    0.042,
    0.08,
    0.12,
    0.14,
    0.12,
    0.09,
  ].map(mkFrame);
  ok('C: peak < 0.25 → retro null', tryRetroArmingFromMeaningfulMotion(tinyPeak) == null);

  ts = 0;
  // standing 이후 모션 최대가 낮아 excursion(대략 0.14-0.04) < 0.12 를 못 넘김 + 피크도 0.25 미만
  const lowExcursion = [
    ...Array.from({ length: 6 }, () => 0.1),
    0.04,
    0.041,
    0.042,
    0.09,
    0.12,
    0.14,
    0.13,
  ].map(mkFrame);
  ok('C: peak & excursion too low → retro null', tryRetroArmingFromMeaningfulMotion(lowExcursion) == null);
}

// D: 피크 앵커가 먼저 잡는 fixture — retro 미적용
{
  ts = 0;
  const peakFrames = peakAnchoredFixtureDepths.map(mkFrame);
  const r = computeSquatCompletionArming(peakFrames);
  ok('D: peak anchored wins', r.arming.armingPeakAnchored === true, r.arming);
  ok('D: retro not applied', r.arming.armingRetroApplied !== true, r.arming);
}

// E: 피크 앵커 실패 후 10-frame standing arm (글로벌 피크는 버퍼 앞, standing+2차 모션은 뒤)
{
  ts = 0;
  const tenFrameDepths = [
    0.42,
    0.5,
    0.48,
    0.44,
    0.38,
    0.32,
    0.26,
    0.2,
    0.14,
    ...Array.from({ length: 10 }, () => 0.02),
    0.05,
    0.14,
    0.28,
    0.36,
    0.32,
    0.2,
    0.08,
    0.03,
  ];
  const tenFrames = tenFrameDepths.map(mkFrame);
  const r = computeSquatCompletionArming(tenFrames);
  ok('E: armed via 10-frame (no peak anchor)', r.arming.armed === true && r.arming.stableFrames === 10, r.arming);
  ok('E: not peak anchored', r.arming.armingPeakAnchored !== true, r.arming);
  ok('E: not retro', r.arming.armingRetroApplied !== true, r.arming);
  ok('E: slice starts after first squat', r.arming.completionSliceStartIndex === 19, r.arming.completionSliceStartIndex);
}

// F: 4-frame 폴백만 — 전역 피크가 vi=0 이라 피크 앵커 불가, 이후 4 standing + 모션만 rule 성공
{
  ts = 0;
  const fourOnlyDepths = [
    0.5,
    0.48,
    0.42,
    0.04,
    0.041,
    0.042,
    0.043,
    0.12,
    0.2,
    0.3,
    0.38,
    0.4,
    0.36,
    0.22,
    0.1,
    0.06,
  ];
  const fourFrames = fourOnlyDepths.map(mkFrame);
  const r = computeSquatCompletionArming(fourFrames);
  ok('F: 4-frame fallback', r.arming.stableFrames === 4 && r.arming.armingFallbackUsed === true, r.arming);
  ok('F: not retro', r.arming.armingRetroApplied !== true, r.arming);
}

// G: observability — compact `ra` 는 retro 케이스에서만 true
{
  const armRetro = buildSquatArmingAssistTraceCompact(computeSquatCompletionArming(retroFrames).arming);
  ts = 0;
  const armPeak = buildSquatArmingAssistTraceCompact(
    computeSquatCompletionArming(peakAnchoredFixtureDepths.map(mkFrame)).arming
  );
  ok('G: ra true only for retro case', armRetro.ra === true && armPeak.ra === false, { armRetro, armPeak });
}

// 짧은 버퍼(길이 7 < 8): 예전 4-frame 가드로 idle이던 구간에서 retro 시도
{
  ts = 0;
  const short7 = [0.04, 0.042, 0.041, 0.14, 0.24, 0.34, 0.3].map(mkFrame);
  ok('short7: length < 8', short7.length === 7);
  const r = computeSquatCompletionArming(short7);
  ok('short7: retro arms', r.arming.armed === true && r.arming.armingRetroApplied === true, r.arming);
}

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
