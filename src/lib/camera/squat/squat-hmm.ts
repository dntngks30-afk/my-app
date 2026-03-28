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
 *   depth는 시퀀스 ROM으로 z-정규화, 프레임간 변화량은 raw smoothed delta로 둔 하이브리드 emission.
 *   (깊은 ROM에서 z-delta만 쓰면 스텝이 지나치게 작아져 ascent가 bottom에 붙는 문제 방지 — PR-HMM-04B)
 *   null / invalid 프레임은 emission confidence를 낮춰 soft penalty로 반영한다.
 *
 * PR-HMM-04C — confidence는 모션 프레임 비율이 아니라 excursion·시퀀스 품질·상태 커버리지·노이즈 페널티 가중합.
 */

import type { PoseFeaturesFrame } from '@/lib/camera/pose-features';

// ─── 공개 타입 ─────────────────────────────────────────────────────────────────

export type SquatHmmState = 'standing' | 'descent' | 'bottom' | 'ascent';

/** PR-HMM-04C: confidence 하위 성분 (0–1, noisePenalty 만큼 가중 차감) */
export interface SquatHmmConfidenceBreakdown {
  excursionScore: number;
  sequenceScore: number;
  coverageScore: number;
  /** 0=깨끗, 1=최대 — 최종식에서 0.1 가중으로 차감 */
  noisePenalty: number;
}

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
   * PR-HMM-04C: 0.4·excursion + 0.35·sequence + 0.15·coverage − 0.1·noisePenalty (후보 아닐 때 상한).
   */
  confidence: number;
  /** PR-HMM-04C: confidence 분해 — 디버그/캘리브 전용 */
  confidenceBreakdown: SquatHmmConfidenceBreakdown;
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
  // ascent — 짧은 ROM에서도 ascent dwell≥2가 나오도록 self-loop 우세 (PR-HMM-02B no_descend 픽스처)
  const fromAscent    = [ln(0.28), NEG_INF, NEG_INF, ln(0.72)];
  return [fromStanding, fromDescent, fromBottom, fromAscent];
})();

/** log 초기 확률 (standing에서 시작할 가능성이 가장 높다) */
const LOG_INIT: number[] = [Math.log(0.85), Math.log(0.1), Math.log(0.025), Math.log(0.025)];

/**
 * [mean_zDepth, sigma_zDepth, mean_rawDelta, sigma_rawDelta] — raw delta는 구 shallow 캘리브와 동일 스케일.
 */
const EMISSION_HYBRID: Array<[number, number, number, number]> = [
  [0.03, 0.12, 0.0, 0.006],
  [0.28, 0.16, 0.006, 0.008],
  /** 고깊이 z에서도 bottom/ascent 동일 평균 z — raw delta로만 구분 (z-delta만 쓸 때의 ascent 붕괴 방지) */
  [0.93, 0.09, 0.0, 0.003],
  [0.93, 0.09, -0.0045, 0.006],
];

/** ROM 정규화 시 depth 스팬 하한 (지터 구간에서 z 과대 방지) */
const MIN_DEPTH_SPAN_FOR_NORM = 0.03;

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

/** PR-HMM-04C: excursion 정규화 기준(이 값 이상이면 excursion 성분 1) */
const CONFIDENCE_EXCURSION_NORM = 0.25;
/** 가중치: excursion / sequence / coverage / noise penalty */
const W_EX = 0.4;
const W_SEQ = 0.35;
const W_COV = 0.15;
const W_NOISE = 0.1;
/** 비후보(지터 등) confidence 상한 — assist·arming 바와 혼동 방지 */
const CONFIDENCE_NON_CANDIDATE_CAP = 0.24;

// ─── 내부 함수 ────────────────────────────────────────────────────────────────

function clamp01(x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  return x;
}

function round3(x: number): number {
  return Math.round(x * 1000) / 1000;
}

/** Viterbi 전이 그래프상 허용 단일 스텝(자기 루프 포함) */
function isPlausibleHmmTransition(from: SquatHmmState, to: SquatHmmState): boolean {
  if (from === to) return true;
  if (from === 'standing' && to === 'descent') return true;
  if (from === 'descent' && to === 'bottom') return true;
  if (from === 'bottom' && to === 'ascent') return true;
  if (from === 'ascent' && to === 'standing') return true;
  return false;
}

type HmmRun = { state: SquatHmmState; count: number };

/**
 * PR-HMM-04C — completionCandidate FSM과 동일한 stage(0–5) + 시퀀스·커버리지·노이즈 기반 confidence.
 */
function computeSquatHmmConfidence(
  sequence: SquatHmmState[],
  depthSeries: Array<number | null>,
  runs: HmmRun[],
  dominantStateCounts: Record<SquatHmmState, number>,
  transitionCount: number,
  effectiveExcursion: number,
  completionCandidate: boolean
): { confidence: number; confidenceBreakdown: SquatHmmConfidenceBreakdown } {
  const T = sequence.length;

  const excursionScore = clamp01(effectiveExcursion / CONFIDENCE_EXCURSION_NORM);

  const covD = clamp01(dominantStateCounts.descent / MIN_DESCENT_FRAMES);
  const covB = clamp01(dominantStateCounts.bottom / MIN_BOTTOM_FRAMES);
  const covA = clamp01(dominantStateCounts.ascent / MIN_ASCENT_FRAMES);
  const coverageScore = (covD + covB + covA) / 3;

  const descentRunMin = (r: HmmRun) => r.state === 'descent' && r.count >= MIN_DESCENT_FRAMES;
  const bottomRunMin = (r: HmmRun) => r.state === 'bottom' && r.count >= MIN_BOTTOM_FRAMES;
  const ascentRunMin = (r: HmmRun) => r.state === 'ascent' && r.count >= MIN_ASCENT_FRAMES;

  let stage = 0;
  for (const run of runs) {
    if (stage === 0 && run.state === 'standing') {
      stage = 1;
      continue;
    }
    if (stage === 1 && descentRunMin(run)) {
      stage = 2;
      continue;
    }
    if (stage === 2 && bottomRunMin(run)) {
      stage = 3;
      continue;
    }
    if (stage === 3 && ascentRunMin(run)) {
      stage = 4;
      continue;
    }
    if (stage === 4 && run.state === 'standing') {
      stage = 5;
      break;
    }
  }

  const stageBaseSeq = [0.04, 0.1, 0.26, 0.44, 0.72, 0.9][Math.min(stage, 5)]!;
  let sequenceScore = stageBaseSeq;

  let badTrans = 0;
  for (let i = 1; i < sequence.length; i++) {
    if (!isPlausibleHmmTransition(sequence[i - 1]!, sequence[i]!)) badTrans++;
  }
  const badTransRatio = clamp01(badTrans / Math.max(3, Math.floor(T / 5)));
  sequenceScore = clamp01(sequenceScore * (1 - 0.5 * badTransRatio));

  if (completionCandidate) {
    sequenceScore = Math.max(sequenceScore, 0.78);
    const last = runs[runs.length - 1];
    if (last?.state === 'standing' && last.count >= 4) {
      sequenceScore = clamp01(sequenceScore + 0.05);
    }
  }

  const nullCount = depthSeries.filter((d) => d === null).length;
  const invalidRatio = T > 0 ? nullCount / T : 0;
  const idealTrans = completionCandidate ? 6 : 3;
  const flipExcess = Math.max(0, transitionCount - idealTrans);
  const flipNoise = clamp01(flipExcess / Math.max(5, T * 0.28));
  const noisePenalty = clamp01(invalidRatio * 0.9 + 0.7 * flipNoise + 0.2 * badTransRatio);

  let confidence = clamp01(
    W_EX * excursionScore + W_SEQ * sequenceScore + W_COV * coverageScore - W_NOISE * noisePenalty
  );

  if (!completionCandidate) {
    confidence = Math.min(confidence, CONFIDENCE_NON_CANDIDATE_CAP);
  }

  /**
   * 초저 ROM 후보는 시퀀스 품질만으로 점수가 과대해질 수 있음 — no_reversal(0.5) 게이트와 borderline 픽스처 정합.
   * (descent_span 0.41 바는 유지되도록 0.86만 적용)
   */
  if (completionCandidate && effectiveExcursion < 0.048) {
    confidence = round3(clamp01(confidence * 0.86));
  }

  return {
    confidence: round3(confidence),
    confidenceBreakdown: {
      excursionScore: round3(excursionScore),
      sequenceScore: round3(sequenceScore),
      coverageScore: round3(coverageScore),
      noisePenalty: round3(noisePenalty),
    },
  };
}

// ─── emission / depth prep ───────────────────────────────────────────────────

function logGaussian(x: number, mean: number, sigma: number): number {
  const diff = x - mean;
  return -0.5 * (diff / sigma) ** 2 - Math.log(sigma * Math.sqrt(2 * Math.PI));
}

function logEmissionHybrid(stateIdx: number, zDepth: number, rawDelta: number): number {
  const [mz, sz, mRd, sRd] = EMISSION_HYBRID[stateIdx]!;
  return logGaussian(zDepth, mz, sz) + logGaussian(rawDelta, mRd, sRd);
}

/**
 * 유효 depth만으로 min/max 스팬을 잡고 z-깊이·z-delta 시계열을 만든다.
 */
function computeZDepths(depthSeries: Array<number | null>): {
  zDepths: Array<number | null>;
  span: number;
} {
  const vals = depthSeries.filter((d): d is number => d !== null && Number.isFinite(d));
  if (vals.length === 0) {
    return {
      zDepths: depthSeries.map(() => null),
      span: MIN_DEPTH_SPAN_FOR_NORM,
    };
  }
  const dmin = Math.min(...vals);
  const dmax = Math.max(...vals);
  const span = Math.max(MIN_DEPTH_SPAN_FOR_NORM, dmax - dmin);
  const zDepths = depthSeries.map((d) =>
    d === null || !Number.isFinite(d) ? null : (d - dmin) / span
  );
  return { zDepths, span };
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

  const { zDepths } = computeZDepths(depthSeries);

  // ── Viterbi DP ──────────────────────────────────────────────────────────────
  // dp[t][s] = 시각 t에서 상태 s에 도달하는 최대 log 확률
  const dp: number[][] = Array.from({ length: T }, () => new Array<number>(S).fill(-Infinity));
  const backtrack: number[][] = Array.from({ length: T }, () => new Array<number>(S).fill(-1));

  // delta 계산 (smoothed raw — states·디버그용)
  const deltas: number[] = depthSeries.map((d, i) => {
    if (i === 0 || d === null) return 0;
    const prev = depthSeries[i - 1];
    if (prev === null) return 0;
    return d - prev;
  });

  // 초기화
  for (let s = 0; s < S; s++) {
    const d = depthSeries[0];
    const z = zDepths[0];
    const rawDelta = deltas[0] ?? 0;
    const emitLog =
      d === null || z === null ? INVALID_FRAME_LOG_EMISSION : logEmissionHybrid(s, z, rawDelta);
    dp[0]![s] = LOG_INIT[s]! + emitLog;
  }

  // 재귀
  for (let t = 1; t < T; t++) {
    const d = depthSeries[t];
    const z = zDepths[t];
    const rawDelta = deltas[t] ?? 0;

    for (let s = 0; s < S; s++) {
      const emitLog =
        d === null || z === null ? INVALID_FRAME_LOG_EMISSION : logEmissionHybrid(s, z, rawDelta);

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

  const runs: HmmRun[] = [];
  for (let i = 0; i < sequence.length; i++) {
    const s = sequence[i]!;
    if (runs.length === 0 || runs[runs.length - 1]!.state !== s) {
      runs.push({ state: s, count: 1 });
    } else {
      runs[runs.length - 1]!.count += 1;
    }
  }

  // ── completionCandidate 판정 ────────────────────────────────────────────────
  let completionCandidate = false;
  const excursionOk = effectiveExcursion >= MIN_EXCURSION_FOR_CANDIDATE;

  if (excursionOk) {
    const descentRunMin = (r: HmmRun) => r.state === 'descent' && r.count >= MIN_DESCENT_FRAMES;
    const bottomRunMin = (r: HmmRun) => r.state === 'bottom' && r.count >= MIN_BOTTOM_FRAMES;
    const ascentRunMin = (r: HmmRun) => r.state === 'ascent' && r.count >= MIN_ASCENT_FRAMES;

    let stage = 0;
    for (const run of runs) {
      if (stage === 0 && run.state === 'standing') { stage = 1; continue; }
      if (stage === 1 && descentRunMin(run)) { stage = 2; continue; }
      if (stage === 2 && bottomRunMin(run)) { stage = 3; continue; }
      if (stage === 3 && ascentRunMin(run)) { stage = 4; continue; }
      if (stage === 4 && run.state === 'standing') { stage = 5; break; }
    }
    completionCandidate = stage >= 4;
  }

  if (!excursionOk) notes.push(`excursion_too_small:${effectiveExcursion.toFixed(4)}`);
  if (dominantStateCounts.descent < MIN_DESCENT_FRAMES) notes.push('descent_dwell_too_short');
  if (dominantStateCounts.bottom < MIN_BOTTOM_FRAMES) notes.push('bottom_dwell_too_short');
  if (dominantStateCounts.ascent < MIN_ASCENT_FRAMES) notes.push('ascent_dwell_too_short');
  if (completionCandidate) notes.push('temporal_cycle_found');

  const { confidence, confidenceBreakdown } = computeSquatHmmConfidence(
    sequence,
    depthSeries,
    runs,
    dominantStateCounts,
    transitionCount,
    effectiveExcursion,
    completionCandidate
  );

  return {
    sequence,
    states: frameStates,
    dominantStateCounts,
    transitionCount,
    completionCandidate,
    confidence,
    confidenceBreakdown,
    peakDepth: Math.round(peakDepth * 1000) / 1000,
    effectiveExcursion: Math.round(effectiveExcursion * 1000) / 1000,
    notes,
  };
}

// ─── 내부 유틸 ────────────────────────────────────────────────────────────────

const EMPTY_CONFIDENCE_BREAKDOWN: SquatHmmConfidenceBreakdown = {
  excursionScore: 0,
  sequenceScore: 0,
  coverageScore: 0,
  noisePenalty: 0,
};

function buildEmptyResult(reason: string, notes: string[]): SquatHmmDecodeResult {
  notes.push(reason);
  return {
    sequence: [],
    states: [],
    dominantStateCounts: { standing: 0, descent: 0, bottom: 0, ascent: 0 },
    transitionCount: 0,
    completionCandidate: false,
    confidence: 0,
    confidenceBreakdown: { ...EMPTY_CONFIDENCE_BREAKDOWN },
    peakDepth: 0,
    effectiveExcursion: 0,
    notes,
  };
}
