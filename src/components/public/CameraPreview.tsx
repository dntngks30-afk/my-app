'use client';

/**
 * 카메라 미리보기 (전신 framing guide 포함)
 * 권한 거부/실패 시 null 반환, 부모에서 fallback UI 처리
 */
import { useEffect, useRef, useState } from 'react';

const BG = '#0d161f';

interface CameraPreviewProps {
  /** 권한 허용 시 표시할 비디오 */
  onReady?: (stream: MediaStream) => void;
  /** 비디오 엘리먼트 준비 시 (pose capture용) */
  onVideoReady?: (video: HTMLVideoElement) => void;
  /** 권한 거부/실패 시 */
  onError?: (error: Error) => void;
  /** 비디오 미러 표시 */
  mirrored?: boolean;
  className?: string;
}

export function CameraPreview({
  onReady,
  onVideoReady,
  onError,
  mirrored = true,
  className = '',
}: CameraPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onReadyRef = useRef(onReady);
  const onVideoReadyRef = useRef(onVideoReady);
  const onErrorRef = useRef(onError);
  const [status, setStatus] = useState<
    'idle' | 'requesting' | 'binding' | 'ready' | 'error'
  >('idle');
  const streamRef = useRef<MediaStream | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    onVideoReadyRef.current = onVideoReady;
  }, [onVideoReady]);

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
        errorMessage,
      });
    }
  }, [status, stream, errorMessage]);

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

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 ${className}`}
      data-camera-phase={status}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`relative z-10 block w-full min-h-[320px] aspect-[3/4] object-cover max-h-[50vh] ${mirrored ? 'scale-x-[-1]' : ''}`}
        style={{ backgroundColor: BG }}
      />
      {showLoading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none bg-black/20">
          <p className="text-slate-300 text-sm">카메라 연결 중...</p>
        </div>
      )}
      {/* 전신 framing guide */}
      <div
        className="absolute inset-0 z-30 pointer-events-none flex items-center justify-center"
        aria-hidden
      >
        <div className="w-3/4 h-[85%] rounded-2xl border-2 border-dashed border-white/30" />
      </div>
      {process.env.NODE_ENV !== 'production' && (
        <div className="absolute bottom-2 left-2 z-30 rounded bg-black/50 px-2 py-1 text-[10px] text-white pointer-events-none">
          {status}
        </div>
      )}
    </div>
  );
}
