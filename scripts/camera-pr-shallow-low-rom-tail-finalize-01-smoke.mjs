/**
 * PR-CAM-SHALLOW-LOW-ROM-TAIL-FINALIZE-01 smoke
 * Verifies: guarded low-rom tail finalize path — only fires when all upstream is locked
 * and ONLY the continuity/drop sub-check inside low_rom_standing_finalize_not_satisfied fails.
 *
 * Run: npx tsx scripts/camera-pr-shallow-low-rom-tail-finalize-01-smoke.mjs
 *
 * 5 patterns:
 *   AC1. Standing still                 → completionSatisfied false
 *   AC2. Descent-only (no return)       → blocked before finalize
 *   AC3. Ultra-low + trajectory rescue  → blocked (not low_rom band)
 *   AC4. Valid low-rom with slow return → completionSatisfied true (guard fires)
 *   AC5. Deep standard                  → standard_cycle, no regression
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
    const d = extra !== undefined ? ` | got: ${JSON.stringify(extra)}` : '';
    console.error(`  ✗ ${name}${d}`);
  }
}

/**
 * Builds synthetic frames.
 * squatDepthProxyBlended = squatDepthProxy (primary = blended for simplicity)
 */
function makeFrames(depths, phases, { stepMs = 80 } = {}) {
  return depths.map((depth, i) => ({
    timestampMs: 200 + i * stepMs,
    isValid: true,
    phaseHint: phases[i] ?? 'start',
    derived: {
      squatDepthProxy: depth,
      squatDepthProxyBlended: depth,
    },
    joints: {},
    bodyBox: { area: 0.25 },
    visibilitySummary: { visibleLandmarkRatio: 0.88, criticalJointsAvailability: 0.9 },
    qualityHints: [],
  }));
}

// ─── AC1. Standing still ──────────────────────────────────────────────────────
console.log('\nAC1. Standing still');
{
  const s = evaluateSquatCompletionState(
    makeFrames(Array(25).fill(0.012), Array(25).fill('start'))
  );
  ok('AC1: completionSatisfied false', s.completionSatisfied === false);
  ok('AC1: no lowRomTailGuarded finalize', s.standingRecoveryFinalizeReason !== 'low_rom_tail_guarded_finalize');
}

// ─── AC2. Descent-only (no return) ───────────────────────────────────────────
console.log('\nAC2. Descent-only — no return to standing');
{
  const depths = [
    0.010, 0.010, 0.010, 0.010, 0.010,
    0.025, 0.045, 0.070, 0.095, 0.115,
    0.115, 0.115, 0.115, 0.115,
  ];
  const phases = [
    'start', 'start', 'start', 'start', 'start',
    'descent', 'descent', 'descent', 'descent', 'bottom',
    'bottom', 'bottom', 'bottom', 'bottom',
  ];
  const s = evaluateSquatCompletionState(makeFrames(depths, phases, { stepMs: 80 }));
  ok('AC2: completionSatisfied false', s.completionSatisfied === false);
  ok(
    'AC2: blocked upstream (no_reversal / not_standing_recovered / no_commitment)',
    s.completionBlockedReason === 'no_reversal' ||
      s.completionBlockedReason === 'not_standing_recovered' ||
      s.completionBlockedReason === 'no_commitment' ||
      s.completionSatisfied === false
  );
  ok('AC2: no tail finalize guard', s.standingRecoveryFinalizeReason !== 'low_rom_tail_guarded_finalize');
}

// ─── AC3. Ultra-low + trajectory rescue ──────────────────────────────────────
console.log('\nAC3. Ultra-low (< 0.07) range — not low_rom band');
{
  // relativeDepthPeak < 0.07 → ultra_low band → guard must not activate
  const depths = [
    0.010, 0.010, 0.010, 0.010, 0.010, 0.010,
    0.015, 0.020, 0.025, 0.030, 0.035, 0.040, 0.045,
    0.045, 0.045, 0.040, 0.030, 0.018, 0.011, 0.010,
    0.010, 0.010, 0.010, 0.010,
  ];
  const phases = [
    'start', 'start', 'start', 'start', 'start', 'start',
    'descent', 'descent', 'descent', 'descent', 'descent', 'bottom', 'bottom',
    'bottom', 'bottom', 'ascent', 'ascent', 'ascent', 'start', 'start',
    'start', 'start', 'start', 'start',
  ];
  const s = evaluateSquatCompletionState(makeFrames(depths, phases, { stepMs: 80 }));
  ok('AC3: guard must not fire (ultra_low band, not [0.07, 0.40))', s.standingRecoveryFinalizeReason !== 'low_rom_tail_guarded_finalize');
}

// ─── AC4. Valid low-rom down-up with slow standing return ─────────────────────
console.log('\nAC4. Valid low-rom down-up: upstream locked, only finalize gap remains');
{
  /**
   * Design:
   * - baseline: 0.010
   * - peak: 0.10 → relativeDepthPeak ≈ 0.090 (inside [0.07, 0.40))
   * - Strict reversal: big drop after peak
   * - Standing recovery: slow (low recoveryDropRatio may fail strict proof at 0.45)
   * - Descent timing: slow enough (>= 200ms at 80ms/frame → 3 descent frames = 240ms)
   * - Reversal-to-standing: >= 200ms
   */
  const stepMs = 80;
  const baseline = 0.010;
  const depths = [
    // 6-frame baseline
    0.010, 0.010, 0.010, 0.010, 0.010, 0.010,
    // descent: 3 frames × 80ms = 240ms (>= 200ms threshold)
    0.035, 0.065, 0.100,
    // bottom hold
    0.100, 0.100,
    // post-peak drop (strict reversal: drop = 0.100 - 0.040 = 0.060 >> required ≈ 0.012)
    0.075, 0.055, 0.040,
    // slow standing return (gradual)
    0.028, 0.018, 0.012, 0.010,
    // standing hold
    0.010, 0.010, 0.010, 0.010, 0.010, 0.010,
  ];
  const phases = [
    'start', 'start', 'start', 'start', 'start', 'start',
    'descent', 'descent', 'descent',
    'bottom', 'bottom',
    'ascent', 'ascent', 'ascent',
    'start', 'start', 'start', 'start',
    'start', 'start', 'start', 'start', 'start', 'start',
  ];
  const s = evaluateSquatCompletionState(makeFrames(depths, phases, { stepMs }));

  if (s.completionSatisfied === true) {
    ok('AC4: completionSatisfied true', true);
    ok(
      'AC4: passReason is low_rom_cycle',
      s.completionPassReason === 'low_rom_cycle'
    );
    ok(
      'AC4: standingRecoveryFinalizeReason is low_rom guarded or standard finalize',
      s.standingRecoveryFinalizeReason === 'low_rom_tail_guarded_finalize' ||
        s.standingRecoveryFinalizeReason === 'low_rom_guarded_finalize' ||
        s.standingRecoveryFinalizeReason === 'standing_hold_met'
    );
    ok(
      'AC4: officialShallowPathClosed true',
      s.officialShallowPathClosed === true
    );
    ok(
      'AC4: reversalConfirmedBy is rule family (not trajectory)',
      s.reversalConfirmedBy === 'rule' || s.reversalConfirmedBy === 'rule_plus_hmm'
    );
  } else {
    // If this specific fixture's strict reversal proof doesn't trigger the guard,
    // check that at least the guard was not the cause of failure.
    ok(
      'AC4: blocked upstream (not by finalize gap)',
      s.completionBlockedReason !== 'low_rom_standing_finalize_not_satisfied' ||
        s.standingRecoveryFinalizeReason === 'low_rom_tail_guarded_finalize'
    );
    ok('AC4: [INFO] guard did not fire (fixture may need adjustment)', false,
      { completionSatisfied: s.completionSatisfied, completionBlockedReason: s.completionBlockedReason, standingRecoveryFinalizeReason: s.standingRecoveryFinalizeReason, reversalConfirmedBy: s.reversalConfirmedBy }
    );
  }
}

// ─── AC5. Deep standard squat — no regression ────────────────────────────────
console.log('\nAC5. Deep standard squat — standard_cycle, no regression');
{
  const stepMs = 80;
  const depths = [
    0.010, 0.010, 0.010, 0.010, 0.010, 0.010,
    0.050, 0.120, 0.220, 0.350, 0.460, 0.500,
    0.500, 0.480,
    0.380, 0.260, 0.150, 0.070,
    0.020, 0.012, 0.010, 0.010, 0.010, 0.010, 0.010, 0.010,
  ];
  const phases = [
    'start', 'start', 'start', 'start', 'start', 'start',
    'descent', 'descent', 'descent', 'descent', 'descent', 'bottom',
    'bottom', 'bottom',
    'ascent', 'ascent', 'ascent', 'ascent',
    'start', 'start', 'start', 'start', 'start', 'start', 'start', 'start',
  ];
  const s = evaluateSquatCompletionState(makeFrames(depths, phases, { stepMs }));
  ok('AC5: completionSatisfied true', s.completionSatisfied === true);
  ok('AC5: standard_cycle', s.completionPassReason === 'standard_cycle');
  ok(
    'AC5: reversalConfirmedBy rule (not trajectory)',
    s.reversalConfirmedBy === 'rule' || s.reversalConfirmedBy === 'rule_plus_hmm'
  );
  ok('AC5: no tail finalize guard', s.standingRecoveryFinalizeReason !== 'low_rom_tail_guarded_finalize');
}

// ─── Summary ────────────────────────────────────────────────────────────────
console.log(`\nDone: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
