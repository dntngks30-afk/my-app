/**
 * PR-RF-STRUCT-11A smoke guard: squat owner truth read boundary unification.
 *
 * Run:
 *   npx tsx scripts/camera-rf-struct-11a-owner-read-boundary-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { isFinalPassLatched, readSquatPassOwnerTruth } = await import(
  '../src/lib/camera/auto-progression.ts'
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

function makeSquatGate(opts) {
  const squatCompletionState = {
    completionSatisfied: opts.completionSatisfied ?? true,
    completionPassReason: opts.completionPassReason ?? 'standard_cycle',
    completionBlockedReason: opts.completionBlockedReason ?? null,
    currentSquatPhase: opts.currentSquatPhase ?? 'standing_recovered',
    readinessStableDwellSatisfied: opts.readinessStableDwellSatisfied ?? true,
    setupMotionBlocked: opts.setupMotionBlocked ?? false,
  };

  const debug = {
    squatCompletionState,
    squatSetupPhaseTrace: {
      readinessStableDwellSatisfied: opts.readinessStableDwellSatisfied ?? true,
      setupMotionBlocked: opts.setupMotionBlocked ?? false,
      setupMotionBlockReason: null,
    },
  };

  if (opts.omitPassCore !== true) {
    debug.squatPassCore = {
      passDetected: opts.passDetected ?? true,
      passBlockedReason: opts.passBlockedReason ?? null,
    };
  }

  return {
    completionSatisfied: opts.gateCompletionSatisfied ?? squatCompletionState.completionSatisfied,
    confidence: opts.confidence ?? 0.63,
    passConfirmationSatisfied: opts.passConfirmationSatisfied ?? true,
    passConfirmationFrameCount: opts.passConfirmationFrameCount ?? 3,
    squatCycleDebug: {
      captureArmingSatisfied: opts.captureArmingSatisfied ?? true,
      liveReadinessSummaryState: opts.liveReadinessSummaryState,
      readinessStableDwellSatisfied: opts.readinessStableDwellSatisfied ?? true,
      setupMotionBlocked: opts.setupMotionBlocked ?? false,
    },
    guardrail: {
      captureQuality: opts.captureQuality ?? 'ok',
      flags: opts.flags ?? [],
      retryRecommended: false,
      completionStatus: opts.guardrailCompletionStatus ?? 'complete',
    },
    evaluatorResult: {
      metrics: [],
      qualityHints: [],
      completionHints: [],
      interpretedSignals: [],
      debug,
    },
  };
}

function readOwnerFromGate(gate) {
  return readSquatPassOwnerTruth({
    squatCompletionState: gate.evaluatorResult.debug.squatCompletionState,
    squatPassCore: gate.evaluatorResult.debug.squatPassCore,
  });
}

console.log('\nA. Structural read boundary');
{
  const source = readFileSync('src/lib/camera/auto-progression.ts', 'utf8');
  const helperCalls = [...source.matchAll(/readSquatPassOwnerTruth\(/g)].length;
  ok('A1: shared adapter is exported and used by both call sites', helperCalls >= 3, helperCalls);
  ok(
    'A2: fallback latch no longer calls computeSquatCompletionOwnerTruth inline',
    !source
      .slice(source.indexOf('export function isFinalPassLatched'), source.indexOf('export function getCameraGuideTone'))
      .includes('computeSquatCompletionOwnerTruth(')
  );
}

console.log('\nB. Main-path owner interpretation mirrors prior pass-core inline mapping');
{
  const gate = makeSquatGate({
    passDetected: true,
    passBlockedReason: null,
    completionPassReason: 'standard_cycle',
  });
  const owner = readOwnerFromGate(gate);
  ok('B1: standard cycle owner passes from passCore', owner.completionOwnerPassed === true, owner);
  ok('B2: standard cycle final latch still passes', isFinalPassLatched('squat', gate) === true);
}

console.log('\nC. Official shallow path remains accessible');
{
  const gate = makeSquatGate({
    passDetected: true,
    passBlockedReason: null,
    completionPassReason: 'official_shallow_cycle',
    confidence: 0.58,
    passConfirmationFrameCount: 2,
  });
  const owner = readOwnerFromGate(gate);
  ok('C1: official shallow owner passes from passCore', owner.completionOwnerPassed === true, owner);
  ok('C2: official shallow final latch still passes at easy threshold', isFinalPassLatched('squat', gate) === true);
}

console.log('\nD. Premature/non-cycle input remains blocked by pass-core owner');
{
  const gate = makeSquatGate({
    passDetected: false,
    passBlockedReason: 'no_reversal_after_peak',
    completionSatisfied: true,
    completionPassReason: 'standard_cycle',
    currentSquatPhase: 'standing_recovered',
  });
  const owner = readOwnerFromGate(gate);
  ok('D1: pass-core block wins over completion-looking state', owner.completionOwnerPassed === false, owner);
  ok('D2: final latch fallback uses the same blocked owner truth', isFinalPassLatched('squat', gate) === false);
}

console.log('\nE. Legacy no-passCore boundary remains explicit');
{
  const gate = makeSquatGate({
    omitPassCore: true,
    completionSatisfied: true,
    completionPassReason: 'standard_cycle',
    currentSquatPhase: 'standing_recovered',
  });
  const owner = readOwnerFromGate(gate);
  ok('E1: no-passCore legacy fallback stays behavior-preserving', owner.completionOwnerPassed === true, owner);
}

console.log(`\nPR-RF-STRUCT-11A owner read-boundary smoke: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
