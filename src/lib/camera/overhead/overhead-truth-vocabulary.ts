/**
 * OVERHEAD REACH TRUTH VOCABULARY — PR-01 frozen vocabulary
 *
 * Reference: docs/ssot/OVERHEAD_REACH_SSOT_20260405_R2.md §3
 *
 * This file locks the three-layer truth vocabulary for overhead reach.
 * It contains TYPE DEFINITIONS ONLY — no runtime logic.
 *
 * PR-01 scope: freeze vocabulary, lock boundaries, label layers.
 * PR-02 scope: implement the rise-truth owner + minimum observability.
 * PR-03 scope: unify progression hold contract.
 * PR-04 scope: fallback rescue normalization.
 * PR-05 scope: guardrail/final-pass read-only alignment.
 *
 * Do NOT add runtime logic to this file.
 * Do NOT mix completion truth with final pass truth fields.
 * Do NOT use interpretation truth thresholds as pass gates.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * THREE-LAYER TRUTH SPLIT (SSOT R2 §3)
 * ──────────────────────────────────────────────────────────────────────────────
 *
 *   LAYER 1 — COMPLETION TRUTH (§3.1)
 *     Motion-only truth.
 *     Answers: did a meaningful rise happen? Did the user enter a valid top zone?
 *     Did the user hold at top long enough? What path satisfied completion?
 *     If blocked, what blocked it?
 *     Must NOT include: confidence threshold, capture quality, pass confirmation,
 *     UI latch, auto-advance, retry routing, voice playback state.
 *     Owned by: overhead-completion-state.ts (strict path),
 *               overhead-easy-progression.ts (easy / low_rom / humane_low_rom paths)
 *
 *   LAYER 2 — FINAL PASS TRUTH (§3.2)
 *     Reads completion truth and adds only UI/runtime gates.
 *     Adds: capture quality invalid block, hard framing block,
 *           pass confirmation stability, confidence threshold.
 *     Must NOT redefine motion completion.
 *     Owned by: isFinalPassLatched() in auto-progression.ts
 *
 *   LAYER 3 — INTERPRETATION TRUTH (§3.3)
 *     Quality-only truth. Strictness belongs here.
 *     Includes: strict top quality, asymmetry severity, compensation severity,
 *               internal quality tier, planning evidence tier, fallback vs strict
 *               explanation.
 *     Must NOT block a valid easy pass unless an explicit hard safety gate says so.
 *     Owned by: computeOverheadInternalQuality(), overhead-planning.ts
 * ──────────────────────────────────────────────────────────────────────────────
 */

// ── Layer 1: Completion Truth ─────────────────────────────────────────────────

/**
 * COMPLETION TRUTH vocabulary — SSOT R2 §3.1
 *
 * Motion-only truth. Must never include runtime gates (confidence, capture quality,
 * pass confirmation window, UI latch).
 *
 * Canonical user-facing contract: meaningful rise → top zone → short hold → pass
 *
 * Fields labelled [PR-02] are planned for the rise-truth owner module.
 * They are defined here as vocabulary anchors for PR-02 to implement against.
 */
export interface OverheadCompletionTruth {
  /**
   * [PR-02] True when a meaningful upward arm raise has been established.
   * Must NOT be satisfied by arm noise, setup motion, or micro-sways.
   * Currently approximated by raiseCount > 0 in evaluator.
   * PR-02 will replace this with a robust rise-truth owner.
   */
  meaningfulRiseSatisfied: boolean;

  /** True when arm elevation first crossed the top-zone floor threshold. */
  topDetected: boolean;

  /**
   * True when arm entered the stable-top zone (consecutive settled frames at top).
   * Distinct from topDetected — stability is required, not just a threshold crossing.
   */
  topStableEntered: boolean;

  /**
   * True when hold arming and accumulation have both started.
   * Must be false during active upward motion (ascending phase is excluded from hold).
   */
  holdStarted: boolean;

  /** True when hold duration >= required hold threshold. */
  holdSatisfied: boolean;

  /** True when any progression path satisfies completion. */
  completionSatisfied: boolean;

  /**
   * Which progression path satisfied completion, or null if not yet satisfied.
   * 'strict' | 'fallback' | 'easy' | 'low_rom' | 'humane_low_rom' | null
   */
  completionPath: 'strict' | 'fallback' | 'easy' | 'low_rom' | 'humane_low_rom' | null;

  /**
   * Why completion was blocked, or null if not blocked.
   * Must be a motion-only reason — never a UI/runtime gate reason.
   */
  completionBlockedReason: string | null;

  /**
   * Current completion machine phase.
   * idle → raising → top_unstable | easy_top | low_rom_top | humane_top
   *      → stable_top | easy_building_hold | low_rom_building_hold | humane_building_hold
   *      → holding → completed
   */
  completionPhase: string;

  // ── Timestamps (vocabulary anchors — PR-02 will populate these) ──

  /**
   * [PR-02] Timestamp when meaningful rise first started.
   * Not yet available as a distinct field — rise-truth owner will provide this.
   */
  riseStartedAtMs?: number;

  /** Timestamp when arm first entered the top zone (any floor). */
  topDetectedAtMs?: number;

  /** Timestamp when arm entered the stable-top zone. */
  topStableEnteredAtMs?: number;

  /** Timestamp when hold accumulation started. */
  holdStartedAtMs?: number;

  /** Timestamp when hold duration requirement was satisfied. */
  holdSatisfiedAtMs?: number;
}

// ── Layer 2: Final Pass Truth ─────────────────────────────────────────────────

/**
 * FINAL PASS TRUTH vocabulary — SSOT R2 §3.2
 *
 * Reads completion truth and adds only UI/runtime gates.
 * Must NOT redefine motion completion.
 *
 * All fields in this layer are read-only consumers of Layer 1.
 * guardrails.ts and auto-progression.ts are the owners of this layer.
 *
 * This interface is a VOCABULARY ANCHOR for PR-05 (final pass read-only alignment).
 * PR-05 will make guardrail/final-pass explicitly consume OverheadCompletionTruth
 * without redefining it.
 */
export interface OverheadFinalPassTruth {
  /**
   * Read from completion truth (Layer 1). Not recomputed here.
   * If false, final pass is blocked at the completion layer.
   */
  completionSatisfied: boolean;

  /**
   * True when captureQuality === 'invalid'.
   * This is the only capture-quality gate that may block final pass.
   * Low capture quality alone must NOT block final pass when completion is satisfied.
   */
  captureQualityBlocked: boolean;

  /**
   * True when pass confirmation stability criteria are satisfied.
   * (Requires passConfirmationSatisfied AND passConfirmationFrameCount >= required frames)
   */
  passConfirmationSatisfied: boolean;

  /**
   * True when confidence >= effective threshold.
   * Threshold is path-dependent: easy/low_rom/humane paths use OVERHEAD_EASY_PASS_CONFIDENCE (0.58),
   * strict path uses BASIC_PASS_CONFIDENCE_THRESHOLD['overhead-reach'].
   */
  confidenceMet: boolean;

  /** True when all final pass gates clear. This is the final UI-visible pass decision. */
  finalPassGranted: boolean;

  /**
   * First blocking reason when finalPassGranted=false, null when granted.
   * Distinguishes final-pass-level blocks from completion-level blocks.
   *
   * Possible values (not yet surfaced in debug — PR-02/PR-05 will populate this):
   * - 'completion_not_satisfied'     — failed at Layer 1 (completion truth)
   * - 'capture_quality_invalid'      — camera framing / capture gate
   * - 'pass_confirmation_unstable'   — passConfirmation not yet stable
   * - 'confidence_below_threshold'   — confidence gate
   * - null                           — pass granted
   */
  finalPassBlockedReason:
    | 'completion_not_satisfied'
    | 'capture_quality_invalid'
    | 'pass_confirmation_unstable'
    | 'confidence_below_threshold'
    | null;
}

// ── Layer 3: Interpretation Truth ─────────────────────────────────────────────

/**
 * INTERPRETATION TRUTH vocabulary — SSOT R2 §3.3
 *
 * Quality-only truth. Strictness belongs here, NOT in completion truth or final pass truth.
 *
 * Must NOT block a valid easy pass unless an explicit hard safety gate says so.
 * Asymmetry thresholds that appear in completion-state currently serve double duty
 * (also gate completion). This will be separated in PR-03/PR-05.
 *
 * Owned by: computeOverheadInternalQuality(), computeOverheadPlanningEvidenceLevel()
 */
export interface OverheadInterpretationTruth {
  /**
   * Internal quality tier ('excellent' | 'good' | 'fair' | 'limited' | 'insufficient').
   * Strict quality threshold. NOT a pass gate.
   */
  internalQualityTier: string;

  /**
   * Planning evidence tier ('strong' | 'moderate' | 'weak' | 'insufficient').
   * Used for result page content — NOT a pass gate.
   */
  planningEvidenceLevel: string;

  /**
   * True when the pass was granted via a fallback/easy/low_rom/humane path.
   * Interpretation may differ from strict path — but pass already happened.
   */
  isFallbackOrEasyPath: boolean;

  /**
   * Arm asymmetry severity as an interpretation label.
   * Strict asymmetry thresholds for interpretation may be stricter than pass-gate thresholds.
   * Do NOT silently convert this to a pass gate without an explicit SSOT change.
   */
  asymmetrySeverity: 'none' | 'mild' | 'moderate' | 'severe' | null;

  /**
   * Trunk compensation severity as an interpretation label.
   * Interpretation only — not a pass gate.
   */
  compensationSeverity: 'none' | 'mild' | 'moderate' | 'severe' | null;
}

// ── Canonical pass contract (product law) ────────────────────────────────────

/**
 * CANONICAL OVERHEAD PASS CONTRACT — SSOT R2 §4
 *
 * Pass must require (Layer 1 → Layer 2 sequential check):
 *   1. meaningfulRiseSatisfied     (Layer 1)
 *   2. topDetected                 (Layer 1)
 *   3. topStableEntered            (Layer 1)  [except in fallback rescue path]
 *   4. holdSatisfied               (Layer 1)
 *   5. captureQualityBlocked=false (Layer 2)
 *   6. passConfirmationSatisfied   (Layer 2)
 *   7. confidenceMet               (Layer 2)
 *
 * What must NEVER pass:
 *   - Standing still / noise only              (rise check blocks)
 *   - Arm motion with no meaningful rise proof  (rise proof blocks)
 *   - Pass while arm is actively rising         (ascending phase excluded from hold)
 *   - Pass at first top-touch without hold      (hold satisfaction required)
 *   - Pass from transient top spikes only       (stable-top entry or fallback run required)
 *
 * "Pass easy / interpretation strict" direction (SSOT R2 §1):
 *   - Pass is opened by a real rise + short hold
 *   - Interpretation quality may still be labeled as limited/asymmetrical/compensated
 *   - Strict interpretation thresholds must NOT silently become pass gates everywhere
 */
export const OVERHEAD_PASS_CONTRACT_SSOT_REF = 'docs/ssot/OVERHEAD_REACH_SSOT_20260405_R2.md' as const;

/**
 * Vocabulary anchor for the target hold feel (SSOT R2 §1).
 * approximately 1.0s to 1.5s felt by user.
 * This is a product-law constant — do NOT adjust without SSOT update.
 * Runtime values are in overhead-constants.ts.
 */
export const OVERHEAD_TARGET_HOLD_FEEL_MS_MIN = 1000 as const;
export const OVERHEAD_TARGET_HOLD_FEEL_MS_MAX = 1500 as const;

// ── Protected boundaries (SSOT R2 §7) ────────────────────────────────────────

/**
 * PROTECTED BOUNDARY: Squat must not be touched in overhead PRs.
 *
 * The following modules are protected from overhead PR changes:
 * - src/lib/camera/squat/pass-core.ts
 * - src/lib/camera/squat/squat-completion-state.ts (in squat-completion-state.ts)
 * - src/lib/camera/squat/squat-descent-truth.ts
 * - src/lib/camera/squat/ (all squat-specific files)
 *
 * Shared camera modules (guardrails.ts, auto-progression.ts) may be touched
 * ONLY when the change is overhead-scoped and proven not to alter squat behavior.
 * Any shared file edit must use overhead-only branching (stepId === 'overhead-reach').
 */
export const OVERHEAD_PROTECTED_BOUNDARY_NOTE =
  'See SSOT R2 §7: do not touch squat logic in overhead PRs.' as const;
