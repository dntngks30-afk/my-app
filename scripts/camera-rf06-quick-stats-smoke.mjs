/**
 * RF-06: focused quick-stats smoke test
 * Run: npx tsx scripts/camera-rf06-quick-stats-smoke.mjs
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { getQuickStats } = await import('../src/lib/camera/camera-trace.ts');

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

function eq(name, actual, expected) {
  ok(name, JSON.stringify(actual) === JSON.stringify(expected));
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    console.error('    actual  ', JSON.stringify(actual));
    console.error('    expected', JSON.stringify(expected));
  }
}

function snapshot(id, movementType, outcome, topReasons, flags) {
  return {
    id,
    ts: `2026-04-09T00:00:0${id}Z`,
    movementType,
    outcome,
    captureQuality: outcome === 'invalid' ? 'invalid' : 'good',
    confidence: 0.9,
    motionCompleteness: 'complete',
    progressionPassed: outcome === 'ok',
    finalPassLatched: outcome === 'ok',
    fallbackType: null,
    flags,
    topReasons,
  };
}

console.log('RF-06 quick-stats smoke test\n');

const empty = getQuickStats([]);
eq('QS1: empty input shape is unchanged', empty, {
  byMovement: {
    squat: 0,
    overhead_reach: 0,
  },
  byOutcome: {
    ok: 0,
    low: 0,
    invalid: 0,
    retry_required: 0,
    retry_optional: 0,
    failed: 0,
  },
  topRetryReasons: [],
  topFlags: [],
  okLowInvalidByMovement: {
    squat: { ok: 0, low: 0, invalid: 0 },
    overhead_reach: { ok: 0, low: 0, invalid: 0 },
  },
});

const mixed = getQuickStats([
  snapshot('1', 'squat', 'ok', ['depth_low'], ['needs_cue', 'soft_knees']),
  snapshot('2', 'squat', 'retry_required', ['depth_low', 'stability'], ['needs_cue']),
  snapshot('3', 'overhead_reach', 'low', ['depth_low', 'stability'], ['soft_knees']),
  snapshot('4', 'overhead_reach', 'invalid', ['camera_blocked'], ['camera_reset']),
  snapshot('5', 'overhead_reach', 'failed', [], ['needs_cue']),
]);

eq('QS2: representative mixed input parity is unchanged', mixed, {
  byMovement: {
    squat: 2,
    overhead_reach: 3,
  },
  byOutcome: {
    ok: 1,
    low: 1,
    invalid: 1,
    retry_required: 1,
    retry_optional: 0,
    failed: 1,
  },
  topRetryReasons: [
    { reason: 'depth_low', count: 3 },
    { reason: 'stability', count: 2 },
    { reason: 'camera_blocked', count: 1 },
  ],
  topFlags: [
    { flag: 'needs_cue', count: 3 },
    { flag: 'soft_knees', count: 2 },
    { flag: 'camera_reset', count: 1 },
  ],
  okLowInvalidByMovement: {
    squat: { ok: 1, low: 1, invalid: 0 },
    overhead_reach: { ok: 0, low: 1, invalid: 2 },
  },
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
