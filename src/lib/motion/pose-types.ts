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

/**
 * CAM-OBS: MediaPipe detect 1회 관측 — 판정·스무딩과 무관, JSON export 전용.
 */
export type CameraPoseDelegateKind = 'cpu' | 'gpu' | 'wasm' | 'unknown';

export interface CameraPoseFrameObservability {
  runtime: {
    latency_ms: number;
    fps_est: number;
    delegate: CameraPoseDelegateKind;
  };
  pose_quality: {
    median_landmark_conf: number;
    reproj_px: number | null;
    pose_world_present: boolean;
  };
}

export interface PoseFrame {
  timestampMs: number;
  landmarks: PoseLandmark[] | null;
  source: 'mediapipe';
  width: number;
  height: number;
  /** CAM-OBS: detectForVideo 직후 측정값(랜드마크 유효 프레임에만 채움) */
  cameraObservability?: CameraPoseFrameObservability;
  /**
   * 내부용: `detectForVideo` 예외 시 true. 캡처 루프 백오프만을 위한 힌트(공개 결과 스키마 아님).
   */
  _mediapipeDetectFailed?: boolean;
  /**
   * 내부용: 현재 analyzer가 fatal detect/runtime 오류로 더 이상 사용되면 안 됨을 뜻한다.
   * CameraPreview는 이 신호를 받으면 해당 analyzer를 폐기하고 새 analyzer를 만들어야 한다.
   */
  _mediapipeAnalyzerFatal?: boolean;
  /** 내부용: 현재 analyzer를 다시 만들 필요가 있음을 명시한다. */
  _mediapipeAnalyzerNeedsRecreate?: boolean;
  /** 내부용: 어떤 analyzer 인스턴스가 이 프레임을 만들었는지 식별한다. */
  _mediapipeAnalyzerId?: number;
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
const MIN_USABLE_VISIBLE_RATIO = 0.25;
const MIN_CORE_VISIBILITY_RATIO = 0.34;
const MIN_BODY_BOX_AREA = 0.02;
const MAX_BODY_BOX_AREA = 0.98;
const MAX_CORE_JITTER_DISTANCE = 0.16;

const CORE_LANDMARK_INDICES = [
  POSE_LANDMARKS.LEFT_SHOULDER,
  POSE_LANDMARKS.RIGHT_SHOULDER,
  POSE_LANDMARKS.LEFT_HIP,
  POSE_LANDMARKS.RIGHT_HIP,
  POSE_LANDMARKS.LEFT_KNEE,
  POSE_LANDMARKS.RIGHT_KNEE,
] as const;

export interface PoseFrameBodyBox {
  width: number;
  height: number;
  area: number;
}

export interface PoseFrameQuality {
  usable: boolean;
  visibleRatio: number;
  coreVisibilityRatio: number;
  bodyBox: PoseFrameBodyBox;
  jitterDistance: number | null;
  reasons: string[];
}

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

export function getPoseFrameBodyBox(frame: PoseFrame): PoseFrameBodyBox {
  if (!frame.landmarks || frame.landmarks.length === 0) {
    return { width: 0, height: 0, area: 0 };
  }

  const xs = frame.landmarks.map((landmark) => landmark.x);
  const ys = frame.landmarks.map((landmark) => landmark.y);
  const width = Math.max(...xs) - Math.min(...xs);
  const height = Math.max(...ys) - Math.min(...ys);

  return {
    width,
    height,
    area: width * height,
  };
}

export function getPoseFrameCoreVisibilityRatio(frame: PoseFrame): number {
  if (!frame.landmarks || frame.landmarks.length === 0) {
    return 0;
  }

  const visibleCount = CORE_LANDMARK_INDICES.filter((index) => {
    const landmark = frame.landmarks?.[index];
    if (!landmark) return false;
    if (typeof landmark.visibility !== 'number') return true;
    return landmark.visibility >= DEFAULT_VISIBILITY_THRESHOLD;
  }).length;

  return visibleCount / CORE_LANDMARK_INDICES.length;
}

export function getPoseFrameJitterDistance(
  frame: PoseFrame,
  previousFrame: PoseFrame | null
): number | null {
  if (!frame.landmarks || !previousFrame?.landmarks) {
    return null;
  }

  const distances = CORE_LANDMARK_INDICES.flatMap((index) => {
    const current = frame.landmarks?.[index];
    const previous = previousFrame.landmarks?.[index];
    if (!current || !previous) return [];

    return [Math.hypot(current.x - previous.x, current.y - previous.y)];
  });

  if (distances.length === 0) {
    return null;
  }

  return distances.reduce((sum, value) => sum + value, 0) / distances.length;
}

export function getPoseFrameQuality(
  frame: PoseFrame,
  previousFrame: PoseFrame | null = null
): PoseFrameQuality {
  const reasons: string[] = [];
  const visibleRatio = getPoseFrameVisibleRatio(frame);
  const coreVisibilityRatio = getPoseFrameCoreVisibilityRatio(frame);
  const bodyBox = getPoseFrameBodyBox(frame);
  const jitterDistance = getPoseFrameJitterDistance(frame, previousFrame);

  if (!isValidPoseFrame(frame)) {
    reasons.push('landmark_count');
  }
  if (visibleRatio < MIN_USABLE_VISIBLE_RATIO) {
    reasons.push('low_visibility');
  }
  if (coreVisibilityRatio < MIN_CORE_VISIBILITY_RATIO) {
    reasons.push('core_joints_missing');
  }
  if (bodyBox.area < MIN_BODY_BOX_AREA || bodyBox.area > MAX_BODY_BOX_AREA) {
    reasons.push('body_box_invalid');
  }
  if (
    jitterDistance !== null &&
    jitterDistance > MAX_CORE_JITTER_DISTANCE &&
    visibleRatio < 0.5
  ) {
    reasons.push('unstable_frame');
  }

  const blockingReasons = reasons.filter((reason) => reason !== 'unstable_frame');

  return {
    usable: blockingReasons.length === 0,
    visibleRatio,
    coreVisibilityRatio,
    bodyBox,
    jitterDistance,
    reasons,
  };
}
