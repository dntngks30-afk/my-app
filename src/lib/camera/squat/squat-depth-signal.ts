/**
 * PR-04E1: 스쿼트 depth 보조 신호 — knee 기반 primary(squatDepthProxy)를 대체하지 않고
 * 얕은 ROM·모바일 노이즈에서 0 근처 붕괴를 완화하는 blended 입력을 만든다.
 *
 * PR-CAM-29: primary / fallback / travel / blended 를 분해해 관측 가능하게 하고,
 * blended 가 단발·약한 증거만으로 과도하게 치솟는 것을 기존 상수 조합 ceiling 으로 제한한다.
 * completion / arming / owner / finalize 는 건드리지 않음 — 입력 source 안정화만.
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
  /** PR-CAM-29: 분해·temporal 레이어용 (additive) */
  primaryDepth?: number | null;
  fallbackDepth?: number | null;
  travelEvidence?: number;
  /** raw 신호가 blended 경로를 제안했는지(temporal 게이트는 pose-features) */
  blendOffered?: boolean;
  /** cap 적용 전 blended 후보 깊이 */
  blendCandidateRaw?: number | null;
  /** ceiling 로 raw 후보가 잘렸는지 */
  blendCapped?: boolean;
}

/** pose-features temporal 가드와 동일 스케일 — 외부에서 flat primary 임계 참조용 */
export const SQUAT_DEPTH_PRIMARY_NEAR_FLAT = 0.016;

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

const PRIMARY_NEAR_FLAT = SQUAT_DEPTH_PRIMARY_NEAR_FLAT;
/** 기존 분기와 동일 — “강한 primary” 하한(리터럴 이름만 부여, 값 변경 없음) */
export const PRIMARY_STRONG_MIN = 0.045;
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
 * 단발 travel 스파이크가 softCap 을 키우지 않도록 travel 은 TRAVEL_EVIDENCE_MIN 으로 끊고,
 * hardCap 은 PRIMARY_STRONG_MIN·BLEND_*·FALLBACK_MIN 만 조합(새 raw threshold 없음).
 */
function blendLiftCeiling(primary: number, travel: number): number {
  if (primary >= PRIMARY_STRONG_MIN) return 1;
  const travelForCap = Math.min(travel, TRAVEL_EVIDENCE_MIN);
  const softCap = clamp01(
    primary + FALLBACK_PRIMARY_RATIO * FALLBACK_MIN_FOR_ASSIST + BLEND_FALLBACK_W * travelForCap
  );
  const hardCap = clamp01(
    PRIMARY_STRONG_MIN + BLEND_FALLBACK_W * FALLBACK_MIN_FOR_ASSIST + BLEND_PRIMARY_W * clamp01(primary)
  );
  return Math.min(softCap, hardCap);
}

function withMeta(
  sig: Omit<SquatDepthSignal, 'primaryDepth' | 'fallbackDepth' | 'travelEvidence'>,
  primary: number | null,
  fallback: number | null,
  travel: number,
  extra?: Partial<Pick<SquatDepthSignal, 'blendOffered' | 'blendCandidateRaw' | 'blendCapped'>>
): SquatDepthSignal {
  return {
    ...sig,
    primaryDepth: primary,
    fallbackDepth: fallback,
    travelEvidence: travel,
    ...extra,
  };
}

function emitCappedBlend(
  primary: number,
  rawBlended: number,
  travel: number,
  baseNotes: string[],
  blendReason: string,
  confidence: number,
  fallback: number | null,
  travelEv: number
): SquatDepthSignal {
  const notes = [...baseNotes];
  const ceiling = blendLiftCeiling(primary, travel);
  const capped = clamp01(Math.min(rawBlended, ceiling));
  const blendCapped = capped + 1e-9 < rawBlended;
  if (capped <= primary) {
    if (blendCapped) notes.push('blend_capped');
    notes.push('blend_rejected_cap_at_primary');
    return withMeta(
      { depthValue: primary, source: 'primary', confidence: 0.55, notes },
      primary,
      fallback,
      travelEv,
      { blendOffered: true, blendCandidateRaw: rawBlended, blendCapped }
    );
  }
  notes.push(blendReason);
  if (blendCapped) notes.push('blend_capped');
  return withMeta(
    { depthValue: capped, source: 'blended', confidence, notes },
    primary,
    fallback,
    travelEv,
    { blendOffered: true, blendCandidateRaw: rawBlended, blendCapped }
  );
}

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
      return withMeta(
        { depthValue: fallback, source: 'fallback', confidence: 0.45, notes },
        null,
        fallback,
        travel
      );
    }
    notes.push('primary_null_no_fallback');
    return withMeta({ depthValue: 0, source: 'primary', confidence: 0, notes }, null, fallback, travel);
  }

  if (primary >= PRIMARY_STRONG_MIN) {
    notes.push('primary_strong');
    return withMeta({ depthValue: primary, source: 'primary', confidence: 0.92, notes }, primary, fallback, travel);
  }

  const travelLow = travel < JITTER_TRAVEL_CAP && (fallback == null || fallback < JITTER_FALLBACK_CAP);
  if (primary < PRIMARY_NEAR_FLAT && travelLow) {
    notes.push('jitter_guard_flat');
    return withMeta({ depthValue: primary, source: 'primary', confidence: 0.55, notes }, primary, fallback, travel);
  }

  const fallbackRejectedLowTravel =
    fallback != null &&
    fallback >= FALLBACK_MIN_FOR_ASSIST &&
    fallback >= primary * FALLBACK_PRIMARY_RATIO &&
    travel < FALLBACK_BLEND_MIN_TRAVEL;

  const fallbackOk =
    fallback != null &&
    fallback >= FALLBACK_MIN_FOR_ASSIST &&
    fallback >= primary * FALLBACK_PRIMARY_RATIO &&
    travel >= FALLBACK_BLEND_MIN_TRAVEL;
  const travelOk = travel >= TRAVEL_EVIDENCE_MIN && (fallback == null || fallback >= TRAVEL_WITH_FALLBACK_MIN);

  if (fallbackRejectedLowTravel) {
    notes.push('fallback_rejected_low_travel');
  }

  if (primary < PRIMARY_NEAR_FLAT && (fallbackOk || travelOk)) {
    const fb = fallback ?? primary;
    const rawBlended = clamp01(BLEND_PRIMARY_W * primary + BLEND_FALLBACK_W * Math.max(fb, primary));
    return emitCappedBlend(
      primary,
      rawBlended,
      travel,
      notes,
      fallbackOk ? 'blend_fallback' : 'blend_travel',
      0.62,
      fallback,
      travel
    );
  }

  if (fallback != null && fallback > primary + 0.01 && travel >= 0.1) {
    const rawBlended = clamp01(0.5 * primary + 0.5 * fallback);
    return emitCappedBlend(primary, rawBlended, travel, notes, 'blend_moderate_lift', 0.55, fallback, travel);
  }

  notes.push('primary_only');
  return withMeta({ depthValue: primary, source: 'primary', confidence: 0.7, notes }, primary, fallback, travel);
}
