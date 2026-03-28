/**
 * PR-04E4: low-ROM standing finalize drop proof — pose continuity(≥3, ≥0.35) 정렬
 *
 * npx tsx scripts/camera-pr-04e4-lr-standing-tail-tuning-smoke.mjs
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

/** blended / proxy 분리 — completion tail 은 blended 가 낮고 proxy 꼬리는 조금 높아 drop ratio 가 0.35~0.45 구간에 들어가게 */
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

/**
 * A 용: 저ROM blended excursion + proxy 꼬리는 연속성 OK 이지만 drop ratio 는 구(0.45) 밑으로 떨어지는 구간
 * (예: 0.38 근처)
 */
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

  // blended 상대 피크 ~0.08 유지 (0.07≤low_rom<0.10), primary 는 상대 <0.12 로 blended owner
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

  // 상승 후: blended 는 서 있기에 가깝게, proxy 는 약간 높게 유지 후 말미만 연속 낮춤 (continuity≥3 & ratio ~0.38)
  for (let i = 0; i < 6; i++) push('start', 0.078, 0.048);
  for (let i = 0; i < 6; i++) push('start', 0.072, 0.046);
  // 마지막 8프레임: proxy 를 peak*0.6 이하로 맞춰 연속 카운트, 평균은 0.065 전후 → ratio ≈0.41 @ peak 0.115
  for (let i = 0; i < 8; i++) push('start', 0.064, 0.045);

  return frames;
}

/** B: 연속성 부족 — proxy 꼬리가 끝에서 끊기도록 중간에 스파이크 */
function buildLowRomBadContinuityFrames() {
  const fr = buildLowRomContinuityMarginalDropFrames();
  const last = fr[fr.length - 1];
  const bad = fr.slice(0, -4);
  bad.push(
    makeDualFrame(last.timestampMs - 120, 'start', 0.095, 0.05),
    makeDualFrame(last.timestampMs - 80, 'start', 0.088, 0.047),
    makeDualFrame(last.timestampMs - 40, 'start', 0.064, 0.045),
    makeDualFrame(last.timestampMs, 'start', 0.064, 0.045)
  );
  return bad;
}

/**
 * C: continuity≥3 유지(말미 3프레임은 peak*0.6 이하)이나 tail 평균이 커서 drop ratio < 0.35
 * 마지막 6 proxy: 앞 3은 높고 뒤 3만 연속 낮음 → 연속 카운트 3, mean 은 높음
 */
function buildLowRomLowDropFrames() {
  const fr = buildLowRomContinuityMarginalDropFrames().slice(0, -10);
  let ts = fr[fr.length - 1].timestampMs + 40;
  const b = 0.045;
  const tailProxy = [0.09, 0.088, 0.086, 0.065, 0.064, 0.063];
  for (const p of tailProxy) {
    fr.push(makeDualFrame(ts, 'start', p, b));
    ts += 40;
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

console.log('\n── A. low-ROM continuity≥3 & drop∈[0.35,0.45) → low_rom_guarded_finalize ──');
{
  const fr = buildLowRomContinuityMarginalDropFrames();
  const sig = getSquatRecoverySignal(fr);
  ok('A0: recovery returnContinuity ≥ 3', (sig.returnContinuityFrames ?? 0) >= 3, sig.returnContinuityFrames);
  ok(
    'A0b: recoveryDropRatio in [0.35, 0.45)',
    sig.recoveryDropRatio >= 0.35 && sig.recoveryDropRatio < 0.45,
    sig.recoveryDropRatio
  );
  const st = evaluateSquatCompletionState(fr, {});
  ok('A1: evidence low_rom', st.evidenceLabel === 'low_rom', st.evidenceLabel);
  ok('A2: low_rom_guarded_finalize', st.standingRecoveryFinalizeReason === 'low_rom_guarded_finalize', st.standingRecoveryFinalizeReason);
  ok('A3: completion satisfied', st.completionSatisfied === true, st.completionSatisfied);
}

console.log('\n── B. low-ROM continuity < 3 → return_continuity_below_min ──');
{
  const fr = buildLowRomBadContinuityFrames();
  const sig = getSquatRecoverySignal(fr);
  ok('B0: continuity broken (expect <3)', (sig.returnContinuityFrames ?? 0) < 3, sig.returnContinuityFrames);
  const st = evaluateSquatCompletionState(fr, {});
  ok(
    'B1: finalize blocked on continuity',
    st.standingRecoveryFinalizeReason === 'return_continuity_below_min',
    st.standingRecoveryFinalizeReason
  );
  ok('B2: not completion satisfied', st.completionSatisfied === false, st.completionSatisfied);
}

console.log('\n── C. low-ROM drop < 0.35 → recovery_drop_ratio_below_min ──');
{
  const fr = buildLowRomLowDropFrames();
  const sig = getSquatRecoverySignal(fr);
  ok('C0: drop ratio < 0.35', sig.recoveryDropRatio < 0.35, sig.recoveryDropRatio);
  const st = evaluateSquatCompletionState(fr, {});
  ok(
    'C1: finalize blocked on drop',
    st.standingRecoveryFinalizeReason === 'recovery_drop_ratio_below_min',
    st.standingRecoveryFinalizeReason
  );
}

console.log('\n── D. deep standard_cycle unchanged ──');
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
  ok('D1: standard_cycle', st.completionPassReason === 'standard_cycle', st.completionPassReason);
  ok('D2: standing_hold_met', st.standingRecoveryFinalizeReason === 'standing_hold_met', st.standingRecoveryFinalizeReason);
}

console.log('\n── E. standing / micro-dip still blocked ──');
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
  ok('E1: not satisfied', st.completionSatisfied === false, st.completionSatisfied);
}

console.log(`\n━━━ PR-04E4 smoke: ${passed} passed, ${failed} failed ━━━`);
if (failed === 0) console.log('✓ All acceptance criteria met');
