/**
 * PR-5 -- Quality Semantics Split.
 *
 * Smoke coverage for SSOT §4.4 quality-vs-pass separation:
 *   - `confidence_too_low`, `hard_partial`, `capture_quality_low`, and
 *     `standard_cycle_signal_integrity` must NOT overturn a legitimate pass
 *     when completion-owner truth is already passed and PR-2 false-pass
 *     guard is clear (for shallow) / owner-law is satisfied (for standard).
 *   - Quality signals must still be visible post-pass as warnings (not
 *     silently dropped).
 *   - Confidence decouple must NOT open pass for no-cycle motion
 *     (`completionOwnerPassed === false` keeps confidence as a hard gate).
 *   - `capture_quality_invalid` / severe-invalid captures stay hard gates.
 *   - hard_partial retry routing unchanged for decouple-eligible path.
 *   - PR-2 false-pass guard stays independent from the quality split.
 *
 * Run:
 *   npx tsx scripts/camera-pr-cam-squat-quality-semantics-split-05-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const {
  isSquatLowQualityPassDecoupleEligible,
  isSquatConfidencePassDecoupleEligible,
  getSquatQualityOnlyWarnings,
  squatPassProgressionIntegrityBlock,
  squatRetryTriggeredByPartialFramingReasons,
  readSquatQualitySemanticsSplitSnapshot,
  readOfficialShallowFalsePassGuardSnapshot,
} = await import('../src/lib/camera/squat/squat-progression-contract.ts');

const {
  computeSquatUiProgressionLatchGate,
} = await import('../src/lib/camera/squat/squat-ui-progression-latch-gate.ts');

let passed = 0;
let failed = 0;

function ok(label, cond, detail) {
  if (cond) {
    passed += 1;
    // console.log(`  OK  ${label}`);
  } else {
    failed += 1;
    console.error(`  FAIL ${label}${detail ? ` -- ${JSON.stringify(detail)}` : ''}`);
  }
}

const passThreshold = 0.62;
const lowConfidence = 0.45;
const goodConfidence = 0.8;

function baseGateInput(overrides = {}) {
  return {
    completionOwnerPassed: true,
    guardrailCompletionComplete: true,
    captureQualityInvalid: false,
    confidence: goodConfidence,
    passThresholdEffective: passThreshold,
    effectivePassConfirmation: true,
    passConfirmationFrameCount: 3,
    framesReq: 3,
    captureArmingSatisfied: true,
    squatIntegrityBlockForPass: null,
    reasons: [],
    hardBlockerReasons: [],
    liveReadinessNotReady: false,
    readinessStableDwellSatisfied: true,
    setupMotionBlocked: false,
    officialShallowOwnerFrozen: false,
    confidenceDecoupleEligible: false,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════
// 1) confidence decouple eligibility helper
// ═══════════════════════════════════════════════════════════════════

{
  const eligibleBase = {
    stepId: 'squat',
    completionOwnerPassed: true,
    completionSatisfied: true,
    guardrail: { captureQuality: 'low' },
    severeInvalid: false,
    effectivePassConfirmation: true,
  };

  ok(
    '1.1 confidence decouple eligible when owner-pass + cycle + not-invalid + pass-confirm',
    isSquatConfidencePassDecoupleEligible(eligibleBase) === true
  );
  ok(
    '1.2 confidence decouple BLOCKS when completionOwnerPassed=false (no cycle / no PR-2)',
    isSquatConfidencePassDecoupleEligible({ ...eligibleBase, completionOwnerPassed: false }) === false
  );
  ok(
    '1.3 confidence decouple BLOCKS when completionSatisfied=false',
    isSquatConfidencePassDecoupleEligible({ ...eligibleBase, completionSatisfied: false }) === false
  );
  ok(
    '1.4 confidence decouple BLOCKS on captureQuality=invalid',
    isSquatConfidencePassDecoupleEligible({
      ...eligibleBase,
      guardrail: { captureQuality: 'invalid' },
    }) === false
  );
  ok(
    '1.5 confidence decouple BLOCKS on severeInvalid',
    isSquatConfidencePassDecoupleEligible({ ...eligibleBase, severeInvalid: true }) === false
  );
  ok(
    '1.6 confidence decouple BLOCKS without pass-confirmation',
    isSquatConfidencePassDecoupleEligible({ ...eligibleBase, effectivePassConfirmation: false }) === false
  );
  ok(
    '1.7 confidence decouple BLOCKS on non-squat step',
    isSquatConfidencePassDecoupleEligible({ ...eligibleBase, stepId: 'overhead-reach' }) === false
  );
  ok(
    '1.8 confidence decouple eligible with captureQuality=valid (owner-pass sufficient)',
    isSquatConfidencePassDecoupleEligible({
      ...eligibleBase,
      guardrail: { captureQuality: 'valid' },
    }) === true
  );
}

// ═══════════════════════════════════════════════════════════════════
// 2) UI gate: confidence demoted when eligible
// ═══════════════════════════════════════════════════════════════════

{
  const gate = computeSquatUiProgressionLatchGate(
    baseGateInput({ confidence: lowConfidence, confidenceDecoupleEligible: true })
  );
  ok(
    '2.1 legitimate pass survives low confidence when decouple eligible',
    gate.uiProgressionAllowed === true,
    gate
  );
  ok('2.2 blockedReason null when demoted', gate.uiProgressionBlockedReason === null, gate);
  ok('2.3 confidenceDecoupleApplied=true observable', gate.confidenceDecoupleApplied === true, gate);
}

{
  const gate = computeSquatUiProgressionLatchGate(
    baseGateInput({ confidence: lowConfidence, confidenceDecoupleEligible: false })
  );
  ok(
    '2.4 legacy behavior: confidence_too_low still blocks when decouple NOT eligible',
    gate.uiProgressionAllowed === false &&
      gate.uiProgressionBlockedReason != null &&
      gate.uiProgressionBlockedReason.startsWith('confidence_too_low:'),
    gate
  );
  ok('2.5 decoupleApplied=false when not eligible', gate.confidenceDecoupleApplied === false);
}

{
  const gate = computeSquatUiProgressionLatchGate(
    baseGateInput({ confidence: goodConfidence, confidenceDecoupleEligible: true })
  );
  ok(
    '2.6 normal confidence: decoupleApplied=false even when eligible (no demotion needed)',
    gate.uiProgressionAllowed === true &&
      gate.confidenceDecoupleApplied === false,
    gate
  );
}

// ═══════════════════════════════════════════════════════════════════
// 3) UI gate: capture_quality_invalid stays hard gate even with decouple
// ═══════════════════════════════════════════════════════════════════

{
  const gate = computeSquatUiProgressionLatchGate(
    baseGateInput({
      confidence: lowConfidence,
      confidenceDecoupleEligible: true,
      captureQualityInvalid: true,
    })
  );
  ok(
    '3.1 capture_quality_invalid remains a hard gate even when confidence decouple eligible',
    gate.uiProgressionAllowed === false &&
      gate.uiProgressionBlockedReason === 'capture_quality_invalid',
    gate
  );
}

// ═══════════════════════════════════════════════════════════════════
// 4) UI gate: no-cycle motion stays blocked (owner not passed)
// ═══════════════════════════════════════════════════════════════════

{
  const gate = computeSquatUiProgressionLatchGate(
    baseGateInput({
      completionOwnerPassed: false,
      confidence: lowConfidence,
      // even if caller accidentally asked for decouple, owner-not-passed short-circuits first
      confidenceDecoupleEligible: true,
    })
  );
  ok(
    '4.1 no-cycle motion still blocks at completion_owner_not_satisfied (decouple cannot open)',
    gate.uiProgressionAllowed === false &&
      gate.uiProgressionBlockedReason === 'completion_owner_not_satisfied',
    gate
  );
}

// ═══════════════════════════════════════════════════════════════════
// 5) UI gate: cycle truth gates (pass-confirmation, integrity, hard blockers)
// still close after decouple
// ═══════════════════════════════════════════════════════════════════

{
  const gate = computeSquatUiProgressionLatchGate(
    baseGateInput({
      confidence: lowConfidence,
      confidenceDecoupleEligible: true,
      effectivePassConfirmation: false,
    })
  );
  ok(
    '5.1 decouple does not bypass pass_confirmation_not_ready',
    gate.uiProgressionAllowed === false &&
      gate.uiProgressionBlockedReason === 'pass_confirmation_not_ready' &&
      gate.confidenceDecoupleApplied === true,
    gate
  );
}

{
  const gate = computeSquatUiProgressionLatchGate(
    baseGateInput({
      confidence: lowConfidence,
      confidenceDecoupleEligible: true,
      squatIntegrityBlockForPass: 'standard_cycle_signal_integrity:hard_partial',
    })
  );
  ok(
    '5.2 decouple does not bypass leftover integrity block (caller may still have raw block)',
    gate.uiProgressionAllowed === false &&
      gate.uiProgressionBlockedReason === 'standard_cycle_signal_integrity:hard_partial' &&
      gate.confidenceDecoupleApplied === true,
    gate
  );
}

{
  const gate = computeSquatUiProgressionLatchGate(
    baseGateInput({
      confidence: lowConfidence,
      confidenceDecoupleEligible: true,
      reasons: ['valid_frames_too_few'],
      hardBlockerReasons: ['valid_frames_too_few'],
    })
  );
  ok(
    '5.3 decouple does not bypass hard blockers (valid_frames_too_few)',
    gate.uiProgressionAllowed === false &&
      gate.uiProgressionBlockedReason === 'hard_blocker:valid_frames_too_few' &&
      gate.confidenceDecoupleApplied === true,
    gate
  );
}

// ═══════════════════════════════════════════════════════════════════
// 6) UI gate: readiness / setup gates still close after decouple
// ═══════════════════════════════════════════════════════════════════

{
  const gate = computeSquatUiProgressionLatchGate(
    baseGateInput({
      confidence: lowConfidence,
      confidenceDecoupleEligible: true,
      setupMotionBlocked: true,
    })
  );
  ok(
    '6.1 decouple does not bypass setup_motion_blocked',
    gate.uiProgressionAllowed === false &&
      gate.uiProgressionBlockedReason === 'setup_motion_blocked',
    gate
  );
}

{
  const gate = computeSquatUiProgressionLatchGate(
    baseGateInput({
      confidence: lowConfidence,
      confidenceDecoupleEligible: true,
      captureArmingSatisfied: false,
    })
  );
  ok(
    '6.2 decouple does not bypass minimum_cycle_duration_not_met (arming)',
    gate.uiProgressionAllowed === false &&
      gate.uiProgressionBlockedReason === 'minimum_cycle_duration_not_met',
    gate
  );
}

// ═══════════════════════════════════════════════════════════════════
// 7) UI gate: shallow owner-freeze pre-empts everything (PR-1 ownership
// preserved independent of PR-5 decouple)
// ═══════════════════════════════════════════════════════════════════

{
  const gate = computeSquatUiProgressionLatchGate(
    baseGateInput({
      confidence: lowConfidence,
      confidenceDecoupleEligible: true,
      officialShallowOwnerFrozen: true,
      setupMotionBlocked: true, // normally would block, but freeze overrides
    })
  );
  ok(
    '7.1 owner-freeze still grants pass regardless of PR-5 decouple or setup block',
    gate.uiProgressionAllowed === true && gate.uiProgressionBlockedReason === null,
    gate
  );
}

// ═══════════════════════════════════════════════════════════════════
// 8) quality-only warnings -- confidence_too_low appears post-pass
// ═══════════════════════════════════════════════════════════════════

{
  const warnings = getSquatQualityOnlyWarnings({
    guardrail: { captureQuality: 'low', flags: ['hard_partial'] },
    rawIntegrityBlock: 'standard_cycle_signal_integrity:hard_partial',
    decoupleEligible: true,
    confidenceDecoupleApplied: true,
  });
  ok(
    '8.1 quality warnings include capture_quality_low + hard_partial + integrity + confidence_too_low',
    warnings.includes('capture_quality_low') &&
      warnings.includes('hard_partial') &&
      warnings.includes('standard_cycle_signal_integrity') &&
      warnings.includes('confidence_too_low'),
    warnings
  );
}

{
  const warnings = getSquatQualityOnlyWarnings({
    guardrail: { captureQuality: 'valid', flags: [] },
    rawIntegrityBlock: null,
    decoupleEligible: false,
    confidenceDecoupleApplied: true,
  });
  ok(
    '8.2 confidence_too_low surfaces even when low-quality decouple disabled',
    warnings.length === 1 && warnings[0] === 'confidence_too_low',
    warnings
  );
}

{
  const warnings = getSquatQualityOnlyWarnings({
    guardrail: { captureQuality: 'low', flags: ['hard_partial'] },
    rawIntegrityBlock: 'standard_cycle_signal_integrity:hard_partial',
    decoupleEligible: false,
    confidenceDecoupleApplied: false,
  });
  ok(
    '8.3 neither decouple applied -- no warnings surface',
    warnings.length === 0,
    warnings
  );
}

// ═══════════════════════════════════════════════════════════════════
// 9) low-quality decouple unchanged (PR-3 regression guard)
// ═══════════════════════════════════════════════════════════════════

{
  ok(
    '9.1 low-quality decouple still requires completion + pass-confirm',
    isSquatLowQualityPassDecoupleEligible({
      stepId: 'squat',
      completionSatisfied: true,
      completionPassReason: 'standard_cycle',
      guardrail: { captureQuality: 'low' },
      severeInvalid: false,
      effectivePassConfirmation: true,
    }) === true
  );
  ok(
    '9.2 low-quality decouple null-s integrity when eligible',
    squatPassProgressionIntegrityBlock('standard_cycle_signal_integrity:hard_partial', true) === null
  );
  ok(
    '9.3 low-quality decouple preserves integrity when ineligible',
    squatPassProgressionIntegrityBlock(
      'standard_cycle_signal_integrity:hard_partial',
      false
    ) === 'standard_cycle_signal_integrity:hard_partial'
  );
  ok(
    '9.4 hard_partial retry suppressed when decouple eligible',
    squatRetryTriggeredByPartialFramingReasons(['hard_partial'], true) === false
  );
  ok(
    '9.5 rep_incomplete retry still fires even when decouple eligible',
    squatRetryTriggeredByPartialFramingReasons(['rep_incomplete'], true) === true
  );
}

// ═══════════════════════════════════════════════════════════════════
// 10) Quality semantics split snapshot
// ═══════════════════════════════════════════════════════════════════

{
  const snap = readSquatQualitySemanticsSplitSnapshot({
    lowQualityDecoupleEligible: true,
    confidenceDecoupleEligible: true,
    confidenceDecoupleApplied: true,
    guardrail: { captureQuality: 'low', flags: ['hard_partial'] },
    rawIntegrityBlock: 'standard_cycle_signal_integrity:hard_partial',
  });
  ok(
    '10.1 snapshot mirrors eligibility flags',
    snap.lowQualityDecoupleEligible === true &&
      snap.confidenceDecoupleEligible === true &&
      snap.confidenceDecoupleApplied === true,
    snap
  );
  ok(
    '10.2 snapshot surfaces quality-only warnings (including confidence_too_low)',
    snap.qualityOnlyWarnings.includes('capture_quality_low') &&
      snap.qualityOnlyWarnings.includes('hard_partial') &&
      snap.qualityOnlyWarnings.includes('standard_cycle_signal_integrity') &&
      snap.qualityOnlyWarnings.includes('confidence_too_low'),
    snap
  );
}

{
  const snap = readSquatQualitySemanticsSplitSnapshot({
    lowQualityDecoupleEligible: false,
    confidenceDecoupleEligible: false,
    confidenceDecoupleApplied: false,
    guardrail: { captureQuality: 'valid', flags: [] },
    rawIntegrityBlock: null,
  });
  ok(
    '10.3 empty snapshot has no warnings and all false flags',
    snap.qualityOnlyWarnings.length === 0 &&
      snap.lowQualityDecoupleEligible === false &&
      snap.confidenceDecoupleEligible === false &&
      snap.confidenceDecoupleApplied === false,
    snap
  );
}

// ═══════════════════════════════════════════════════════════════════
// 11) PR-2 false-pass guard independence -- quality split must NOT
//     override guard verdict
// ═══════════════════════════════════════════════════════════════════

{
  // Weird pass scenario: PR-2 guard marks a suspicious shallow rep as
  // setup_origin_rep, still-seated, or motion-only. The guard snapshot
  // must be independently queryable and must return NOT-CLEAR regardless
  // of quality-split state.
  // Minimal closed-but-untrue input: any missing cycle truth should keep
  // the PR-2 guard NOT-clear with a specific family label. The quality
  // split has no path to override this -- guard is an independent opener.
  const suspiciousGuardSnapshot = readOfficialShallowFalsePassGuardSnapshot({
    squatCompletionState: {
      officialShallowPathClosed: true,
    },
  });
  ok(
    '11.1 PR-2 guard stays NOT-clear on suspicious shallow close, independent of quality split',
    suspiciousGuardSnapshot.officialShallowFalsePassGuardClear === false &&
      suspiciousGuardSnapshot.officialShallowFalsePassGuardFamily != null &&
      typeof suspiciousGuardSnapshot.officialShallowFalsePassGuardBlockedReason === 'string' &&
      suspiciousGuardSnapshot.officialShallowFalsePassGuardBlockedReason.startsWith(
        'official_shallow_false_pass_guard:'
      ),
    suspiciousGuardSnapshot
  );
}

// ═══════════════════════════════════════════════════════════════════

console.log(`\nPR-5 quality semantics split smoke -- passed: ${passed}, failed: ${failed}`);
if (failed > 0) process.exit(1);
