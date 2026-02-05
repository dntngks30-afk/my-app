'use client';

import { useState, useEffect, useRef } from 'react';

interface DiagnosticResult {
  secureContext: boolean;
  protocol: string;
  hostname: string;
  hasMediaDevices: boolean;
  hasGetUserMedia: boolean;
  videoDeviceCount: number | null;
  deviceEnumError: string | null;
  getUserMediaTest: {
    status: 'idle' | 'testing' | 'success' | 'error';
    errorName?: string;
    errorMessage?: string;
  };
  videoState: {
    readyState: number;
    videoWidth: number;
    videoHeight: number;
    paused: boolean;
    muted: boolean;
    autoplay: boolean;
  } | null;
}

const ERROR_GUIDES: Record<string, string> = {
  SecurityError: 'HTTPS 또는 localhost에서만 카메라를 사용할 수 있습니다. URL이 https://로 시작하거나 localhost인지 확인하세요.',
  NotAllowedError: '카메라 권한이 차단되었습니다. 브라우저 주소창의 자물쇠 아이콘을 클릭하여 카메라 권한을 허용하거나, 사이트 설정에서 권한을 변경하세요.',
  NotFoundError: '카메라 장치를 찾을 수 없습니다. 카메라가 연결되어 있고 다른 앱에서 사용 중이 아닌지 확인하세요.',
  NotReadableError: '카메라가 다른 앱(줌, OBS, 다른 브라우저 탭 등)에서 사용 중입니다. 다른 앱을 종료하고 다시 시도하세요.',
  OverconstrainedError: '요청한 카메라 설정을 지원하지 않습니다. 더 단순한 설정으로 재시도합니다.',
  AbortError: '카메라 접근이 중단되었습니다. 다시 시도하세요.',
  TypeError: '카메라 API 호출에 문제가 있습니다. 브라우저를 업데이트하거나 다른 브라우저를 시도하세요.',
};

export default function CameraDiagnostics() {
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult>({
    secureContext: false,
    protocol: '',
    hostname: '',
    hasMediaDevices: false,
    hasGetUserMedia: false,
    videoDeviceCount: null,
    deviceEnumError: null,
    getUserMediaTest: { status: 'idle' },
    videoState: null,
  });
  const [debugMode, setDebugMode] = useState(false);
  const testVideoRef = useRef<HTMLVideoElement>(null);
  const testStreamRef = useRef<MediaStream | null>(null);

  // 초기 진단 실행
  useEffect(() => {
    runInitialDiagnostics();
  }, []);

  // video 상태 모니터링
  useEffect(() => {
    if (!testVideoRef.current) return;

    const updateVideoState = () => {
      const video = testVideoRef.current;
      if (!video) return;

      setDiagnostics((prev) => ({
        ...prev,
        videoState: {
          readyState: video.readyState,
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
          paused: video.paused,
          muted: video.muted,
          autoplay: video.hasAttribute('autoplay'),
        },
      }));
    };

    const interval = setInterval(updateVideoState, 500);
    updateVideoState();

    return () => clearInterval(interval);
  }, [diagnostics.getUserMediaTest.status]);

  const runInitialDiagnostics = async () => {
    const isSecure = window.isSecureContext;
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    const hasMediaDevices = !!navigator.mediaDevices;
    const hasGetUserMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

    setDiagnostics((prev) => ({
      ...prev,
      secureContext: isSecure,
      protocol,
      hostname,
      hasMediaDevices,
      hasGetUserMedia,
    }));

    // enumerateDevices 시도
    if (hasMediaDevices) {
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

  const testGetUserMedia = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setDiagnostics((prev) => ({
        ...prev,
        getUserMediaTest: {
          status: 'error',
          errorName: 'NotSupportedError',
          errorMessage: 'getUserMedia를 지원하지 않습니다.',
        },
      }));
      return;
    }

    setDiagnostics((prev) => ({
      ...prev,
      getUserMediaTest: { status: 'testing' },
    }));

    try {
      // 기존 스트림 정리
      if (testStreamRef.current) {
        testStreamRef.current.getTracks().forEach((track) => track.stop());
        testStreamRef.current = null;
      }

      // getUserMedia 실행
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });

      testStreamRef.current = stream;

      // video에 연결
      if (testVideoRef.current) {
        testVideoRef.current.srcObject = stream;

        // play() 호출
        try {
          await testVideoRef.current.play();
          setDiagnostics((prev) => ({
            ...prev,
            getUserMediaTest: { status: 'success' },
          }));
        } catch (playError) {
          const err = playError as Error;
          console.error('play() 실패:', err);
          setDiagnostics((prev) => ({
            ...prev,
            getUserMediaTest: {
              status: 'error',
              errorName: 'PlayError',
              errorMessage: `비디오 재생 실패: ${err.message}`,
            },
          }));
        }
      }
    } catch (error) {
      const err = error as DOMException;
      console.error('getUserMedia 실패:', err);
      setDiagnostics((prev) => ({
        ...prev,
        getUserMediaTest: {
          status: 'error',
          errorName: err.name || 'UnknownError',
          errorMessage: err.message || '알 수 없는 오류',
        },
      }));
    }
  };

  // cleanup
  useEffect(() => {
    return () => {
      if (testStreamRef.current) {
        testStreamRef.current.getTracks().forEach((track) => track.stop());
        testStreamRef.current = null;
      }
    };
  }, []);

  const getErrorGuide = (errorName: string): string => {
    return ERROR_GUIDES[errorName] || `알 수 없는 오류: ${errorName}`;
  };

  const readyStateText = (state: number): string => {
    const states = ['HAVE_NOTHING', 'HAVE_METADATA', 'HAVE_CURRENT_DATA', 'HAVE_FUTURE_DATA', 'HAVE_ENOUGH_DATA'];
    return states[state] || `Unknown(${state})`;
  };

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6 shadow-2xl space-y-4">
      <h3 className="text-xl font-bold text-white mb-4">카메라 진단</h3>

      {/* Secure Context */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className={`w-3 h-3 rounded-full ${diagnostics.secureContext ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-slate-300 font-semibold">Secure Context</span>
        </div>
        <div className="pl-5 text-sm text-slate-400">
          <p>상태: {diagnostics.secureContext ? '✓ 안전' : '✗ 비안전'}</p>
          <p>프로토콜: {diagnostics.protocol}</p>
          <p>호스트: {diagnostics.hostname}</p>
          {!diagnostics.secureContext && (
            <p className="text-amber-400 mt-1">
              ⚠️ HTTPS 또는 localhost에서만 카메라를 사용할 수 있습니다.
            </p>
          )}
        </div>
      </div>

      {/* MediaDevices API */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span
            className={`w-3 h-3 rounded-full ${diagnostics.hasMediaDevices ? 'bg-green-500' : 'bg-red-500'}`}
          />
          <span className="text-slate-300 font-semibold">MediaDevices API</span>
        </div>
        <div className="pl-5 text-sm text-slate-400">
          <p>navigator.mediaDevices: {diagnostics.hasMediaDevices ? '✓ 있음' : '✗ 없음'}</p>
          <p>getUserMedia: {diagnostics.hasGetUserMedia ? '✓ 있음' : '✗ 없음'}</p>
        </div>
      </div>

      {/* 장치 개수 */}
      <div className="space-y-2">
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

      {/* getUserMedia 테스트 */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span
            className={`w-3 h-3 rounded-full ${
              diagnostics.getUserMediaTest.status === 'success'
                ? 'bg-green-500'
                : diagnostics.getUserMediaTest.status === 'error'
                  ? 'bg-red-500'
                  : diagnostics.getUserMediaTest.status === 'testing'
                    ? 'bg-yellow-500'
                    : 'bg-gray-500'
            }`}
          />
          <span className="text-slate-300 font-semibold">getUserMedia 테스트</span>
        </div>
        <div className="pl-5 space-y-2">
          <button
            onClick={testGetUserMedia}
            disabled={diagnostics.getUserMediaTest.status === 'testing'}
            className="px-4 py-2 bg-[#f97316] text-white rounded-lg text-sm font-semibold hover:bg-[#ea580c] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {diagnostics.getUserMediaTest.status === 'testing' ? '테스트 중...' : '테스트 실행'}
          </button>
          {diagnostics.getUserMediaTest.status === 'success' && (
            <p className="text-green-400 text-sm">✓ 성공: 카메라 스트림을 가져왔습니다.</p>
          )}
          {diagnostics.getUserMediaTest.status === 'error' && (
            <div className="text-red-400 text-sm space-y-1">
              <p>✗ 실패: {diagnostics.getUserMediaTest.errorName}</p>
              <p>{diagnostics.getUserMediaTest.errorMessage}</p>
              {diagnostics.getUserMediaTest.errorName && (
                <div className="mt-2 p-2 bg-red-900/20 border border-red-700/50 rounded text-xs">
                  <p className="font-semibold mb-1">해결 방법:</p>
                  <p>{getErrorGuide(diagnostics.getUserMediaTest.errorName)}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 비디오 엘리먼트 상태 */}
      {diagnostics.videoState && (
        <div className="space-y-2">
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
            <p>muted: {diagnostics.videoState.muted ? '예' : '아니오'}</p>
            <p>autoplay: {diagnostics.videoState.autoplay ? '예' : '아니오'}</p>
            {diagnostics.videoState.videoWidth === 0 && diagnostics.videoState.videoHeight === 0 && (
              <p className="text-amber-400 mt-1">
                ⚠️ 비디오 크기가 0입니다. 스트림이 제대로 연결되지 않았을 수 있습니다.
              </p>
            )}
          </div>
        </div>
      )}

      {/* 테스트 비디오 (디버그 모드) */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={debugMode}
            onChange={(e) => setDebugMode(e.target.checked)}
            className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-[#f97316] focus:ring-[#f97316] focus:ring-2"
          />
          <span className="text-slate-300 text-sm">디버그 모드 (강제 높이/배경)</span>
        </label>
        {debugMode && (
          <div className="bg-slate-900 rounded-lg overflow-hidden" style={{ minHeight: '320px' }}>
            <video
              ref={testVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full"
              style={{
                minHeight: '320px',
                backgroundColor: '#000',
                transform: 'scaleX(-1)',
              }}
            />
            {diagnostics.getUserMediaTest.status !== 'success' && (
              <div className="p-4 text-center text-slate-400">
                비디오가 표시되지 않습니다. 위의 "테스트 실행" 버튼을 클릭하세요.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
