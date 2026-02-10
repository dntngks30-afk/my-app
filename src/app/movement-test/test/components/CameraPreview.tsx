'use client';

import { useEffect, useRef, useState } from 'react';

interface CameraPreviewProps {
  isOn: boolean;
  facingMode: 'user' | 'environment';
  mirror: boolean;
  onRequestStart?: () => void;
  debugMode?: boolean;
}

export default function CameraPreview({
  isOn,
  facingMode,
  mirror,
  onRequestStart,
  debugMode = false,
}: CameraPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playError, setPlayError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOn) {
      // 카메라 종료
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setError(null);
      setPlayError(null);
      return;
    }

    // 카메라 시작
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode }, audio: false })
        .then(async (stream) => {
          if (videoRef.current) {
            try {
              // srcObject 설정
              videoRef.current.srcObject = stream;
              streamRef.current = stream;
              setError(null);

              // play() 명시적 호출
              try {
                await videoRef.current.play();
                setPlayError(null);
              } catch (playErr) {
                const err = playErr as Error;
                console.error('video.play() 실패:', err);
                setPlayError(`비디오 재생 실패: ${err.message}`);
              }
            } catch (err) {
              console.error('비디오 설정 실패:', err);
              setError('비디오 설정 중 오류가 발생했습니다.');
            }
          }
        })
        .catch((err) => {
          console.error('getUserMedia 실패:', err);
          const errorName = (err as DOMException).name || 'UnknownError';
          let errorMessage = '카메라에 접근할 수 없습니다.';

          // 에러별 상세 메시지
          switch (errorName) {
            case 'SecurityError':
              errorMessage = 'HTTPS 또는 localhost에서만 카메라를 사용할 수 있습니다.';
              break;
            case 'NotAllowedError':
              errorMessage = '카메라 권한이 차단되었습니다. 브라우저 설정에서 권한을 허용하세요.';
              break;
            case 'NotFoundError':
              errorMessage = '카메라 장치를 찾을 수 없습니다.';
              break;
            case 'NotReadableError':
              errorMessage = '카메라가 다른 앱에서 사용 중입니다. 다른 앱을 종료하고 다시 시도하세요.';
              break;
            case 'OverconstrainedError':
              errorMessage = '요청한 카메라 설정을 지원하지 않습니다.';
              break;
            default:
              errorMessage = `카메라 오류: ${errorName} - ${(err as Error).message}`;
          }

          setError(errorMessage);
        });
    } else {
      setError('카메라를 지원하지 않는 기기입니다.');
    }

    return () => {
      // cleanup
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [isOn, facingMode]);

  if (error) {
    return (
      <div className="bg-slate-800/50 backdrop-blur-sm border border-red-700 rounded-2xl p-6 shadow-2xl">
        <p className="text-red-400 text-center font-semibold mb-2">카메라 오류</p>
        <p className="text-slate-300 text-center text-sm">{error}</p>
        {onRequestStart && (
          <button
            onClick={onRequestStart}
            className="w-full mt-4 px-6 py-3 bg-[#f97316] text-white rounded-xl font-semibold hover:bg-[#ea580c] transition-all duration-200"
          >
            다시 시도
          </button>
        )}
      </div>
    );
  }

  if (playError) {
    return (
      <div className="bg-slate-800/50 backdrop-blur-sm border border-amber-700 rounded-2xl p-6 shadow-2xl">
        <p className="text-amber-400 text-center font-semibold mb-2">비디오 재생 오류</p>
        <p className="text-slate-300 text-center text-sm">{playError}</p>
        <p className="text-slate-400 text-center text-xs mt-2">
          브라우저가 자동 재생을 차단했을 수 있습니다. 비디오를 클릭하여 재생을 시작하세요.
        </p>
      </div>
    );
  }

  if (!isOn) {
    return (
      <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6 shadow-2xl">
        <p className="text-slate-300 text-center mb-4">카메라가 꺼져 있습니다.</p>
        {onRequestStart && (
          <button
            onClick={onRequestStart}
            className="w-full px-6 py-3 bg-[#f97316] text-white rounded-xl font-semibold hover:bg-[#ea580c] transition-all duration-200"
          >
            카메라 켜기
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-4 shadow-2xl">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full aspect-video object-cover rounded-lg"
        style={{
          transform: mirror ? 'scaleX(-1)' : 'none',
          ...(debugMode && {
            minHeight: '320px',
            backgroundColor: '#000',
          }),
        }}
        onClick={async () => {
          // 클릭 시 재생 시도
          if (videoRef.current && videoRef.current.paused) {
            try {
              await videoRef.current.play();
              setPlayError(null);
            } catch (err) {
              const error = err as Error;
              console.error('수동 재생 실패:', error);
              setPlayError(`재생 실패: ${error.message}`);
            }
          }
        }}
      />
    </div>
  );
}
