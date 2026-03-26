/**
 * PR-CAM-20 smoke test — Squat pass owner truth fix
 *
 * 검증 목표:
 * - completionPassReason이 success owner (not post-hoc label)
 * - completionSatisfied = completionPassReason !== 'not_confirmed'
 * - evidenceLabel에서 파생하지 않고, completionPassReason → completionSatisfied 순서
 *
 * 현재 thresholds (main 기준):
 *   LOW_ROM_LABEL_FLOOR  = 0.07
 *   STANDARD_LABEL_FLOOR = 0.10
 *   squatDepthProxy = clamp((175 - kneeAngleAvg) / 85)
 *   직립 baseline (무릎 ~171°) ≈ 0.047
 *
 * 수용 테스트:
 * A. 얕은 유효 사이클 → completionPassReason = low_rom_event_cycle, completionPathUsed != 'standard'
 * B. ultra-low ROM 유효 사이클 → ultra_low_rom_event_cycle
 * C. 깊은 스쿼트 → standard_cycle (회귀 없음)
 * D. standing/sway → blocked (false positive 없음)
 * E. 빠른 미세 딥 → blocked (timing guard)
 * F. not_confirmed이면 completionSatisfied = false (오너 일관성)
 * G. completionPathUsed는 evidenceLabel이 아닌 completionPassReason에서 파생
 *    (via auto-progression evalSquatCompletion 시뮬레이션은 unit 범위 초과이므로
 *     squat-completion-state 레이어에서 completionPassReason 정합성만 확인)
 *
 * 실행: npx tsx scripts/camera-cam20-squat-owner-truth-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { evaluateSquatCompletionState } = await import(
  '../src/lib/camera/squat-completion-state.ts'
);

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

function makeFrame(depth, timestampMs, phaseHint) {
  return {
    isValid: true,
    derived: { squatDepthProxy: depth },
    timestampMs,
    phaseHint,
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
    timestampDeltaMs: 33,
    stepId: 'squat',
  };
}

/**
 * 스쿼트 프레임 생성.
 *
 * low/ultra-low ROM 사이클 시뮬레이션 시 주의사항:
 * - LOW_ROM_TIMING_PEAK_MAX(0.10) 미만이면 하강→피크 >= 200ms 필요
 * - SHALLOW_REVERSAL_TIMING_PEAK_MAX(0.11) 미만이면 역전→standing >= 200ms 필요
 * - timing 체크에서 descentFrame(phaseHint='descent')이 있으면 그 시점이 시작점이 됨
 *   → slow descent(delta per frame < 0.008)를 사용하면 'descent' phaseHint 없음
 *   → effectiveDescentStartFrame(trajectory)이 사용되어 더 이른 시점 기준 적용
 *
 * phaseHintMode:
 *   'auto'  — 하강 프레임에 'descent' 자동 배정 (표준 사이클용)
 *   'start' — 하강/피크 프레임 모두 'start' 유지 (slow/low-ROM eventBasedPath 강제)
 *
 * @param {number} baselineDepth
 * @param {number} peakDepth
 * @param {number} msPerFrame
 * @param {number} descentFrames
 * @param {'auto'|'start'} phaseHintMode
 */
function makeSquatFrames(baselineDepth, peakDepth, msPerFrame = 40, descentFrames = 12, phaseHintMode = 'auto') {
  const frames = [];
  let t = 0;

  // 6 baseline
  for (let i = 0; i < 6; i++) {
    frames.push(makeFrame(baselineDepth, t, 'start'));
    t += msPerFrame;
  }

  // descent
  for (let i = 0; i < descentFrames; i++) {
    const ratio = (i + 1) / descentFrames;
    const depth = baselineDepth + (peakDepth - baselineDepth) * ratio;
    let hint = 'start';
    if (phaseHintMode === 'auto' && depth >= 0.08) {
      const prevDepth = baselineDepth + (i / descentFrames) * (peakDepth - baselineDepth);
      const delta = depth - prevDepth;
      const excursion = depth - baselineDepth;
      if (delta > 0.008 && excursion >= 0.022) hint = 'descent';
    }
    frames.push(makeFrame(depth, t, hint));
    t += msPerFrame;
  }

  // 3 peak frames
  for (let i = 0; i < 3; i++) {
    const hint = phaseHintMode === 'auto' && peakDepth >= 0.08 ? 'bottom' : 'start';
    frames.push(makeFrame(peakDepth, t, hint));
    t += msPerFrame;
  }

  // ascent — 'ascent' phaseHint 명시 (ascendConfirmed 보장)
  for (let i = 0; i < descentFrames; i++) {
    const ratio = (i + 1) / descentFrames;
    const depth = peakDepth - (peakDepth - baselineDepth) * ratio;
    const hint = depth >= 0.08 ? 'ascent' : 'start';
    frames.push(makeFrame(depth, t, hint));
    t += msPerFrame;
  }

  // 7 recovery
  for (let i = 0; i < 7; i++) {
    frames.push(makeFrame(baselineDepth, t, 'start'));
    t += msPerFrame;
  }

  return frames;
}

// ────────────────────────────────────────────
// A. 얕은 유효 사이클 (low_rom 구간)
//    relativeDepthPeak ≈ 0.08 → LOW_ROM_LABEL_FLOOR(0.07) ≤ 0.08 < STANDARD_LABEL_FLOOR(0.10)
//    → evidenceLabel = low_rom → completionPassReason = low_rom_event_cycle
//    타이밍: 0.08 < LOW_ROM_TIMING_PEAK_MAX(0.10) → 하강 >= 200ms 필요
//    phaseHintMode='start' → descentFrame=null → effectiveDescentStartFrame(trajectory) 사용
//    effectiveDescentStartFrame at ~t=350ms, peakFrame at t=850ms → 500ms >= 200ms ✓
//    reversalToStanding: 0.08 < SHALLOW_REVERSAL_TIMING_PEAK_MAX(0.11) → >= 200ms 필요
//    ascent + recovery = 12*50 + 7*50 = 950ms >= 200ms ✓
// ────────────────────────────────────────────
console.log('\nA. 얕은 유효 사이클 (low_rom_event_cycle owner)');
{
  const baseline = 0.047;
  const peak = 0.047 + 0.08; // relativeDepthPeak = 0.08
  // phaseHintMode='start': 모든 하강/피크 프레임이 'start' → descentFrame=null → eventBasedDescentPath=true
  const frames = makeSquatFrames(baseline, peak, 50, 12, 'start');
  const state = evaluateSquatCompletionState(frames);

  ok(
    'A1: evidenceLabel = low_rom',
    state.evidenceLabel === 'low_rom',
    state.evidenceLabel
  );
  ok(
    'A2: completionPassReason = low_rom_event_cycle (owner)',
    state.completionPassReason === 'low_rom_event_cycle',
    state.completionPassReason
  );
  ok(
    'A3: completionSatisfied = true (derived from owner)',
    state.completionSatisfied === true,
    state.completionSatisfied
  );
  ok(
    'A4: completionPassReason != standard_cycle',
    state.completionPassReason !== 'standard_cycle',
    state.completionPassReason
  );
  ok(
    'A5: completionBlockedReason = null (gate clear)',
    state.completionBlockedReason === null,
    state.completionBlockedReason
  );
}

// ────────────────────────────────────────────
// B. ultra-low ROM 사이클 (ultra_low_rom 구간)
//    relativeDepthPeak ≈ 0.04 → [0.02, 0.07)
//    pieak depth = 0.047 + 0.04 = 0.087 > 0.08이지만 slow descent로 'descent' phaseHint 없음
//    phaseHintMode='start' → descentFrame=null → eventBasedDescentPath=true
//    타이밍: 0.04 < 0.10 → 하강 >= 200ms 필요
//    effectiveDescentStartFrame: depth >= 0.047+0.008=0.055, ~t=350ms; peakFrame ~t=850ms → 500ms ✓
// ────────────────────────────────────────────
console.log('\nB. ultra-low ROM 유효 사이클 (ultra_low_rom_event_cycle owner)');
{
  const baseline = 0.047;
  const peak = 0.047 + 0.04; // relativeDepthPeak = 0.04
  const frames = makeSquatFrames(baseline, peak, 50, 12, 'start');
  const state = evaluateSquatCompletionState(frames);

  ok(
    'B1: evidenceLabel = ultra_low_rom (relativeDepthPeak = 0.04 in [0.02, 0.07))',
    state.evidenceLabel === 'ultra_low_rom',
    { evidenceLabel: state.evidenceLabel, relPeak: state.relativeDepthPeak }
  );
  ok(
    'B2: completionPassReason = ultra_low_rom_event_cycle (owner)',
    state.completionPassReason === 'ultra_low_rom_event_cycle',
    state.completionPassReason
  );
  ok(
    'B3: completionSatisfied = true',
    state.completionSatisfied === true,
    state.completionSatisfied
  );
}

// ────────────────────────────────────────────
// C. 깊은 스쿼트 회귀 (standard_cycle 보존)
//    relativeDepthPeak = 0.94 (실기기 deep squat)
// ────────────────────────────────────────────
console.log('\nC. 깊은 스쿼트 — standard_cycle 회귀 없음');
{
  const baseline = 0.047;
  const peak = 0.047 + 0.94; // relativeDepthPeak = 0.94
  const frames = makeSquatFrames(baseline, Math.min(peak, 1.0), 40, 12);
  const state = evaluateSquatCompletionState(frames);

  ok(
    'C1: evidenceLabel = standard',
    state.evidenceLabel === 'standard',
    state.evidenceLabel
  );
  ok(
    'C2: completionPassReason = standard_cycle',
    state.completionPassReason === 'standard_cycle',
    state.completionPassReason
  );
  ok(
    'C3: completionSatisfied = true',
    state.completionSatisfied === true,
    state.completionSatisfied
  );
}

// ────────────────────────────────────────────
// D. Standing still / sway — blocked
//    relativeDepthPeak < MIN_RELATIVE_DEPTH_FOR_ATTEMPT(0.02)
// ────────────────────────────────────────────
console.log('\nD. Standing / sway — blocked');
{
  const baseline = 0.047;
  const peak = 0.047 + 0.01; // relativeDepthPeak = 0.01 < 0.02
  const frames = makeSquatFrames(baseline, peak, 40, 6);
  const state = evaluateSquatCompletionState(frames);

  ok(
    'D1: completionSatisfied = false',
    state.completionSatisfied === false,
    state.completionSatisfied
  );
  ok(
    'D2: completionPassReason = not_confirmed',
    state.completionPassReason === 'not_confirmed',
    state.completionPassReason
  );
}

// ────────────────────────────────────────────
// E. 빠른 가짜 딥 — timing guard
//    relativeDepthPeak = 0.05 (< 0.10) 하지만 하강 시간 < 200ms
//    descentFrames = 3, msPerFrame = 30 → 90ms < 200ms → blocked
// ────────────────────────────────────────────
console.log('\nE. 빠른 미세 딥 — timing blocked');
{
  const baseline = 0.047;
  const peak = 0.047 + 0.05;
  const frames = makeSquatFrames(baseline, peak, 30, 3); // 3 * 30ms = 90ms < 200ms
  const state = evaluateSquatCompletionState(frames);

  ok(
    'E1: completionSatisfied = false (timing block)',
    state.completionSatisfied === false,
    { reason: state.completionBlockedReason, passReason: state.completionPassReason }
  );
  ok(
    'E2: completionPassReason = not_confirmed',
    state.completionPassReason === 'not_confirmed',
    state.completionPassReason
  );
}

// ────────────────────────────────────────────
// F. owner 일관성: not_confirmed → completionSatisfied = false (항상)
// ────────────────────────────────────────────
console.log('\nF. owner 일관성 — not_confirmed → completionSatisfied = false');
{
  // 빈 프레임
  const state = evaluateSquatCompletionState([]);
  ok(
    'F1: empty frames → completionPassReason = not_confirmed',
    state.completionPassReason === 'not_confirmed',
    state.completionPassReason
  );
  ok(
    'F2: empty frames → completionSatisfied = false',
    state.completionSatisfied === false,
    state.completionSatisfied
  );
}

// ────────────────────────────────────────────
// G. 품질 분리: low_rom 성공 시 evidenceLabel = low_rom 유지 (standard로 승격 안 됨)
// ────────────────────────────────────────────
console.log('\nG. 품질 분리 — low_rom pass는 evidenceLabel 변경 없음');
{
  const baseline = 0.047;
  const peak = 0.047 + 0.08;
  const frames = makeSquatFrames(baseline, peak, 50, 12, 'start');
  const state = evaluateSquatCompletionState(frames);

  ok(
    'G1: 성공해도 evidenceLabel = low_rom (standard로 승격 안 됨)',
    state.evidenceLabel === 'low_rom',
    state.evidenceLabel
  );
  ok(
    'G2: completionPassReason = low_rom_event_cycle (not standard_cycle)',
    state.completionPassReason === 'low_rom_event_cycle',
    state.completionPassReason
  );
}

// ────────────────────────────────────────────
// H. 경계값: relativeDepthPeak = STANDARD_LABEL_FLOOR (0.10) → standard
//            relativeDepthPeak = 0.099 → low_rom
// ────────────────────────────────────────────
console.log('\nH. 경계값 — STANDARD_LABEL_FLOOR 0.10 경계');
{
  const baseline = 0.047;

  // 0.10 → standard (>= STANDARD_LABEL_FLOOR)
  const framesDeep = makeSquatFrames(baseline, baseline + 0.10, 50, 6);
  const stateDeep = evaluateSquatCompletionState(framesDeep);
  ok(
    'H1: relativeDepthPeak = 0.10 → standard_cycle',
    stateDeep.completionPassReason === 'standard_cycle',
    { passReason: stateDeep.completionPassReason, evidenceLabel: stateDeep.evidenceLabel, relativeDepthPeak: stateDeep.relativeDepthPeak }
  );

  // 0.099 → low_rom (< STANDARD_LABEL_FLOOR = 0.10)
  // 타이밍: 0.099 < LOW_ROM_TIMING_PEAK_MAX(0.10) → 하강 >= 200ms 필요
  // phaseHintMode='start' → eventBasedDescentPath 사용, 충분한 타임스팬 보장
  const framesShallow = makeSquatFrames(baseline, baseline + 0.099, 50, 12, 'start');
  const stateShallow = evaluateSquatCompletionState(framesShallow);
  ok(
    'H2: relativeDepthPeak ≈ 0.099 → low_rom_event_cycle',
    stateShallow.completionPassReason === 'low_rom_event_cycle',
    { passReason: stateShallow.completionPassReason, evidenceLabel: stateShallow.evidenceLabel, relativeDepthPeak: stateShallow.relativeDepthPeak }
  );
}

// ────────────────────────────────────────────
// I. 회귀: 기존 deeper standard squat (0.15, 0.30, 0.50) → 항상 standard_cycle
// ────────────────────────────────────────────
console.log('\nI. 기존 deeper squat 회귀');
{
  const baseline = 0.047;
  for (const relPeak of [0.15, 0.30, 0.50]) {
    const frames = makeSquatFrames(baseline, baseline + relPeak, 40, 12);
    const state = evaluateSquatCompletionState(frames);
    ok(
      `I: relativeDepthPeak = ${relPeak} → standard_cycle (completionSatisfied = true)`,
      state.completionPassReason === 'standard_cycle' && state.completionSatisfied === true,
      { passReason: state.completionPassReason, satisfied: state.completionSatisfied, relPeak: state.relativeDepthPeak }
    );
  }
}

// ────────────────────────────────────────────
// 최종 결과
// ────────────────────────────────────────────
console.log(`\n━━━ PR-CAM-20 smoke: ${passed} passed, ${failed} failed ━━━`);
if (failed === 0) {
  console.log('✓ All acceptance criteria met — owner-first structure verified');
} else {
  console.error('✗ Some tests failed');
}
