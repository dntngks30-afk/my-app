/**
 * Pose landmarks 타입 (MediaPipe 33-point 호환)
 * 브라우저 pose 추출 결과 정규화
 */
export interface PoseLandmark {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

export interface PoseFrame {
  timestampMs: number;
  landmarks: PoseLandmark[] | null;
  source: 'mediapipe';
  width: number;
  height: number;
}

export interface PoseLandmarks {
  /** 33개 랜드마크 (MediaPipe 인덱스) */
  landmarks: PoseLandmark[];
  /** 프레임 타임스탬프 */
  timestamp?: number;
}

/** MediaPipe 랜드마크 인덱스 */
export const POSE_LANDMARKS = {
  NOSE: 0,
  LEFT_EYE_INNER: 1,
  LEFT_EYE: 2,
  LEFT_EYE_OUTER: 3,
  RIGHT_EYE_INNER: 4,
  RIGHT_EYE: 5,
  RIGHT_EYE_OUTER: 6,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  MOUTH_LEFT: 9,
  MOUTH_RIGHT: 10,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_PINKY: 17,
  RIGHT_PINKY: 18,
  LEFT_INDEX: 19,
  RIGHT_INDEX: 20,
  LEFT_THUMB: 21,
  RIGHT_THUMB: 22,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32,
} as const;

const DEFAULT_VISIBILITY_THRESHOLD = 0.45;

export function toPoseLandmarks(frame: PoseFrame): PoseLandmarks | null {
  if (!frame.landmarks || frame.landmarks.length === 0) {
    return null;
  }

  return {
    landmarks: frame.landmarks,
    timestamp: frame.timestampMs,
  };
}

export function getPoseFrameLandmarkCount(frame: PoseFrame): number {
  return frame.landmarks?.length ?? 0;
}

export function getPoseFrameVisibleRatio(
  frame: PoseFrame,
  visibilityThreshold = DEFAULT_VISIBILITY_THRESHOLD
): number {
  if (!frame.landmarks || frame.landmarks.length === 0) {
    return 0;
  }

  const visibleCount = frame.landmarks.filter((landmark) => {
    if (typeof landmark.visibility !== 'number') {
      return true;
    }

    return landmark.visibility >= visibilityThreshold;
  }).length;

  return visibleCount / frame.landmarks.length;
}

export function isValidPoseFrame(frame: PoseFrame): boolean {
  return getPoseFrameLandmarkCount(frame) >= 33;
}
