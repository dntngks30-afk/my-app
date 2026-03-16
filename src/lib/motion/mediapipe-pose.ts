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
  analyze(video: HTMLVideoElement, timestampMs: number): PoseFrame;
  close(): void;
}

let sharedPoseLandmarkerPromise: Promise<PoseLandmarker> | null = null;

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
    analyze(video, timestampMs) {
      if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
        return createEmptyPoseFrame(video, timestampMs);
      }

      const result = landmarker.detectForVideo(video, timestampMs);
      const firstPose = result.landmarks?.[0];

      if (!firstPose || firstPose.length === 0) {
        return createEmptyPoseFrame(video, timestampMs);
      }

      return toPoseFrame(
        video,
        timestampMs,
        firstPose.map((landmark) => ({
          x: landmark.x,
          y: landmark.y,
          z: landmark.z,
          visibility: landmark.visibility,
        }))
      );
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
