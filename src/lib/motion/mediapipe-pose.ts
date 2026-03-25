import type { PoseLandmarker } from '@mediapipe/tasks-vision';
import type { PoseFrame, PoseLandmark } from './pose-types';

const MEDIAPIPE_WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm';
const POSE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task';

const POSE_CONNECTIONS: Array<[number, number]> = [
  [0, 1],
  [0, 4],
  [1, 2],
  [2, 3],
  [4, 5],
  [5, 6],
  [9, 10],
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [24, 26],
  [25, 27],
  [26, 28],
  [27, 29],
  [28, 30],
  [29, 31],
  [30, 32],
];

export interface LivePoseAnalyzer {
  /**
   * @param _timestampMsIgnored PR-HOTFIX-03: 타임스탬프는 `video.currentTime`에서만 유도한다(호환용 인자).
   */
  analyze(video: HTMLVideoElement, _timestampMsIgnored?: number): PoseFrame;
  close(): void;
}

let sharedPoseLandmarkerPromise: Promise<PoseLandmarker> | null = null;

/**
 * 공유 VIDEO PoseLandmarker는 전역적으로 단조 증가하는 timestamp만 허용한다.
 * analyzer 인스턴스마다 lastTs를 두면 페이지 전환·remount 시 역행이 들어가 런타임 예외가 날 수 있다.
 */
let globalLastDetectTimestampMs = -1;

function bumpMonotonicTimestampMs(candidateMs: number): number {
  let c = candidateMs;
  if (!Number.isFinite(c) || c < 0) {
    c = 0;
  }
  if (globalLastDetectTimestampMs >= 0 && c <= globalLastDetectTimestampMs) {
    c = globalLastDetectTimestampMs + 1;
  }
  globalLastDetectTimestampMs = c;
  return c;
}

function mediaTimestampMsFromVideo(video: HTMLVideoElement): number {
  return Number.isFinite(video.currentTime) ? Math.round(video.currentTime * 1000) : NaN;
}

function createEmptyPoseFrame(video: HTMLVideoElement, timestampMs: number): PoseFrame {
  return {
    timestampMs,
    landmarks: null,
    source: 'mediapipe',
    width: video.videoWidth || video.clientWidth || 0,
    height: video.videoHeight || video.clientHeight || 0,
  };
}

function toPoseFrame(
  video: HTMLVideoElement,
  timestampMs: number,
  landmarks: PoseLandmark[] | null
): PoseFrame {
  return {
    ...createEmptyPoseFrame(video, timestampMs),
    landmarks,
  };
}

async function getSharedPoseLandmarker(): Promise<PoseLandmarker> {
  if (!sharedPoseLandmarkerPromise) {
    sharedPoseLandmarkerPromise = (async () => {
      const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision');
      const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL);

      return PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: POSE_MODEL_URL,
        },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
    })().catch((error) => {
      sharedPoseLandmarkerPromise = null;
      throw error;
    });
  }

  return sharedPoseLandmarkerPromise;
}

export async function createLivePoseAnalyzer(): Promise<LivePoseAnalyzer> {
  const landmarker = await getSharedPoseLandmarker();

  return {
    analyze(video, _timestampMsIgnored) {
      if (!video) {
        return {
          timestampMs: 0,
          landmarks: null,
          source: 'mediapipe',
          width: 0,
          height: 0,
        };
      }

      const rawMediaMs = mediaTimestampMsFromVideo(video);

      if (!landmarker) {
        return createEmptyPoseFrame(
          video,
          Number.isFinite(rawMediaMs) ? rawMediaMs : 0
        );
      }

      if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
        return createEmptyPoseFrame(
          video,
          Number.isFinite(rawMediaMs) ? rawMediaMs : 0
        );
      }

      if (!Number.isFinite(rawMediaMs)) {
        return createEmptyPoseFrame(video, 0);
      }

      const ts = bumpMonotonicTimestampMs(rawMediaMs);

      if (process.env.NODE_ENV !== 'production') {
        console.debug('[mediapipe-pose] detectForVideo', {
          readyState: video.readyState,
          currentTime: video.currentTime,
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
          rawMediaMs,
          ts,
          globalLast: globalLastDetectTimestampMs,
        });
      }

      try {
        const result = landmarker.detectForVideo(video, ts);
        const firstPose = result.landmarks?.[0];

        if (!firstPose || firstPose.length === 0) {
          return createEmptyPoseFrame(video, ts);
        }

        return toPoseFrame(
          video,
          ts,
          firstPose.map((landmark) => ({
            x: landmark.x,
            y: landmark.y,
            z: landmark.z,
            visibility: landmark.visibility,
          }))
        );
      } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[mediapipe-pose] detectForVideo failed', error);
        }
        return createEmptyPoseFrame(video, ts);
      }
    },
    close() {
      // Shared landmarker는 유지하고 preview loop만 정리한다.
    },
  };
}

function clearCanvas(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d');
  if (!context) return;

  context.clearRect(0, 0, canvas.width, canvas.height);
}

export function drawPoseFrameToCanvas(
  canvas: HTMLCanvasElement,
  frame: PoseFrame,
  options: { mirrored?: boolean } = {}
) {
  const context = canvas.getContext('2d');
  if (!context) return;

  const width = canvas.clientWidth || frame.width || 0;
  const height = canvas.clientHeight || frame.height || 0;

  if (width === 0 || height === 0) {
    clearCanvas(canvas);
    return;
  }

  if (canvas.width !== width) {
    canvas.width = width;
  }

  if (canvas.height !== height) {
    canvas.height = height;
  }

  clearCanvas(canvas);

  if (!frame.landmarks || frame.landmarks.length === 0) {
    return;
  }

  context.save();
  context.lineWidth = 2;
  context.strokeStyle = 'rgba(255, 123, 0, 0.7)';
  context.fillStyle = 'rgba(255, 255, 255, 0.85)';

  for (const [startIndex, endIndex] of POSE_CONNECTIONS) {
    const start = frame.landmarks[startIndex];
    const end = frame.landmarks[endIndex];

    if (!start || !end) continue;

    context.beginPath();
    context.moveTo(start.x * width, start.y * height);
    context.lineTo(end.x * width, end.y * height);
    context.stroke();
  }

  for (const landmark of frame.landmarks) {
    const alpha =
      typeof landmark.visibility === 'number'
        ? Math.max(0.25, Math.min(1, landmark.visibility))
        : 0.85;

    context.beginPath();
    context.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    context.arc(landmark.x * width, landmark.y * height, 3, 0, Math.PI * 2);
    context.fill();
  }

  if (options.mirrored) {
    // CSS에서 미러링하므로 draw 좌표는 그대로 사용한다.
  }

  context.restore();
}

export function clearPoseOverlay(canvas: HTMLCanvasElement | null) {
  if (!canvas) return;
  clearCanvas(canvas);
}
