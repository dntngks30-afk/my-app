/**
 * PR-04E4B: ultra_low_rom guarded 진입을 continuity+0.35 로 04E4 finalize 와 정렬
 *
 * npx tsx scripts/camera-pr-04e4b-ultra-guarded-finalize-path-smoke.mjs
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { evaluateSquatCompletionState } = await import('../src/lib/camera/squat-completion-state.ts');
const { getSquatRecoverySignal } = await import('../src/lib/camera/pose-features.ts');

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

/** 상대 피크 <0.07 (ultra), proxy drop ratio [0.35,0.45) + continuity≥3 */
function buildUltraMarginalDropFrames() {
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
  for (let i = 0; i < 8; i++) push('start', 0.046, 0.045);

  return frames;
}

function buildUltraBadContinuityFrames() {
  const fr = buildUltraMarginalDropFrames();
  const last = fr[fr.length - 1];
  const bad = fr.slice(0, -4);
  bad.push(
    makeDualFrame(last.timestampMs - 120, 'start', 0.072, 0.05),
    makeDualFrame(last.timestampMs - 80, 'start', 0.068, 0.047),
    makeDualFrame(last.timestampMs - 40, 'start', 0.046, 0.045),
    makeDualFrame(last.timestampMs, 'start', 0.046, 0.045)
  );
  return bad;
}

function buildUltraLowDropFrames() {
  const fr = buildUltraMarginalDropFrames().slice(0, -10);
  let tms = fr[fr.length - 1].timestampMs + 40;
  const b = 0.045;
  const tailProxy = [0.07, 0.068, 0.066, 0.046, 0.045, 0.044];
  for (const p of tailProxy) {
    fr.push(makeDualFrame(tms, 'start', p, b));
    tms += 40;
  }
  return fr;
}

/** PR-04E4 low_rom 픽스처 (상대 ~0.08) */
function buildLowRomContinuityMarginalDropFrames() {
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
  for (let i = 0; i < 8; i++) push('start', 0.064, 0.045);
  return frames;
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

console.log('\n── A. ultra: continuity≥3 & drop∈[0.35,0.45) → ultra_low_rom_guarded_finalize ──');
{
  const fr = buildUltraMarginalDropFrames();
  const sig = getSquatRecoverySignal(fr);
  ok('A0: continuity ≥ 3', (sig.returnContinuityFrames ?? 0) >= 3, sig.returnContinuityFrames);
  ok(
    'A0b: recoveryDropRatio in [0.35, 0.45)',
    sig.recoveryDropRatio >= 0.35 && sig.recoveryDropRatio < 0.45,
    sig.recoveryDropRatio
  );
  const st = evaluateSquatCompletionState(fr, {});
  ok('A1: evidence ultra_low_rom', st.evidenceLabel === 'ultra_low_rom', st.evidenceLabel);
  ok(
    'A2: ultra_low_rom_guarded_finalize',
    st.standingRecoveryFinalizeReason === 'ultra_low_rom_guarded_finalize',
    st.standingRecoveryFinalizeReason
  );
  ok('A3: min hold 60ms path', st.standingRecoveryMinHoldMsUsed === 60, st.standingRecoveryMinHoldMsUsed);
  ok('A4: completion satisfied', st.completionSatisfied === true, st.completionSatisfied);
}

console.log('\n── B. ultra: continuity < 3 → guarded false, 160ms 요구 ──');
{
  const fr = buildUltraBadContinuityFrames();
  const sig = getSquatRecoverySignal(fr);
  ok('B0: continuity < 3', (sig.returnContinuityFrames ?? 0) < 3, sig.returnContinuityFrames);
  const st = evaluateSquatCompletionState(fr, {});
  ok('B1: not guarded (160ms)', st.standingRecoveryMinHoldMsUsed === 160, st.standingRecoveryMinHoldMsUsed);
  ok(
    'B2: not ultra_low_rom_guarded_finalize',
    st.standingRecoveryFinalizeReason !== 'ultra_low_rom_guarded_finalize',
    st.standingRecoveryFinalizeReason
  );
}

console.log('\n── C. ultra: drop < 0.35 → guarded false ──');
{
  const fr = buildUltraLowDropFrames();
  const sig = getSquatRecoverySignal(fr);
  ok('C0: drop < 0.35', sig.recoveryDropRatio < 0.35, sig.recoveryDropRatio);
  const st = evaluateSquatCompletionState(fr, {});
  ok('C1: min hold 160 (non-guarded)', st.standingRecoveryMinHoldMsUsed === 160, st.standingRecoveryMinHoldMsUsed);
}

console.log('\n── D. low_rom unchanged (PR-04E4) ──');
{
  const fr = buildLowRomContinuityMarginalDropFrames();
  const st = evaluateSquatCompletionState(fr, {});
  ok('D1: low_rom', st.evidenceLabel === 'low_rom', st.evidenceLabel);
  ok('D2: low_rom_guarded_finalize', st.standingRecoveryFinalizeReason === 'low_rom_guarded_finalize', st.standingRecoveryFinalizeReason);
  ok('D3: satisfied', st.completionSatisfied === true, st.completionSatisfied);
}

console.log('\n── E. deep standard_cycle ──');
{
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
  for (let i = 20; i < 34; i++) {
    const t = (i - 20) / 13;
    dp.push(0.58 - 0.53 * t);
    phases.push('ascent');
  }
  for (let i = 34; i < 42; i++) {
    dp.push(0.05);
    phases.push('start');
  }
  const fr = framesFrom(dp, phases, undefined, 40);
  const st = evaluateSquatCompletionState(fr, {});
  ok('E1: standard_cycle', st.completionPassReason === 'standard_cycle', st.completionPassReason);
  ok('E2: standing_hold_met', st.standingRecoveryFinalizeReason === 'standing_hold_met', st.standingRecoveryFinalizeReason);
}

console.log(`\n━━━ PR-04E4B smoke: ${passed} passed, ${failed} failed ━━━`);
if (failed === 0) console.log('✓ All acceptance criteria met');
