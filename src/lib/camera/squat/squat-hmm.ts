/**
 * PR-HMM-01B — 스쿼트 시간 기반 HMM shadow decoder
 *
 * 역할 및 범위:
 *   - rule 기반 phaseHint와 완전히 독립적인 시간 분절 레이어
 *   - squatDepthProxy 시계열에 로그-Viterbi(O(T×S²))를 적용해 4상태 경로를 추론한다
 *   - completionSatisfied / guarded finalize semantics를 전혀 바꾸지 않는다
 *   - evaluator debug / shadow observability 전용 — pass/retry/fail gate에 사용 금지
 *
 * 상태:
 *   0 = standing
 *   1 = descent
 *   2 = bottom
 *   3 = ascent
 *
 * 전이 구조:
 *   standing  → standing, descent
 *   descent   → descent, bottom
 *   bottom    → bottom, ascent
 *   ascent    → ascent, standing
 *   비현실 점프(standing→bottom, descent→standing 직접 등)는 매우 낮은 로그 확률
 *
 * 관측 모델:
 *   각 상태는 squatDepthProxy 절댓값 + 프레임간 delta를 결합한 가우시안 근사 emission을 사용한다.
 *   null / invalid 프레임은 제거하지 않고 emission confidence를 낮춰 soft penalty로 반영한다.
 */

import type { PoseFeaturesFrame } from '@/lib/camera/pose-features';

// ─── 공개 타입 ─────────────────────────────────────────────────────────────────

export type SquatHmmState = 'standing' | 'descent' | 'bottom' | 'ascent';

export interface SquatHmmFrameState {
  frameIndex: number;
  state: SquatHmmState;
  /** 해당 프레임의 squatDepthProxy (null → invalid 처리됨) */
  depth: number | null;
  /** 프레임간 depth delta (첫 프레임은 0) */
  delta: number;
  /** smoothed depth (1-step EMA, alpha=0.5) */
  smoothedDepth: number;
}

export interface SquatHmmDecodeResult {
  /** 프레임별 상태 배열 */
  sequence: SquatHmmState[];
  /** 프레임별 상세 정보 */
  states: SquatHmmFrameState[];
  /** 각 상태가 나온 프레임 수 */
  dominantStateCounts: Record<SquatHmmState, number>;
  /**
   * 연속 상태 전이 횟수.
   * ex: standing→descent 전이 1회, descent→bottom 1회 등.
   */
  transitionCount: number;
  /**
   * temporal cycle candidate:
   *   standing≥1 → descent≥1 → bottom≥1 → ascent≥1 → standing≥1 순으로
   *   의미 있는 시간 구조가 성립했는지 여부.
   * effectiveExcursion ≥ MIN_EXCURSION_FOR_CANDIDATE 도 충족해야 함.
   */
  completionCandidate: boolean;
  /**
   * decoder 신뢰도 (0–1).
   * descent + bottom + ascent 총 프레임 수 및 excursion에 비례한다.
   */
  confidence: number;
  /**
   * completion 슬라이스 내 최대 squatDepthProxy (smoothed).
   */
  peakDepth: number;
  /**
   * baseline 대비 실효 excursion = peakDepth − baselineDepth.
   * baseline은 leading standing 구간 평균.
   */
  effectiveExcursion: number;
  /** 디버그 메모 (이유, 경고 등) */
  notes: string[];
}

// ─── 내부 상수 ────────────────────────────────────────────────────────────────

/** 4개 상태 인덱스 매핑 */
const STATE_NAMES: SquatHmmState[] = ['standing', 'descent', 'bottom', 'ascent'];
const S = STATE_NAMES.length; // 4

/**
 * log(전이 확률) 행렬 [from][to].
 * 숫자는 실기기 squat 데이터 기반 heuristic — tuning 가능.
 * -Infinity는 완전 금지 전이.
 */
const LOG_TRANSITION: number[][] = (() => {
  const NEG_INF = -Infinity;
  const ln = Math.log;
  // standing
  const fromStanding  = [ln(0.85), ln(0.15), NEG_INF, NEG_INF];
  // descent
  const fromDescent   = [NEG_INF, ln(0.55), ln(0.45), NEG_INF];
  // bottom
  const fromBottom    = [NEG_INF, NEG_INF, ln(0.55), ln(0.45)];
  // ascent
  const fromAscent    = [ln(0.45), NEG_INF, NEG_INF, ln(0.55)];
  return [fromStanding, fromDescent, fromBottom, fromAscent];
})();

/** log 초기 확률 (standing에서 시작할 가능성이 가장 높다) */
const LOG_INIT: number[] = [Math.log(0.85), Math.log(0.1), Math.log(0.025), Math.log(0.025)];

/**
 * emission 파라미터 (가우시안 근사).
 * [mean_depth, sigma_depth, mean_delta, sigma_delta]
 * delta: 양수 = 깊어짐, 음수 = 얕아짐
 */
const EMISSION_PARAMS: Array<[number, number, number, number]> = [
  // standing: depth 낮음, delta ≈ 0
  [0.01, 0.015, 0.0,   0.006],
  // descent:  depth 증가 중, delta > 0
  [0.04, 0.04,  0.006, 0.008],
  // bottom:   depth 높음, delta ≈ 0
  [0.07, 0.05,  0.0,   0.006],
  // ascent:   depth 감소 중, delta < 0
  [0.04, 0.04, -0.006, 0.008],
];

/**
 * invalid/null 프레임의 emission penalty (log 단위).
 * 어느 상태든 같은 확률을 부여해 null이 특정 상태를 강제하지 않게 한다.
 */
const INVALID_FRAME_LOG_EMISSION = Math.log(0.25);

/** candidate 성립 최소 excursion */
const MIN_EXCURSION_FOR_CANDIDATE = 0.018;

/** 각 주요 상태 최소 dwell 프레임 수 (노이즈 차단) */
const MIN_DESCENT_FRAMES = 2;
const MIN_BOTTOM_FRAMES = 1;
const MIN_ASCENT_FRAMES = 2;

/** confidence 계산에서 모션 프레임(descent+bottom+ascent)의 포화 기준 */
const CONFIDENCE_MOTION_SATURATION = 12;

// ─── 내부 함수 ────────────────────────────────────────────────────────────────

function logGaussian(x: number, mean: number, sigma: number): number {
  const diff = x - mean;
  return -0.5 * (diff / sigma) ** 2 - Math.log(sigma * Math.sqrt(2 * Math.PI));
}

function logEmission(stateIdx: number, depth: number, delta: number): number {
  const [md, sd, mDelta, sDelta] = EMISSION_PARAMS[stateIdx]!;
  return logGaussian(depth, md, sd) + logGaussian(delta, mDelta, sDelta);
}

/**
 * squatDepthProxy를 준비한다.
 * null/undefined/NaN 는 null로 통일하고, 유효 값은 double EMA(alpha=0.46)를 적용한다.
 * (raw frames에 이미 stabilizeDerivedSignals가 적용됐을 수 있으므로 한 번만 더 smoothing)
 */
function prepareDepthSeries(frames: PoseFeaturesFrame[]): Array<number | null> {
  let prev: number | null = null;
  return frames.map((f) => {
    const raw = f.derived?.squatDepthProxy;
    if (typeof raw !== 'number' || !Number.isFinite(raw)) {
      return null;
    }
    const smoothed = prev === null ? raw : prev + (raw - prev) * 0.5;
    prev = smoothed;
    return smoothed;
  });
}

// ─── 메인 디코더 ──────────────────────────────────────────────────────────────

/**
 * Viterbi log-probability decoder.
 *
 * @param frames PoseFeaturesFrame 배열 (arming slice 또는 valid 전체)
 * @returns SquatHmmDecodeResult (shadow debug 전용)
 */
export function decodeSquatHmm(frames: PoseFeaturesFrame[]): SquatHmmDecodeResult {
  const notes: string[] = [];

  if (frames.length === 0) {
    return buildEmptyResult('frames_empty', notes);
  }

  const depthSeries = prepareDepthSeries(frames);
  const T = depthSeries.length;

  if (T < 4) {
    notes.push('too_few_frames');
    return buildEmptyResult('too_few_frames', notes);
  }

  // ── Viterbi DP ──────────────────────────────────────────────────────────────
  // dp[t][s] = 시각 t에서 상태 s에 도달하는 최대 log 확률
  const dp: number[][] = Array.from({ length: T }, () => new Array<number>(S).fill(-Infinity));
  const backtrack: number[][] = Array.from({ length: T }, () => new Array<number>(S).fill(-1));

  // delta 계산 (smoothed)
  const deltas: number[] = depthSeries.map((d, i) => {
    if (i === 0 || d === null) return 0;
    const prev = depthSeries[i - 1];
    if (prev === null) return 0;
    return d - prev;
  });

  // 초기화
  for (let s = 0; s < S; s++) {
    const d = depthSeries[0];
    const delta = deltas[0] ?? 0;
    const emitLog =
      d === null ? INVALID_FRAME_LOG_EMISSION : logEmission(s, d, delta);
    dp[0]![s] = LOG_INIT[s]! + emitLog;
  }

  // 재귀
  for (let t = 1; t < T; t++) {
    const d = depthSeries[t];
    const delta = deltas[t] ?? 0;

    for (let s = 0; s < S; s++) {
      const emitLog =
        d === null ? INVALID_FRAME_LOG_EMISSION : logEmission(s, d, delta);

      let bestLogProb = -Infinity;
      let bestPrev = -1;

      for (let prevS = 0; prevS < S; prevS++) {
        const candidate = dp[t - 1]![prevS]! + LOG_TRANSITION[prevS]![s]! + emitLog;
        if (candidate > bestLogProb) {
          bestLogProb = candidate;
          bestPrev = prevS;
        }
      }

      dp[t]![s] = bestLogProb;
      backtrack[t]![s] = bestPrev;
    }
  }

  // ── Backtrack ──────────────────────────────────────────────────────────────
  const stateSeq: number[] = new Array<number>(T).fill(0);
  let lastBest = 0;
  let lastBestProb = -Infinity;
  for (let s = 0; s < S; s++) {
    if (dp[T - 1]![s]! > lastBestProb) {
      lastBestProb = dp[T - 1]![s]!;
      lastBest = s;
    }
  }
  stateSeq[T - 1] = lastBest;
  for (let t = T - 2; t >= 0; t--) {
    stateSeq[t] = backtrack[t + 1]![stateSeq[t + 1]!]!;
  }

  // ── 결과 조립 ─────────────────────────────────────────────────────────────
  const sequence: SquatHmmState[] = stateSeq.map((s) => STATE_NAMES[s]!);

  const dominantStateCounts: Record<SquatHmmState, number> = {
    standing: 0, descent: 0, bottom: 0, ascent: 0,
  };
  const frameStates: SquatHmmFrameState[] = sequence.map((state, i) => {
    dominantStateCounts[state] += 1;
    return {
      frameIndex: i,
      state,
      depth: depthSeries[i] ?? null,
      delta: deltas[i] ?? 0,
      smoothedDepth: depthSeries[i] ?? 0,
    };
  });

  // transition count (연속 전이 횟수)
  let transitionCount = 0;
  for (let i = 1; i < sequence.length; i++) {
    if (sequence[i] !== sequence[i - 1]) transitionCount += 1;
  }

  // baseline = leading standing 구간 평균 depth
  const leadingStandingDepths: number[] = [];
  for (let i = 0; i < sequence.length; i++) {
    if (sequence[i] !== 'standing') break;
    const d = depthSeries[i];
    if (d !== null) leadingStandingDepths.push(d);
  }
  const baselineDepth =
    leadingStandingDepths.length > 0
      ? leadingStandingDepths.reduce((a, b) => a + b, 0) / leadingStandingDepths.length
      : (depthSeries.find((d) => d !== null) ?? 0);

  const validDepths = depthSeries.filter((d): d is number => d !== null);
  const peakDepth = validDepths.length > 0 ? Math.max(...validDepths) : 0;
  const effectiveExcursion = Math.max(0, peakDepth - baselineDepth);

  // ── completionCandidate 판정 ────────────────────────────────────────────────
  // 조건: standing≥1 → descent≥MIN → bottom≥MIN → ascent≥MIN → standing≥1 순서로 출현
  // + effectiveExcursion ≥ MIN_EXCURSION_FOR_CANDIDATE
  // + 각 상태가 최소 dwell 충족

  let completionCandidate = false;
  const excursionOk = effectiveExcursion >= MIN_EXCURSION_FOR_CANDIDATE;

  if (excursionOk) {
    // 상태 전이 순서를 RLE(런-렝스 인코딩)로 확인
    const runs: Array<{ state: SquatHmmState; count: number }> = [];
    for (let i = 0; i < sequence.length; i++) {
      const s = sequence[i]!;
      if (runs.length === 0 || runs[runs.length - 1]!.state !== s) {
        runs.push({ state: s, count: 1 });
      } else {
        runs[runs.length - 1]!.count += 1;
      }
    }

    // standing → descent → bottom → ascent → standing 패턴 탐색
    const descentRunMin = (r: { state: SquatHmmState; count: number }) =>
      r.state === 'descent' && r.count >= MIN_DESCENT_FRAMES;
    const bottomRunMin = (r: { state: SquatHmmState; count: number }) =>
      r.state === 'bottom' && r.count >= MIN_BOTTOM_FRAMES;
    const ascentRunMin = (r: { state: SquatHmmState; count: number }) =>
      r.state === 'ascent' && r.count >= MIN_ASCENT_FRAMES;

    // 순서 FSM 탐색
    let stage = 0; // 0=need_standing 1=need_descent 2=need_bottom 3=need_ascent 4=need_final_standing 5=done
    for (const run of runs) {
      if (stage === 0 && run.state === 'standing') { stage = 1; continue; }
      if (stage === 1 && descentRunMin(run)) { stage = 2; continue; }
      if (stage === 2 && bottomRunMin(run)) { stage = 3; continue; }
      if (stage === 3 && ascentRunMin(run)) { stage = 4; continue; }
      if (stage === 4 && run.state === 'standing') { stage = 5; break; }
    }
    completionCandidate = stage >= 4; // standing_final까지 오면 stage=5, ascent만 있어도 4
  }

  if (!excursionOk) notes.push(`excursion_too_small:${effectiveExcursion.toFixed(4)}`);
  if (dominantStateCounts.descent < MIN_DESCENT_FRAMES) notes.push('descent_dwell_too_short');
  if (dominantStateCounts.bottom < MIN_BOTTOM_FRAMES) notes.push('bottom_dwell_too_short');
  if (dominantStateCounts.ascent < MIN_ASCENT_FRAMES) notes.push('ascent_dwell_too_short');
  if (completionCandidate) notes.push('temporal_cycle_found');

  // ── confidence 계산 ────────────────────────────────────────────────────────
  const motionFrames =
    dominantStateCounts.descent +
    dominantStateCounts.bottom +
    dominantStateCounts.ascent;
  const motionRatio = Math.min(1, motionFrames / CONFIDENCE_MOTION_SATURATION);
  const excursionRatio = Math.min(1, effectiveExcursion / 0.12);
  const confidence = completionCandidate
    ? Math.min(1, motionRatio * 0.6 + excursionRatio * 0.4)
    : motionRatio * 0.3 * excursionRatio; // 미통과는 낮은 confidence

  return {
    sequence,
    states: frameStates,
    dominantStateCounts,
    transitionCount,
    completionCandidate,
    confidence: Math.round(confidence * 1000) / 1000,
    peakDepth: Math.round(peakDepth * 1000) / 1000,
    effectiveExcursion: Math.round(effectiveExcursion * 1000) / 1000,
    notes,
  };
}

// ─── 내부 유틸 ────────────────────────────────────────────────────────────────

function buildEmptyResult(reason: string, notes: string[]): SquatHmmDecodeResult {
  notes.push(reason);
  return {
    sequence: [],
    states: [],
    dominantStateCounts: { standing: 0, descent: 0, bottom: 0, ascent: 0 },
    transitionCount: 0,
    completionCandidate: false,
    confidence: 0,
    peakDepth: 0,
    effectiveExcursion: 0,
    notes,
  };
}
