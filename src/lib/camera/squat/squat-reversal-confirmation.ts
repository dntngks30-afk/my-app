/**
 * PR-04E2: squat completion-state 전용 reversal 확인 — peak 이후 상승(standing 방향) 증거.
 * HMM assist 모듈(squat-reversal-assist) 임계값은 변경하지 않으며, rule 측 보강 + 보조 rule_plus_hmm 만 담당.
 *
 * PR-02 Assist lock: trajectory rescue / tail backfill / HMM reversal assist 는 **reversal evidence provenance**만
 * 보강하며, 통과 게이트 소유권(completion truth finalized)을 대체하지 않는다. `reversalEvidenceProvenance`·`reversalConfirmedBy`는
 * 앵커 출처 추적용이다.
 *
 * PR-CAM-AUTHORITATIVE-REVERSAL-SPLIT-02 (completion-state): **권위 역전** 입력은 strict `detectSquatReversalConfirmation`·
 * HMM reversal assist(이미 권위 체인)·`evaluateOfficialShallowCompletionStreamBridge` 만이다. trajectory rescue·
 * standing tail backfill·ultra-shallow meaningful down-up rescue 는 `provenanceReversalEvidencePresent` 로만 구분한다(임계값 동일).
 *
 * -----------------------------------------------------------------------------
 * PR-SQUAT-COMPLETION-REARCH-01 — Subcontract B (Reversal / Ascent-Equivalent)
 * -----------------------------------------------------------------------------
 * B1 — `detectSquatReversalConfirmation`: strict + shallow relax + guarded ultra + HMM bridge (기존).
 * B2 — `evaluateOfficialShallowCompletionStreamBridge`: 공식 shallow 전용 completion-stream 역전·상승 등가.
 * B3 — orchestrator 측 trajectory/tail/HMM reversal assist: provenance only (closure 결정 안 함).
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
/**
 * PR-CAM-29B: squat-completion-state / squat-event-cycle 과 동일한 “의미 있는 시도” 하한.
 * 그 미만 상대 피크는 reversal assist 없이 strict-only (standing jitter 차단).
 */
const LEGACY_ATTEMPT_FLOOR = 0.02;
/**
 * squat-event-cycle.ts MIN_DESCENT_FRAMES / MIN_REVERSAL_FRAMES 와 동일 수치(모듈 직접 import 안 함).
 * guarded ultra-shallow 가 post-peak 증거·ascent streak 를 요구할 때만 사용.
 */
const MIN_DESCENT_FRAMES = 3;
const MIN_REVERSAL_FRAMES = 2;
/** PR-CAM-SHALLOW-REVERSAL-SIGNAL-01: [0.02,0.08) 에서는 PR-CAM-29B guarded assist 허용, <0.02 는 strict-only */
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

/**
 * PR-CAM-REVERSAL-SIGNAL-STABILIZATION-01: 피크 직후 짧은 구간에서 reversal depth 가 단조적으로
 * 서 있기 방향으로 움직이는 partial 상승을 strict 2-frame 동시 hit 없이도 rule 로 잡는다.
 * standing/jitter/1-frame spike 는 유효 프레임·단계 수·누적 drop 이 동시에 못 맞추게 한다.
 */
export function postPeakMonotonicReversalAssist(args: {
  validFrames: PoseFeaturesFrame[];
  peakValidIndex: number;
  peakPrimaryDepth: number;
  required: number;
  windowSize?: number;
  minFrames?: number;
  /** 기본 0.002 — 실기기 ultra-low 느린 복귀(프레임당 ~0.001)는 guarded 전용 더 작은 값으로 별도 호출 */
  stepDownEpsilon?: number;
}): { ok: boolean; drop: number; frames: number } {
  const windowSize = args.windowSize ?? 6;
  const minFrames = args.minFrames ?? 3;
  const stepDownEpsilon = args.stepDownEpsilon ?? 0.002;
  const slice = args.validFrames.slice(
    args.peakValidIndex + 1,
    args.peakValidIndex + 1 + windowSize
  );
  const depths: number[] = [];
  for (const f of slice) {
    const d = readSquatCompletionDepthForReversal(f);
    if (typeof d === 'number' && Number.isFinite(d)) depths.push(d);
  }
  const usedFrames = depths.length;
  if (usedFrames < minFrames) {
    const minObserved =
      usedFrames > 0 ? Math.min(...depths) : args.peakPrimaryDepth;
    return {
      ok: false,
      drop: Math.max(0, args.peakPrimaryDepth - minObserved),
      frames: usedFrames,
    };
  }
  let strictDownStepCount = 0;
  for (let i = 0; i < depths.length - 1; i++) {
    if (depths[i + 1]! <= depths[i]! - stepDownEpsilon) {
      strictDownStepCount += 1;
    }
  }
  const minObserved = Math.min(...depths);
  const drop = Math.max(0, args.peakPrimaryDepth - minObserved);
  let maxPartialFromPeak = 0;
  for (const d of depths) {
    maxPartialFromPeak = Math.max(maxPartialFromPeak, args.peakPrimaryDepth - d);
  }
  if (strictDownStepCount < 2) {
    return { ok: false, drop, frames: usedFrames };
  }
  if (drop < args.required * 0.88) {
    return { ok: false, drop, frames: usedFrames };
  }
  if (maxPartialFromPeak < args.required * 0.72) {
    return { ok: false, drop, frames: usedFrames };
  }
  return { ok: true, drop, frames: usedFrames };
}

/**
 * PR-SQUAT-ULTRA-SHALLOW-RUNTIME-FIX-03: primary/slow monotonic 이 모두 실패해도, 피크 이후 **전체** post-peak 에서
 * 누적 reversal-stream drop 과 다프레임 분산이 있으면 실기기 zig-zag·backloaded 복귀 인정.
 * 단일 프레임 스파이크·짧은 버퍼·약한 누적은 mid/deepBar·이웃 비율로 차단.
 */
function guardedUltraShallowCumulativeRuntimeFallback(
  validFrames: PoseFeaturesFrame[],
  peakValidIndex: number,
  peakPrimaryDepth: number,
  req: number,
  ev: PostPeakRecoveryEvidence
): SquatReversalConfirmation | null {
  const post = validFrames.slice(peakValidIndex + 1);
  if (post.length < 10 || ev.postPeakFrameCount < 10) return null;
  if (ev.dropReversal < req * 0.9) return null;

  const revs = post
    .map((f) => readSquatCompletionDepthForReversal(f))
    .filter((x): x is number => Number.isFinite(x));
  if (revs.length < 10) return null;

  const midBar = peakPrimaryDepth - req * 0.45;
  const deepBar = peakPrimaryDepth - req * 0.88;
  let countMid = 0;
  let countDeep = 0;
  for (const r of revs) {
    if (r <= midBar) countMid += 1;
    if (r <= deepBar) countDeep += 1;
  }
  if (countMid < 5 || countDeep < 2) return null;

  const minR = Math.min(...revs);
  const totalDrop = peakPrimaryDepth - minR;
  if (totalDrop < req * 0.9) return null;

  const minIdx = revs.indexOf(minR);
  const prevR = minIdx > 0 ? revs[minIdx - 1]! : peakPrimaryDepth;
  const nextR = minIdx < revs.length - 1 ? revs[minIdx + 1]! : peakPrimaryDepth;
  const maxNeighbor = Math.max(prevR, nextR);
  const troughIsolationDrop = maxNeighbor - minR;
  if (troughIsolationDrop > totalDrop * 0.72) return null;

  return {
    reversalConfirmed: true,
    reversalIndex: peakValidIndex,
    reversalDepthDrop: totalDrop,
    reversalFrameCount: Math.min(revs.length, 14),
    reversalSource: 'rule',
    notes: ['guarded_ultra_shallow_reversal_assist_cumulative_runtime'],
  };
}

/**
 * PR-CAM-29B: [LEGACY_ATTEMPT_FLOOR, ULTRA_SHALLOW_STRICT_ONLY_FLOOR) 전용.
 * strict primary/blended 가 모두 실패한 뒤에만 호출. source 는 rule 만 (HMM bridge·rule_plus_hmm 확장 없음).
 * postPeakMonotonicReversalAssist + ascent 연속 프레임 + 최소 post-peak 길이로 1-frame·seated hold 차단.
 */
function guardedUltraShallowReversalAssist(
  validFrames: PoseFeaturesFrame[],
  peakValidIndex: number,
  peakPrimaryDepth: number,
  req: number,
  relativeDepthPeak: number,
  ev: PostPeakRecoveryEvidence
): SquatReversalConfirmation | null {
  if (relativeDepthPeak < LEGACY_ATTEMPT_FLOOR || relativeDepthPeak >= ULTRA_SHALLOW_STRICT_ONLY_FLOOR) {
    return null;
  }
  /** 짧은 윈도우·0.002 스텝 — 기존 PR-CAM 안정화 경로 */
  const primaryMono = postPeakMonotonicReversalAssist({
    validFrames,
    peakValidIndex,
    peakPrimaryDepth,
    required: req,
    windowSize: 6,
    minFrames: 3,
    stepDownEpsilon: 0.002,
  });
  /**
   * PR-SQUAT-ULTRA-SHALLOW-RUNTIME-ALIGN-02 / FIX-02: authoritative ultra-low 는 피크 직후 프레임당 ~0.001 복귀만 있어
   * primaryMono(6f, ε=0.002) 가 실패해도 reversal-stream 누적 drop 은 충분할 수 있음. 긴 윈도우·0.001 스텝으로만 보강;
   * post-peak 길이·dropReversal 바닥으로 지터 단발과 구분.
   */
  const slowMono =
    !primaryMono.ok
      ? postPeakMonotonicReversalAssist({
          validFrames,
          peakValidIndex,
          peakPrimaryDepth,
          required: req,
          windowSize: 12,
          minFrames: 5,
          stepDownEpsilon: 0.001,
        })
      : { ok: false as const, drop: 0, frames: 0 };

  if (ev.postPeakFrameCount < MIN_DESCENT_FRAMES) return null;

  const ascentPhaseOk = ev.ascentStreakMax >= MIN_REVERSAL_FRAMES;
  const monotonicStreamIntegrityOk =
    primaryMono.ok &&
    primaryMono.frames >= 4 &&
    ev.dropReversal >= req * 0.88 &&
    ev.postPeakFrameCount >= 4;
  const slowRecoveryMonotonicOk =
    !primaryMono.ok &&
    slowMono.ok &&
    slowMono.frames >= 6 &&
    ev.dropReversal >= req * 0.88 &&
    ev.postPeakFrameCount >= 6;

  const monoForReturn = primaryMono.ok ? primaryMono : slowMono.ok ? slowMono : null;
  if (monoForReturn != null && monoForReturn.ok) {
    if (ascentPhaseOk || monotonicStreamIntegrityOk || slowRecoveryMonotonicOk) {
      const note = ascentPhaseOk
        ? 'guarded_ultra_shallow_reversal_assist'
        : monotonicStreamIntegrityOk
          ? 'guarded_ultra_shallow_reversal_assist_monotonic_stream_integrity'
          : 'guarded_ultra_shallow_reversal_assist_slow_recovery_monotonic';
      return {
        reversalConfirmed: true,
        reversalIndex: peakValidIndex,
        reversalDepthDrop: monoForReturn.drop,
        reversalFrameCount: monoForReturn.frames,
        reversalSource: 'rule',
        notes: [note],
      };
    }
  }

  if (!primaryMono.ok && !slowMono.ok) {
    const cum = guardedUltraShallowCumulativeRuntimeFallback(
      validFrames,
      peakValidIndex,
      peakPrimaryDepth,
      req,
      ev
    );
    if (cum != null) return cum;
  }

  return null;
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
 * relativeDepthPeak < LEGACY_ATTEMPT_FLOOR: strict-only.
 * [LEGACY_ATTEMPT_FLOOR, 0.08): strict 실패 시 PR-CAM-29B guardedUltraShallowReversalAssist.
 * [0.08,0.12): shallowWindowReversalRelax 만 추가(기존).
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

  if (relativeDepthPeak < LEGACY_ATTEMPT_FLOOR) {
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

  if (relativeDepthPeak < ULTRA_SHALLOW_STRICT_ONLY_FLOOR) {
    const guarded = guardedUltraShallowReversalAssist(
      validFrames,
      peakValidIndex,
      peakPrimaryDepth,
      req,
      relativeDepthPeak,
      ev
    );
    if (guarded != null) {
      return { ...guarded, notes: [...notes, ...guarded.notes] };
    }
    /* PR-CAM-30B: 스펙 노트명 — JSON/스모크에서 ultra-shallow guarded 실패 구분 */
    notes.push('guarded_ultra_shallow_no_hit');
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

  const mono = postPeakMonotonicReversalAssist({
    validFrames,
    peakValidIndex,
    peakPrimaryDepth,
    required: req,
  });
  if (mono.ok) {
    notes.push('post_peak_monotonic_reversal_assist');
    return {
      reversalConfirmed: true,
      reversalIndex: peakValidIndex,
      reversalDepthDrop: mono.drop,
      reversalFrameCount: mono.frames,
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

/** completion-state depth row — bridge 전용 최소 필드 (순환 import 방지) */
export type SquatCompletionStreamBridgeFrame = {
  index: number;
  depth: number;
  timestampMs: number;
  phaseHint: PoseFeaturesFrame['phaseHint'];
};

export type OfficialShallowStreamBridgeResult = {
  reversalFrame: SquatCompletionStreamBridgeFrame | undefined;
  officialShallowStreamBridgeApplied: boolean;
  officialShallowAscentEquivalentSatisfied: boolean;
  officialShallowStreamCompletionReturnDrop: number | null;
  /** 브리지 적용 시에만 상승 확정 덮어쓰기; null 이면 orchestrator 기존 ascendConfirmed 유지 */
  ascendConfirmedOverride: boolean | null;
};

/**
 * PR-SQUAT-COMPLETION-REARCH-01 — B2: strict 역전 앵커가 없을 때만 shallow closure 번들 하에서
 * completion-stream 앵커 + 상승 등가(0.88×drop)로 reversal truth 를 연다.
 * closure / pass reason 은 호출하지 않는다.
 */
export function evaluateOfficialShallowCompletionStreamBridge(args: {
  reversalFrameFromStrict: SquatCompletionStreamBridgeFrame | undefined;
  hmmReversalAssistApplied: boolean;
  shallowClosureProofBundleFromStream: boolean;
  officialShallowPathCandidate: boolean;
  armed: boolean;
  descendConfirmed: boolean;
  attemptStarted: boolean;
  hasValidCommittedPeakAnchor: boolean;
  committedOrPostCommitPeakFrame: SquatCompletionStreamBridgeFrame | null | undefined;
  depthFrames: SquatCompletionStreamBridgeFrame[];
  ascentFrame: SquatCompletionStreamBridgeFrame | undefined;
  squatReversalDropRequired: number;
  officialShallowProofCompletionReturnDrop: number | null;
}): OfficialShallowStreamBridgeResult {
  if (args.reversalFrameFromStrict != null) {
    return {
      reversalFrame: args.reversalFrameFromStrict,
      officialShallowStreamBridgeApplied: false,
      officialShallowAscentEquivalentSatisfied: false,
      officialShallowStreamCompletionReturnDrop: null,
      ascendConfirmedOverride: null,
    };
  }
  if (
    args.hmmReversalAssistApplied ||
    !args.shallowClosureProofBundleFromStream ||
    !args.officialShallowPathCandidate ||
    !args.armed ||
    !args.descendConfirmed ||
    !args.attemptStarted ||
    !args.hasValidCommittedPeakAnchor ||
    args.committedOrPostCommitPeakFrame == null
  ) {
    return {
      reversalFrame: undefined,
      officialShallowStreamBridgeApplied: false,
      officialShallowAscentEquivalentSatisfied: false,
      officialShallowStreamCompletionReturnDrop: null,
      ascendConfirmedOverride: null,
    };
  }

  const rf = args.committedOrPostCommitPeakFrame;
  const dropForAscend = args.officialShallowProofCompletionReturnDrop ?? 0;
  let bridgeAscend =
    args.ascentFrame != null ||
    args.depthFrames.some(
      (frame) =>
        frame.index > rf.index && frame.depth < rf.depth - args.squatReversalDropRequired
    );
  let officialShallowAscentEquivalentSatisfied = false;
  if (!bridgeAscend && dropForAscend >= args.squatReversalDropRequired * 0.88) {
    bridgeAscend = true;
    officialShallowAscentEquivalentSatisfied = true;
  } else if (
    bridgeAscend &&
    args.ascentFrame == null &&
    dropForAscend >= args.squatReversalDropRequired * 0.88
  ) {
    officialShallowAscentEquivalentSatisfied = true;
  }

  return {
    reversalFrame: rf,
    officialShallowStreamBridgeApplied: true,
    officialShallowAscentEquivalentSatisfied,
    officialShallowStreamCompletionReturnDrop: args.officialShallowProofCompletionReturnDrop,
    ascendConfirmedOverride: bridgeAscend,
  };
}
