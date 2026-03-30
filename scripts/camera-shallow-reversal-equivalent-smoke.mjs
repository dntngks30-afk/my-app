/**
 * PR-03 rework — primary 역전 미달 + completion 스트림 post-peak return 시 official shallow stream bridge
 *
 * npx tsx scripts/camera-shallow-reversal-equivalent-smoke.mjs
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

/** primary + blended — reversal 모듈은 blended 우선 읽고, rel 피크 소스는 blended 가 질 때 completion 피크가 달라질 수 있음 */
function makeFrameBlend(primary, blended, timestampMs, phaseHint) {
  return {
    timestampMs,
    isValid: true,
    phaseHint,
    derived: { squatDepthProxy: primary, squatDepthProxyBlended: blended },
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
    timestampDeltaMs: 45,
    stepId: 'squat',
  };
}

console.log('\nPR-03 camera-shallow-reversal-equivalent-smoke\n');

// primary 피크 후 거의 평지, blended 는 충분한 복귀 — guarded finalize + bridge
const prim = [
  0.02, 0.02, 0.02, 0.02, 0.02, 0.02,
  0.04, 0.06, 0.08, 0.092, 0.095, 0.095,
  0.094, 0.093, 0.092, 0.091, 0.09, 0.089, 0.088, 0.087, 0.086, 0.085,
  0.05, 0.035, 0.022, 0.018, 0.015, 0.014, 0.013,
];
const blend = [
  0.02, 0.02, 0.02, 0.02, 0.02, 0.02,
  0.05, 0.08, 0.11, 0.125, 0.132, 0.134,
  0.12, 0.1, 0.075, 0.055, 0.042, 0.034, 0.028, 0.024, 0.021, 0.019,
  0.016, 0.014, 0.012, 0.011, 0.01, 0.01, 0.01,
];
const phases = [
  'start', 'start', 'start', 'start', 'start', 'start',
  'descent', 'descent', 'descent', 'bottom', 'bottom', 'bottom',
  'ascent', 'ascent', 'ascent', 'ascent', 'ascent', 'ascent', 'ascent', 'ascent', 'ascent', 'ascent',
  'start', 'start', 'start', 'start', 'start', 'start', 'start',
];
const stepMs = 70;
const frames = prim.map((p, i) => makeFrameBlend(p, blend[i] ?? p, 200 + i * stepMs, phases[i] ?? 'start'));

const st = evaluateSquatCompletionState(frames);

ok('dual-stream: shallow pass', st.completionSatisfied === true, st);
ok('dual-stream: official candidate+admitted+closed', st.officialShallowPathClosed === true, st);
ok('dual-stream: low_rom_cycle family', st.completionPassReason === 'low_rom_cycle', st.completionPassReason);
ok('dual-stream: blended completion source', st.relativeDepthPeakSource === 'blended', st.relativeDepthPeakSource);
ok('dual-stream: reversal truth after descend', st.reversalConfirmedAfterDescend === true, st);
ok(
  'dual-stream: provenance strict_rule or shallow bridge',
  st.reversalEvidenceProvenance === 'official_shallow_stream_bridge' ||
    st.reversalEvidenceProvenance === 'strict_rule',
  st.reversalEvidenceProvenance
);
ok(
  'dual-stream: closure proof when bridge applied',
  st.officialShallowStreamBridgeApplied !== true || st.officialShallowClosureProofSatisfied === true,
  st
);
ok('dual-stream: trajectory rescue not assist owner', st.trajectoryReversalRescueApplied !== true, st.trajectoryReversalRescueApplied);
ok('dual-stream: not event rescue pass reason', !String(st.completionPassReason).includes('event_cycle'), st.completionPassReason);

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
