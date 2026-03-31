/**
 * CAM-OBS: 스쿼트 세션당 `finalPassEligible` 최초 true 엣지에서 pass_snapshot 1회 고정.
 * completion / gate 산식은 변경하지 않는다.
 */
import type { ExerciseGateResult } from '@/lib/camera/auto-progression';
import { isFinalPassLatched } from '@/lib/camera/auto-progression';
import { formatSquatPassSnapshotObservabilityRow } from '@/lib/camera/evaluators/squat';

let prevFinalPassEligible = false;
let frozenPassSnapshot: Record<string, unknown> | null = null;

export function resetSquatCameraObservabilitySession(): void {
  prevFinalPassEligible = false;
  frozenPassSnapshot = null;
}

export function getFrozenSquatPassSnapshot(): Record<string, unknown> | null {
  return frozenPassSnapshot;
}

/**
 * squat 페이지(또는 동일 gate 구동부)에서 매 gate 갱신 시 호출.
 * `prevFinalPassEligible === false && gate.finalPassEligible === true` 인 최초 1회만 스냅샷 고정.
 */
export function noteSquatGateForCameraObservability(gate: ExerciseGateResult): void {
  if (gate.evaluatorResult?.stepId !== 'squat') return;

  const cs = gate.evaluatorResult.debug?.squatCompletionState;
  const hm = gate.evaluatorResult.debug?.highlightedMetrics as Record<string, unknown> | undefined;
  const nowElig = gate.finalPassEligible === true;

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
