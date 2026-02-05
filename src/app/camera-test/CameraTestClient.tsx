'use client';

import { useState, useEffect, useRef } from 'react';

interface DiagnosticInfo {
  secureContext: boolean;
  locationHref: string;
  videoDeviceCount: number | null;
  deviceEnumError: string | null;
  getUserMediaStatus: 'idle' | 'testing' | 'success' | 'error';
  getUserMediaError: {
    name: string;
    message: string;
  } | null;
  videoState: {
    readyState: number;
    videoWidth: number;
    videoHeight: number;
    paused: boolean;
  } | null;
}

const readyStateText = (state: number): string => {
  const states = ['HAVE_NOTHING', 'HAVE_METADATA', 'HAVE_CURRENT_DATA', 'HAVE_FUTURE_DATA', 'HAVE_ENOUGH_DATA'];
  return states[state] || `Unknown(${state})`;
};

export default function CameraTestClient() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [diagnostics, setDiagnostics] = useState<DiagnosticInfo>({
    secureContext: false,
    locationHref: '',
    videoDeviceCount: null,
    deviceEnumError: null,
    getUserMediaStatus: 'idle',
    getUserMediaError: null,
    videoState: null,
  });
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // 초기 진단 실행
  useEffect(() => {
    runInitialDiagnostics();
  }, []);

  // 비디오 상태 모니터링
  useEffect(() => {
    if (!videoRef.current) return;

    const updateVideoState = () => {
      const video = videoRef.current;
      if (!video) return;

      setDiagnostics((prev) => ({
        ...prev,
        videoState: {
          readyState: video.readyState,
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
          paused: video.paused,
        },
      }));
    };

    const interval = setInterval(updateVideoState, 500);
    updateVideoState();

    return () => clearInterval(interval);
  }, [isCameraOn]);

  const runInitialDiagnostics = async () => {
    const isSecure = window.isSecureContext;
    const href = window.location.href;

    setDiagnostics((prev) => ({
      ...prev,
      secureContext: isSecure,
      locationHref: href,
    }));

    // enumerateDevices 시도
    if (navigator.mediaDevices) {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter((d) => d.kind === 'videoinput');
        setDiagnostics((prev) => ({
          ...prev,
          videoDeviceCount: videoDevices.length,
          deviceEnumError: null,
        }));
      } catch (error) {
        const err = error as Error;
        setDiagnostics((prev) => ({
          ...prev,
          deviceEnumError: err.message || '알 수 없는 오류',
        }));
      }
    }
  };

  const startCamera = async (constraints: MediaStreamConstraints = { video: { facingMode: 'user' }, audio: false }) => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setDiagnostics((prev) => ({
        ...prev,
        getUserMediaStatus: 'error',
        getUserMediaError: {
          name: 'NotSupportedError',
          message: 'getUserMedia를 지원하지 않습니다.',
        },
      }));
      return;
    }

    setDiagnostics((prev) => ({
      ...prev,
      getUserMediaStatus: 'testing',
      getUserMediaError: null,
    }));

    try {
      // 기존 스트림 정리
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

      // getUserMedia 실행
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = mediaStream;
      setStream(mediaStream);
      setIsCameraOn(true);

      // video에 연결
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;

        // play() 명시적 호출
        try {
          await videoRef.current.play();
          setDiagnostics((prev) => ({
            ...prev,
            getUserMediaStatus: 'success',
            getUserMediaError: null,
          }));
        } catch (playError) {
          const err = playError as Error;
          console.error('play() 실패:', err);
          setDiagnostics((prev) => ({
            ...prev,
            getUserMediaStatus: 'error',
            getUserMediaError: {
              name: 'PlayError',
              message: `비디오 재생 실패: ${err.message}`,
            },
          }));
        }
      }
    } catch (error) {
      const err = error as DOMException;
      console.error('getUserMedia 실패:', err);
      setDiagnostics((prev) => ({
        ...prev,
        getUserMediaStatus: 'error',
        getUserMediaError: {
          name: err.name || 'UnknownError',
          message: err.message || '알 수 없는 오류',
        },
      }));
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStream(null);
    setIsCameraOn(false);
    setDiagnostics((prev) => ({
      ...prev,
      getUserMediaStatus: 'idle',
      getUserMediaError: null,
      videoState: null,
    }));
  };

  const retryWithMinimalConstraints = () => {
    stopCamera();
    setTimeout(() => {
      startCamera({ video: true, audio: false });
    }, 100);
  };

  // cleanup
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* 헤더 */}
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6 shadow-2xl">
          <h1 className="text-3xl font-bold text-white mb-2">카메라 테스트 페이지</h1>
          <p className="text-slate-300 text-sm">
            환경 문제(권한/OS/secure context/점유) vs 앱 코드 문제(렌더/언마운트/CSS)를 빠르게 진단합니다.
          </p>
        </div>

        {/* 진단 정보 */}
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6 shadow-2xl space-y-4">
          <h2 className="text-xl font-bold text-white mb-4">진단 정보</h2>

          {/* Secure Context */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span
                className={`w-3 h-3 rounded-full ${diagnostics.secureContext ? 'bg-green-500' : 'bg-red-500'}`}
              />
              <span className="text-slate-300 font-semibold">Secure Context</span>
            </div>
            <div className="pl-5 text-sm text-slate-400">
              <p>상태: {diagnostics.secureContext ? '✓ 안전' : '✗ 비안전'}</p>
              <p>URL: {diagnostics.locationHref}</p>
              {!diagnostics.secureContext && (
                <p className="text-red-400 mt-1">⚠️ HTTPS 또는 localhost에서만 카메라를 사용할 수 있습니다.</p>
              )}
            </div>
          </div>

          {/* 비디오 장치 개수 */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span
                className={`w-3 h-3 rounded-full ${
                  diagnostics.videoDeviceCount !== null && diagnostics.videoDeviceCount > 0
                    ? 'bg-green-500'
                    : diagnostics.videoDeviceCount === 0
                      ? 'bg-yellow-500'
                      : 'bg-gray-500'
                }`}
              />
              <span className="text-slate-300 font-semibold">비디오 입력 장치</span>
            </div>
            <div className="pl-5 text-sm text-slate-400">
              {diagnostics.deviceEnumError ? (
                <p className="text-red-400">오류: {diagnostics.deviceEnumError}</p>
              ) : diagnostics.videoDeviceCount !== null ? (
                <>
                  <p>감지된 카메라: {diagnostics.videoDeviceCount}개</p>
                  {diagnostics.videoDeviceCount === 0 && (
                    <p className="text-amber-400 mt-1">
                      ⚠️ 카메라가 감지되지 않았습니다. 권한이 없으면 0개로 표시될 수 있습니다.
                    </p>
                  )}
                </>
              ) : (
                <p>확인 중...</p>
              )}
            </div>
          </div>

          {/* getUserMedia 상태 */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span
                className={`w-3 h-3 rounded-full ${
                  diagnostics.getUserMediaStatus === 'success'
                    ? 'bg-green-500'
                    : diagnostics.getUserMediaStatus === 'error'
                      ? 'bg-red-500'
                      : diagnostics.getUserMediaStatus === 'testing'
                        ? 'bg-yellow-500'
                        : 'bg-gray-500'
                }`}
              />
              <span className="text-slate-300 font-semibold">getUserMedia 상태</span>
            </div>
            <div className="pl-5 text-sm text-slate-400">
              <p>상태: {diagnostics.getUserMediaStatus}</p>
              {diagnostics.getUserMediaError && (
                <div className="mt-2 space-y-1">
                  <p className="text-red-400">에러 이름: {diagnostics.getUserMediaError.name}</p>
                  <p className="text-red-400">에러 메시지: {diagnostics.getUserMediaError.message}</p>
                </div>
              )}
            </div>
          </div>

          {/* 비디오 엘리먼트 상태 */}
          {diagnostics.videoState && (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-slate-300 font-semibold">비디오 엘리먼트 상태</span>
              </div>
              <div className="pl-5 text-sm text-slate-400 space-y-1">
                <p>readyState: {readyStateText(diagnostics.videoState.readyState)}</p>
                <p>
                  크기: {diagnostics.videoState.videoWidth} x {diagnostics.videoState.videoHeight}
                </p>
                <p>paused: {diagnostics.videoState.paused ? '예' : '아니오'}</p>
                {diagnostics.videoState.videoWidth === 0 && diagnostics.videoState.videoHeight === 0 && (
                  <p className="text-amber-400 mt-1">
                    ⚠️ 비디오 크기가 0입니다. 스트림이 제대로 연결되지 않았을 수 있습니다.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 컨트롤 버튼 */}
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6 shadow-2xl">
          <h2 className="text-xl font-bold text-white mb-4">컨트롤</h2>
          <div className="flex flex-wrap gap-4">
            {!isCameraOn ? (
              <button
                onClick={() => startCamera()}
                className="px-6 py-3 bg-[#f97316] text-white rounded-xl font-semibold hover:bg-[#ea580c] transition-all duration-200"
              >
                카메라 켜기
              </button>
            ) : (
              <button
                onClick={stopCamera}
                className="px-6 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-all duration-200"
              >
                카메라 끄기
              </button>
            )}
            {isCameraOn && (
              <button
                onClick={retryWithMinimalConstraints}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all duration-200"
              >
                다른 해상도로 재시도
              </button>
            )}
          </div>
        </div>

        {/* 비디오 프리뷰 */}
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6 shadow-2xl">
          <h2 className="text-xl font-bold text-white mb-4">비디오 프리뷰</h2>
          <div className="bg-black rounded-lg overflow-hidden" style={{ minHeight: '320px' }}>
            {isCameraOn ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full"
                style={{
                  minHeight: '320px',
                  backgroundColor: '#000',
                }}
                onClick={async () => {
                  // 클릭 시 재생 시도
                  if (videoRef.current && videoRef.current.paused) {
                    try {
                      await videoRef.current.play();
                    } catch (err) {
                      console.error('수동 재생 실패:', err);
                    }
                  }
                }}
              />
            ) : (
              <div className="flex items-center justify-center" style={{ minHeight: '320px' }}>
                <p className="text-slate-400">카메라를 켜면 영상이 표시됩니다.</p>
              </div>
            )}
          </div>
          {isCameraOn && diagnostics.videoState && diagnostics.videoState.videoWidth === 0 && (
            <p className="text-amber-400 text-sm mt-2">
              ⚠️ 비디오 크기가 0입니다. 스트림은 연결되었지만 영상이 표시되지 않습니다.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
