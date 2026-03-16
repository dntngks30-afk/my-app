'use client';

/**
 * 카메라 미리보기 (전신 framing guide 포함)
 * 권한 거부/실패 시 null 반환, 부모에서 fallback UI 처리
 */
import { useEffect, useRef, useState } from 'react';
import type { PoseFrame } from '@/lib/motion/pose-types';
import type { CameraGuideTone } from '@/lib/camera/auto-progression';
import {
  clearPoseOverlay,
  createLivePoseAnalyzer,
  drawPoseFrameToCanvas,
  type LivePoseAnalyzer,
} from '@/lib/motion/mediapipe-pose';

const BG = '#0d161f';
const ANALYSIS_INTERVAL_MS = 90;

interface CameraPreviewProps {
  /** 권한 허용 시 표시할 비디오 */
  onReady?: (stream: MediaStream) => void;
  /** 비디오 엘리먼트 준비 시 (pose capture용) */
  onVideoReady?: (video: HTMLVideoElement) => void;
  /** live pose frame 전달 */
  onPoseFrame?: (frame: PoseFrame) => void;
  /** 권한 거부/실패 시 */
  onError?: (error: Error) => void;
  /** 비디오 미러 표시 */
  mirrored?: boolean;
  /** 개발용 skeleton overlay */
  showPoseDebugOverlay?: boolean;
  /** 실시간 가이드 색상 */
  guideTone?: CameraGuideTone;
  className?: string;
}

function getGuidePalette(tone: CameraGuideTone) {
  if (tone === 'success') {
    return {
      frame: 'rgba(34, 197, 94, 0.9)',
      glow: 'rgba(34, 197, 94, 0.24)',
      fill: 'rgba(34, 197, 94, 0.14)',
    };
  }

  if (tone === 'warning') {
    return {
      frame: 'rgba(248, 113, 113, 0.95)',
      glow: 'rgba(248, 113, 113, 0.24)',
      fill: 'rgba(248, 113, 113, 0.14)',
    };
  }

  return {
    frame: 'rgba(255, 255, 255, 0.62)',
    glow: 'rgba(255, 255, 255, 0.12)',
    fill: 'rgba(255, 255, 255, 0.08)',
  };
}

export function CameraPreview({
  onReady,
  onVideoReady,
  onPoseFrame,
  onError,
  mirrored = true,
  showPoseDebugOverlay = process.env.NODE_ENV !== 'production',
  guideTone = 'neutral',
  className = '',
}: CameraPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const onReadyRef = useRef(onReady);
  const onVideoReadyRef = useRef(onVideoReady);
  const onPoseFrameRef = useRef(onPoseFrame);
  const onErrorRef = useRef(onError);
  const [status, setStatus] = useState<
    'idle' | 'requesting' | 'binding' | 'ready' | 'error'
  >('idle');
  const streamRef = useRef<MediaStream | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const analyzerRef = useRef<LivePoseAnalyzer | null>(null);
  const analyzerInitRef = useRef<Promise<LivePoseAnalyzer> | null>(null);
  const analysisRafRef = useRef<number | null>(null);
  const [poseStatus, setPoseStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [poseErrorMessage, setPoseErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    onVideoReadyRef.current = onVideoReady;
  }, [onVideoReady]);

  useEffect(() => {
    onPoseFrameRef.current = onPoseFrame;
  }, [onPoseFrame]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      const video = videoRef.current;
      console.info('[CameraPreview]', {
        phase: status,
        hasStream: Boolean(stream),
        readyState: video?.readyState ?? null,
        videoWidth: video?.videoWidth ?? 0,
        videoHeight: video?.videoHeight ?? 0,
        poseStatus,
        errorMessage,
        poseErrorMessage,
      });
    }
  }, [status, stream, poseStatus, errorMessage, poseErrorMessage]);

  useEffect(() => {
    let mounted = true;

    async function startCamera() {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        const err = new Error('카메라를 지원하지 않는 환경입니다.');
        setStatus('error');
        setErrorMessage(err.message);
        onErrorRef.current?.(err);
        return;
      }
      setStatus('requesting');
      setErrorMessage(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        if (!mounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        setStream(stream);
        setStatus('binding');
        onReadyRef.current?.(stream);
      } catch (e) {
        if (!mounted) return;
        const error = e instanceof Error ? e : new Error('카메라 접근 실패');
        setStatus('error');
        setErrorMessage(error.message);
        onErrorRef.current?.(error);
      }
    }

    startCamera();
    return () => {
      mounted = false;
      if (analysisRafRef.current != null) {
        cancelAnimationFrame(analysisRafRef.current);
        analysisRafRef.current = null;
      }
      analyzerRef.current?.close();
      analyzerRef.current = null;
      clearPoseOverlay(overlayCanvasRef.current);
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    const shouldAnalyze = Boolean(onPoseFrameRef.current) || showPoseDebugOverlay;

    if (!video || status !== 'ready' || !shouldAnalyze) {
      setPoseStatus('idle');
      setPoseErrorMessage(null);
      clearPoseOverlay(overlayCanvasRef.current);
      return;
    }

    let cancelled = false;
    let lastAnalyzedAt = 0;

    const startAnalyzer = async () => {
      try {
        setPoseStatus('loading');
        setPoseErrorMessage(null);

        if (!analyzerInitRef.current) {
          analyzerInitRef.current = createLivePoseAnalyzer();
        }

        const analyzer = await analyzerInitRef.current;
        if (cancelled) return;

        analyzerRef.current = analyzer;
        setPoseStatus('ready');

        const loop = () => {
          if (cancelled) return;

          const currentVideo = videoRef.current;
          if (
            !currentVideo ||
            !streamRef.current ||
            currentVideo.readyState < 2 ||
            currentVideo.paused ||
            currentVideo.ended
          ) {
            analysisRafRef.current = requestAnimationFrame(loop);
            return;
          }

          const now = performance.now();
          if (now - lastAnalyzedAt >= ANALYSIS_INTERVAL_MS) {
            lastAnalyzedAt = now;
            const frame = analyzer.analyze(currentVideo, now);

            onPoseFrameRef.current?.(frame);

            if (showPoseDebugOverlay && overlayCanvasRef.current) {
              drawPoseFrameToCanvas(overlayCanvasRef.current, frame, { mirrored });
            } else {
              clearPoseOverlay(overlayCanvasRef.current);
            }
          }

          analysisRafRef.current = requestAnimationFrame(loop);
        };

        analysisRafRef.current = requestAnimationFrame(loop);
      } catch (error) {
        if (cancelled) return;

        const message =
          error instanceof Error ? error.message : 'Pose analyzer 초기화에 실패했습니다.';
        setPoseStatus('error');
        setPoseErrorMessage(message);
        clearPoseOverlay(overlayCanvasRef.current);

        if (process.env.NODE_ENV !== 'production') {
          console.warn('[CameraPreview:pose]', message);
        }
      }
    };

    startAnalyzer();

    return () => {
      cancelled = true;
      if (analysisRafRef.current != null) {
        cancelAnimationFrame(analysisRafRef.current);
        analysisRafRef.current = null;
      }
      analyzerRef.current?.close();
      analyzerRef.current = null;
      clearPoseOverlay(overlayCanvasRef.current);
    };
  }, [status, mirrored, showPoseDebugOverlay]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;

    let cancelled = false;

    const bindStream = async () => {
      try {
        if (video.srcObject !== stream) {
          video.srcObject = stream;
        }

        const playPromise = video.play();
        if (playPromise) {
          await playPromise;
        }
        if (cancelled) return;
        setStatus('ready');
        setErrorMessage(null);
        onVideoReadyRef.current?.(video);
      } catch (e) {
        if (cancelled) return;
        const error = e instanceof Error ? e : new Error('카메라 미리보기 재생 실패');
        setStatus('error');
        setErrorMessage(error.message);
        onErrorRef.current?.(error);
      }
    };

    const handleLoadedMetadata = () => {
      if (process.env.NODE_ENV !== 'production') {
        console.info('[CameraPreview:metadata]', {
          readyState: video.readyState,
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
        });
      }
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    bindStream();

    return () => {
      cancelled = true;
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      if (video.srcObject === stream) {
        video.pause();
        video.srcObject = null;
      }
    };
  }, [stream]);

  if (status === 'error') {
    return null;
  }

  const showLoading = status === 'requesting' || status === 'binding';
  const guidePalette = getGuidePalette(guideTone);

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 ${className}`}
      data-camera-phase={status}
      data-pose-phase={poseStatus}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`relative z-10 block w-full min-h-[320px] aspect-[3/4] object-cover max-h-[50vh] ${mirrored ? 'scale-x-[-1]' : ''}`}
        style={{ backgroundColor: BG }}
      />
      <canvas
        ref={overlayCanvasRef}
        className={`absolute inset-0 z-20 h-full w-full pointer-events-none ${mirrored ? 'scale-x-[-1]' : ''}`}
        aria-hidden
      />
      {showLoading && (
        <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none bg-black/20">
          <p className="text-slate-300 text-sm">카메라 연결 중...</p>
        </div>
      )}
      {/* 사용자가 멀리서도 맞추기 쉽도록 사람 실루엣 가이드를 겹쳐 보여준다. */}
      <div
        className="absolute inset-0 z-40 pointer-events-none flex items-center justify-center"
        aria-hidden
      >
        <svg
          viewBox="0 0 240 520"
          className="h-[85%] w-auto max-w-[78%] drop-shadow-[0_0_18px_rgba(255,255,255,0.08)]"
        >
          <rect
            x="22"
            y="18"
            width="196"
            height="484"
            rx="30"
            fill="none"
            stroke={guidePalette.frame}
            strokeWidth="3"
            strokeDasharray="10 10"
          />
          <circle
            cx="120"
            cy="88"
            r="31"
            fill={guidePalette.fill}
            stroke={guidePalette.frame}
            strokeWidth="3"
          />
          <path
            d="M88 160C88 144 101 132 117 132H123C139 132 152 144 152 160V222C152 238 139 250 123 250H117C101 250 88 238 88 222V160Z"
            fill={guidePalette.fill}
            stroke={guidePalette.frame}
            strokeWidth="3"
          />
          <path
            d="M87 188L55 252"
            stroke={guidePalette.frame}
            strokeWidth="16"
            strokeLinecap="round"
          />
          <path
            d="M153 188L185 252"
            stroke={guidePalette.frame}
            strokeWidth="16"
            strokeLinecap="round"
          />
          <path
            d="M108 250L86 412"
            stroke={guidePalette.frame}
            strokeWidth="18"
            strokeLinecap="round"
          />
          <path
            d="M132 250L154 412"
            stroke={guidePalette.frame}
            strokeWidth="18"
            strokeLinecap="round"
          />
          <path
            d="M78 418H95"
            stroke={guidePalette.frame}
            strokeWidth="10"
            strokeLinecap="round"
          />
          <path
            d="M145 418H162"
            stroke={guidePalette.frame}
            strokeWidth="10"
            strokeLinecap="round"
          />
          <rect
            x="18"
            y="14"
            width="204"
            height="492"
            rx="34"
            fill="none"
            stroke={guidePalette.glow}
            strokeWidth="12"
          />
        </svg>
      </div>
      {process.env.NODE_ENV !== 'production' && (
        <div className="absolute bottom-2 left-2 z-40 rounded bg-black/50 px-2 py-1 text-[10px] text-white pointer-events-none">
          {status} / pose:{poseStatus}
        </div>
      )}
    </div>
  );
}
