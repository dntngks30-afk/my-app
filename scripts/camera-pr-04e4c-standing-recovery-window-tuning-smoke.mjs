/**
 * PR-04E4C: low_rom / ultra_low_rom standing recovery 임계 바닥 0.017 — 스캔 토폴로지 동일
 *
 * npx tsx scripts/camera-pr-04e4c-standing-recovery-window-tuning-smoke.mjs
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { evaluateSquatCompletionState } = await import('../src/lib/camera/squat-completion-state.ts');

let passed = 0;
let failed = 0;

function ok(name, cond, extra) {
  if (cond) {
    passed++;
    console.log(`  PASS: ${name}`);
  } else {
    failed++;
    const detail = extra !== undefined ? ` | got: ${JSON.stringify(extra)}` : '';
    console.error(`  FAIL: ${name}${detail}`);
    process.exitCode = 1;
  }
}

function makeDualFrame(ts, phaseHint, proxy, blended) {
  return {
    timestampMs: ts,
    isValid: true,
    phaseHint,
    derived: { squatDepthProxy: proxy, squatDepthProxyBlended: blended },
    visibilitySummary: {
      averageVisibility: 0.9,
      criticalJointsAvailability: 0.9,
      visibleLandmarkRatio: 0.9,
      leftSideCompleteness: 0.9,
      rightSideCompleteness: 0.9,
    },
    bodyBox: { area: 0.35, width: 0.4, height: 0.8 },
    qualityHints: [],
    frameValidity: 'valid',
    joints: {},
    eventHints: [],
    timestampDeltaMs: 40,
    stepId: 'squat',
  };
}

/** low_rom 사이클 + completion(blended) 꼬리 마지막 1프레임만 relative≈0.016 (구 바닥 0.015 초과) */
function buildLowRomLastFrameNoiseFrames() {
  const frames = [];
  let ts = 100;
  const step = 40;
  const baseB = 0.045;
  const baseP = 0.048;
  const push = (ph, p, b) => {
    frames.push(makeDualFrame(ts, ph, p, b));
    ts += step;
  };
  for (let i = 0; i < 8; i++) push('start', baseP, baseB);
  for (let i = 0; i < 8; i++) {
    const t = i / 7;
    push(i < 2 ? 'start' : 'descent', baseP + 0.01 * t, baseB + 0.085 * t);
  }
  const peakB = 0.128;
  for (let i = 0; i < 6; i++) push('bottom', 0.115, peakB);
  for (let i = 0; i < 12; i++) {
    const t = i / 11;
    const p = 0.115 - 0.05 * t;
    const b = peakB - (peakB - baseB) * t;
    push('ascent', p, b);
  }
  for (let i = 0; i < 6; i++) push('start', 0.078, 0.048);
  for (let i = 0; i < 6; i++) push('start', 0.072, 0.046);
  for (let i = 0; i < 7; i++) push('start', 0.064, 0.045);
  // 마지막: blended baseline+0.016 근처 → 구 0.015 바닥이면 접미사 단절, 0.017 저밴드면 통과
  push('start', 0.064, 0.061);
  return frames;
}

/** 저밴드 꼬리 전체가 복귀 불충분 (relative ~0.035) */
function buildLowRomUnrecoveredTailFrames() {
  const fr = buildLowRomLastFrameNoiseFrames().slice(0, -9);
  let tms = fr[fr.length - 1].timestampMs + 40;
  for (let i = 0; i < 9; i++) {
    fr.push(makeDualFrame(tms, 'start', 0.088, 0.08));
    tms += 40;
  }
  return fr;
}

function makeFrame(depthPrimary, timestampMs, phaseHint, blended = undefined) {
  const derived = { squatDepthProxy: depthPrimary };
  if (blended !== undefined) derived.squatDepthProxyBlended = blended;
  return {
    timestampMs,
    isValid: true,
    phaseHint,
    derived,
    visibilitySummary: {
      averageVisibility: 0.9,
      criticalJointsAvailability: 0.9,
      visibleLandmarkRatio: 0.9,
      leftSideCompleteness: 0.9,
      rightSideCompleteness: 0.9,
    },
    bodyBox: { area: 0.35, width: 0.4, height: 0.8 },
    qualityHints: [],
    frameValidity: 'valid',
    joints: {},
    eventHints: [],
    timestampDeltaMs: 40,
    stepId: 'squat',
  };
}

function framesFrom(depthsPrimary, phases, blendedSeries, stepMs = 40) {
  return depthsPrimary.map((dp, i) =>
    makeFrame(dp, 100 + i * stepMs, phases[i] ?? 'start', blendedSeries?.[i])
  );
}

/** 표준 깊은 사이클 + 마지막 프레임 살짝 튀어도 ratio 임계가 커서 복귀 유지 */
function buildStandardDeepLastBumpFrames() {
  const dp = [];
  const phases = [];
  for (let i = 0; i < 6; i++) {
    dp.push(0.05);
    phases.push('start');
  }
  for (let i = 6; i < 14; i++) {
    const t = (i - 6) / 8;
    dp.push(0.05 + 0.5 * t);
    phases.push('descent');
  }
  for (let i = 14; i < 20; i++) {
    dp.push(0.58);
    phases.push('bottom');
  }
  for (let i = 20; i < 33; i++) {
    const t = (i - 20) / 12;
    dp.push(0.58 - 0.53 * t);
    phases.push('ascent');
  }
  for (let i = 0; i < 10; i++) {
    dp.push(0.05);
    phases.push('start');
  }
  dp.push(0.066);
  phases.push('start');
  return framesFrom(dp, phases, undefined, 40);
}

console.log('\n── A. low_rom + 마지막 1프레임 노이즈 → standing 복귀 앵커 존재 ──');
{
  const fr = buildLowRomLastFrameNoiseFrames();
  const st = evaluateSquatCompletionState(fr, {});
  ok('A1: low_rom', st.evidenceLabel === 'low_rom', st.evidenceLabel);
  ok('A2: low-band threshold floor', st.standingRecoveryThreshold === 0.017, st.standingRecoveryThreshold);
  ok('A3: standingRecoveredAtMs set', st.standingRecoveredAtMs != null, st.standingRecoveredAtMs);
  ok('A4: not blocked at not_standing_recovered', st.ruleCompletionBlockedReason !== 'not_standing_recovered', st.ruleCompletionBlockedReason);
}

console.log('\n── B. standard 깊음 + 끝 bump → 임계는 ratio 우세, 동작 유지 ──');
{
  const fr = buildStandardDeepLastBumpFrames();
  const st = evaluateSquatCompletionState(fr, {});
  ok('B1: standard', st.evidenceLabel === 'standard', st.evidenceLabel);
  ok(
    'B2: threshold uses standard floor (not low-band 0.017 as sole floor)',
    st.standingRecoveryThreshold > 0.017,
    st.standingRecoveryThreshold
  );
  ok('B3: standingRecoveredAtMs set', st.standingRecoveredAtMs != null, st.standingRecoveredAtMs);
  ok('B4: standard_cycle', st.completionPassReason === 'standard_cycle', st.completionPassReason);
}

console.log('\n── C. 저밴드 꼬리 미복귀 → not_standing_recovered ──');
{
  const fr = buildLowRomUnrecoveredTailFrames();
  const st = evaluateSquatCompletionState(fr, {});
  ok('C1: low_rom', st.evidenceLabel === 'low_rom', st.evidenceLabel);
  ok('C2: not_standing_recovered', st.ruleCompletionBlockedReason === 'not_standing_recovered', st.ruleCompletionBlockedReason);
}

console.log('\n── D. standing / micro-dip ──');
{
  const dp = [];
  const phases = [];
  for (let i = 0; i < 30; i++) {
    const d = 0.025 + (i === 12 ? 0.015 : 0);
    dp.push(d);
    phases.push('start');
  }
  const fr = framesFrom(dp, phases, undefined, 40);
  const st = evaluateSquatCompletionState(fr, {});
  ok('D1: not satisfied', st.completionSatisfied === false, st.completionSatisfied);
}

console.log('\n── E. ultra_low_rom 저밴드 임계 구분 ──');
{
  const { getSquatRecoverySignal } = await import('../src/lib/camera/pose-features.ts');
  // ultra 픽스처: 04E4B 스타일 축소본 — 짧은 시퀀스 대신 기존 ultra 스모크 패턴 재사용 불가 시 직접 구성
  const frames = [];
  let ts = 100;
  const step = 40;
  const baseB = 0.045;
  const baseP = 0.048;
  const push = (ph, p, b) => {
    frames.push(makeDualFrame(ts, ph, p, b));
    ts += step;
  };
  for (let i = 0; i < 8; i++) push('start', baseP, baseB);
  for (let i = 0; i < 8; i++) {
    const t = i / 7;
    push(i < 2 ? 'start' : 'descent', baseP + 0.008 * t, baseB + 0.032 * t);
  }
  const peakB = 0.09;
  const peakP = 0.082;
  for (let i = 0; i < 6; i++) push('bottom', peakP, peakB);
  for (let i = 0; i < 12; i++) {
    const t = i / 11;
    push('ascent', peakP - 0.038 * t, peakB - (peakB - baseB) * t);
  }
  for (let i = 0; i < 6; i++) push('start', 0.056, 0.048);
  for (let i = 0; i < 6; i++) push('start', 0.052, 0.046);
  for (let i = 0; i < 7; i++) push('start', 0.046, 0.045);
  push('start', 0.064, 0.061);
  getSquatRecoverySignal(frames);
  const st = evaluateSquatCompletionState(frames, {});
  ok('E1: ultra_low_rom', st.evidenceLabel === 'ultra_low_rom', st.evidenceLabel);
  ok('E2: ultra uses low-band threshold', st.standingRecoveryThreshold === 0.017, st.standingRecoveryThreshold);
}

console.log(`\n━━━ PR-04E4C smoke: ${passed} passed, ${failed} failed ━━━`);
if (failed === 0) console.log('✓ All acceptance criteria met');
