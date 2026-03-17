/**
 * Public camera live readiness smoke test
 * Run: npx tsx scripts/camera-live-readiness-smoke.mjs
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const {
  getGuideToneFromLiveReadiness,
  getLiveReadinessState,
} = await import('../src/lib/camera/live-readiness.ts');

let passed = 0;
let failed = 0;

function ok(name, cond) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}`);
  }
}

function createGuardrail(overrides = {}) {
  return {
    captureQuality: 'ok',
    flags: [],
    debug: {
      validFrameCount: 12,
      visibleJointsRatio: 0.72,
      criticalJointsAvailability: 0.78,
      leftSideCompleteness: 0.82,
      rightSideCompleteness: 0.84,
    },
    ...overrides,
  };
}

console.log('Camera live readiness smoke test\n');

const successState = getLiveReadinessState({
  success: true,
  guardrail: createGuardrail({ captureQuality: 'invalid' }),
});
ok('AT1: success wins over non-ready guardrail', successState === 'success');
ok('AT1b: success maps to green tone', getGuideToneFromLiveReadiness(successState) === 'success');

const readyLowQualityState = getLiveReadinessState({
  success: false,
  guardrail: createGuardrail({
    captureQuality: 'low',
    flags: ['rep_incomplete'],
    debug: {
      validFrameCount: 10,
      visibleJointsRatio: 0.61,
      criticalJointsAvailability: 0.7,
      leftSideCompleteness: 0.68,
      rightSideCompleteness: 0.7,
    },
  }),
});
ok('AT2: low-quality but usable state is ready', readyLowQualityState === 'ready');
ok('AT2b: ready maps to white tone', getGuideToneFromLiveReadiness(readyLowQualityState) === 'neutral');

const invalidState = getLiveReadinessState({
  success: false,
  guardrail: createGuardrail({
    captureQuality: 'invalid',
    flags: ['framing_invalid'],
    debug: {
      validFrameCount: 2,
      visibleJointsRatio: 0.3,
      criticalJointsAvailability: 0.28,
      leftSideCompleteness: 0.4,
      rightSideCompleteness: 0.42,
    },
  }),
});
ok('AT3: invalid framing stays not_ready', invalidState === 'not_ready');
ok('AT3b: not_ready maps to red tone', getGuideToneFromLiveReadiness(invalidState) === 'warning');

const crossMotionParityState = getLiveReadinessState({
  success: false,
  guardrail: createGuardrail({
    captureQuality: 'low',
    flags: ['hold_too_short'],
    debug: {
      validFrameCount: 9,
      visibleJointsRatio: 0.63,
      criticalJointsAvailability: 0.75,
      leftSideCompleteness: 0.66,
      rightSideCompleteness: 0.67,
    },
  }),
});
ok('AT4: motion incompleteness does not force not_ready', crossMotionParityState === 'ready');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
