import type { PoseFeaturesFrame } from '../pose-features';

function meanSafe(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((sum, value) => sum + value, 0) / nums.length;
}

function meanHipCenter(
  frames: PoseFeaturesFrame[]
): { x: number; y: number } | null {
  const pts = frames
    .map((frame) => frame.joints.hipCenter)
    .filter((joint): joint is NonNullable<typeof joint> => joint != null && (joint.visibility ?? 0) >= 0.35);
  if (pts.length === 0) return null;
  return {
    x: meanSafe(pts.map((point) => point.x)),
    y: meanSafe(pts.map((point) => point.y)),
  };
}

export type SquatSetupMotionBlockResult = {
  blocked: boolean;
  reason: string | null;
};

/**
 * Shared setup contamination detector used by evaluator and completion-state.
 * The detector semantics are unchanged; this module only centralizes reuse so
 * completion-core can classify when the block first became observable.
 */
export function computeSquatSetupMotionBlock(
  validPipeline: PoseFeaturesFrame[]
): SquatSetupMotionBlockResult {
  if (validPipeline.length < 14) return { blocked: false, reason: null };
  let maxIdx = 0;
  let maxDepth = -Infinity;
  for (let i = 0; i < validPipeline.length; i += 1) {
    const depth = validPipeline[i]!.derived.squatDepthProxy;
    if (typeof depth === 'number' && Number.isFinite(depth) && depth > maxDepth) {
      maxDepth = depth;
      maxIdx = i;
    }
  }

  const head = validPipeline.slice(0, 4);
  const headAreas = head.map((frame) => frame.bodyBox.area).filter((area) => area > 0);
  const areaEarly = meanSafe(headAreas);
  const hipEarly = meanHipCenter(head);

  if (areaEarly > 0.03 && validPipeline.length >= 8) {
    for (let start = 4; start + 4 <= validPipeline.length; start += 1) {
      const mid = validPipeline.slice(start, start + 4);
      const midAreas = mid.map((frame) => frame.bodyBox.area).filter((area) => area > 0);
      const areaMid = meanSafe(midAreas);
      if (areaMid > 0 && areaMid / areaEarly < 0.67) {
        return { blocked: true, reason: 'step_back_or_camera_tilt_area_shrink' };
      }
      if (areaMid / areaEarly > 1.55) {
        return { blocked: true, reason: 'step_in_or_camera_close_area_spike' };
      }
      if (hipEarly) {
        const hipMid = meanHipCenter(mid);
        if (hipMid) {
          const dx = hipMid.x - hipEarly.x;
          const dy = hipMid.y - hipEarly.y;
          if (Math.hypot(dx, dy) > 0.138) {
            return { blocked: true, reason: 'large_framing_translation' };
          }
        }
      }
    }
  }

  if (maxIdx < 8) return { blocked: false, reason: null };

  const tail = validPipeline.slice(-4);
  const tailAreas = tail.map((frame) => frame.bodyBox.area).filter((area) => area > 0);
  const areaLate = meanSafe(tailAreas);
  if (areaEarly > 0.03 && areaLate > 0 && areaLate / areaEarly < 0.67) {
    return { blocked: true, reason: 'step_back_or_camera_tilt_area_shrink' };
  }
  if (areaEarly > 0.03 && areaLate / areaEarly > 1.55) {
    return { blocked: true, reason: 'step_in_or_camera_close_area_spike' };
  }
  const hipLate = meanHipCenter(tail);
  if (hipEarly && hipLate) {
    const dx = hipLate.x - hipEarly.x;
    const dy = hipLate.y - hipEarly.y;
    if (Math.hypot(dx, dy) > 0.138) {
      return { blocked: true, reason: 'large_framing_translation' };
    }
  }
  return { blocked: false, reason: null };
}

export type SquatSetupMotionBlockObservation = SquatSetupMotionBlockResult & {
  firstBlockedValidIndex: number | null;
  firstBlockedAtMs: number | null;
};

/**
 * Returns the first prefix where the shared setup detector flips to blocked.
 * The observed timestamp is used by completion-core to distinguish:
 * - before commit contamination,
 * - within-rep contamination, and
 * - after-completion retro-only contamination.
 */
export function findFirstSquatSetupMotionBlockObservation(
  validPipeline: PoseFeaturesFrame[]
): SquatSetupMotionBlockObservation {
  if (validPipeline.length < 14) {
    return {
      blocked: false,
      reason: null,
      firstBlockedValidIndex: null,
      firstBlockedAtMs: null,
    };
  }

  for (let end = 13; end < validPipeline.length; end += 1) {
    const prefix = validPipeline.slice(0, end + 1);
    const block = computeSquatSetupMotionBlock(prefix);
    if (block.blocked) {
      return {
        blocked: true,
        reason: block.reason,
        firstBlockedValidIndex: end,
        firstBlockedAtMs: validPipeline[end]!.timestampMs,
      };
    }
  }

  return {
    blocked: false,
    reason: null,
    firstBlockedValidIndex: null,
    firstBlockedAtMs: null,
  };
}
