/**
 * PR-CAM-OVERLAY-RENDER-SMOOTHING-01: 오버레이 전용 포즈 스무딩 (렌더 경로만).
 * evaluator / 캡처 truth 에는 사용하지 않는다 — camera evaluator 모듈 import 금지.
 */
import type { PoseLandmark } from './pose-types';

/** MediaPipe pose landmarker 단일 포즈 랜드마크 수 */
export const POSE_OVERLAY_LANDMARK_COUNT = 33;

export type PoseOverlaySmoothedPoint = {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
  /** 연속으로 관측이 비어 있던 프레임 수 (carry-forward 한계용) */
  missingStreak: number;
};

export interface PoseOverlaySmoothingState {
  points: Array<PoseOverlaySmoothedPoint | null>;
}

export interface PoseOverlaySmoothingOptions {
  /** x/y (및 z) EMA 계수 — 낮을수록 더 부드럽고 반응은 느려짐 */
  positionAlpha?: number;
  visibilityAlpha?: number;
  /** 랜드마크 좌표가 잠깐 비어 있을 때 직전 스무딩 값을 유지하는 최대 연속 프레임 수 */
  maxMissingCarryFrames?: number;
}

function isLandmarkObservationValid(lm: PoseLandmark | null | undefined): boolean {
  if (lm == null) return false;
  return Number.isFinite(lm.x) && Number.isFinite(lm.y);
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/**
 * 빈 상태 — 첫 유효 프레임에서 채워진다.
 */
export function createEmptyPoseOverlaySmoothingState(): PoseOverlaySmoothingState {
  return { points: Array.from({ length: POSE_OVERLAY_LANDMARK_COUNT }, () => null) };
}

/**
 * raw 랜드마크를 EMA + 짧은 carry-forward 로 스무딩한다.
 *
 * - raw 가 null/빈 배열이면 `{ landmarks: null, nextState: null }` 로 완전 리셋(고스트 방지).
 * - 인덱스별로 이전 스무딩 값이 있으면 EMA 적용.
 * - 좌표가 잠깐 invalid 면 maxMissingCarryFrames 동안 직전 스무딩을 출력.
 */
export function smoothPoseOverlayLandmarks(
  raw: PoseLandmark[] | null | undefined,
  prevState: PoseOverlaySmoothingState | null,
  options?: PoseOverlaySmoothingOptions
): { landmarks: PoseLandmark[] | null; nextState: PoseOverlaySmoothingState | null } {
  const positionAlpha = options?.positionAlpha ?? 0.38;
  const visibilityAlpha = options?.visibilityAlpha ?? 0.42;
  const maxCarry = options?.maxMissingCarryFrames ?? 2;

  if (!raw || raw.length === 0) {
    return { landmarks: null, nextState: null };
  }

  const n = POSE_OVERLAY_LANDMARK_COUNT;
  const prevPoints = prevState?.points ?? Array.from({ length: n }, () => null);
  const nextPoints: Array<PoseOverlaySmoothedPoint | null> = Array.from({ length: n }, () => null);
  const out: PoseLandmark[] = [];

  for (let i = 0; i < n; i++) {
    const r = raw[i];
    const prev = prevPoints[i] ?? null;

    if (isLandmarkObservationValid(r)) {
      const rx = r!.x;
      const ry = r!.y;
      const rz = r!.z;
      const rv = r!.visibility;

      let x: number;
      let y: number;
      let z: number | undefined;
      let visibility: number | undefined;

      if (prev != null && prev.missingStreak <= maxCarry) {
        x = prev.x + positionAlpha * (rx - prev.x);
        y = prev.y + positionAlpha * (ry - prev.y);
        if (prev.z != null && rz != null && Number.isFinite(rz)) {
          z = prev.z + positionAlpha * (rz - prev.z);
        } else {
          z = rz ?? prev.z;
        }
        if (typeof rv === 'number' && Number.isFinite(rv) && typeof prev.visibility === 'number') {
          visibility = prev.visibility + visibilityAlpha * (rv - prev.visibility);
        } else {
          visibility = rv ?? prev.visibility;
        }
      } else {
        x = rx;
        y = ry;
        z = rz;
        visibility = rv;
      }

      if (typeof visibility === 'number' && Number.isFinite(visibility)) {
        visibility = clamp01(visibility);
      }

      nextPoints[i] = { x, y, z, visibility, missingStreak: 0 };
      out.push({ x, y, z, visibility });
      continue;
    }

    // 관측 없음 / invalid — 짧게 carry
    if (prev != null && prev.missingStreak < maxCarry) {
      nextPoints[i] = {
        x: prev.x,
        y: prev.y,
        z: prev.z,
        visibility: prev.visibility,
        missingStreak: prev.missingStreak + 1,
      };
      out.push({
        x: prev.x,
        y: prev.y,
        z: prev.z,
        visibility: prev.visibility,
      });
    } else {
      nextPoints[i] = null;
      // 연결선 스킵을 위해 visibility 0 — 좌표는 이전 또는 중립 (고스트 최소화)
      const fx = prev?.x ?? 0.5;
      const fy = prev?.y ?? 0.5;
      out.push({ x: fx, y: fy, z: prev?.z, visibility: 0 });
    }
  }

  return {
    landmarks: out,
    nextState: { points: nextPoints },
  };
}

/**
 * 테스트·진단용: 연속 프레임 랜드마크 시퀀스의 평균 L1 이동량 (정규화 좌표).
 */
export function meanLandmarkL1DeltaBetweenFrames(frames: PoseLandmark[][]): number {
  if (frames.length < 2) return 0;
  let sum = 0;
  let count = 0;
  for (let f = 1; f < frames.length; f++) {
    const a = frames[f - 1]!;
    const b = frames[f]!;
    const len = Math.min(a.length, b.length, POSE_OVERLAY_LANDMARK_COUNT);
    for (let i = 0; i < len; i++) {
      const la = a[i];
      const lb = b[i];
      if (!la || !lb) continue;
      if (
        !Number.isFinite(la.x) ||
        !Number.isFinite(la.y) ||
        !Number.isFinite(lb.x) ||
        !Number.isFinite(lb.y)
      ) {
        continue;
      }
      sum += Math.abs(lb.x - la.x) + Math.abs(lb.y - la.y);
      count += 1;
    }
  }
  return count > 0 ? sum / count : 0;
}
