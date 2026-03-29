/**
 * PR-04E2: squat completion-state 전용 reversal 확인 — peak 이후 상승(standing 방향) 증거.
 * HMM assist 모듈(squat-reversal-assist) 임계값은 변경하지 않으며, rule 측 보강 + 보조 rule_plus_hmm 만 담당.
 */

import type { PoseFeaturesFrame } from '@/lib/camera/pose-features';
import type { SquatHmmDecodeResult } from '@/lib/camera/squat/squat-hmm';

export type SquatReversalConfirmationSource = 'rule' | 'rule_plus_hmm' | 'none';

export interface SquatReversalConfirmation {
  reversalConfirmed: boolean;
  /** validFrames 인덱스 — 역전 앵커(피크) */
  reversalIndex: number | null;
  /** peak 대비 실제 하락량(확인에 사용된 depth 스트림 기준) */
  reversalDepthDrop: number;
  /** 확인에 기여한 연속/유효 프레임 수 */
  reversalFrameCount: number;
  reversalSource: SquatReversalConfirmationSource;
  notes: string[];
}

/** PR-04E1: reversal 탐지용 depth — blended 우선, primary 폴백 */
export function readSquatCompletionDepthForReversal(frame: PoseFeaturesFrame): number | null {
  const b = frame.derived.squatDepthProxyBlended;
  if (typeof b === 'number' && Number.isFinite(b)) return b;
  const p = frame.derived.squatDepthProxy;
  return typeof p === 'number' && Number.isFinite(p) ? p : null;
}

export interface SquatReversalDetectInput {
  validFrames: PoseFeaturesFrame[];
  peakValidIndex: number;
  peakPrimaryDepth: number;
  relativeDepthPeak: number;
  reversalDropRequired: number;
  hmm?: SquatHmmDecodeResult | null;
}

/** 완화 rule·HMM 보조 적용 최소 ROM — shallow bounce 에는 적용 안 함 */
const MODERATE_ROM_REL_PEAK_FLOOR = 0.12;
/** PR-CAM-SHALLOW-REVERSAL-SIGNAL-01: <0.08 은 기존과 동일 ultra-shallow strict-only */
const ULTRA_SHALLOW_STRICT_ONLY_FLOOR = 0.08;
/** 0.08 <= rel < 0.12 만 제한적 window relax 허용 (ascent/HMM 금지) */
const SHALLOW_RELAX_FLOOR = 0.08;
const SHALLOW_RELAX_CEIL = 0.12;
/** shallow-relax 전용 drop 계수 — 기존 WINDOW_RELAX_FACTOR(0.92)와 별도, 함수 본문 미변경 유지 */
const SHALLOW_WINDOW_RELAX_FACTOR = 0.88;
const WINDOW_RELAX_FACTOR = 0.92;
/** 너무 낮으면 PR-HMM-04B 완만 상승 합성 시퀀스가 구 assist 전에 rule로 열려 스모크·계약이 깨짐 */
const ASCENT_STREAK_RELAX_FACTOR = 0.93;
const HMM_BRIDGE_MIN_REL_PEAK = 0.16;
const HMM_BRIDGE_CONFIDENCE = 0.38;
const HMM_BRIDGE_MIN_ASCENT = 2;
const HMM_BRIDGE_DROP_FACTOR = 0.93;

export interface PostPeakRecoveryEvidence {
  minPostPeakPrimary: number;
  minPostPeakReversal: number;
  dropPrimary: number;
  dropReversal: number;
  postPeakFrameCount: number;
  ascentStreakMax: number;
}

export function computePostPeakRecoveryEvidence(
  validFrames: PoseFeaturesFrame[],
  peakValidIndex: number,
  peakPrimaryDepth: number
): PostPeakRecoveryEvidence {
  const post = validFrames.slice(peakValidIndex + 1);
  let minP = peakPrimaryDepth;
  let minR = peakPrimaryDepth;
  for (const f of post) {
    const p = f.derived.squatDepthProxy;
    const r = readSquatCompletionDepthForReversal(f);
    if (typeof p === 'number' && Number.isFinite(p) && p < minP) minP = p;
    if (typeof r === 'number' && Number.isFinite(r) && r < minR) minR = r;
  }
  let streak = 0;
  let bestStreak = 0;
  for (const f of post) {
    if (f.phaseHint === 'ascent') {
      streak += 1;
      bestStreak = Math.max(bestStreak, streak);
    } else {
      streak = 0;
    }
  }
  return {
    minPostPeakPrimary: minP,
    minPostPeakReversal: minR,
    dropPrimary: Math.max(0, peakPrimaryDepth - minP),
    dropReversal: Math.max(0, peakPrimaryDepth - minR),
    postPeakFrameCount: post.length,
    ascentStreakMax: bestStreak,
  };
}

/** 단발 1프레임 스파이크 역전 방지: 연속 2프레임이 임계 이하 */
function strictPrimaryHit(
  validFrames: PoseFeaturesFrame[],
  peakValidIndex: number,
  peakPrimaryDepth: number,
  required: number
): { hit: boolean; firstIdx: number | null; count: number } {
  for (let i = peakValidIndex + 1; i < validFrames.length - 1; i++) {
    const d0 = validFrames[i]!.derived.squatDepthProxy;
    const d1 = validFrames[i + 1]!.derived.squatDepthProxy;
    if (typeof d0 !== 'number' || !Number.isFinite(d0)) continue;
    if (typeof d1 !== 'number' || !Number.isFinite(d1)) continue;
    if (d0 <= peakPrimaryDepth - required && d1 <= peakPrimaryDepth - required) {
      return { hit: true, firstIdx: i, count: 2 };
    }
  }
  return { hit: false, firstIdx: null, count: 0 };
}

function strictReversalHit(
  validFrames: PoseFeaturesFrame[],
  peakValidIndex: number,
  peakPrimaryDepth: number,
  required: number
): { hit: boolean; firstIdx: number | null; count: number } {
  for (let i = peakValidIndex + 1; i < validFrames.length - 1; i++) {
    const r0 = readSquatCompletionDepthForReversal(validFrames[i]!);
    const r1 = readSquatCompletionDepthForReversal(validFrames[i + 1]!);
    if (r0 == null || r1 == null) continue;
    if (r0 <= peakPrimaryDepth - required && r1 <= peakPrimaryDepth - required) {
      return { hit: true, firstIdx: i, count: 2 };
    }
  }
  return { hit: false, firstIdx: null, count: 0 };
}

/**
 * PR-CAM-SHALLOW-REVERSAL-SIGNAL-01: [0.08, 0.12) 전용 — 피크 직후 4프레임·reversal depth 유효 ≥2·drop ≥ required*0.88
 * windowReversalRelax / ascent / HMM 과 분리(계수·노트 다름).
 */
function shallowWindowReversalRelax(
  validFrames: PoseFeaturesFrame[],
  peakValidIndex: number,
  peakPrimaryDepth: number,
  required: number
): { ok: boolean; drop: number; frames: number } {
  const win = 4;
  const slice = validFrames.slice(peakValidIndex + 1, peakValidIndex + 1 + win);
  const revs = slice
    .map((f) => readSquatCompletionDepthForReversal(f))
    .filter((x): x is number => x != null);
  if (revs.length < 2) return { ok: false, drop: 0, frames: revs.length };
  const minR = Math.min(...revs);
  const drop = peakPrimaryDepth - minR;
  return {
    ok: drop >= required * SHALLOW_WINDOW_RELAX_FACTOR,
    drop,
    frames: revs.length,
  };
}

function windowReversalRelax(
  validFrames: PoseFeaturesFrame[],
  peakValidIndex: number,
  peakPrimaryDepth: number,
  required: number,
  win: number
): { ok: boolean; drop: number; frames: number } {
  const slice = validFrames.slice(peakValidIndex + 1, peakValidIndex + 1 + win);
  if (slice.length < 2) return { ok: false, drop: 0, frames: 0 };
  const revs = slice
    .map((f) => readSquatCompletionDepthForReversal(f))
    .filter((x): x is number => x != null);
  if (revs.length < 2) return { ok: false, drop: 0, frames: 0 };
  const minR = Math.min(...revs);
  const drop = peakPrimaryDepth - minR;
  return {
    ok: drop >= required * WINDOW_RELAX_FACTOR,
    drop,
    frames: revs.length,
  };
}

function ascentStreakRelax(
  validFrames: PoseFeaturesFrame[],
  peakValidIndex: number,
  peakPrimaryDepth: number,
  required: number
): { ok: boolean; drop: number; streak: number } {
  const post = validFrames.slice(peakValidIndex + 1);
  for (let i = 0; i < post.length - 1; i++) {
    const f0 = post[i]!;
    const f1 = post[i + 1]!;
    if (f0.phaseHint !== 'ascent' || f1.phaseHint !== 'ascent') continue;
    const r0 = readSquatCompletionDepthForReversal(f0);
    const r1 = readSquatCompletionDepthForReversal(f1);
    if (r0 == null || r1 == null) continue;
    const minR = Math.min(r0, r1);
    const drop = peakPrimaryDepth - minR;
    if (drop >= required * ASCENT_STREAK_RELAX_FACTOR) {
      return { ok: true, drop, streak: 2 };
    }
  }
  return { ok: false, drop: 0, streak: 0 };
}

function hmmBridgeConfirm(
  validFrames: PoseFeaturesFrame[],
  peakValidIndex: number,
  peakPrimaryDepth: number,
  required: number,
  relativeDepthPeak: number,
  hmm: SquatHmmDecodeResult | null | undefined
): { ok: boolean; drop: number } {
  if (relativeDepthPeak < HMM_BRIDGE_MIN_REL_PEAK) return { ok: false, drop: 0 };
  if (hmm == null) return { ok: false, drop: 0 };
  if (!hmm.completionCandidate) return { ok: false, drop: 0 };
  if (hmm.confidence < HMM_BRIDGE_CONFIDENCE) return { ok: false, drop: 0 };
  if (hmm.dominantStateCounts.ascent < HMM_BRIDGE_MIN_ASCENT) return { ok: false, drop: 0 };
  const ev = computePostPeakRecoveryEvidence(validFrames, peakValidIndex, peakPrimaryDepth);
  if (ev.dropReversal < required * HMM_BRIDGE_DROP_FACTOR) return { ok: false, drop: ev.dropReversal };
  return { ok: true, drop: ev.dropReversal };
}

/**
 * 피크 이후 역전(상승 시작) rule + 선택적 HMM 보조.
 * relativeDepthPeak < 0.08: strict-only · <0.12 구간은 [0.08,0.12) 에서 shallowWindowReversalRelax 만 추가.
 */
export function detectSquatReversalConfirmation(input: SquatReversalDetectInput): SquatReversalConfirmation {
  const notes: string[] = [];
  const {
    validFrames,
    peakValidIndex,
    peakPrimaryDepth,
    relativeDepthPeak,
    reversalDropRequired: req,
    hmm,
  } = input;

  const ev = computePostPeakRecoveryEvidence(validFrames, peakValidIndex, peakPrimaryDepth);

  const sp = strictPrimaryHit(validFrames, peakValidIndex, peakPrimaryDepth, req);
  if (sp.hit && sp.firstIdx != null) {
    const d0 = validFrames[sp.firstIdx]!.derived.squatDepthProxy;
    const d1 = validFrames[sp.firstIdx + 1]!.derived.squatDepthProxy;
    const minPair =
      typeof d0 === 'number' && Number.isFinite(d0) && typeof d1 === 'number' && Number.isFinite(d1)
        ? Math.min(d0, d1)
        : typeof d0 === 'number' && Number.isFinite(d0)
          ? d0
          : peakPrimaryDepth;
    const dropP = peakPrimaryDepth - minPair;
    notes.push('strict_primary_hit');
    return {
      reversalConfirmed: true,
      reversalIndex: peakValidIndex,
      reversalDepthDrop: Math.max(dropP, 0),
      reversalFrameCount: sp.count,
      reversalSource: 'rule',
      notes,
    };
  }

  const sr = strictReversalHit(validFrames, peakValidIndex, peakPrimaryDepth, req);
  if (sr.hit && sr.firstIdx != null) {
    const r0 = readSquatCompletionDepthForReversal(validFrames[sr.firstIdx]!);
    const r1 = readSquatCompletionDepthForReversal(validFrames[sr.firstIdx + 1]!);
    const minR = r0 != null && r1 != null ? Math.min(r0, r1) : r0 ?? r1 ?? peakPrimaryDepth;
    const dropR = peakPrimaryDepth - minR;
    notes.push('strict_blended_hit');
    return {
      reversalConfirmed: true,
      reversalIndex: peakValidIndex,
      reversalDepthDrop: Math.max(dropR, 0),
      reversalFrameCount: sr.count,
      reversalSource: 'rule',
      notes,
    };
  }

  if (relativeDepthPeak < ULTRA_SHALLOW_STRICT_ONLY_FLOOR) {
    notes.push('ultra_shallow_strict_only_no_hit');
    return {
      reversalConfirmed: false,
      reversalIndex: null,
      reversalDepthDrop: Math.max(ev.dropPrimary, ev.dropReversal),
      reversalFrameCount: 0,
      reversalSource: 'none',
      notes,
    };
  }

  if (relativeDepthPeak >= SHALLOW_RELAX_FLOOR && relativeDepthPeak < SHALLOW_RELAX_CEIL) {
    const sw = shallowWindowReversalRelax(validFrames, peakValidIndex, peakPrimaryDepth, req);
    if (sw.ok) {
      notes.push('shallow_window_reversal_relax');
      return {
        reversalConfirmed: true,
        reversalIndex: peakValidIndex,
        reversalDepthDrop: sw.drop,
        reversalFrameCount: sw.frames,
        reversalSource: 'rule',
        notes,
      };
    }
    notes.push('shallow_relax_no_hit');
    return {
      reversalConfirmed: false,
      reversalIndex: null,
      reversalDepthDrop: Math.max(ev.dropPrimary, ev.dropReversal),
      reversalFrameCount: 0,
      reversalSource: 'none',
      notes,
    };
  }

  const w = windowReversalRelax(validFrames, peakValidIndex, peakPrimaryDepth, req, 4);
  if (w.ok) {
    notes.push('window_reversal_relax');
    return {
      reversalConfirmed: true,
      reversalIndex: peakValidIndex,
      reversalDepthDrop: w.drop,
      reversalFrameCount: w.frames,
      reversalSource: 'rule',
      notes,
    };
  }

  const a = ascentStreakRelax(validFrames, peakValidIndex, peakPrimaryDepth, req);
  if (a.ok) {
    notes.push('ascent_streak_relax');
    return {
      reversalConfirmed: true,
      reversalIndex: peakValidIndex,
      reversalDepthDrop: a.drop,
      reversalFrameCount: a.streak,
      reversalSource: 'rule',
      notes,
    };
  }

  const hb = hmmBridgeConfirm(validFrames, peakValidIndex, peakPrimaryDepth, req, relativeDepthPeak, hmm);
  if (hb.ok) {
    notes.push('hmm_bridge_rule_plus_hmm');
    return {
      reversalConfirmed: true,
      reversalIndex: peakValidIndex,
      reversalDepthDrop: hb.drop,
      reversalFrameCount: 2,
      reversalSource: 'rule_plus_hmm',
      notes,
    };
  }

  return {
    reversalConfirmed: false,
    reversalIndex: null,
    reversalDepthDrop: Math.max(ev.dropPrimary, ev.dropReversal),
    reversalFrameCount: 0,
    reversalSource: 'none',
    notes,
  };
}
