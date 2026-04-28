/**
 * PR-CAMERA-QUALITY-ENRICHMENT-04 — interpretation-only adjustment from PR3 QualityWindowTrace.
 *
 * Uses only compact fields already on QualityWindowTrace. No evaluator/coverageRatio/raw frames.
 * Does not upgrade tier/confidence — may add limitations and downgrade high→medium conservatively.
 */
import type { QualityWindowTrace } from '@/lib/camera/stability';

export const CAMERA_INTERPRETATION_QUALITY_ENRICHMENT_POLICY_VERSION =
  'camera_interpretation_quality_enrichment_pr4_01' as const;

/** Mirrors evaluator INTERNAL_QUALITY_WINDOW_OPTIONS.minWindowMs (read-only conceptual alignment). */
const INTERP_QUALITY_MIN_WINDOW_DURATION_MS = 800;
/** Mirrors MIN_INTERNAL_QUALITY_WINDOW_FRAMES (=4). */
const INTERP_QUALITY_MIN_WINDOW_FRAMES = 4;

type Tier = 'high' | 'medium' | 'low';

export type InterpretationIQBaseSnapshot = {
  confidence: number;
  qualityTier: Tier;
  limitations: string[];
};

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function uniqPush(limits: string[], code: string): void {
  if (!limits.includes(code)) limits.push(code);
}

/**
 * Post-process squat/overhead IQ after base scores derived. Pure; does not mutate input arrays.
 */
export function applyInterpretationQualityWindowEnrichment(
  base: InterpretationIQBaseSnapshot,
  trace: QualityWindowTrace | undefined
): InterpretationIQBaseSnapshot {
  const limitations = [...base.limitations];
  let confidence = clamp01(base.confidence);
  let qualityTier = base.qualityTier;

  if (trace == null) {
    return { confidence, qualityTier, limitations };
  }

  let downgradeHigh = false;

  const fc = trace.selectedWindowFrameCount;
  const dur = trace.selectedWindowDurationMs;
  const sc = trace.selectedWindowScore;
  const src = trace.selectedWindowSource;
  const fr = trace.fallbackReason ?? null;

  if (src === 'unavailable' || fc <= 0) {
    uniqPush(limitations, 'interpretation_window_unavailable');
    confidence *= 0.88;
    if (qualityTier === 'high') qualityTier = 'low';
    else if (qualityTier === 'medium') qualityTier = 'low';
    return { confidence: clamp01(confidence), qualityTier, limitations };
  }

  if (src === 'fallback_sparse_frames' || src === 'fallback_all_valid_frames') {
    uniqPush(limitations, 'interpretation_window_fallback');
    confidence *= 0.94;
    downgradeHigh = true;
  }

  if (fr === 'selected_window_too_sparse' || fr === 'no_valid_frames') {
    uniqPush(limitations, 'interpretation_window_sparse_or_empty');
    confidence *= 0.92;
    downgradeHigh = true;
  }

  if (fc > 0 && fc < INTERP_QUALITY_MIN_WINDOW_FRAMES) {
    uniqPush(limitations, 'interpretation_window_fragmentary');
    confidence *= 0.91;
    downgradeHigh = true;
  }

  if (dur != null && dur > 0 && dur < INTERP_QUALITY_MIN_WINDOW_DURATION_MS) {
    uniqPush(limitations, 'interpretation_window_short_duration');
    confidence *= 0.93;
    downgradeHigh = true;
  }

  /** Low selected-window intrinsic quality — never promote; weak signal adds penalty only. */
  if (typeof sc === 'number' && Number.isFinite(sc) && sc < 0.5) {
    uniqPush(limitations, 'interpretation_window_score_weak');
    confidence *= clamp01(0.72 + (sc / 0.5) * 0.28);
    if (sc < 0.33) downgradeHigh = true;
  }

  if (qualityTier === 'high' && downgradeHigh) {
    qualityTier = 'medium';
  }

  return {
    confidence: clamp01(confidence),
    qualityTier,
    limitations,
  };
}
