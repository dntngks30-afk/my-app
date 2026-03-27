/**
 * PR-HMM-01B smoke test — squat HMM shadow decoder quality
 *
 * 검증 목표:
 *   A. full cycle (deep)        → completionCandidate true
 *   B. shallow meaningful cycle  → completionCandidate true
 *   C. standing jitter only      → completionCandidate false
 *   D. descent-only no recovery  → completionCandidate false
 *   E. ascent-like noise only    → completionCandidate false
 *   F. ultra-low-ROM guarded finalize과 별개인 HMM candidate true case (synthetic)
 *
 * 이 smoke는 completionSatisfied 검사가 아니라 shadow decoder quality 검사다.
 * completionSatisfied / guarded finalize semantics는 건드리지 않는다.
 *
 * 실행:
 *   npx tsx scripts/camera-pr-hmm-01b-squat-shadow-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { decodeSquatHmm } = await import('../src/lib/camera/squat/squat-hmm.ts');

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

/**
 * PoseFeaturesFrame minimal mock.
 * HMM은 derived.squatDepthProxy만 사용한다.
 */
function makeFrame(depth, timestampMs = 0, phaseHint = 'start') {
  return {
    timestampMs,
    isValid: typeof depth === 'number',
    phaseHint,
    derived: {
      squatDepthProxy: typeof depth === 'number' ? depth : undefined,
    },
    visibilitySummary: {
      averageVisibility: 0.9,
      criticalJointsAvailability: 0.9,
      visibleLandmarkRatio: 0.9,
      leftSideCompleteness: 0.9,
      rightSideCompleteness: 0.9,
    },
    bodyBox: { area: 0.35, width: 0.4, height: 0.8 },
    qualityHints: [],
    frameValidity: typeof depth === 'number' ? 'valid' : 'invalid',
    joints: {},
    eventHints: [],
    timestampDeltaMs: 33,
    stepId: 'squat',
  };
}

function buildFrames(depthArray, startMs = 0, stepMs = 33) {
  return depthArray.map((d, i) => makeFrame(d, startMs + i * stepMs));
}

// ─── A. Full cycle (deep squat) ───────────────────────────────────────────────
console.log('\n── A. Full cycle (deep squat) ──');
{
  // standing 5 → descent 4 → bottom 3 → ascent 4 → standing 4
  const depths = [
    // standing
    0.005, 0.006, 0.005, 0.007, 0.006,
    // descent
    0.025, 0.050, 0.085, 0.115,
    // bottom
    0.140, 0.145, 0.142,
    // ascent
    0.110, 0.075, 0.040, 0.015,
    // standing
    0.007, 0.006, 0.007, 0.005,
  ];
  const frames = buildFrames(depths);
  const result = decodeSquatHmm(frames);
  ok('completionCandidate = true', result.completionCandidate, result);
  ok('confidence > 0.5', result.confidence > 0.5, result.confidence);
  ok('peakDepth > 0.1', result.peakDepth > 0.1, result.peakDepth);
  ok('effectiveExcursion > 0.018', result.effectiveExcursion > 0.018, result.effectiveExcursion);
  ok('descent count >= 2', result.dominantStateCounts.descent >= 2, result.dominantStateCounts);
  ok('bottom count >= 1', result.dominantStateCounts.bottom >= 1, result.dominantStateCounts);
  ok('ascent count >= 2', result.dominantStateCounts.ascent >= 2, result.dominantStateCounts);
}

// ─── B. Shallow meaningful cycle ──────────────────────────────────────────────
console.log('\n── B. Shallow meaningful cycle ──');
{
  // standing 5 → descent 3 → bottom 2 → ascent 3 → standing 5
  const depths = [
    // standing
    0.004, 0.005, 0.004, 0.006, 0.005,
    // descent
    0.018, 0.032, 0.045,
    // bottom
    0.055, 0.058,
    // ascent
    0.038, 0.022, 0.008,
    // standing
    0.005, 0.006, 0.005, 0.004, 0.005,
  ];
  const frames = buildFrames(depths);
  const result = decodeSquatHmm(frames);
  ok('completionCandidate = true', result.completionCandidate, result.notes);
  ok('confidence > 0', result.confidence > 0, result.confidence);
  ok('effectiveExcursion >= 0.018', result.effectiveExcursion >= 0.018, result.effectiveExcursion);
}

// ─── C. Standing jitter only ──────────────────────────────────────────────────
console.log('\n── C. Standing jitter only ──');
{
  // 모두 standing band 내 소진폭 진동
  const depths = [
    0.004, 0.006, 0.005, 0.007, 0.006, 0.005, 0.004, 0.006,
    0.005, 0.004, 0.006, 0.005, 0.007, 0.005, 0.006, 0.004,
  ];
  const frames = buildFrames(depths);
  const result = decodeSquatHmm(frames);
  ok('completionCandidate = false (jitter)', !result.completionCandidate, result.notes);
  ok('effectiveExcursion < 0.018 (jitter)', result.effectiveExcursion < 0.018, result.effectiveExcursion);
}

// ─── D. Descent-only, no recovery ─────────────────────────────────────────────
console.log('\n── D. Descent-only (no recovery) ──');
{
  // 내려가다가 멈춤 — ascent 없음
  const depths = [
    0.005, 0.006, 0.005, 0.007,
    0.020, 0.040, 0.065, 0.080, 0.090, 0.092, 0.091,
  ];
  const frames = buildFrames(depths);
  const result = decodeSquatHmm(frames);
  ok('completionCandidate = false (no ascent)', !result.completionCandidate, result.notes);
}

// ─── E. Ascent-like noise only ────────────────────────────────────────────────
console.log('\n── E. Ascent-like noise (no descend) ──');
{
  // 계속 서 있다가 살짝 올라가는 척 (노이즈)
  const depths = [
    0.005, 0.004, 0.008, 0.006, 0.003, 0.005, 0.004, 0.006,
    0.007, 0.005, 0.004, 0.006, 0.007, 0.005, 0.003, 0.004,
  ];
  const frames = buildFrames(depths);
  const result = decodeSquatHmm(frames);
  ok('completionCandidate = false (noise only)', !result.completionCandidate, result.notes);
  ok('effectiveExcursion < 0.018 (noise)', result.effectiveExcursion < 0.018, result.effectiveExcursion);
}

// ─── F. Ultra-low-ROM style: HMM candidate (guarded finalize와 독립) ───────────
console.log('\n── F. Ultra-low-ROM HMM candidate (independent of guarded finalize) ──');
{
  // ultra-low ROM 범위(0.03–0.08) 사이클 — 충분한 프레임으로 Viterbi dwell 충족
  // rule-based pass는 guarded finalize 조건 별도 체크지만,
  // HMM은 temporal cycle 구조만 보므로 candidate = true를 줄 수 있어야 함
  const depths = [
    // standing
    0.004, 0.005, 0.004, 0.006, 0.005,
    // descent (5 frames, deltas clearly positive)
    0.012, 0.022, 0.032, 0.044, 0.056,
    // bottom (3 frames, near peak with ~0 delta)
    0.062, 0.064, 0.062,
    // ascent (5 frames, deltas clearly negative)
    0.052, 0.038, 0.025, 0.013, 0.006,
    // standing recovery
    0.005, 0.006, 0.005, 0.004, 0.005,
  ];
  const frames = buildFrames(depths);
  const result = decodeSquatHmm(frames);
  ok('F: completionCandidate = true (ultra-low HMM)', result.completionCandidate, result.notes);
  ok('F: effectiveExcursion >= 0.018', result.effectiveExcursion >= 0.018, result.effectiveExcursion);
  ok('F: confidence > 0', result.confidence > 0, result.confidence);
}

// ─── Invalid frame handling ───────────────────────────────────────────────────
console.log('\n── G. Mixed null/invalid frames (soft penalty) ──');
{
  // 일부 프레임이 null (카메라 트래킹 실패)
  // HMM은 null을 제거하지 않고 낮은 emission confidence로 처리해야 함
  // null 주변에 충분한 유효 프레임을 두어 Viterbi dwell 조건 충족
  const rawDepths = [
    // standing
    0.005, null, 0.006, 0.005, null, 0.006,
    // descent (6 valid with 1 null = 5 valid)
    0.020, null, 0.042, 0.065, 0.090, 0.115,
    // bottom (3 valid with 1 null)
    0.140, null, 0.138, 0.135,
    // ascent (5 valid with 1 null)
    0.110, 0.080, null, 0.045, 0.020, 0.008,
    // standing
    0.006, null, 0.005, 0.006, 0.005,
  ];
  const frames = rawDepths.map((d, i) => makeFrame(d, i * 33));
  const result = decodeSquatHmm(frames);
  ok('G: decodeSquatHmm does not throw on null frames', true);
  ok('G: sequence length = frame count', result.sequence.length === frames.length, result.sequence.length);
  // null 프레임이 섞여도 meaningful한 cycle이면 candidate true 가능
  ok('G: completionCandidate = true despite nulls', result.completionCandidate, result.notes);
}

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n══ Result: ${passed} passed, ${failed} failed ══\n`);
if (failed > 0) process.exitCode = 1;
