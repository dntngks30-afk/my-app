/**
 * PR-04E1: 스쿼트 depth 보조 신호 — knee 기반 primary(squatDepthProxy)를 대체하지 않고
 * 얕은 ROM·모바일 노이즈에서 0 근처 붕괴를 완화하는 blended 입력을 만든다.
 *
 * pose-features.ts 와 순환 import 방지: PoseFeaturesFrame 대신 최소 구조만 사용.
 */

export type SquatDepthSignalSource = 'primary' | 'fallback' | 'blended';

export interface SquatDepthSignal {
  depthValue: number;
  source: SquatDepthSignalSource;
  /** 0–1, 관측 신뢰도(휴리스틱) */
  confidence: number;
  notes: string[];
}

/** 프레임 입력 — PoseFeaturesFrame 과 구조 호환 */
export type SquatDepthSignalFrame = {
  derived: {
    squatDepthProxy: number | null;
    kneeAngleLeft: number | null;
    kneeAngleRight: number | null;
    kneeAngleAvg: number | null;
  };
  joints: Record<string, { x: number; y: number } | null>;
};

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function readPrimary(frame: SquatDepthSignalFrame): number | null {
  const d = frame.derived.squatDepthProxy;
  return typeof d === 'number' && Number.isFinite(d) ? d : null;
}

/**
 * hip–knee 수직 분리(이미지 y 증가=아래)를 torso scale 로 나눈 보조 깊이.
 * 무릎 각도 primary가 얕게 나올 때 하체 굴곡의 2차 증거.
 */
function computeFallbackKneeHipDepth(frame: SquatDepthSignalFrame): number | null {
  const lh = frame.joints.leftHip;
  const lk = frame.joints.leftKnee;
  const rh = frame.joints.rightHip;
  const rk = frame.joints.rightKnee;
  const shoulder = frame.joints.shoulderCenter;
  const hip = frame.joints.hipCenter;

  const flexes: number[] = [];
  if (lh && lk && lh.y < lk.y) {
    flexes.push((lk.y - lh.y) / 0.22);
  }
  if (rh && rk && rh.y < rk.y) {
    flexes.push((rk.y - rh.y) / 0.22);
  }
  if (flexes.length === 0) return null;

  let torso = 0.14;
  if (shoulder && hip && hip.y > shoulder.y) {
    torso = Math.max(0.1, hip.y - shoulder.y);
  }
  const raw = mean(flexes) * (0.16 / torso);
  return clamp01(raw * 1.15);
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/**
 * 무릎 전방 이동(hip 대비 knee x) 변화량 — shallow motion evidence 전용, 단독 pass truth 아님.
 */
function computeKneeTravelSignal(
  frame: SquatDepthSignalFrame,
  prev: SquatDepthSignalFrame | null
): number {
  if (!prev) return 0;
  let delta = 0;
  const pairs: [typeof frame.joints.leftHip, typeof frame.joints.leftKnee][] = [
    [frame.joints.leftHip, frame.joints.leftKnee],
    [frame.joints.rightHip, frame.joints.rightKnee],
  ];
  const prevs: [typeof prev.joints.leftHip, typeof prev.joints.leftKnee][] = [
    [prev.joints.leftHip, prev.joints.leftKnee],
    [prev.joints.rightHip, prev.joints.rightKnee],
  ];
  for (let i = 0; i < pairs.length; i++) {
    const [h, k] = pairs[i]!;
    const [ph, pk] = prevs[i]!;
    if (!h || !k || !ph || !pk) continue;
    const cur = Math.abs(k.x - h.x);
    const pr = Math.abs(pk.x - ph.x);
    delta += Math.abs(cur - pr);
  }
  return clamp01(delta / 0.055);
}

const PRIMARY_NEAR_FLAT = 0.016;
const FALLBACK_MIN_FOR_ASSIST = 0.022;
const FALLBACK_PRIMARY_RATIO = 1.75;
const TRAVEL_EVIDENCE_MIN = 0.18;
const TRAVEL_WITH_FALLBACK_MIN = 0.012;
/** 기하 fallback 만으로 블렌드하지 않도록 — standing 에서 hip–knee 간격이 커 보여도 travel 이 작으면 차단 */
const FALLBACK_BLEND_MIN_TRAVEL = 0.11;
const BLEND_PRIMARY_W = 0.38;
const BLEND_FALLBACK_W = 0.62;
const JITTER_TRAVEL_CAP = 0.09;
const JITTER_FALLBACK_CAP = 0.018;

/**
 * 단일 프레임 depth 보조값. prevFrame 이 있으면 knee travel 증거에 사용.
 */
export function buildSquatDepthSignal(
  frame: SquatDepthSignalFrame,
  prevFrame: SquatDepthSignalFrame | null
): SquatDepthSignal {
  const notes: string[] = [];
  const primary = readPrimary(frame);
  const fallback = computeFallbackKneeHipDepth(frame);
  const travel = computeKneeTravelSignal(frame, prevFrame);

  if (primary == null) {
    if (fallback != null && fallback >= FALLBACK_MIN_FOR_ASSIST) {
      notes.push('primary_null_fallback');
      return { depthValue: fallback, source: 'fallback', confidence: 0.45, notes };
    }
    notes.push('primary_null_no_fallback');
    return { depthValue: 0, source: 'primary', confidence: 0, notes };
  }

  if (primary >= 0.045) {
    notes.push('primary_strong');
    return { depthValue: primary, source: 'primary', confidence: 0.92, notes };
  }

  const travelLow = travel < JITTER_TRAVEL_CAP && (fallback == null || fallback < JITTER_FALLBACK_CAP);
  if (primary < PRIMARY_NEAR_FLAT && travelLow) {
    notes.push('jitter_guard_flat');
    return { depthValue: primary, source: 'primary', confidence: 0.55, notes };
  }

  const fallbackOk =
    fallback != null &&
    fallback >= FALLBACK_MIN_FOR_ASSIST &&
    fallback >= primary * FALLBACK_PRIMARY_RATIO &&
    travel >= FALLBACK_BLEND_MIN_TRAVEL;
  const travelOk = travel >= TRAVEL_EVIDENCE_MIN && (fallback == null || fallback >= TRAVEL_WITH_FALLBACK_MIN);

  if (primary < PRIMARY_NEAR_FLAT && (fallbackOk || travelOk)) {
    const fb = fallback ?? primary;
    const blended = clamp01(BLEND_PRIMARY_W * primary + BLEND_FALLBACK_W * Math.max(fb, primary));
    notes.push(fallbackOk ? 'blend_fallback' : 'blend_travel');
    return {
      depthValue: Math.max(primary, blended),
      source: 'blended',
      confidence: 0.62,
      notes,
    };
  }

  if (fallback != null && fallback > primary + 0.01 && travel >= 0.1) {
    const blended = clamp01(0.5 * primary + 0.5 * fallback);
    notes.push('blend_moderate_lift');
    return { depthValue: Math.max(primary, blended), source: 'blended', confidence: 0.55, notes };
  }

  notes.push('primary_only');
  return { depthValue: primary, source: 'primary', confidence: 0.7, notes };
}
