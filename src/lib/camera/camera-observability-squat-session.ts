/**
 * CAM-OBS / DESCENT-TRUTH-RESET-01 / PASS-SNAPSHOT-OBSERVABILITY-RESET-01:
 *
 * Two observability layers:
 *
 * 1. frozenPassSnapshot — classic frozen snapshot (finalPassEligible false→true edge).
 *    Unchanged from original.
 *
 * 2. livePassCoreTruth — NEW. Captured on every gate update. Always shows the latest
 *    squatPassCore truth and squatUiGate truth, regardless of whether finalPassEligible
 *    ever becomes true. This eliminates the gap where pass_snapshot=null made it impossible
 *    to distinguish "pass-core never opened" from "UI gate blocked".
 *
 * SSOT §8 compliance: exported JSON must always show pass-core truth and UI gate truth.
 */
import type { ExerciseGateResult } from '@/lib/camera/auto-progression';
import { isFinalPassLatched } from '@/lib/camera/auto-progression';
import { formatSquatPassSnapshotObservabilityRow } from '@/lib/camera/evaluators/squat';
import type { SquatPassCoreResult } from '@/lib/camera/squat/pass-core';

let prevFinalPassEligible = false;
let frozenPassSnapshot: Record<string, unknown> | null = null;
/** PASS-SNAPSHOT-OBSERVABILITY-RESET-01: always-updated pass-core + UI gate truth snapshot. */
let livePassCoreTruth: Record<string, unknown> | null = null;

export function resetSquatCameraObservabilitySession(): void {
  prevFinalPassEligible = false;
  frozenPassSnapshot = null;
  livePassCoreTruth = null;
}

export function getFrozenSquatPassSnapshot(): Record<string, unknown> | null {
  return frozenPassSnapshot;
}

/**
 * PASS-SNAPSHOT-OBSERVABILITY-RESET-01: Returns the latest pass-core + UI gate truth.
 * Always non-null after the first gate update (even if finalPassEligible never goes true).
 * This directly exposes whether pass-core opened and whether UI gate allowed progression,
 * enabling real-device diagnosis without relying on the frozen pass snapshot.
 */
export function getLiveSquatPassCoreTruth(): Record<string, unknown> | null {
  return livePassCoreTruth;
}

/**
 * squat 페이지(또는 동일 gate 구동부)에서 매 gate 갱신 시 호출.
 *
 * - frozenPassSnapshot: `prevFinalPassEligible === false && gate.finalPassEligible === true`
 *   인 최초 1회만 고정 (기존 동작 유지).
 *
 * - livePassCoreTruth: 매 호출마다 squatPassCore + squatUiGate 현재 상태로 갱신
 *   (PASS-SNAPSHOT-OBSERVABILITY-RESET-01).
 */
export function noteSquatGateForCameraObservability(gate: ExerciseGateResult): void {
  if (gate.evaluatorResult?.stepId !== 'squat') return;

  const cs = gate.evaluatorResult.debug?.squatCompletionState;
  const hm = gate.evaluatorResult.debug?.highlightedMetrics as Record<string, unknown> | undefined;
  const nowElig = gate.finalPassEligible === true;
  const passCore = gate.evaluatorResult.debug?.squatPassCore as SquatPassCoreResult | undefined;
  const sqCycleDebug = gate.squatCycleDebug;
  const officialShallowOwnerFrozen = sqCycleDebug?.officialShallowOwnerFrozen === true;

  // ── PASS-SNAPSHOT-OBSERVABILITY-RESET-01 + Wave B opener unification ──
  // Expose the same effective opener truth the final-pass chain consumes.
  // rawPassDetected remains visible so pass-core math is not hidden.
  if (passCore != null) {
    const passDetected = passCore.passDetected === true || officialShallowOwnerFrozen;

    /**
     * PR-X2 same-epoch peak provenance adapter:
     * When the shallow-admitted current rep has had its peak anchor rebound by
     * `applyShallowAcquisitionPeakProvenanceUnification` (completion-state upstream
     * repair), the raw pass-core `peakAtMs` (derived from the shared descent truth
     * over the full pass-window) can lag behind the unified post-commit peak.
     *
     * This adapter prefers the unified completion-state `peakAtMs` only inside the
     * primary shallow-admitted epoch where unification actually fired. The raw
     * pass-core math is preserved under `rawPeakAtMs`, so deep/standard-cycle peak
     * computation is never touched and no new pass path is created.
     */
    const shallowPeakProvenanceUnified =
      cs?.shallowAcquisitionPeakProvenanceUnified === true &&
      typeof cs?.peakAtMs === 'number' &&
      Number.isFinite(cs.peakAtMs);
    const rawPassCorePeakAtMs = passCore.peakAtMs ?? null;
    const unifiedPeakAtMs = shallowPeakProvenanceUnified
      ? (cs!.peakAtMs as number)
      : rawPassCorePeakAtMs;

    livePassCoreTruth = {
      squatPassCore: {
        passDetected,
        passBlockedReason: passDetected ? null : passCore.passBlockedReason ?? null,
        rawPassDetected: passCore.passDetected,
        openerUnifiedByOfficialShallowOwner: officialShallowOwnerFrozen && passCore.passDetected !== true,
        descentDetected: passCore.descentDetected,
        descentStartAtMs: passCore.descentStartAtMs ?? null,
        peakAtMs: unifiedPeakAtMs,
        rawPeakAtMs: rawPassCorePeakAtMs,
        peakProvenanceUnifiedByShallow: shallowPeakProvenanceUnified,
        reversalAtMs: passCore.reversalAtMs ?? null,
        standingRecoveredAtMs: passCore.standingRecoveredAtMs ?? null,
        trace: passCore.trace,
      },
      squatUiGate: {
        uiProgressionAllowed: sqCycleDebug?.uiProgressionAllowed ?? null,
        uiProgressionBlockedReason: sqCycleDebug?.uiProgressionBlockedReason ?? null,
      },
      finalPassEligible: gate.finalPassEligible,
      finalPassBlockedReason: gate.finalPassBlockedReason ?? null,
    };
  }

  // ── Classic frozen snapshot (unchanged) ──
  if (!frozenPassSnapshot && !prevFinalPassEligible && nowElig && cs != null) {
    const latest =
      typeof hm?.latestSquatDepthProxy === 'number' && Number.isFinite(hm.latestSquatDepthProxy)
        ? hm.latestSquatDepthProxy
        : typeof cs.rawDepthPeak === 'number'
          ? cs.rawDepthPeak
          : 0;
    const baseline =
      typeof cs.baselineStandingDepth === 'number' && Number.isFinite(cs.baselineStandingDepth)
        ? cs.baselineStandingDepth
        : 0;
    const relCurrent = Math.max(0, latest - baseline);
    const standingTh =
      typeof cs.standingRecoveryThreshold === 'number' && Number.isFinite(cs.standingRecoveryThreshold)
        ? cs.standingRecoveryThreshold
        : 0;
    const stillSeatedAtPass = standingTh > 0 ? relCurrent > standingTh * 1.15 : false;

    const bottomPeakTs =
      cs.peakAtMs ??
      cs.reversalAtMs ??
      cs.committedAtMs ??
      null;

    const relPeak =
      typeof cs.relativeDepthPeak === 'number' && Number.isFinite(cs.relativeDepthPeak)
        ? cs.relativeDepthPeak
        : 0;

    const ownerRaw =
      gate.squatCycleDebug?.finalSuccessOwner ?? gate.squatCycleDebug?.passOwner ?? '';
    const passReasonRaw = cs.completionPassReason ?? '';

    frozenPassSnapshot = formatSquatPassSnapshotObservabilityRow({
      frameIdx: gate.guardrail.debug?.sampledFrameCount ?? 0,
      passReason: passReasonRaw,
      completionOwner: String(ownerRaw),
      eventCyclePromoted: cs.eventCyclePromoted === true,
      passLatched: isFinalPassLatched('squat', gate),
      descentConfirmed: cs.descendConfirmed === true,
      reversalConfirmedAfterDescend: cs.reversalConfirmedAfterDescend === true,
      recoveryConfirmedAfterReversal: cs.recoveryConfirmedAfterReversal === true,
      peakLatchedAtIndex:
        typeof cs.peakLatchedAtIndex === 'number' ? cs.peakLatchedAtIndex : null,
      bottomPeakTs,
      relativeDepthPeak: Math.round(relPeak * 1000) / 1000,
      currentDepth: Math.round(latest * 1000) / 1000,
      stillSeatedAtPass,
    });
  }

  prevFinalPassEligible = nowElig;
}
