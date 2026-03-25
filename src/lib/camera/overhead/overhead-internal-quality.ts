/**
 * PR-COMP-04 — 오버헤드 **내부 해석** 레이어 (completion·pass와 무관).
 */
import type { MotionInternalQualityBase } from '@/lib/camera/types/motion-completion';
import { OVERHEAD_REQUIRED_HOLD_MS, OVERHEAD_TOP_FLOOR_DEG } from './overhead-constants';

export type OverheadInternalQuality = MotionInternalQualityBase & {
  mobilityScore: number;
  controlScore: number;
  symmetryScore: number;
  holdStabilityScore: number;
};

export type OverheadInternalQualityInput = {
  peakArmElevationDeg: number;
  meanAsymmetryDeg: number | null;
  lumbarExtensionDeviationDeg: number | null;
  holdDurationMs: number;
  stableTopDwellMs: number;
  stableTopSegmentCount: number;
  dwellCoherent: boolean;
  validFrameRatio: number;
  signalIntegrityMultiplier: number;
  raiseCount: number;
  peakCount: number;
};

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function scoreMobilityStrict(peakDeg: number): number {
  if (peakDeg <= 0) return 0;
  if (peakDeg >= 152) return clamp01(0.82 + ((peakDeg - 152) / 40) * 0.18);
  if (peakDeg >= OVERHEAD_TOP_FLOOR_DEG) {
    return 0.5 + ((peakDeg - OVERHEAD_TOP_FLOOR_DEG) / (152 - OVERHEAD_TOP_FLOOR_DEG)) * 0.32;
  }
  return (peakDeg / OVERHEAD_TOP_FLOOR_DEG) * 0.5;
}

function scoreSymmetryStrict(meanAsym: number | null): number {
  if (meanAsym == null) return 0.52;
  return clamp01(1 - meanAsym / 26);
}

function scoreControlStrict(lumbarDev: number | null): number {
  if (lumbarDev == null) return 0.55;
  return clamp01(1 - lumbarDev / 28);
}

function scoreHoldStabilityStrict(input: OverheadInternalQualityInput): number {
  const ratio = OVERHEAD_REQUIRED_HOLD_MS > 0 ? input.holdDurationMs / OVERHEAD_REQUIRED_HOLD_MS : 0;
  let base = clamp01(ratio * 0.72);
  if (input.dwellCoherent) base += 0.18;
  else base *= 0.78;
  if (input.stableTopSegmentCount >= 2) base += 0.06;
  base += clamp01(input.stableTopDwellMs / 1800) * 0.12;
  return clamp01(base);
}

function deriveTier(
  m: number,
  c: number,
  s: number,
  h: number,
  conf: number
): 'high' | 'medium' | 'low' {
  const core = ((m + c + s + h) / 4) * conf;
  const w = Math.min(m, c, s, h);
  if (core >= 0.64 && w >= 0.44 && conf >= 0.55) return 'high';
  if (core < 0.36 || w < 0.26 || conf < 0.38) return 'low';
  return 'medium';
}

function limitationsFor(
  m: number,
  c: number,
  s: number,
  h: number,
  conf: number,
  input: OverheadInternalQualityInput
): string[] {
  const lim: string[] = [];
  if (m < 0.44) lim.push('mobility_limited');
  if (c < 0.44) lim.push('compensation_elevated');
  if (s < 0.44) lim.push('asymmetry_elevated');
  if (h < 0.44) lim.push('hold_stability_weak');
  if (conf < 0.5) lim.push('low_tracking_confidence');
  if (input.raiseCount > 0 && input.peakCount === 0) lim.push('peak_phase_missing');
  return lim;
}

export function overheadInternalQualityInsufficientSignal(): OverheadInternalQuality {
  return {
    mobilityScore: 0,
    controlScore: 0,
    symmetryScore: 0,
    holdStabilityScore: 0,
    confidence: 0,
    qualityTier: 'low',
    limitations: ['insufficient_frames'],
  };
}

export function computeOverheadInternalQuality(
  input: OverheadInternalQualityInput
): OverheadInternalQuality {
  const mobilityScore = scoreMobilityStrict(input.peakArmElevationDeg);
  const symmetryScore = scoreSymmetryStrict(input.meanAsymmetryDeg);
  const controlScore = scoreControlStrict(input.lumbarExtensionDeviationDeg);
  const holdStabilityScore = scoreHoldStabilityStrict(input);
  const confidence = clamp01(input.validFrameRatio * clamp01(input.signalIntegrityMultiplier));
  const qualityTier = deriveTier(
    mobilityScore,
    controlScore,
    symmetryScore,
    holdStabilityScore,
    confidence
  );
  const limitations = limitationsFor(
    mobilityScore,
    controlScore,
    symmetryScore,
    holdStabilityScore,
    confidence,
    input
  );

  return {
    mobilityScore: clamp01(mobilityScore),
    controlScore: clamp01(controlScore),
    symmetryScore: clamp01(symmetryScore),
    holdStabilityScore: clamp01(holdStabilityScore),
    confidence: clamp01(confidence),
    qualityTier,
    limitations,
  };
}
