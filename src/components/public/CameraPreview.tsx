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
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let mounted = true;

    async function startCamera() {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        const err = new Error('카메라를 지원하지 않는 환경입니다.');
        setStatus('error');
        onError?.(err);
        return;
      }
      setStatus('loading');
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
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setStatus('ready');
        onReady?.(stream);
      } catch (e) {
        if (!mounted) return;
        setStatus('error');
        onError?.(e instanceof Error ? e : new Error('카메라 접근 실패'));
      }
    }

    startCamera();
    return () => {
      mounted = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [onReady, onError]);

  useEffect(() => {
    if (status === 'ready' && videoRef.current && onVideoReady) {
      onVideoReady(videoRef.current);
    }
  }, [status, onVideoReady]);

  if (status === 'error') return null;
  if (status === 'loading') {
    return (
      <div
        className={`flex items-center justify-center aspect-[3/4] max-h-[50vh] rounded-2xl bg-white/5 border border-white/10 ${className}`}
      >
        <p className="text-slate-400 text-sm">카메라 연결 중...</p>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-white/10 ${className}`}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`block w-full aspect-[3/4] object-cover max-h-[50vh] ${mirrored ? 'scale-x-[-1]' : ''}`}
        style={{ backgroundColor: BG }}
      />
      {/* 전신 framing guide */}
      <div
        className="absolute inset-0 pointer-events-none flex items-center justify-center"
        aria-hidden
      >
        <div className="w-3/4 h-[85%] rounded-2xl border-2 border-dashed border-white/30" />
      </div>
    </div>
  );
}
