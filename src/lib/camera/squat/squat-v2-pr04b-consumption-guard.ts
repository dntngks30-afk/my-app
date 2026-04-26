/**
 * PR-V2-INPUT-04B / PR-V2-INPUT-05: shared product **consumption** guard for squat V2.
 * Single source for auto-progression and evaluator recovery acceptance (no drift).
 * Does not change V2 pass logic inside squat-motion-evidence-v2.ts.
 */
import type { SquatMotionEvidenceDecisionV2 } from '@/lib/camera/squat/squat-motion-evidence-v2.types';

export const V2_ROLLING_FALLBACK_PASS_NOT_CONSUMABLE = 'v2_rolling_fallback_pass_not_consumable';
export const V2_KNEE_FLEX_PROXY_UNRELIABLE_PASS = 'v2_knee_flex_proxy_unreliable_pass';

export function readSquatV2KneeFlexProxyAngleRangeDeg(
  sourceStats: SquatMotionEvidenceDecisionV2['metrics']['v2InputSourceStats']
): number | null {
  if (sourceStats == null || typeof sourceStats !== 'object') return null;
  const rec = sourceStats as Record<string, unknown>;
  const knee = rec['knee_flex_proxy'];
  if (knee == null || typeof knee !== 'object') return null;
  const a = (knee as Record<string, unknown>)['angleRangeDeg'];
  if (typeof a !== 'number' || !Number.isFinite(a)) return null;
  return a;
}

/**
 * Narrow runtime-owner **consumption** guard. When usableMotionEvidence is false,
 * returns consumptionAllowed true (no safety layer — outer blockedReason handles it).
 */
export function evaluateSquatV2RuntimeOwnerSafetyConsumption(
  decision: SquatMotionEvidenceDecisionV2 | undefined
): { consumptionAllowed: boolean; blockedReason: string | null } {
  if (!decision || decision.usableMotionEvidence !== true) {
    return { consumptionAllowed: true, blockedReason: null };
  }
  const m = decision.metrics ?? {};

  if (m.usedRollingFallback === true || m.v2EpochSource === 'rolling_window_fallback') {
    return { consumptionAllowed: false, blockedReason: V2_ROLLING_FALLBACK_PASS_NOT_CONSUMABLE };
  }

  if (m.v2InputSelectedDepthSource === 'knee_flex_proxy') {
    const inputFrameCount = m.inputFrameCount ?? m.v2InputFrameCount;
    if (
      inputFrameCount == null ||
      typeof inputFrameCount !== 'number' ||
      !Number.isFinite(inputFrameCount)
    ) {
      return { consumptionAllowed: false, blockedReason: V2_KNEE_FLEX_PROXY_UNRELIABLE_PASS };
    }
    if (inputFrameCount < 18) {
      return { consumptionAllowed: false, blockedReason: V2_KNEE_FLEX_PROXY_UNRELIABLE_PASS };
    }
    const peakTail = m.peakDistanceFromTailFrames;
    if (
      peakTail == null ||
      typeof peakTail !== 'number' ||
      !Number.isFinite(peakTail) ||
      peakTail < 6
    ) {
      return { consumptionAllowed: false, blockedReason: V2_KNEE_FLEX_PROXY_UNRELIABLE_PASS };
    }
    if (m.v2InputFiniteButUselessDepthRejected === true) {
      return { consumptionAllowed: false, blockedReason: V2_KNEE_FLEX_PROXY_UNRELIABLE_PASS };
    }
    const kneeAngleDeg = readSquatV2KneeFlexProxyAngleRangeDeg(m.v2InputSourceStats);
    if (kneeAngleDeg != null && kneeAngleDeg < 18) {
      return { consumptionAllowed: false, blockedReason: V2_KNEE_FLEX_PROXY_UNRELIABLE_PASS };
    }
  }

  return { consumptionAllowed: true, blockedReason: null };
}
