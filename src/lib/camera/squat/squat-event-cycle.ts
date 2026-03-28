/**
 * PR-04E3B: shallow / low-ROM **event-cycle** 인식 전용 헬퍼.
 * completion truth 소유권은 squat-completion-state 에서만 승격하며,
 * 본 모듈은 동일 attempt 버퍼 내 궤적 증거만 산출한다 (HMM = 보조 증거).
 */

import type { PoseFeaturesFrame } from '@/lib/camera/pose-features';
import type { SquatHmmDecodeResult } from '@/lib/camera/squat/squat-hmm';

/** PR-04E1/04E3A 와 동일: completion·reversal read — squat-completion-state 와 순환 import 방지 */
function readCompletionDepth(frame: PoseFeaturesFrame): number | null {
  const b = frame.derived.squatDepthProxyBlended;
  if (typeof b === 'number' && Number.isFinite(b)) return b;
  const p = frame.derived.squatDepthProxy;
  return typeof p === 'number' && Number.isFinite(p) ? p : null;
}

const LOW_ROM_LABEL_FLOOR = 0.07;
const STANDARD_OWNER_FLOOR = 0.4;
const GUARDED_ULTRA_LOW_ROM_FLOOR = 0.01;
const LEGACY_ATTEMPT_FLOOR = 0.02;
const STANDING_RECOVERY_TOLERANCE_FLOOR = 0.015;
const STANDING_RECOVERY_TOLERANCE_RATIO = 0.18;
const MIN_DESCENT_FRAMES = 3;
const MIN_REVERSAL_FRAMES = 2;
const MIN_RECOVERY_FRAMES = 2;
const MIN_PEAK_PLATEAU_FRAMES = 2;
const JITTER_MAX_SINGLE_SPIKE_REL = 0.035;
const MIN_DESCENT_DELTA_FROM_BASELINE = 0.022;

export type SquatEventCycleBand = 'low_rom' | 'ultra_low_rom' | null;

export type SquatEventCycleSource = 'rule' | 'rule_plus_hmm' | 'none';

export interface SquatEventCycleResult {
  detected: boolean;
  band: SquatEventCycleBand;
  baselineFrozen: boolean;
  peakLatched: boolean;
  peakLatchedAtIndex: number | null;
  descentDetected: boolean;
  reversalDetected: boolean;
  recoveryDetected: boolean;
  nearStandingRecovered: boolean;
  peakDepth: number;
  relativePeak: number;
  descentFrames: number;
  reversalFrames: number;
  recoveryFrames: number;
  source: SquatEventCycleSource;
  notes: string[];
}

export type DetectSquatEventCycleOptions = {
  hmm?: SquatHmmDecodeResult | null;
  /** 고정 baseline (completion-state 가 동일 attempt 에서 고정한 값) */
  baselineFrozenDepth?: number | null;
  lockedSource?: 'primary' | 'blended' | null;
  baselineFrozen?: boolean;
  peakLatched?: boolean;
  peakLatchedAtIndex?: number | null;
};

export type SquatEventCycleDepthSample = {
  depth: number;
  timestampMs: number;
  phaseHint: PoseFeaturesFrame['phaseHint'];
  validIndex: number;
};

/**
 * 프레임에서 locked 스트림 기준 depth 시계열을 만든다 (evaluate 와 동일 규칙).
 */
export function buildFrozenSquatCycleWindow(
  frames: PoseFeaturesFrame[],
  options?: { lockedSource?: 'primary' | 'blended' | null }
): SquatEventCycleDepthSample[] {
  const valid = frames.filter((f) => f.isValid);
  const src = options?.lockedSource ?? 'primary';
  const out: SquatEventCycleDepthSample[] = [];
  for (let vi = 0; vi < valid.length; vi++) {
    const frame = valid[vi]!;
    const p = frame.derived.squatDepthProxy;
    if (typeof p !== 'number' || !Number.isFinite(p)) continue;
    const cRead = readCompletionDepth(frame);
    const depthCompletion = cRead != null && Number.isFinite(cRead) ? cRead : p;
    const depth = src === 'blended' ? depthCompletion : p;
    out.push({
      depth,
      timestampMs: frame.timestampMs,
      phaseHint: frame.phaseHint,
      validIndex: vi,
    });
  }
  return out;
}

function bandFromRelativePeak(
  relativePeak: number,
  attemptAdmissionSatisfied: boolean
): SquatEventCycleBand {
  if (relativePeak >= LOW_ROM_LABEL_FLOOR && relativePeak < STANDARD_OWNER_FLOOR) return 'low_rom';
  if (
    relativePeak >= GUARDED_ULTRA_LOW_ROM_FLOOR &&
    relativePeak < LOW_ROM_LABEL_FLOOR &&
    attemptAdmissionSatisfied
  ) {
    return 'ultra_low_rom';
  }
  return null;
}

/**
 * 동일 attempt 버퍼에서 shallow 의미 사이클(descent → peak → reversal → near-standing) 증거.
 * baseline/peak latch 가 없으면 promote 금지(호출 측이 flags 로 전달).
 */
export function detectSquatEventCycle(
  frames: PoseFeaturesFrame[],
  options?: DetectSquatEventCycleOptions
): SquatEventCycleResult {
  const notes: string[] = [];
  const baselineFrozen = options?.baselineFrozen === true;
  const peakLatched = options?.peakLatched === true;
  const peakLatchedAtIndex = options?.peakLatchedAtIndex ?? null;
  const lockedSource = options?.lockedSource ?? null;

  const empty = (): SquatEventCycleResult => ({
    detected: false,
    band: null,
    baselineFrozen,
    peakLatched,
    peakLatchedAtIndex,
    descentDetected: false,
    reversalDetected: false,
    recoveryDetected: false,
    nearStandingRecovered: false,
    peakDepth: 0,
    relativePeak: 0,
    descentFrames: 0,
    reversalFrames: 0,
    recoveryFrames: 0,
    source: 'none',
    notes,
  });

  if (!baselineFrozen || !peakLatched) {
    notes.push('freeze_or_latch_missing');
    return empty();
  }

  const baseline =
    options?.baselineFrozenDepth != null && Number.isFinite(options.baselineFrozenDepth)
      ? options.baselineFrozenDepth
      : null;
  if (baseline == null) {
    notes.push('no_baseline');
    return empty();
  }

  const series =
    lockedSource != null
      ? buildFrozenSquatCycleWindow(frames, { lockedSource })
      : buildFrozenSquatCycleWindow(frames, { lockedSource: 'primary' });

  if (series.length < 10) {
    notes.push('series_too_short');
    return empty();
  }

  let peakIdx = 0;
  let peakDepth = series[0]!.depth;
  for (let i = 1; i < series.length; i++) {
    if (series[i]!.depth > peakDepth) {
      peakDepth = series[i]!.depth;
      peakIdx = i;
    }
  }

  const relativePeak = Math.max(0, peakDepth - baseline);
  const guardedUltra =
    relativePeak >= GUARDED_ULTRA_LOW_ROM_FLOOR &&
    relativePeak < LEGACY_ATTEMPT_FLOOR &&
    series.some((s) => s.phaseHint === 'ascent' || s.phaseHint === 'start');
  const attemptAdmissionSatisfied =
    relativePeak >= LEGACY_ATTEMPT_FLOOR || guardedUltra;

  const band = bandFromRelativePeak(relativePeak, attemptAdmissionSatisfied);
  if (band == null) {
    notes.push('band_out_of_range');
    return {
      ...empty(),
      peakDepth,
      relativePeak,
    };
  }

  /** 단일 스파이크·바운스: 피크 전 구간이 너무 짧거나 피크 폭이 없음 */
  const prePeak = series.slice(0, peakIdx);
  const postPeak = series.slice(peakIdx + 1);
  const standingBand = Math.max(
    STANDING_RECOVERY_TOLERANCE_FLOOR,
    relativePeak * STANDING_RECOVERY_TOLERANCE_RATIO
  );

  let descentSteps = 0;
  for (let i = 1; i < prePeak.length; i++) {
    const rel = Math.max(0, prePeak[i]!.depth - baseline);
    const prevRel = Math.max(0, prePeak[i - 1]!.depth - baseline);
    if (rel > prevRel + 0.002) descentSteps += 1;
  }
  const descentFrames = descentSteps;
  const minRelBeforePeak = prePeak.length
    ? Math.min(...prePeak.map((s) => Math.max(0, s.depth - baseline)))
    : 0;
  const descentExcursion = relativePeak - minRelBeforePeak;
  const descentDetected =
    descentFrames >= MIN_DESCENT_FRAMES && descentExcursion >= MIN_DESCENT_DELTA_FROM_BASELINE;

  let plateau = 0;
  for (let i = peakIdx; i < series.length && i <= peakIdx + 3; i++) {
    if (Math.abs(series[i]!.depth - peakDepth) <= peakDepth * 0.04 + 0.003) plateau += 1;
  }
  const jitterSpike =
    relativePeak < JITTER_MAX_SINGLE_SPIKE_REL && plateau < MIN_PEAK_PLATEAU_FRAMES && prePeak.length < 5;

  const dropRequired = Math.max(0.007, relativePeak * 0.13);
  let reversalFrames = 0;
  let reversalDetected = false;
  for (const s of postPeak) {
    if (peakDepth - s.depth >= dropRequired) reversalFrames += 1;
  }
  reversalDetected = reversalFrames >= MIN_REVERSAL_FRAMES;

  let recoveryFrames = 0;
  for (let i = series.length - 1; i > peakIdx; i--) {
    const rel = Math.max(0, series[i]!.depth - baseline);
    if (rel <= standingBand) recoveryFrames += 1;
    else break;
  }
  const nearStandingRecovered = recoveryFrames >= MIN_RECOVERY_FRAMES;
  const recoveryDetected = recoveryFrames >= 1;

  const hmm = options?.hmm;
  let source: SquatEventCycleSource = 'rule';
  if (hmm != null && hmm.completionCandidate) {
    const c = hmm.dominantStateCounts;
    if (c.descent >= 1 && c.ascent >= 1 && (c.bottom >= 1 || relativePeak >= LOW_ROM_LABEL_FLOOR)) {
      source = 'rule_plus_hmm';
      notes.push('hmm_cycle_support');
    }
  }

  let detected =
    descentDetected &&
    reversalDetected &&
    nearStandingRecovered &&
    !jitterSpike &&
    attemptAdmissionSatisfied;

  if (!descentDetected) notes.push('descent_weak');
  if (!reversalDetected) notes.push('reversal_weak');
  if (!nearStandingRecovered) notes.push('recovery_tail_weak');
  if (jitterSpike) notes.push('jitter_spike_reject');

  /** rule 단독이 애매할 때만 HMM 이 감지를 보강 (final owner 아님) */
  if (!detected && source === 'rule_plus_hmm' && hmm != null && hmm.completionCandidate) {
    const c = hmm.dominantStateCounts;
    if (
      c.descent >= 2 &&
      c.ascent >= 2 &&
      nearStandingRecovered &&
      reversalFrames >= 1 &&
      relativePeak >= GUARDED_ULTRA_LOW_ROM_FLOOR &&
      !jitterSpike
    ) {
      detected = true;
      notes.push('hmm_assist_structural');
    }
  }

  return {
    detected,
    band: detected ? band : null,
    baselineFrozen,
    peakLatched,
    peakLatchedAtIndex,
    descentDetected,
    reversalDetected,
    recoveryDetected,
    nearStandingRecovered,
    peakDepth,
    relativePeak,
    descentFrames,
    reversalFrames,
    recoveryFrames,
    source,
    notes,
  };
}
