/**
 * PR-CAM-SHALLOW-DEPTH-TRUTH-ALIGN-01 smoke
 *
 * 검증 목표: applySquatDepthBlendPass 의 raw peak capture 가 올바르게 작동하는지 확인.
 *
 * 4 시나리오:
 *   S1. Standing still           → squatDepthProxyBlended stays near 0 (no raw capture)
 *   S2. Ultra-low tiny dip       → blended stays ultra-low (primary < PRIMARY_STRONG_MIN)
 *   S3. Real shallow low-rom     → blended captures raw peak (primary >= PRIMARY_STRONG_MIN)
 *   S4. Deep standard squat      → blended near raw (EMA converged; no regression)
 *
 * Run: npx tsx scripts/camera-pr-squat-depth-truth-align-01-smoke.mjs
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { applySquatDepthBlendPass } = await import('../src/lib/camera/pose-features.ts');

let passed = 0;
let failed = 0;

function ok(name, cond, extra) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    const d = extra !== undefined ? ` | got: ${JSON.stringify(extra)}` : '';
    console.error(`  ✗ ${name}${d}`);
  }
}

/**
 * Synthetic PoseFeaturesFrame 생성.
 * squatDepthProxy  = EMA-smoothed 값 (stabilizeDerivedSignals 이후 상태 모사).
 * squatDepthProxyRaw = raw pre-EMA 값.
 * joints 는 null (buildSquatDepthSignal 의 fallback/travel 경로 비활성화 → primary path 만 작동).
 */
function makeFrame(proxy, raw, timestampMs) {
  return {
    timestampMs: timestampMs ?? 0,
    isValid: true,
    phaseHint: 'unknown',
    eventHints: [],
    qualityHints: [],
    derived: {
      squatDepthProxy: proxy,
      squatDepthProxyRaw: raw,
      kneeAngleLeft: null,
      kneeAngleRight: null,
      kneeAngleAvg: null,
    },
    joints: {}, // all null — computeFallbackKneeHipDepth / computeKneeTravelSignal return null/0
    bodyBox: { area: 0.25 },
    visibilitySummary: { visibleLandmarkRatio: 0.88, criticalJointsAvailability: 0.9 },
  };
}

/**
 * EMA 시뮬레이션 (alpha=0.46, pose-features.ts stabilizeDerivedSignals 와 동일).
 * rawValues: 원시 knee depth proxy 시계열
 * returns: EMA-smoothed 시계열
 */
function simulateEma(rawValues, alpha = 0.46) {
  const result = [];
  let prev = null;
  for (const v of rawValues) {
    if (prev === null) {
      result.push(v);
      prev = v;
    } else {
      const next = prev + (v - prev) * alpha;
      result.push(next);
      prev = next;
    }
  }
  return result;
}

/**
 * frames 배열에서 squatDepthProxyBlended 의 최대값을 반환.
 */
function maxBlended(frames) {
  let max = -Infinity;
  for (const f of frames) {
    const b = f.derived?.squatDepthProxyBlended;
    if (typeof b === 'number' && b > max) max = b;
  }
  return max;
}

// LOW_ROM_LABEL_FLOOR = 0.07, PRIMARY_STRONG_MIN = 0.045 (squat-depth-signal.ts 기준)
const LOW_ROM_FLOOR = 0.07;
const PRIMARY_STRONG_MIN = 0.045;

// ─── S1. Standing still ───────────────────────────────────────────────────────
console.log('\nS1. Standing still');
{
  // 20 프레임, raw 값이 0.010~0.014 사이에서 미세 진동.
  const rawValues = Array.from({ length: 20 }, (_, i) => 0.010 + 0.002 * Math.sin(i * 0.8));
  const emaValues = simulateEma(rawValues);
  const frames = emaValues.map((ema, i) => makeFrame(ema, rawValues[i], i * 80));
  const out = applySquatDepthBlendPass(frames);
  const peak = maxBlended(out);
  // jitter 수준에서는 primary 가 PRIMARY_STRONG_MIN 에 못 미치므로 raw capture 미발동
  ok('blended peak stays well below low-rom floor', peak < LOW_ROM_FLOOR, peak);
  ok('blended peak stays below PRIMARY_STRONG_MIN', peak < PRIMARY_STRONG_MIN, peak);
  console.log(`    peak blended = ${peak.toFixed(4)}`);
}

// ─── S2. Ultra-low tiny dip ───────────────────────────────────────────────────
console.log('\nS2. Ultra-low tiny dip (raw peak ~0.045)');
{
  // 서 있다가 raw 0.045 까지 내려갔다가 복귀 (ultra-low 범주).
  const rawValues = [
    0.010, 0.015, 0.025, 0.035, 0.040, 0.045, // descent
    0.040, 0.030, 0.020, 0.013, 0.010,          // ascent
  ];
  const emaValues = simulateEma(rawValues);
  const frames = emaValues.map((ema, i) => makeFrame(ema, rawValues[i], i * 80));
  const out = applySquatDepthBlendPass(frames);
  const peak = maxBlended(out);
  // primary 피크 EMA ≈ 0.040 < PRIMARY_STRONG_MIN(0.045) → raw capture 발동 안 함.
  ok('blended peak below low-rom floor (ultra-low stays ultra-low)', peak < LOW_ROM_FLOOR, peak);
  console.log(`    peak blended = ${peak.toFixed(4)}`);
}

// ─── S3. Real shallow low-rom ─────────────────────────────────────────────────
console.log('\nS3. Real shallow low-rom (raw peak ~0.090)');
{
  // 4 프레임 하강, raw 피크 0.090 (knee ~90°).
  // 기존(alpha=0.46): EMA 피크 ≈ 0.068 → blended = 0.068 (LOW_ROM_FLOOR 미달).
  // fix 후: EMA 피크 ≈ 0.068 >= PRIMARY_STRONG_MIN → raw capture → blended = 0.090.
  const rawValues = [
    0.010, 0.040, 0.070, 0.085, 0.090, // descent
    0.085, 0.065, 0.040, 0.020, 0.012, // ascent
  ];
  const emaValues = simulateEma(rawValues);
  const frames = emaValues.map((ema, i) => makeFrame(ema, rawValues[i], i * 80));
  const out = applySquatDepthBlendPass(frames);

  // raw capture 발동 여부: descent 중 primary가 PRIMARY_STRONG_MIN 을 넘는 프레임 확인
  const gateFrames = out.filter((f) => f.derived.squatDepthProxy >= PRIMARY_STRONG_MIN);
  const peak = maxBlended(out);

  ok('gate triggers (primary reaches PRIMARY_STRONG_MIN during descent)', gateFrames.length > 0, gateFrames.length);
  ok('blended peak crosses low-rom floor (raw capture fixes compression)', peak >= LOW_ROM_FLOOR, peak);
  console.log(`    peak blended = ${peak.toFixed(4)}  (raw peak = 0.090, ema peak ≈ ${Math.max(...emaValues).toFixed(4)})`);
}

// ─── S4. Deep standard squat ──────────────────────────────────────────────────
console.log('\nS4. Deep standard squat (raw peak ~0.50)');
{
  // 8 프레임 점진 하강, raw 피크 0.50 (deep).
  const rawValues = [
    0.010, 0.060, 0.130, 0.230, 0.350, 0.430, 0.480, 0.500, // descent
    0.480, 0.430, 0.350, 0.230, 0.130, 0.060, 0.020, 0.010, // ascent
  ];
  const emaValues = simulateEma(rawValues);
  const frames = emaValues.map((ema, i) => makeFrame(ema, rawValues[i], i * 80));
  const out = applySquatDepthBlendPass(frames);
  const peak = maxBlended(out);
  // deep squat: EMA 수렴되어 raw ≈ smoothed → raw capture 최대 raw peak(0.50) 이하, 동일 결과
  ok('blended peak is high (standard deep, no regression)', peak >= 0.35, peak);
  ok('blended peak does not exceed raw peak', peak <= 0.500001, peak);
  console.log(`    peak blended = ${peak.toFixed(4)}  (raw peak = 0.500, ema peak ≈ ${Math.max(...emaValues).toFixed(4)})`);
}

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
