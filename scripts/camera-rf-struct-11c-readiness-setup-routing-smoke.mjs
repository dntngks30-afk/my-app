/**
 * PR-RF-STRUCT-11C smoke guard: squat readiness/setup source routing freeze.
 *
 * Run:
 *   npx tsx scripts/camera-rf-struct-11c-readiness-setup-routing-smoke.mjs
 */

import { readFileSync } from 'fs';

let passed = 0;
let failed = 0;

function ok(name, cond) {
  if (cond) {
    passed += 1;
    console.log(`  PASS: ${name}`);
  } else {
    failed += 1;
    console.error(`  FAIL: ${name}`);
    process.exitCode = 1;
  }
}

const source = readFileSync('src/lib/camera/auto-progression.ts', 'utf8');

console.log('\nA. Routing helper presence');
ok('A1: setup truth compat helper exists', source.includes('function readSquatSetupTruthWithCompatFallback'));
ok('A2: readiness/setup gate routing helper exists', source.includes('function resolveSquatReadinessSetupGateInputs'));

console.log('\nB. Source precedence lock');
ok(
  'B1: readinessStableDwellSatisfied prefers setup trace then completion fallback',
  source.includes('squatSetupPhaseTrace?.readinessStableDwellSatisfied ??') &&
    source.includes('squatCompletionState?.readinessStableDwellSatisfied')
);
ok(
  'B2: setupMotionBlocked prefers setup trace then completion fallback',
  source.includes('squatSetupPhaseTrace?.setupMotionBlocked ??') &&
    source.includes('squatCompletionState?.setupMotionBlocked')
);
ok(
  'B3: attemptStartedAfterReady prefers setup trace then completion fallback',
  source.includes('squatSetupPhaseTrace?.attemptStartedAfterReady ??') &&
    source.includes('squatCompletionState?.attemptStartedAfterReady')
);

console.log('\nC. Live-readiness route separation');
ok(
  'C1: live-readiness still comes from getLiveReadinessSummary',
  source.includes('const liveReadinessSummary = getLiveReadinessSummary({')
);
ok('C2: gate live-readiness route uses success:false', source.includes('success: false,'));
ok('C3: gate live-readiness route uses setup framing hint', source.includes('framingHint: getSetupFramingHint(input.landmarks)'));

console.log('\nD. Gate input + mirror stamp from routed values');
ok(
  'D1: main gate input consumes routed readiness/setup values',
  source.includes('liveReadinessNotReady: squatReadinessSetupRoutedSources.liveReadinessNotReady') &&
    source.includes('readinessStableDwellSatisfied:\n          squatReadinessSetupRoutedSources.readinessStableDwellSatisfied') &&
    source.includes('setupMotionBlocked: squatReadinessSetupRoutedSources.setupMotionBlocked')
);
ok(
  'D2: squatCycleDebug setup/readiness fields are stamped from routed values',
  source.includes('liveReadinessSummaryState: squatReadinessSetupRoutedSources?.liveReadinessSummaryState') &&
    source.includes('readinessStableDwellSatisfied:\n        squatReadinessSetupRoutedSources?.readinessStableDwellSatisfied') &&
    source.includes('setupMotionBlocked: squatReadinessSetupRoutedSources?.setupMotionBlocked') &&
    source.includes('setupMotionBlockReason: squatReadinessSetupRoutedSources?.setupMotionBlockReason') &&
    source.includes('attemptStartedAfterReady: squatReadinessSetupRoutedSources?.attemptStartedAfterReady')
);

console.log(`\nPR-RF-STRUCT-11C readiness/setup routing smoke: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
