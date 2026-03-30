/**
 * PR-03 final — shallow 프리픽스 closure 가 full-buffer standard drift 보다 우선하는지
 *
 * npx tsx scripts/camera-shallow-closure-before-standard-drift-smoke.mjs
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { evaluateSquatCompletionState } = await import('../src/lib/camera/squat-completion-state.ts');

const STANDARD_OWNER_FLOOR = 0.4;

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

function makeFrame(depth, timestampMs, phaseHint) {
  return {
    timestampMs,
    isValid: true,
    phaseHint,
    derived: { squatDepthProxy: depth },
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

console.log('\nPR-03 camera-shallow-closure-before-standard-drift-smoke\n');

// 1) 얕은 사이클 완료 후 동일 캡처에 깊은 excursion 추가 → shallow 로 닫혀야 함
{
  const shallowDepths = [
    0.01, 0.01, 0.01, 0.01, 0.03, 0.05, 0.07, 0.09, 0.09, 0.07, 0.05, 0.03, 0.02, 0.01, 0.01,
  ];
  const shallowPhases = [
    'start', 'start', 'start', 'start', 'descent', 'descent', 'descent', 'bottom', 'bottom', 'ascent', 'ascent', 'ascent', 'start', 'start', 'start',
  ];
  let t = 100;
  const shallowFrames = shallowDepths.map((d, i) => makeFrame(d, (t += 80), shallowPhases[i]));
  const deepTailDepths = [
    0.01, 0.01, 0.02, 0.08, 0.18, 0.32, 0.48, 0.52, 0.55, 0.52, 0.38, 0.22, 0.1, 0.02, 0.01,
    0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01,
  ];
  const deepTailPhases = [
    'start', 'start', 'descent', 'descent', 'descent', 'descent', 'bottom', 'bottom', 'bottom', 'ascent', 'ascent', 'ascent', 'ascent', 'start', 'start',
    'start', 'start', 'start', 'start', 'start', 'start', 'start', 'start', 'start', 'start', 'start', 'start',
  ];
  const stepDeep = 75;
  const deepFrames = deepTailDepths.map((d, i) => makeFrame(d, (t += stepDeep), deepTailPhases[i]));
  const all = [...shallowFrames, ...deepFrames];
  const st = evaluateSquatCompletionState(all);
  ok('drift-fix: pass', st.completionSatisfied === true, st);
  ok('drift-fix: low_rom_cycle (not standard)', st.completionPassReason === 'low_rom_cycle', st.completionPassReason);
  ok('drift-fix: official closed', st.officialShallowPathClosed === true, st);
  ok('drift-fix: rel peak stays shallow owner', st.relativeDepthPeak < STANDARD_OWNER_FLOOR, st.relativeDepthPeak);
  ok('drift-fix: preferred prefix < full length', st.officialShallowPreferredPrefixFrameCount != null && st.officialShallowPreferredPrefixFrameCount < all.length, st);
  ok('drift-fix: not drift flag', st.officialShallowDriftedToStandard === false, st);
  ok('drift-fix: not event rescue', !String(st.completionPassReason).includes('event_cycle'), st.completionPassReason);
}

// 2) moderate/deep 단일 시도 — standard_cycle 유지
{
  const depths = [
    0.01, 0.01, 0.01, 0.01, 0.1, 0.22, 0.36, 0.52, 0.52, 0.36, 0.22, 0.1, 0.02, 0.01, 0.01,
  ];
  const phases = [
    'start', 'start', 'start', 'start', 'descent', 'descent', 'descent', 'bottom', 'bottom', 'ascent', 'ascent', 'ascent', 'start', 'start', 'start',
  ];
  let t = 200;
  const fr = depths.map((d, i) => makeFrame(d, (t += 60), phases[i]));
  const st = evaluateSquatCompletionState(fr);
  ok('deep-only: standard_cycle', st.completionPassReason === 'standard_cycle', st.completionPassReason);
  ok('deep-only: rel peak owner band', st.relativeDepthPeak >= STANDARD_OWNER_FLOOR - 0.05, st.relativeDepthPeak);
  ok('deep-only: no shallow drift flag', st.officialShallowDriftedToStandard === false, st);
  ok('deep-only: no prefix override', st.officialShallowPreferredPrefixFrameCount == null, st);
}

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
