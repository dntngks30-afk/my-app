/**
 * PASS-AUTHORITY-RESET-01: Single squat pass authority core.
 *
 * This module is the ONLY owner of squat motion pass truth.
 * It answers exactly one question: "did a valid squat rep happen?"
 *
 * Design contract:
 * - Reads minimum motion facts from completion state (BEFORE policy lock).
 * - Does NOT read: official_shallow_cycle / low_rom_cycle / ultra_low_rom_cycle labels.
 * - Does NOT read: canonical shallow contract satisfaction.
 * - Does NOT read: ultra-low policy decision.
 * - Does NOT read: interpretation / quality labels.
 * - Handles setup rejection BEFORE pass opens (not as a downstream revocation).
 *
 * After this module runs, downstream layers (evaluator, auto-progression) may:
 *   - classify (shallow / low / standard / deep)
 *   - warn / explain
 *   - gate UI latch / celebration timing
 * but may NOT flip passDetected from true to false.
 *
 * This is PASS_AUTHORITY_RESET_SSOT_20260404 §4 implementation.
 */

/**
 * Minimum motion facts needed by pass-core.
 * Intentionally narrow — no labels, no policy, no canonical contract result.
 * Sourced from SquatCompletionState BEFORE applyUltraLowPolicyLock runs.
 */
export interface SquatPassCoreInput {
  /** Phase machine output — the core machine's final verdict (pre-policy). */
  completionSatisfied?: boolean;
  /** Core machine blocked reason (pre-policy). Used for trace only. */
  completionBlockedReason?: string | null;
  /** True once meaningful descent has started. */
  descendConfirmed?: boolean;
  /** True when attempt epoch has started (arming + baseline established). */
  attemptStarted?: boolean;
  /** True when reversal / ascent evidence is present by any authoritative means. */
  ownerAuthoritativeReversalSatisfied?: boolean;
  /** True when standing recovery evidence is confirmed. */
  ownerAuthoritativeRecoverySatisfied?: boolean;
  /** Current phase of the squat state machine. */
  currentSquatPhase?: string;
  /** True when standing finalize gate is satisfied (hold duration + frames). */
  standingFinalizeSatisfied?: boolean;
  /**
   * Time from reversal to standing recovery (ms).
   * Used for current-rep ownership check (max 7500ms).
   */
  squatReversalToStandingMs?: number;
  /**
   * Downward commitment delta (relativeDepthPeak – baseline).
   * Must be > 0 to satisfy anti-false-pass (non-degenerate movement).
   */
  downwardCommitmentDelta?: number;
  /** Timing observability (not used for pass logic). */
  descendStartAtMs?: number;
  peakAtMs?: number;
  reversalAtMs?: number;
  standingRecoveredAtMs?: number;
  cycleDurationMs?: number;
}

export interface SquatPassSetupInfo {
  /** True when evaluator detected setup camera motion in the capture window. */
  setupMotionBlocked: boolean;
  /** Human-readable reason for setup block (trace only). */
  reason: string | null;
}

export interface SquatPassCoreResult {
  /**
   * SINGLE MOTION PASS AUTHORITY.
   * True = valid squat rep happened (descent → reversal → standing recovery,
   * same rep, setup clear, anti-false-pass clear).
   * Once true, no downstream module may set this to false.
   */
  passDetected: boolean;
  /** Null when passDetected=true. First blocking reason when false. */
  passBlockedReason: string | null;
  /**
   * Lightweight rep ID for observability.
   * Derived from standingRecoveredAtMs when pass opens.
   */
  repId: string | null;

  /** Motion structure facts (read-only observation). */
  descentDetected: boolean;
  reversalDetected: boolean;
  standingRecovered: boolean;

  /** Timing snapshot at pass close (observation only). */
  descentStartAtMs: number | undefined;
  peakAtMs: number | undefined;
  reversalAtMs: number | undefined;
  standingRecoveredAtMs: number | undefined;
  cycleDurationMs: number | undefined;
  reversalToStandingMs: number | undefined;

  /** Gate results (for trace and UI layers). */
  setupClear: boolean;
  currentRepOwnershipClear: boolean;
  antiFalsePassClear: boolean;
  /** True when pass was suppressed because late setup motion was detected and bypass criteria not met. */
  lateSetupSuppressed: boolean;

  /** Machine-readable trace string for device debugging. */
  trace: string;
}

/**
 * Core bypass criteria: a rep that clearly shows descent → reversal → standing recovery
 * within the same attempt is valid even if setup motion was detected in the buffer.
 * This matches the bypass logic in the evaluator's pre-pass-core late-setup check.
 */
function computeBypassLateSetup(input: SquatPassCoreInput): boolean {
  return (
    input.descendConfirmed === true &&
    input.attemptStarted === true &&
    input.ownerAuthoritativeReversalSatisfied === true &&
    input.ownerAuthoritativeRecoverySatisfied === true &&
    input.currentSquatPhase === 'standing_recovered'
  );
}

/**
 * PASS-AUTHORITY-RESET-01: Derive immutable squat pass truth.
 *
 * Called BEFORE applyUltraLowPolicyLock and BEFORE evaluator late-setup
 * suppression rewrites completion truth. The result is stored in
 * evaluatorResult.debug.squatPassCore and consumed by auto-progression.
 *
 * Hard pass criteria (all must be true):
 *  1. Core machine says completion satisfied (pre-policy)
 *  2. Setup clear (or bypass criteria met for authoritative rep)
 *  3. Meaningful descent detected
 *  4. Meaningful reversal / ascent detected
 *  5. Standing recovery confirmed
 *  6. Current-rep ownership clear (reversal-to-standing ≤ 7500ms)
 *  7. Anti-false-pass clear (non-degenerate downward commitment)
 */
export function evaluateSquatPassCore(
  input: SquatPassCoreInput,
  setup: SquatPassSetupInfo
): SquatPassCoreResult {
  // ── 1. Core machine verdict (pre-policy) ──
  const corePassSatisfied = input.completionSatisfied === true;

  // ── 2. Setup check (enforcement before pass opens, not downstream revocation) ──
  const bypassLateSetup = computeBypassLateSetup(input);
  const lateSetupSuppressed = setup.setupMotionBlocked && !bypassLateSetup;
  const setupClear = !lateSetupSuppressed;

  // ── 3. Motion structure facts ──
  const descentDetected = input.descendConfirmed === true;
  const reversalDetected = input.ownerAuthoritativeReversalSatisfied === true;
  const standingRecovered =
    input.currentSquatPhase === 'standing_recovered' && input.standingFinalizeSatisfied === true;

  // ── 4. Current-rep ownership (anti-laundering) ──
  const rsMs = input.squatReversalToStandingMs;
  const currentRepOwnershipClear = rsMs == null || rsMs <= 7500;

  // ── 5. Anti-false-pass (non-degenerate commitment) ──
  const delta = input.downwardCommitmentDelta;
  const antiFalsePassClear = delta == null || delta > 0;

  // ── 6. Final pass decision ──
  const passDetected =
    corePassSatisfied &&
    setupClear &&
    descentDetected &&
    reversalDetected &&
    standingRecovered &&
    currentRepOwnershipClear &&
    antiFalsePassClear;

  // ── Derive first blocked reason for trace ──
  let passBlockedReason: string | null = null;
  if (!passDetected) {
    if (!corePassSatisfied) {
      passBlockedReason = input.completionBlockedReason ?? 'completion_not_satisfied';
    } else if (lateSetupSuppressed) {
      passBlockedReason = `setup_motion:${setup.reason ?? 'blocked'}`;
    } else if (!descentDetected) {
      passBlockedReason = 'no_descent';
    } else if (!reversalDetected) {
      passBlockedReason = 'no_reversal';
    } else if (!standingRecovered) {
      passBlockedReason = 'no_standing_recovery';
    } else if (!currentRepOwnershipClear) {
      passBlockedReason = 'current_rep_ownership_blocked';
    } else if (!antiFalsePassClear) {
      passBlockedReason = 'non_degenerate_commitment_blocked';
    }
  }

  const trace = [
    `core=${corePassSatisfied ? 1 : 0}`,
    `setup=${setupClear ? 1 : 0}`,
    `desc=${descentDetected ? 1 : 0}`,
    `rev=${reversalDetected ? 1 : 0}`,
    `stand=${standingRecovered ? 1 : 0}`,
    `ownership=${currentRepOwnershipClear ? 1 : 0}`,
    `antifalse=${antiFalsePassClear ? 1 : 0}`,
    `pass=${passDetected ? 1 : 0}`,
    passBlockedReason != null ? `blocked=${passBlockedReason}` : null,
  ]
    .filter(Boolean)
    .join('|');

  return {
    passDetected,
    passBlockedReason,
    repId: passDetected ? `rep_${input.standingRecoveredAtMs ?? 0}` : null,
    descentDetected,
    reversalDetected,
    standingRecovered,
    descentStartAtMs: input.descendStartAtMs,
    peakAtMs: input.peakAtMs,
    reversalAtMs: input.reversalAtMs,
    standingRecoveredAtMs: input.standingRecoveredAtMs,
    cycleDurationMs: input.cycleDurationMs,
    reversalToStandingMs: rsMs,
    setupClear,
    currentRepOwnershipClear,
    antiFalsePassClear,
    lateSetupSuppressed,
    trace,
  };
}
