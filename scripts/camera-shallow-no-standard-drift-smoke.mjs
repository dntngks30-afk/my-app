/**
 * PR-03 shallow closure final — 얕은 완료 후 꼬리가 깊어져도 shallow 로 닫히고 drift 플래그가 켜지지 않는지
 *
 * npx tsx scripts/camera-shallow-no-standard-drift-smoke.mjs
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

console.log('\nPR-03 camera-shallow-no-standard-drift-smoke\n');

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
  ok('prefix shallow win: satisfied', st.completionSatisfied === true, st);
  ok('prefix shallow win: low_rom_cycle', st.completionPassReason === 'low_rom_cycle', st.completionPassReason);
  ok('prefix shallow win: official closed', st.officialShallowPathClosed === true, st);
  ok('prefix shallow win: closedAsOfficialRom proxy (state)', st.officialShallowPathClosed === true, st);
  ok('prefix shallow win: drift false', st.officialShallowDriftedToStandard === false, st);
  ok('prefix shallow win: preferred prefix set', st.officialShallowPreferredPrefixFrameCount != null, st);
  ok(
    'prefix shallow win: chosen truth is shallow peak (prefix), not deep tail',
    st.relativeDepthPeak < 0.15 && st.officialShallowPreferredPrefixFrameCount < all.length,
    { relativeDepthPeak: st.relativeDepthPeak, prefixLen: st.officialShallowPreferredPrefixFrameCount, fullLen: all.length }
  );
}

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
  ok('deep-only: standard preserved', st.completionPassReason === 'standard_cycle', st.completionPassReason);
  ok('deep-only: no shallow drift flag', st.officialShallowDriftedToStandard === false, st);
}

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
