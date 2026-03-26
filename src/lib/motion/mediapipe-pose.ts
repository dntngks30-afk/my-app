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

/** `detectForVideo` 실패 시 console 진단용(프레임당 로그 스팸 방지 — rate-limit 적용) */
export type PoseDetectDiagnosticsContext = {
  motionType?: string;
};

export interface LivePoseAnalyzer {
  /**
   * @param _timestampMsIgnored 타임스탬프는 `video.currentTime`에서만 유도한다(호환용).
   * @param diagnostics 선택: 실패 로그에 `motionType` 등 부착
   */
  analyze(
    video: HTMLVideoElement,
    _timestampMsIgnored?: number,
    diagnostics?: PoseDetectDiagnosticsContext
  ): PoseFrame;
  close(): void;
}

const FATAL_DETECT_PATTERNS = [
  'packet timestamp mismatch',
  'calculatorgraph',
  'graph error',
  'bad timestamp',
];
const ANALYZER_RECREATE_REASON = 'fatal_detect_runtime';
let nextAnalyzerId = 1;

function isFatalDetectError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return FATAL_DETECT_PATTERNS.some((p) => msg.includes(p));
}

const DETECT_ERROR_LOG_WINDOW_MS = 30_000;
const DETECT_ERROR_LOG_MAX_PER_WINDOW = 8;

type DetectLogState = {
  windowStartMs: number;
  countInWindow: number;
};

function shouldLogDetectVideoError(state: DetectLogState): boolean {
  const now = Date.now();
  if (now - state.windowStartMs > DETECT_ERROR_LOG_WINDOW_MS) {
    state.windowStartMs = now;
    state.countInWindow = 0;
  }
  if (state.countInWindow >= DETECT_ERROR_LOG_MAX_PER_WINDOW) return false;
  state.countInWindow += 1;
  return true;
}

function logDetectVideoFailure(
  logState: DetectLogState,
  err: unknown,
  video: HTMLVideoElement,
  ts: number,
  context?: PoseDetectDiagnosticsContext
): void {
  if (!shouldLogDetectVideoError(logState)) return;
  const stream = video.srcObject instanceof MediaStream ? video.srcObject : null;
  console.error('[pose.detectForVideo] failed', {
    err,
    ts,
    readyState: video.readyState,
    videoWidth: video.videoWidth,
    videoHeight: video.videoHeight,
    currentTime: video.currentTime,
    paused: video.paused,
    ended: video.ended,
    hasSrcObject: Boolean(video.srcObject),
    streamActive: stream != null && typeof stream.active === 'boolean' ? stream.active : undefined,
    videoTrackStates:
      stream?.getVideoTracks().map((t) => ({ id: t.id, readyState: t.readyState })) ?? undefined,
    motionType: context?.motionType,
  });
}

// ---------------------------------------------------------------------------
// Monotonic timestamp — 실제 detect 직전에만 bump
// ---------------------------------------------------------------------------

/**
 * candidateMs를 단조 증가하는 timestamp로 보정해 반환한다.
 * 이 함수는 반드시 실제 detect 직전에만 호출해야 한다(skip 경로에서는 호출 금지).
 */
function bumpMonotonicTimestampMs(candidateMs: number): number {
  let c = candidateMs;
  if (!Number.isFinite(c) || c < 0) {
    c = 0;
  }
  return c;
}

function bumpAnalyzerTimestampMs(lastDetectTimestampMs: number, candidateMs: number): number {
  let c = bumpMonotonicTimestampMs(candidateMs);
  if (lastDetectTimestampMs >= 0 && c <= lastDetectTimestampMs) {
    c = lastDetectTimestampMs + 1;
  }
  return c;
}

function mediaTimestampMsFromVideo(video: HTMLVideoElement): number {
  return Number.isFinite(video.currentTime) ? Math.round(video.currentTime * 1000) : NaN;
}

/** 스트림이 끊기면 detect 호출을 건너뛴다(전역 timestamp는 증가시키지 않음). */
function isVideoStreamDecodable(video: HTMLVideoElement): boolean {
  const so = video.srcObject;
  if (so == null) return false;
  if (so instanceof MediaStream) {
    if (typeof so.active === 'boolean' && !so.active) return false;
    const tracks = so.getVideoTracks();
    if (tracks.length === 0) return false;
    return tracks.some((t) => t.readyState === 'live');
  }
  return true;
}

async function createPoseLandmarker(): Promise<PoseLandmarker> {
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
}

// ---------------------------------------------------------------------------
// Frame helpers
// ---------------------------------------------------------------------------

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

function createAnalyzerFatalFrame(
  video: HTMLVideoElement,
  timestampMs: number,
  analyzerId: number
): PoseFrame {
  return {
    ...createEmptyPoseFrame(video, timestampMs),
    _mediapipeDetectFailed: true,
    _mediapipeAnalyzerFatal: true,
    _mediapipeAnalyzerNeedsRecreate: true,
    _mediapipeAnalyzerId: analyzerId,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function createLivePoseAnalyzer(): Promise<LivePoseAnalyzer> {
  let landmarker: PoseLandmarker | null = await createPoseLandmarker();
  const analyzerId = nextAnalyzerId++;
  let lastDetectTimestampMs = -1;
  let detectInFlight = false;
  let closed = false;
  let fatal = false;
  const logState: DetectLogState = {
    windowStartMs: 0,
    countInWindow: 0,
  };

  function poisonAnalyzer(reason: unknown): void {
    if (fatal) return;
    fatal = true;
    detectInFlight = false;
    const current = landmarker;
    landmarker = null;
    if (current && typeof current.close === 'function') {
      try {
        current.close();
      } catch {
        // close 실패는 복구 경로를 막지 않도록 삼킨다.
      }
    }
    console.error('[pose] analyzer poisoned after fatal detect failure', {
      analyzerId,
      reason: reason instanceof Error ? reason.message : String(reason),
      recreateReason: ANALYZER_RECREATE_REASON,
    });
  }

  return {
    analyze(video, _timestampMsIgnored, diagnostics) {
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
      const fallbackTs = Number.isFinite(rawMediaMs) ? rawMediaMs : 0;

      if (closed) {
        return createEmptyPoseFrame(video, fallbackTs);
      }

      if (fatal || !landmarker) {
        return createAnalyzerFatalFrame(video, fallbackTs, analyzerId);
      }

      if (detectInFlight) {
        return createEmptyPoseFrame(video, fallbackTs);
      }

      if (video.paused || video.ended) {
        return createEmptyPoseFrame(video, fallbackTs);
      }

      if (!isVideoStreamDecodable(video)) {
        return createEmptyPoseFrame(video, fallbackTs);
      }

      if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
        return createEmptyPoseFrame(video, fallbackTs);
      }

      if (!Number.isFinite(rawMediaMs)) {
        return createEmptyPoseFrame(video, 0);
      }

      const ts = bumpAnalyzerTimestampMs(lastDetectTimestampMs, rawMediaMs);
      lastDetectTimestampMs = ts;
      detectInFlight = true;

      try {
        const result = landmarker.detectForVideo(video, ts);
        detectInFlight = false;

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
        detectInFlight = false;

        if (isFatalDetectError(error)) {
          poisonAnalyzer(error);
          return createAnalyzerFatalFrame(video, ts, analyzerId);
        } else {
          logDetectVideoFailure(logState, error, video, ts, diagnostics);
        }

        return {
          ...createEmptyPoseFrame(video, ts),
          _mediapipeDetectFailed: true,
        };
      }
    },
    close() {
      closed = true;
      detectInFlight = false;
      const current = landmarker;
      landmarker = null;
      if (current && typeof current.close === 'function') {
        try {
          current.close();
        } catch {
          // analyzer close는 best-effort다.
        }
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Canvas drawing utilities (변경 없음)
// ---------------------------------------------------------------------------

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

