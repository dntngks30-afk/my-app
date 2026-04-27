/**
 * PR-P3 — Squat Absurd-Pass Registry Normalization.
 *
 * This module is the single explicit surface for the squat absurd-pass
 * blocker policy. It normalizes the previously scattered late final-pass
 * vetoes into one auditable, **block-only** registry and classifies the
 * remaining known absurd-pass families that are already fail-closed by
 * upstream layers (completion-state, owner truth, UI/progression gate).
 *
 * Parent truth:
 *   - `docs/SSOT_SQUAT_COMPLETION_FIRST_QUALITY_STRICT_2026_04.md`
 *   - `docs/pr/PR-01-SQUAT-COMPLETION-FIRST-AUTHORITY-FREEZE.md`
 *   - `docs/pr/PR-CAM-SQUAT-AUTHORITY-LAW-RESOLUTION.md`
 *   - `docs/pr/P3-SQUAT-ABSURD-PASS-REGISTRY-NORMALIZATION.md`
 *
 * Locked invariants:
 *   1. Registry is **block-only**. It may close the final-pass surface for
 *      explicit absurd-pass families. It may NEVER open final pass, and no
 *      entry acts as an alternate owner or opener. `completionTruthPassed
 *      AND completionOwnerPassed AND gates clear => finalPassEligible`
 *      remains the sole opener law.
 *   2. The registry preserves **class-specific** blocked reasons. A
 *      narrower, more truthful reason must never be merged into a vague
 *      generic blocker.
 *   3. Registry evaluation **preserves the current production veto order**.
 *      P3 is normalization, not behavior redesign. Same input →
 *      same family fires → same blocked reason at the same layer.
 *   4. The registry does not replace upstream fail-close layers. Standing
 *      still, seated hold, stale prior rep, no real descent/reversal/
 *      recovery, setup-motion contamination, and mixed-rep timestamp
 *      contamination are already closed upstream — they are catalogued
 *      here only as passive family inventory for audit.
 *
 * This file exports:
 *   - the three active late-veto blocked-reason constants;
 *   - the three active late-veto predicate functions (same signatures as
 *     before — smokes and other callers import these directly);
 *   - `SquatAbsurdPassRegistryEntry` type and
 *     `SQUAT_ACTIVE_ABSURD_PASS_REGISTRY` readonly list;
 *   - `evaluateSquatAbsurdPassRegistry(...)` — the single runtime
 *     evaluator consumed by `applySquatFinalBlockerVetoLayer` in
 *     `auto-progression.ts`;
 *   - `SquatUpstreamClassifiedAbsurdPassFamily` type and
 *     `SQUAT_UPSTREAM_CLASSIFIED_ABSURD_PASS_FAMILIES` inventory.
 */

import type { CameraStepId } from '@/lib/public/camera-test';
import type { SquatCycleDebug } from '../auto-progression';

// ═══════════════════════════════════════════════════════════════════════════
// Active late final-pass vetoes — blocked-reason constants
// ═══════════════════════════════════════════════════════════════════════════

/**
 * PR-SQUAT-ULTRA-LOW-FINAL-GATE-03 family:
 * seated / too-early trajectory-rescued ultra-low under the minimum-cycle
 * duration. Only this narrow subclass is vetoed at the final-pass surface —
 * `standard_cycle`, rule-reversal deep, and long-cycle ultra-low trajectory
 * rescues are not touched.
 */
export const SQUAT_ULTRA_LOW_TRAJECTORY_SHORT_CYCLE_UI_BLOCKED_REASON =
  'minimum_cycle_duration_not_met:ultra_low_trajectory';

/**
 * PR-SETUP-SERIES-START-01 family:
 * setup/arming fallback combined with series-start peak-anchor
 * contamination that closed a trajectory ultra-low cycle as a false
 * positive. Completion truth is retained upstream; only the final-pass
 * surface is vetoed.
 */
export const SQUAT_SETUP_SERIES_START_FALSE_PASS_BLOCKED_REASON =
  'setup_series_start_false_pass';

/**
 * PR-CAM-SQUAT-BLENDED-EARLY-PEAK-FALSE-PASS-LOCK-01 family:
 * blended/assisted shallow-like evidence combined with very-early peak
 * latch and no event-cycle rescue. Single-field triggers are forbidden
 * upstream — this family is the compound-signature veto only.
 */
export const SQUAT_BLENDED_EARLY_PEAK_CONTAMINATED_FALSE_PASS_BLOCKED_REASON =
  'contaminated_blended_early_peak_false_pass';

// ═══════════════════════════════════════════════════════════════════════════
// Active late final-pass vetoes — predicate functions
// ═══════════════════════════════════════════════════════════════════════════

function squatEventCycleNotesIndicateSeriesStartContamination(
  notes: string[] | undefined
): boolean {
  if (notes == null || notes.length === 0) return false;
  return notes.includes('peak_anchor_at_series_start') || notes.includes('descent_weak');
}

/**
 * PR-SQUAT-ULTRA-LOW-FINAL-GATE-03: `ultra_low_rom_cycle` whose reversal
 * was only confirmed by trajectory rescue and whose cycle duration falls
 * under the minimum must be blocked at the final-pass surface.
 *
 * Block-only. Returns `true` when the family fires; the caller (registry
 * evaluator) turns that into
 * `SQUAT_ULTRA_LOW_TRAJECTORY_SHORT_CYCLE_UI_BLOCKED_REASON`. Same
 * production signature as before so smokes can import it directly.
 */
export function shouldBlockSquatUltraLowTrajectoryRescueShortCycleFinalPass(
  stepId: CameraStepId,
  squatCompletionState: unknown,
  squatCycleDebug: SquatCycleDebug | undefined
): boolean {
  if (stepId !== 'squat') return false;
  if (squatCompletionState == null || typeof squatCompletionState !== 'object') return false;
  const cs = squatCompletionState as {
    completionPassReason?: string;
    reversalConfirmedBy?: string;
    trajectoryReversalRescueApplied?: boolean;
  };
  if (cs.completionPassReason !== 'ultra_low_rom_cycle') return false;
  if (cs.reversalConfirmedBy !== 'trajectory') return false;
  if (cs.trajectoryReversalRescueApplied !== true) return false;
  if (squatCycleDebug?.minimumCycleDurationSatisfied !== false) return false;
  return true;
}

/**
 * PR-SETUP-SERIES-START-01: only the precise compound signature of
 * setup/arming fallback + series-start peak anchor + collapsed
 * descend/reversal timestamps fires. Block-only.
 */
export function shouldBlockSquatUltraLowSetupSeriesStartFalsePassFinalPass(
  stepId: CameraStepId,
  squatCompletionState: unknown,
  squatCycleDebug: SquatCycleDebug | undefined
): boolean {
  if (stepId !== 'squat') return false;
  if (squatCompletionState == null || typeof squatCompletionState !== 'object') return false;
  const cs = squatCompletionState as {
    evidenceLabel?: string;
    reversalConfirmedBy?: string;
    trajectoryReversalRescueApplied?: boolean;
    committedAtMs?: number;
    reversalAtMs?: number;
    descendStartAtMs?: number;
    squatDescentToPeakMs?: number;
    peakLatchedAtIndex?: number | null;
    squatEventCycle?: { notes?: string[] };
  };
  if (cs.evidenceLabel !== 'ultra_low_rom') return false;
  if (cs.reversalConfirmedBy !== 'trajectory') return false;
  if (cs.trajectoryReversalRescueApplied !== true) return false;
  if (squatCycleDebug?.armingFallbackUsed !== true) return false;
  if (cs.peakLatchedAtIndex == null || cs.peakLatchedAtIndex > 0) return false;
  if (cs.committedAtMs == null || cs.reversalAtMs == null || cs.descendStartAtMs == null) return false;
  if (cs.descendStartAtMs !== cs.committedAtMs || cs.committedAtMs !== cs.reversalAtMs) return false;
  if (cs.squatDescentToPeakMs == null || cs.squatDescentToPeakMs > 0) return false;
  const notes = cs.squatEventCycle?.notes;
  if (!squatEventCycleNotesIndicateSeriesStartContamination(notes)) return false;
  return true;
}

/**
 * PR-CAM-SQUAT-BLENDED-EARLY-PEAK-FALSE-PASS-LOCK-01: compound-signature
 * blended/assisted shallow-like + very-early peak latch + no event-cycle
 * rescue + weak completion + negligible primary depth vs blended depth.
 * Single-field triggers forbidden. Block-only.
 */
export function shouldBlockSquatBlendedEarlyPeakContaminatedFalsePassFinalPass(
  stepId: CameraStepId,
  squatCompletionState: unknown,
  squatCycleDebug: SquatCycleDebug | undefined
): boolean {
  if (stepId !== 'squat') return false;
  if (squatCompletionState == null || typeof squatCompletionState !== 'object') return false;

  const cs = squatCompletionState as {
    evidenceLabel?: string;
    completionPassReason?: string;
    completionTruthPassed?: boolean;
    relativeDepthPeak?: number;
    relativeDepthPeakSource?: string | null;
    rawDepthPeakPrimary?: number | null;
    rawDepthPeakBlended?: number | null;
    eventCycleDetected?: boolean;
    eventCyclePromoted?: boolean;
    peakLatchedAtIndex?: number | null;
  };

  const dbg: Partial<SquatCycleDebug> =
    squatCycleDebug != null && typeof squatCycleDebug === 'object' && !Array.isArray(squatCycleDebug)
      ? (squatCycleDebug as Partial<SquatCycleDebug>)
      : {};
  const evidenceLooksShallowLike =
    cs.evidenceLabel === 'ultra_low_rom' ||
    cs.evidenceLabel === 'low_rom' ||
    cs.completionPassReason === 'ultra_low_rom_cycle' ||
    cs.completionPassReason === 'low_rom_cycle' ||
    (typeof cs.relativeDepthPeak === 'number' && cs.relativeDepthPeak > 0 && cs.relativeDepthPeak < 0.12);
  if (!evidenceLooksShallowLike) return false;

  const blendedAssistContamination =
    cs.relativeDepthPeakSource === 'blended' &&
    dbg.armingDepthBlendAssisted === true &&
    (dbg.armingFallbackUsed === true || dbg.armingDepthSource === 'fallback_assisted_blended');
  if (!blendedAssistContamination) return false;

  const earlyPeakLatchedCore =
    (cs.peakLatchedAtIndex != null && cs.peakLatchedAtIndex <= 1) ||
    (dbg.peakLatchedAtIndex != null && dbg.peakLatchedAtIndex <= 1);
  const earlyPeakLatchedObservedFamily =
    (cs.peakLatchedAtIndex === 2 || dbg.peakLatchedAtIndex === 2) &&
    dbg.canonicalShallowContractProvenanceOnlySignalPresent === true;
  const earlyPeakLatched = earlyPeakLatchedCore || earlyPeakLatchedObservedFamily;
  if (!earlyPeakLatched) return false;

  const noStrongEventCycleRescue =
    cs.eventCycleDetected !== true &&
    dbg.eventCycleDetected !== true &&
    cs.eventCyclePromoted !== true &&
    dbg.eventCyclePromoted !== true;
  if (!noStrongEventCycleRescue) return false;

  const completionWeak =
    cs.completionTruthPassed === false && cs.completionPassReason === 'not_confirmed';
  if (!completionWeak) return false;

  const primaryDepth = Math.max(
    0,
    Number(cs.rawDepthPeakPrimary ?? dbg.rawDepthPeakPrimary ?? dbg.squatDepthPeakPrimary ?? 0)
  );
  const blendedDepth = Math.max(
    0,
    Number(cs.rawDepthPeakBlended ?? dbg.rawDepthPeakBlended ?? dbg.squatDepthPeakBlended ?? 0)
  );
  const primaryDepthNegligibleVsBlended =
    blendedDepth > 0 && (primaryDepth <= 0.004 || primaryDepth <= blendedDepth * 0.35);
  if (!primaryDepthNegligibleVsBlended) return false;

  return true;
}

// ═══════════════════════════════════════════════════════════════════════════
// Registry types and entries
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Stable family identifiers for the active late-veto entries. Expanding
 * this union requires a dedicated PR — P3 is normalization only.
 */
export type SquatAbsurdPassFamilyId =
  | 'ultra_low_trajectory_rescue_short_cycle'
  | 'ultra_low_setup_series_start_false_pass'
  | 'blended_early_peak_contaminated_false_pass';

/**
 * A single registry entry. `stage` is hard-pinned to `'late_final_veto'`
 * because this registry only carries active late-veto families. The
 * separate `SquatUpstreamClassifiedAbsurdPassFamily` inventory carries
 * `'upstream_classified_only'` families.
 *
 * There is no `grant` or `open` field anywhere in this shape. Registry
 * entries close the final-pass surface; nothing more.
 */
export interface SquatAbsurdPassRegistryEntry {
  readonly familyId: SquatAbsurdPassFamilyId;
  readonly stage: 'late_final_veto';
  readonly blockedReason: string;
  readonly description: string;
  readonly predicate: (
    stepId: CameraStepId,
    squatCompletionState: unknown,
    squatCycleDebug: SquatCycleDebug | undefined
  ) => boolean;
}

/**
 * Active late final-pass absurd-pass registry — the three families that
 * `applySquatFinalBlockerVetoLayer` currently vetoes at the UI/progression
 * gate after completion-owner truth passes. **Order is the production
 * veto order; do not reorder without a dedicated behavior-change PR.**
 */
export const SQUAT_ACTIVE_ABSURD_PASS_REGISTRY: readonly SquatAbsurdPassRegistryEntry[] = [
  {
    familyId: 'ultra_low_trajectory_rescue_short_cycle',
    stage: 'late_final_veto',
    blockedReason: SQUAT_ULTRA_LOW_TRAJECTORY_SHORT_CYCLE_UI_BLOCKED_REASON,
    description:
      'Trajectory-rescued ultra_low_rom_cycle under minimum cycle duration — block-only.',
    predicate: shouldBlockSquatUltraLowTrajectoryRescueShortCycleFinalPass,
  },
  {
    familyId: 'ultra_low_setup_series_start_false_pass',
    stage: 'late_final_veto',
    blockedReason: SQUAT_SETUP_SERIES_START_FALSE_PASS_BLOCKED_REASON,
    description:
      'Setup/arming fallback + series-start peak anchor + collapsed descent/reversal timestamps — block-only.',
    predicate: shouldBlockSquatUltraLowSetupSeriesStartFalsePassFinalPass,
  },
  {
    familyId: 'blended_early_peak_contaminated_false_pass',
    stage: 'late_final_veto',
    blockedReason: SQUAT_BLENDED_EARLY_PEAK_CONTAMINATED_FALSE_PASS_BLOCKED_REASON,
    description:
      'Blended/assisted shallow-like + very-early peak + no event-cycle rescue + weak completion — block-only.',
    predicate: shouldBlockSquatBlendedEarlyPeakContaminatedFalsePassFinalPass,
  },
] as const;

/**
 * Result of registry evaluation. `null` means no active absurd-pass
 * family fired for this frame. Otherwise the caller must close the
 * final-pass surface with this exact `blockedReason` and record
 * `familyId` for diagnostics.
 *
 * There is intentionally no `grant` or `allow` variant.
 */
export interface SquatAbsurdPassRegistryVerdict {
  readonly familyId: SquatAbsurdPassFamilyId;
  readonly blockedReason: string;
}

/**
 * Single evaluator for the active late-veto registry. Iterates entries
 * in production order and returns the first firing entry. This function
 * is **pure**, **side-effect-free**, and **cannot** open final pass —
 * it only ever returns `null` or a `{ familyId, blockedReason }` close
 * verdict.
 */
export function evaluateSquatAbsurdPassRegistry(input: {
  stepId: CameraStepId;
  squatCompletionState: unknown;
  squatCycleDebug: SquatCycleDebug | undefined;
}): SquatAbsurdPassRegistryVerdict | null {
  for (const entry of SQUAT_ACTIVE_ABSURD_PASS_REGISTRY) {
    if (entry.predicate(input.stepId, input.squatCompletionState, input.squatCycleDebug)) {
      return { familyId: entry.familyId, blockedReason: entry.blockedReason };
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// Passive family inventory — already fail-closed by upstream layers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Known absurd-pass families that the active late-veto registry does
 * NOT enforce because upstream layers already fail-close them. This is
 * a read-only audit surface — no runtime predicate, no blocker
 * registration. Future PRs may decide to elevate a family into the
 * active registry; doing so is explicitly out of P3 scope.
 */
export interface SquatUpstreamClassifiedAbsurdPassFamily {
  readonly familyId: string;
  readonly stage: 'upstream_classified_only';
  readonly description: string;
  /**
   * Which upstream layer(s) already fail-close this family. Free-form
   * strings so the inventory can evolve without churning a union type.
   */
  readonly closedByUpstreamLayer: readonly string[];
  /**
   * Blocked-reason strings this family surfaces through when it fails
   * closed upstream, recorded for diagnostic grep-ability. Not an
   * exhaustive list — it is a representative catalogue.
   */
  readonly representativeBlockedReasons: readonly string[];
}

/**
 * Inventory of known absurd-pass families that are already fail-closed
 * by upstream layers. Ordered to match the P3 SSOT inventory list.
 *
 * This list is intentionally passive: no runtime code reads it to
 * decide anything. It exists so future auditors can see the complete
 * absurd-pass family surface in one place without having to rediscover
 * each upstream guard.
 */
export const SQUAT_UPSTREAM_CLASSIFIED_ABSURD_PASS_FAMILIES: readonly SquatUpstreamClassifiedAbsurdPassFamily[] = [
  {
    familyId: 'standing_still',
    stage: 'upstream_classified_only',
    description:
      'No descent / no reversal / no recovery — standing still cannot satisfy completion state.',
    closedByUpstreamLayer: [
      'evaluateSquatCompletionState',
      'computeSquatCompletionOwnerTruth',
      'getSquatPostOwnerFinalPassBlockedReason',
    ],
    representativeBlockedReasons: [
      'completion_not_satisfied',
      'not_standing_recovered',
      'cycle_not_complete',
      'completion_truth_not_passed',
    ],
  },
  {
    familyId: 'seated_hold_or_still_seated_at_pass',
    stage: 'upstream_classified_only',
    description:
      'Seated hold / still-seated frame cannot satisfy completion state because the rep never standing-recovers.',
    closedByUpstreamLayer: [
      'evaluateSquatCompletionState',
      'computeSquatCompletionOwnerTruth',
    ],
    representativeBlockedReasons: ['not_standing_recovered', 'cycle_not_complete'],
  },
  {
    familyId: 'setup_motion_contaminated_cycle',
    stage: 'upstream_classified_only',
    description:
      'Setup/arming motion contamination is fail-closed by the setup-motion guard before the UI gate opens.',
    closedByUpstreamLayer: [
      'computeSquatUiProgressionLatchGate',
      'evaluateSquatCompletionState:setupMotionBlocked',
    ],
    representativeBlockedReasons: ['setup_motion_blocked'],
  },
  {
    familyId: 'stale_prior_rep_reused_as_current_rep',
    stage: 'upstream_classified_only',
    description:
      'Pass-core `passCoreStale === true` is a same-rep stale veto applied inside readSquatPassOwnerTruth.',
    closedByUpstreamLayer: ['readSquatPassOwnerTruth'],
    representativeBlockedReasons: ['pass_core_stale_rep'],
  },
  {
    familyId: 'mixed_rep_timestamp_contamination',
    stage: 'upstream_classified_only',
    description:
      'Mixed-rep / cross-rep timestamp contamination is guarded by completion-state invariants and the owner contradiction invariant.',
    closedByUpstreamLayer: [
      'evaluateSquatCompletionState',
      'enforceSquatOwnerContradictionInvariant',
    ],
    representativeBlockedReasons: [
      'owner_contradiction:cycle_not_complete',
      'owner_contradiction:completion_truth_not_passed',
    ],
  },
  {
    familyId: 'no_real_descent',
    stage: 'upstream_classified_only',
    description:
      'Missing real descent is fail-closed by descent-confirmation and the canonical shallow contract before completion-state truth can pass.',
    closedByUpstreamLayer: ['evaluateSquatCompletionState', 'shallow-completion-contract'],
    representativeBlockedReasons: ['completion_not_satisfied', 'completion_reason_not_confirmed'],
  },
  {
    familyId: 'no_real_reversal_or_ascent_equivalent',
    stage: 'upstream_classified_only',
    description:
      'Missing reversal / ascent-equivalent is fail-closed by reversal evidence and trajectory rescue provenance guards.',
    closedByUpstreamLayer: ['evaluateSquatCompletionState', 'shallow-completion-contract'],
    representativeBlockedReasons: ['completion_not_satisfied', 'completion_reason_not_confirmed'],
  },
  {
    familyId: 'no_real_recovery_after_reversal',
    stage: 'upstream_classified_only',
    description:
      'No standing recovery after reversal is fail-closed by completion-owner truth (requires `currentSquatPhase === "standing_recovered"`).',
    closedByUpstreamLayer: ['computeSquatCompletionOwnerTruth'],
    representativeBlockedReasons: ['not_standing_recovered'],
  },
] as const;
