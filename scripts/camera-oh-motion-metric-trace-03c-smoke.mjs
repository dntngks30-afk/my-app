/**
 * PR-OH-MOTION-METRIC-TRACE-03C smoke — diagnosisSummary.overhead motion metric separation
 *
 * Run: npx tsx scripts/camera-oh-motion-metric-trace-03c-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { buildAttemptSnapshot } = await import('../src/lib/camera/camera-trace.ts');

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

function baseOhGate({ metrics = [], highlightedMetrics = {} } = {}) {
  return {
    status: 'retry',
    progressionState: 'failed',
    confidence: 0.55,
    completionSatisfied: false,
    nextAllowed: false,
    flags: [],
    reasons: [],
    failureReasons: [],
    userGuidance: [],
    retryRecommended: false,
    evaluatorResult: {
      stepId: 'overhead-reach',
      metrics,
      insufficientSignal: false,
      interpretedSignals: [],
      qualityHints: [],
      completionHints: [],
      debug: { highlightedMetrics },
    },
    guardrail: {
      captureQuality: 'valid',
      flags: [],
      debug: { sampledFrameCount: 12 },
    },
    uiMessage: '',
    autoAdvanceDelayMs: 0,
    passConfirmationSatisfied: false,
    passConfirmationFrameCount: 0,
    passConfirmationWindowCount: 0,
    finalPassEligible: false,
    finalPassBlockedReason: null,
  };
}

console.log('\n[AT1] True peak path — highlightedMetrics.peakArmElevation present');
{
  const gate = baseOhGate({
    metrics: [{ name: 'arm_range', value: 38.5, unit: 'deg', trend: 'concern' }],
    highlightedMetrics: {
      peakArmElevation: 142,
      risePeakArmElevation: 141,
      raiseCount: 3,
      peakCount: 0,
      holdDurationMs: 0,
      meaningfulRiseSatisfied: 1,
    },
  });
  const snap = buildAttemptSnapshot('overhead-reach', gate, undefined, {});
  const oh = snap?.diagnosisSummary?.overhead;
  ok('AT1a: snapshot exists', snap != null);
  ok('AT1b: truePeakArmElevationDeg === 142', oh?.truePeakArmElevationDeg === 142, oh?.truePeakArmElevationDeg);
  ok('AT1c: risePeakArmElevationDeg === 141', oh?.risePeakArmElevationDeg === 141, oh?.risePeakArmElevationDeg);
  ok('AT1d: armElevationTimeAvgDeg === 38.5', oh?.armElevationTimeAvgDeg === 38.5, oh?.armElevationTimeAvgDeg);
  ok('AT1e: peakElevation === true peak (142)', oh?.peakElevation === 142, oh?.peakElevation);
  ok('AT1f: legacyPeakElevationDeg matches peakElevation', oh?.legacyPeakElevationDeg === oh?.peakElevation);
  ok(
    'AT1g: provenance highlighted_metrics_true_peak',
    oh?.exportedPeakElevationProvenance === 'highlighted_metrics_true_peak',
    oh?.exportedPeakElevationProvenance
  );
  ok('AT1h: peakElevationRepresentsTimeAverageFallback === false', oh?.peakElevationRepresentsTimeAverageFallback === false);
  ok('AT1i: armRangeMetricSemantics', oh?.armRangeMetricSemantics === 'time_average_deg');
}

console.log('\n[AT2] Fallback average path — no peakArmElevation, only arm_range');
{
  const gate = baseOhGate({
    metrics: [{ name: 'arm_range', value: 35.2, unit: 'deg', trend: 'concern' }],
    highlightedMetrics: {
      raiseCount: 0,
      peakCount: 0,
      holdDurationMs: 0,
    },
  });
  const oh = buildAttemptSnapshot('overhead-reach', gate, undefined, {})?.diagnosisSummary?.overhead;
  ok('AT2a: truePeakArmElevationDeg undefined', oh?.truePeakArmElevationDeg === undefined, oh?.truePeakArmElevationDeg);
  ok('AT2b: armElevationTimeAvgDeg === 35.2', oh?.armElevationTimeAvgDeg === 35.2);
  ok('AT2c: peakElevation === time average (legacy compat)', oh?.peakElevation === 35.2);
  ok(
    'AT2d: provenance legacy_metrics_arm_range_time_average_fallback',
    oh?.exportedPeakElevationProvenance === 'legacy_metrics_arm_range_time_average_fallback'
  );
  ok('AT2e: peakElevationRepresentsTimeAverageFallback === true', oh?.peakElevationRepresentsTimeAverageFallback === true);
  ok('AT2f: documented — not pretending true peak', oh?.truePeakArmElevationDeg == null && oh?.peakElevationRepresentsTimeAverageFallback);
}

console.log('\n[AT3] Coexistence — peak and average both populated and distinct');
{
  const gate = baseOhGate({
    metrics: [{ name: 'arm_range', value: 42, unit: 'deg', trend: 'concern' }],
    highlightedMetrics: {
      peakArmElevation: 128,
      risePeakArmElevation: 127,
      raiseCount: 2,
      peakCount: 1,
      holdDurationMs: 100,
    },
  });
  const oh = buildAttemptSnapshot('overhead-reach', gate, undefined, {})?.diagnosisSummary?.overhead;
  ok('AT3a: true peak 128, avg 42', oh?.truePeakArmElevationDeg === 128 && oh?.armElevationTimeAvgDeg === 42);
  ok('AT3b: peakElevation uses true peak not average', oh?.peakElevation === 128);
  ok('AT3c: rise peak present', oh?.risePeakArmElevationDeg === 127);
}

console.log('\n[AT4] Unavailable — no peak, no arm_range');
{
  const gate = baseOhGate({
    metrics: [],
    highlightedMetrics: { raiseCount: 0, peakCount: 0, holdDurationMs: 0 },
  });
  const oh = buildAttemptSnapshot('overhead-reach', gate, undefined, {})?.diagnosisSummary?.overhead;
  ok('AT4a: provenance unavailable', oh?.exportedPeakElevationProvenance === 'unavailable');
  ok('AT4b: peakElevation undefined', oh?.peakElevation === undefined);
  ok('AT4c: armRangeMetricSemantics undefined when no arm_range row', oh?.armRangeMetricSemantics === undefined);
}

console.log('\n[AT5] Squat snapshot has no overhead block');
{
  const squatGate = {
    status: 'retry',
    progressionState: 'failed',
    confidence: 0.5,
    completionSatisfied: false,
    nextAllowed: false,
    flags: [],
    reasons: [],
    failureReasons: [],
    userGuidance: [],
    retryRecommended: false,
    evaluatorResult: {
      stepId: 'squat',
      metrics: [],
      insufficientSignal: false,
      interpretedSignals: [],
      qualityHints: [],
      completionHints: [],
      debug: {},
    },
    guardrail: {
      captureQuality: 'valid',
      flags: [],
      debug: {},
    },
    uiMessage: '',
    autoAdvanceDelayMs: 0,
    passConfirmationSatisfied: false,
    passConfirmationFrameCount: 0,
    passConfirmationWindowCount: 0,
    finalPassEligible: false,
    finalPassBlockedReason: null,
  };
  const snap = buildAttemptSnapshot('squat', squatGate, undefined, {});
  ok('AT5: diagnosisSummary.overhead absent for squat', snap?.diagnosisSummary?.overhead === undefined);
}

console.log(`\nPR-OH-MOTION-METRIC-TRACE-03C smoke: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
