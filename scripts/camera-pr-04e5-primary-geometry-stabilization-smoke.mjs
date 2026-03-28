/**
 * PR-04E5: Primary Geometry Stabilization smoke test
 *
 * 목표:
 *   A. 단발 primary 붕괴 → stable primary 복구, rawDepthPeakPrimary 가 near-zero 에서 복구
 *   B. 단발 스파이크 → fake peak/reversal 생성 안 함
 *   C. deep standard cycle → standard_cycle 유지
 *   D. standing / micro dip → 여전히 차단
 *   E. 관측 필드 형상 검증 (squatPrimaryStablePeak, squatPrimaryJumpSuppressedCount)
 *
 * 실행:
 *   npx tsx scripts/camera-pr-04e5-primary-geometry-stabilization-smoke.mjs
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { suppressOneFrameDrops } = await import('../src/lib/camera/stability.ts');
const { evaluateSquatCompletionState } = await import('../src/lib/camera/squat-completion-state.ts');
const { evaluateSquatFromPoseFrames } = await import('../src/lib/camera/evaluators/squat.ts');

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

// ─── 공통 헬퍼 ─────────────────────────────────────────────────────────────

/**
 * 최소 필드를 가진 PoseFeaturesFrame mock 생성.
 * squatDepthProxy  = EMA-smoothed primary (붕괴 포함 가능)
 * squatDepthPrimaryStable = 안정화된 primary (선택적 수동 지정)
 * squatDepthProxyBlended  = blended (event-cycle 판단에 사용)
 */
function makeFrame(
  timestampMs,
  {
    depth = 0.05,
    blendedDepth = null,
    stableDepth = null,
    jumpSuppressed = false,
    phaseHint = 'unknown',
    rawDepth = null,
  } = {}
) {
  const blended = blendedDepth !== null ? blendedDepth : depth;
  return {
    timestampMs,
    isValid: true,
    phaseHint,
    eventHints: [],
    qualityHints: [],
    visibilitySummary: {
      averageVisibility: 0.9,
      criticalJointsAvailability: 0.9,
      visibleLandmarkRatio: 0.9,
      leftSideCompleteness: 0.9,
      rightSideCompleteness: 0.9,
    },
    bodyBox: { area: 0.35, width: 0.5, height: 0.7 },
    joints: {
      leftHip: { x: 0.45, y: 0.45 },
      rightHip: { x: 0.55, y: 0.45 },
      leftKnee: { x: 0.44, y: 0.65 },
      rightKnee: { x: 0.56, y: 0.65 },
      leftAnkle: { x: 0.44, y: 0.85 },
      rightAnkle: { x: 0.56, y: 0.85 },
      leftShoulder: { x: 0.42, y: 0.28 },
      rightShoulder: { x: 0.58, y: 0.28 },
      shoulderCenter: { x: 0.5, y: 0.28 },
      hipCenter: { x: 0.5, y: 0.45 },
      ankleCenter: { x: 0.5, y: 0.85 },
      torsoCenter: { x: 0.5, y: 0.365 },
    },
    derived: {
      squatDepthProxy: depth,
      squatDepthProxyRaw: rawDepth !== null ? rawDepth : depth,
      squatDepthProxyBlended: blended,
      squatDepthSource: 'primary',
      squatDepthPrimaryStable: stableDepth !== null ? stableDepth : depth,
      squatDepthPrimaryJumpSuppressed: jumpSuppressed,
      kneeAngleAvg: 170,
      kneeAngleLeft: 170,
      kneeAngleRight: 170,
      kneeAngleGap: 0,
      kneeTrackingRatio: 1.0,
      trunkLeanDeg: 0,
      torsoExtensionDeg: 90,
      weightShiftRatio: 0.1,
      armElevationLeft: 20,
      armElevationRight: 20,
      armElevationAvg: 20,
      armElevationGap: 0,
      elbowAngleLeft: 160,
      elbowAngleRight: 160,
      wristElbowAlignmentLeft: 0.01,
      wristElbowAlignmentRight: 0.01,
      shoulderSymmetry: 0.01,
      pelvicDrop: 0.005,
      swayAmplitude: 0.005,
      holdBalance: 0.9,
      footHeightGap: 0.01,
      footDownDetected: true,
      torsoCorrectionDetected: false,
    },
  };
}

/**
 * 얕은 스쿼트 패턴 프레임 시퀀스 생성.
 * collapseAt: 해당 인덱스에서 primary 가 near-zero 로 붕괴 (stableDepth 는 보정값)
 */
function makeShallowSquatFrames({ collapseAt = null } = {}) {
  const frames = [];
  let ts = 0;

  // 서 있기 (8프레임)
  for (let i = 0; i < 8; i++) {
    frames.push(makeFrame(ts, {
      depth: 0.025, blendedDepth: 0.028, stableDepth: 0.025,
      phaseHint: 'start', rawDepth: 0.025,
    }));
    ts += 100;
  }

  // 하강 (10프레임, depth 0.025 → 0.18)
  for (let i = 0; i < 10; i++) {
    const d = 0.025 + (0.18 - 0.025) * (i / 9);
    const isCollapse = collapseAt !== null && frames.length === collapseAt;
    const rawD = isCollapse ? 0.002 : d;
    const stableD = isCollapse ? d : d; // stable = 정상값
    frames.push(makeFrame(ts, {
      depth: isCollapse ? 0.002 : d,
      blendedDepth: d,
      stableDepth: stableD,
      jumpSuppressed: isCollapse,
      phaseHint: i < 3 ? 'start' : 'descent',
      rawDepth: rawD,
    }));
    ts += 100;
  }

  // bottom (6프레임)
  const peakDepth = 0.18;
  for (let i = 0; i < 6; i++) {
    const isCollapse = collapseAt !== null && frames.length === collapseAt;
    const rawD = isCollapse ? 0.002 : peakDepth;
    frames.push(makeFrame(ts, {
      depth: isCollapse ? 0.002 : peakDepth,
      blendedDepth: peakDepth,
      stableDepth: peakDepth,
      jumpSuppressed: isCollapse,
      phaseHint: 'bottom',
      rawDepth: rawD,
    }));
    ts += 100;
  }

  // 상승 (10프레임, depth 0.18 → 0.025)
  for (let i = 0; i < 10; i++) {
    const d = 0.18 - (0.18 - 0.025) * (i / 9);
    frames.push(makeFrame(ts, {
      depth: d, blendedDepth: d, stableDepth: d,
      phaseHint: i < 8 ? 'ascent' : 'start',
      rawDepth: d,
    }));
    ts += 100;
  }

  // 서 있기 (10프레임)
  for (let i = 0; i < 10; i++) {
    frames.push(makeFrame(ts, {
      depth: 0.025, blendedDepth: 0.028, stableDepth: 0.025,
      phaseHint: 'start', rawDepth: 0.025,
    }));
    ts += 100;
  }

  return frames;
}

// ─── A. 단발 primary 붕괴 → suppressOneFrameDrops + stable primary 복구 ─────

console.log('\n── A. suppressOneFrameDrops: 단발 붕괴 차단 ──');
{
  // 시리즈 중간에 단발 0 붕괴
  const series = [0.01, 0.12, 0.14, 0.003, 0.14, 0.14, 0.12, 0.08, 0.02, 0.01];
  const { values, suppressedCount } = suppressOneFrameDrops(series);

  ok('A1: suppressedCount === 1', suppressedCount === 1, suppressedCount);
  ok('A2: 붕괴 프레임 보간됨 (≈0.14)', Math.abs(values[3] - 0.14) < 0.01, values[3]);
  ok('A3: 인접 프레임 불변', Math.abs(values[2] - 0.14) < 0.001 && Math.abs(values[4] - 0.14) < 0.001);
}

console.log('\n── A-extra. suppressOneFrameDrops: 단발 스파이크 차단 ──');
{
  const series = [0.05, 0.05, 0.48, 0.05, 0.06, 0.07];
  const { values, suppressedCount } = suppressOneFrameDrops(series);

  ok('A4: 스파이크 suppressedCount === 1', suppressedCount === 1, suppressedCount);
  ok('A5: 스파이크 프레임 보간됨', values[2] < 0.15, values[2]);
}

console.log('\n── A-extra2. suppressOneFrameDrops: 정상 하강 시 오탐 없음 ──');
{
  // 정상 점진 하강 — 억제 없음
  const series = [0.02, 0.05, 0.10, 0.15, 0.18, 0.17, 0.12, 0.06, 0.02];
  const { suppressedCount } = suppressOneFrameDrops(series);

  ok('A6: 정상 하강 오탐 없음 (suppressedCount === 0)', suppressedCount === 0, suppressedCount);
}

// ─── A-completion. proxy 피크 + stable 관측 (HOTFIX-04E5: owner 는 proxy 만) ──

console.log('\n── A-completion. rawDepthPeakPrimary (proxy) + rawDepthPeakPrimaryStableObs ──');
{
  // 피크 구간 근처 1프레임에서 primary 붕괴, stableDepth 는 정상값
  const collapseIdx = 17; // bottom 구간 첫 프레임 (index 18 = 8+10+0 → 18)
  const framesWithCollapse = makeShallowSquatFrames({ collapseAt: collapseIdx });

  const state = evaluateSquatCompletionState(framesWithCollapse, {});

  ok(
    'A7: rawDepthPeakPrimary > 0.10 (다른 프레임 proxy 피크로 유지)',
    state.rawDepthPeakPrimary != null && state.rawDepthPeakPrimary > 0.10,
    state.rawDepthPeakPrimary
  );
  ok(
    'A7b: rawDepthPeakPrimaryStableObs > 0.10 (stable 관측이 붕괴 프레임 보정)',
    state.rawDepthPeakPrimaryStableObs != null && state.rawDepthPeakPrimaryStableObs > 0.10,
    state.rawDepthPeakPrimaryStableObs
  );
  ok(
    'A8: relativeDepthPeak 존재',
    typeof state.relativeDepthPeak === 'number' && state.relativeDepthPeak > 0,
    state.relativeDepthPeak
  );
}

// ─── B. 단발 스파이크가 fake peak/reversal 을 만들지 않음 ────────────────────

console.log('\n── B. 단발 스파이크: fake peak / reversal 방지 ──');
{
  // standing + 단발 스파이크 + 다시 standing
  const spFrames = [];
  let ts = 0;

  for (let i = 0; i < 8; i++) {
    spFrames.push(makeFrame(ts, {
      depth: 0.025, blendedDepth: 0.028, stableDepth: 0.025,
      phaseHint: 'start', rawDepth: 0.025,
    }));
    ts += 100;
  }

  // 단발 스파이크: raw 0.55 이지만 pose 파이프라인(suppressOneFrameDrops) 이후 proxy·stable 은 ~0.025.
  // HOTFIX-04E5: completion owner 는 proxy 만 쓰므로, 스모크는 보간된 proxy 를 넣어 fake pass 를 막는다.
  spFrames.push(makeFrame(ts, {
    depth: 0.025,
    blendedDepth: 0.025,
    stableDepth: 0.025,
    jumpSuppressed: true,
    phaseHint: 'unknown',
    rawDepth: 0.55,
  }));
  ts += 100;

  for (let i = 0; i < 15; i++) {
    spFrames.push(makeFrame(ts, {
      depth: 0.025, blendedDepth: 0.028, stableDepth: 0.025,
      phaseHint: 'start', rawDepth: 0.025,
    }));
    ts += 100;
  }

  const state = evaluateSquatCompletionState(spFrames, {});

  ok(
    'B1: completionSatisfied === false (스파이크는 pass 안 됨)',
    state.completionSatisfied === false,
    state.completionSatisfied
  );
  ok(
    'B2: rawDepthPeakPrimary·rawDepthPeakPrimaryStableObs ≤0.05 (보간된 스트림)',
    (state.rawDepthPeakPrimary == null || state.rawDepthPeakPrimary <= 0.05) &&
      (state.rawDepthPeakPrimaryStableObs == null || state.rawDepthPeakPrimaryStableObs <= 0.05),
    { primary: state.rawDepthPeakPrimary, stableObs: state.rawDepthPeakPrimaryStableObs }
  );
}

// ─── C. deep standard cycle 유지 ────────────────────────────────────────────

console.log('\n── C. deep standard cycle: standard_cycle 유지 ──');
{
  const deepFrames = [];
  let ts = 0;

  for (let i = 0; i < 8; i++) {
    deepFrames.push(makeFrame(ts, {
      depth: 0.03, blendedDepth: 0.03, stableDepth: 0.03,
      phaseHint: 'start', rawDepth: 0.03,
    }));
    ts += 100;
  }

  for (let i = 0; i < 12; i++) {
    const d = 0.03 + (0.68 - 0.03) * (i / 11);
    deepFrames.push(makeFrame(ts, {
      depth: d, blendedDepth: d, stableDepth: d,
      phaseHint: i < 4 ? 'descent' : i < 10 ? 'bottom' : 'ascent',
      rawDepth: d,
    }));
    ts += 100;
  }

  for (let i = 0; i < 10; i++) {
    const d = 0.68 - (0.68 - 0.03) * (i / 9);
    deepFrames.push(makeFrame(ts, {
      depth: d, blendedDepth: d, stableDepth: d,
      phaseHint: i < 8 ? 'ascent' : 'start',
      rawDepth: d,
    }));
    ts += 100;
  }

  for (let i = 0; i < 8; i++) {
    deepFrames.push(makeFrame(ts, {
      depth: 0.03, blendedDepth: 0.03, stableDepth: 0.03,
      phaseHint: 'start', rawDepth: 0.03,
    }));
    ts += 100;
  }

  const state = evaluateSquatCompletionState(deepFrames, {});

  ok(
    'C1: deep cycle completionPassReason includes standard_cycle',
    state.completionPassReason === 'standard_cycle',
    state.completionPassReason
  );
  ok(
    'C2: relativeDepthPeak >= 0.40',
    state.relativeDepthPeak >= 0.40,
    state.relativeDepthPeak
  );
}

// ─── D. standing / micro dip 차단 ───────────────────────────────────────────

console.log('\n── D. standing still / micro dip: 여전히 차단 ──');
{
  const standingFrames = [];
  let ts = 0;

  for (let i = 0; i < 30; i++) {
    const d = 0.025 + (i === 12 ? 0.015 : 0); // micro dip
    standingFrames.push(makeFrame(ts, {
      depth: d, blendedDepth: d + 0.003, stableDepth: d,
      phaseHint: 'start', rawDepth: d,
    }));
    ts += 100;
  }

  const state = evaluateSquatCompletionState(standingFrames, {});

  ok(
    'D1: completionSatisfied === false',
    state.completionSatisfied === false,
    state.completionSatisfied
  );
}

// ─── E. 관측 필드 형상 검증 ─────────────────────────────────────────────────

console.log('\n── E. 관측 필드 형상: squatPrimaryStablePeak / squatPrimaryJumpSuppressedCount ──');
{
  const normalFrames = makeShallowSquatFrames();
  const result = evaluateSquatFromPoseFrames(normalFrames);
  const hm = result.debug?.highlightedMetrics;

  ok(
    'E1: highlightedMetrics 존재',
    hm != null,
  );
  ok(
    'E2: squatPrimaryStablePeak 숫자 필드 존재',
    hm != null && typeof hm.squatPrimaryStablePeak === 'number',
    hm?.squatPrimaryStablePeak
  );
  ok(
    'E3: squatPrimaryJumpSuppressedCount 숫자 필드 존재',
    hm != null && typeof hm.squatPrimaryJumpSuppressedCount === 'number',
    hm?.squatPrimaryJumpSuppressedCount
  );
  ok(
    'E4: squatDepthPeakPrimary 기존 필드 유지',
    hm != null && typeof hm.squatDepthPeakPrimary === 'number',
    hm?.squatDepthPeakPrimary
  );
  ok(
    'E5: squatPrimaryStablePeak >= squatDepthPeakPrimary (stable ≥ raw EMA peak)',
    hm != null &&
      typeof hm.squatPrimaryStablePeak === 'number' &&
      typeof hm.squatDepthPeakPrimary === 'number' &&
      hm.squatPrimaryStablePeak >= hm.squatDepthPeakPrimary,
    { stable: hm?.squatPrimaryStablePeak, raw: hm?.squatDepthPeakPrimary }
  );
}

// ─── 집계 ─────────────────────────────────────────────────────────────────

console.log(`\n결과: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exitCode = 1;
}
