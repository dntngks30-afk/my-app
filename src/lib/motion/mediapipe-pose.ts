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

// ---------------------------------------------------------------------------
// Runtime singleton — globalThis에 보존하여 HMR/module-re-evaluate 시에도
// landmarkerPromise·단조 timestamp·generation 상태가 유지된다.
// ---------------------------------------------------------------------------

interface MpRuntimeSingleton {
  /** 공유 PoseLandmarker 초기화 Promise. null이면 아직 생성 전 또는 fatal reset 후. */
  landmarkerPromise: Promise<PoseLandmarker> | null;
  /** 마지막으로 detectForVideo에 넘긴 타임스탬프(ms). 단조 증가 보장. */
  lastDetectTimestampMs: number;
  /** detectForVideo 호출이 진행 중인지 여부. 중첩 호출을 방지한다. */
  detectInFlight: boolean;
  /**
   * fatal 오류(timestamp mismatch / CalculatorGraph) 발생 후 재시도를 막는
   * 쿨다운 종료 시각(Date.now() 기준 ms).
   */
  fatalCooldownUntilMs: number;
  /** fatal reset 누적 횟수 (진단용). CameraPreview가 동일 resetCount 중복 처리를 막는 데 사용. */
  fatalResetCount: number;
  /**
   * fatal reset 시마다 +1되는 세대 번호.
   * analyzer는 자신의 생성 시점 세대를 기억하고, 불일치 시 stale로 판단한다.
   */
  runtimeGeneration: number;
  /** 오류 로그 rate-limit 윈도우 시작 시각. */
  logWindowStartMs: number;
  /** 현재 윈도우 내 오류 로그 출력 횟수. */
  logCountInWindow: number;
}

/**
 * key 버전 bump: 구 key에 남아 있는 stale 상태와 충돌하지 않도록
 * 구조가 변경될 때마다 버전 suffix를 올린다.
 * v4: runtimeGeneration 필드 추가 (HOTFIX-05)
 */
const RUNTIME_KEY = '__moveReMpRuntime_v4';

function getRuntime(): MpRuntimeSingleton {
  const g = globalThis as Record<string, unknown>;
  if (typeof g[RUNTIME_KEY] !== 'object' || g[RUNTIME_KEY] === null) {
    g[RUNTIME_KEY] = {
      landmarkerPromise: null,
      lastDetectTimestampMs: -1,
      detectInFlight: false,
      fatalCooldownUntilMs: 0,
      fatalResetCount: 0,
      runtimeGeneration: 0,
      logWindowStartMs: 0,
      logCountInWindow: 0,
    } satisfies MpRuntimeSingleton;
  }
  return g[RUNTIME_KEY] as MpRuntimeSingleton;
}

// ---------------------------------------------------------------------------
// Fatal error detection & recovery
// ---------------------------------------------------------------------------

const FATAL_DETECT_PATTERNS = [
  'packet timestamp mismatch',
  'calculatorgraph',
  'graph error',
  'bad timestamp',
];
export const FATAL_COOLDOWN_MS = 2_000;

function isFatalDetectError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return FATAL_DETECT_PATTERNS.some((p) => msg.includes(p));
}

/**
 * fatal reset:
 * - landmarkerPromise를 null로 해 다음 getSharedPoseLandmarker()가 새 인스턴스를 생성하게 한다.
 * - runtimeGeneration을 +1 하여 기존 모든 analyzer가 stale로 판단되도록 한다.
 * - FATAL_COOLDOWN_MS 동안 detect 시도를 차단한다.
 * - 무한 루프 방지: fatalResetCount 확인 후 동일 cooldown 적용.
 */
function applyFatalReset(err: unknown): void {
  const rt = getRuntime();
  rt.landmarkerPromise = null;
  rt.lastDetectTimestampMs = -1;
  rt.detectInFlight = false;
  rt.fatalCooldownUntilMs = Date.now() + FATAL_COOLDOWN_MS;
  rt.fatalResetCount += 1;
  rt.runtimeGeneration += 1;

  console.error('[pose] fatal detect error — runtime reset', {
    err: err instanceof Error ? err.message : String(err),
    resetCount: rt.fatalResetCount,
    runtimeGeneration: rt.runtimeGeneration,
    cooldownMs: FATAL_COOLDOWN_MS,
  });
}

// ---------------------------------------------------------------------------
// Log rate-limiting
// ---------------------------------------------------------------------------

const DETECT_ERROR_LOG_WINDOW_MS = 30_000;
const DETECT_ERROR_LOG_MAX_PER_WINDOW = 8;

function shouldLogDetectVideoError(): boolean {
  const rt = getRuntime();
  const now = Date.now();
  if (now - rt.logWindowStartMs > DETECT_ERROR_LOG_WINDOW_MS) {
    rt.logWindowStartMs = now;
    rt.logCountInWindow = 0;
  }
  if (rt.logCountInWindow >= DETECT_ERROR_LOG_MAX_PER_WINDOW) return false;
  rt.logCountInWindow += 1;
  return true;
}

function logDetectVideoFailure(
  err: unknown,
  video: HTMLVideoElement,
  ts: number,
  context?: PoseDetectDiagnosticsContext
): void {
  if (!shouldLogDetectVideoError()) return;
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
  const rt = getRuntime();
  let c = candidateMs;
  if (!Number.isFinite(c) || c < 0) {
    c = 0;
  }
  if (rt.lastDetectTimestampMs >= 0 && c <= rt.lastDetectTimestampMs) {
    c = rt.lastDetectTimestampMs + 1;
  }
  rt.lastDetectTimestampMs = c;
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

// ---------------------------------------------------------------------------
// Shared PoseLandmarker — runtime singleton 안에 보관
// ---------------------------------------------------------------------------

async function getSharedPoseLandmarker(): Promise<PoseLandmarker> {
  const rt = getRuntime();
  if (!rt.landmarkerPromise) {
    rt.landmarkerPromise = (async () => {
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
      rt.landmarkerPromise = null;
      throw error;
    });
  }

  return rt.landmarkerPromise;
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

/** fatal reset 메타데이터가 포함된 빈 프레임. CameraPreview가 이 신호로 재생성을 트리거한다. */
function createFatalResetFrame(video: HTMLVideoElement, timestampMs: number): PoseFrame {
  const rt = getRuntime();
  return {
    ...createEmptyPoseFrame(video, timestampMs),
    _mediapipeDetectFailed: true,
    _mediapipeFatalResetTriggered: true,
    _mediapipeRuntimeGeneration: rt.runtimeGeneration,
    _mediapipeFatalResetCount: rt.fatalResetCount,
    _mediapipeRecoveryCooldownMs: Math.max(0, rt.fatalCooldownUntilMs - Date.now()),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function createLivePoseAnalyzer(): Promise<LivePoseAnalyzer> {
  const landmarker = await getSharedPoseLandmarker();

  /**
   * analyzer 생성 시점의 runtimeGeneration을 캡처한다.
   * analyze() 호출 시 현재 세대와 다르면 이 analyzer는 stale이며
   * fatal reset이 발생했다는 신호를 포함한 프레임을 반환한다.
   * CameraPreview는 이 신호로 analyzer를 재생성해야 한다.
   */
  const creationRuntimeGeneration = getRuntime().runtimeGeneration;

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

      if (!landmarker) {
        return createEmptyPoseFrame(video, fallbackTs);
      }

      const rt = getRuntime();

      // --- stale analyzer 감지: fatal reset으로 세대가 바뀐 경우 ---
      // 이 analyzer가 캡처한 landmarker는 더 이상 유효하지 않다.
      // detect를 시도하지 않고 fatal 신호를 포함한 프레임을 반환한다.
      if (rt.runtimeGeneration !== creationRuntimeGeneration) {
        return createFatalResetFrame(video, fallbackTs);
      }

      // --- fatal cooldown 중이면 skip (timestamp 증가 없음) ---
      if (Date.now() < rt.fatalCooldownUntilMs) {
        return { ...createEmptyPoseFrame(video, fallbackTs), _mediapipeDetectFailed: true };
      }

      // --- detect 직렬화: 이전 호출이 아직 진행 중이면 이번 프레임은 건너뜀 ---
      if (rt.detectInFlight) {
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

      // --- 실제 detect 직전에만 timestamp bump ---
      const ts = bumpMonotonicTimestampMs(rawMediaMs);
      rt.detectInFlight = true;

      try {
        const result = landmarker.detectForVideo(video, ts);
        rt.detectInFlight = false;

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
        rt.detectInFlight = false;

        if (isFatalDetectError(error)) {
          // fatal: runtime을 완전히 초기화하고 쿨다운 적용.
          // runtimeGeneration이 증가하므로 이 analyzer는 다음 호출부터 stale로 판단된다.
          applyFatalReset(error);
          // 이 프레임 자체에도 fatal 신호를 포함해 CameraPreview가 즉시 재생성 경로를 밟을 수 있게 한다.
          return createFatalResetFrame(video, ts);
        } else {
          logDetectVideoFailure(error, video, ts, diagnostics);
        }

        return {
          ...createEmptyPoseFrame(video, ts),
          _mediapipeDetectFailed: true,
        };
      }
    },
    close() {
      // Shared landmarker는 유지하고 preview loop만 정리한다.
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

// ---------------------------------------------------------------------------
// Dev/test utility — 테스트에서 런타임 상태를 직접 검사·조작할 때만 사용
// ---------------------------------------------------------------------------

/** @internal 테스트 전용 */
export function _getMpRuntimeForTest(): MpRuntimeSingleton {
  return getRuntime();
}

/** @internal 테스트 전용: runtime을 완전 초기화 */
export function _resetMpRuntimeForTest(): void {
  const g = globalThis as Record<string, unknown>;
  g[RUNTIME_KEY] = {
    landmarkerPromise: null,
    lastDetectTimestampMs: -1,
    detectInFlight: false,
    fatalCooldownUntilMs: 0,
    fatalResetCount: 0,
    runtimeGeneration: 0,
    logWindowStartMs: 0,
    logCountInWindow: 0,
  } satisfies MpRuntimeSingleton;
}

/** @internal 테스트 전용: 강제로 fatal reset을 발생시켜 runtimeGeneration을 올린다 */
export function _triggerFatalResetForTest(message = 'Packet timestamp mismatch (test)'): void {
  applyFatalReset(new Error(message));
}
