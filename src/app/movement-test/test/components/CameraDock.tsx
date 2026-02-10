'use client';

import { useState, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';

const readyStateText = (state: number): string => {
  const states = ['HAVE_NOTHING', 'HAVE_METADATA', 'HAVE_CURRENT_DATA', 'HAVE_FUTURE_DATA', 'HAVE_ENOUGH_DATA'];
  return states[state] || `Unknown(${state})`;
};

type Phase = 'idle' | 'requesting' | 'stream' | 'binding' | 'playing' | 'error';
type Size = 'sm' | 'lg';

const STORAGE_KEY_FLOATING = 'movement_test_camera_floating';
const STORAGE_KEY_SIZE = 'movement_test_camera_size';

export interface CameraDockRef {
  startCamera: () => Promise<void>;
  stopCamera: () => void;
  isCameraOn: boolean;
  phase: Phase;
}

interface CameraDockProps {
  mode?: 'normal' | 'split';
  hideControls?: boolean;
  onStateChange?: (isOn: boolean, phase: Phase) => void;
}

const CameraDock = forwardRef<CameraDockRef, CameraDockProps>(
  ({ mode = 'normal', hideControls = false, onStateChange }, ref) => {
    const [isOpen, setIsOpen] = useState(true);
    const [isFloating, setIsFloating] = useState(false);
    const [size, setSize] = useState<Size>('sm');
    const [showDebug, setShowDebug] = useState(false);
    const [phase, setPhase] = useState<Phase>('idle');
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [mirror, setMirror] = useState(true);
    const [errorText, setErrorText] = useState<string | null>(null);
    const [debug, setDebug] = useState<{
      lastEvent: string;
      playResult?: string;
      trackState?: string;
      settings?: any;
    }>({
      lastEvent: '초기화됨',
    });

    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const fallbackAttemptedRef = useRef(false);

    const isSplitMode = mode === 'split';
    const isCameraOn = phase !== 'idle' && phase !== 'error';
    const isLoading = phase === 'requesting' || phase === 'binding';

    // 상태 변경 시 콜백 호출
    useEffect(() => {
      onStateChange?.(isCameraOn, phase);
    }, [isCameraOn, phase, onStateChange]);

    // ref를 통해 외부에서 제어 가능하게
    useImperativeHandle(ref, () => ({
      startCamera: async () => {
        await startCamera();
      },
      stopCamera: () => {
        stopCamera();
      },
      isCameraOn,
      phase,
    }));

    // LocalStorage에서 플로팅 상태 불러오기 (split 모드가 아닐 때만)
    useEffect(() => {
      if (isSplitMode) return;
      
      const floating = localStorage.getItem(STORAGE_KEY_FLOATING);
      const sizeValue = localStorage.getItem(STORAGE_KEY_SIZE);
      
      if (floating === '1') {
        setIsFloating(true);
      }
      if (sizeValue === 'lg' || sizeValue === 'sm') {
        setSize(sizeValue);
      }
    }, [isSplitMode]);

    // 플로팅 상태 저장 (split 모드가 아닐 때만)
    useEffect(() => {
      if (isSplitMode) return;
      localStorage.setItem(STORAGE_KEY_FLOATING, isFloating ? '1' : '0');
    }, [isFloating, isSplitMode]);

    // 크기 상태 저장 (split 모드가 아닐 때만)
    useEffect(() => {
      if (isSplitMode) return;
      localStorage.setItem(STORAGE_KEY_SIZE, size);
    }, [size, isSplitMode]);

    // video 바인딩 및 이벤트 핸들러 (useEffect로 처리)
    useEffect(() => {
      const video = videoRef.current;
      if (!video || !stream) {
        return;
      }

      setPhase('binding');
      setDebug((prev) => ({ ...prev, lastEvent: 'video 바인딩 시작' }));

      // video 속성 설정
      video.srcObject = stream;
      video.muted = true;
      video.autoplay = true;
      video.playsInline = true;

      // 이벤트 핸들러
      const handleLoadedMetadata = async () => {
        setDebug((prev) => ({ ...prev, lastEvent: 'loadedmetadata 이벤트 발생' }));
        try {
          await video.play();
          setDebug((prev) => ({ ...prev, playResult: 'play() 성공' }));
        } catch (playError) {
          const err = playError as Error;
          console.error('play() 실패:', err);
          setDebug((prev) => ({
            ...prev,
            playResult: `play() 실패: ${err.message}`,
            lastEvent: `play() 실패: ${err.name}`,
          }));
          setPhase('error');
          setErrorText(`비디오 재생 실패: ${err.message}`);
        }
      };

      const handlePlaying = () => {
        setDebug((prev) => ({ ...prev, lastEvent: 'playing 이벤트 발생' }));
        setPhase('playing');
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
      };

      const handleError = (e: Event) => {
        setDebug((prev) => ({ ...prev, lastEvent: `error 이벤트: ${e.type}` }));
        setPhase('error');
        setErrorText('비디오 엘리먼트 오류 발생');
      };

      const handleStalled = () => {
        setDebug((prev) => ({ ...prev, lastEvent: 'stalled 이벤트 발생' }));
      };

      const handleWaiting = () => {
        setDebug((prev) => ({ ...prev, lastEvent: 'waiting 이벤트 발생' }));
      };

      // 이벤트 리스너 등록
      video.addEventListener('loadedmetadata', handleLoadedMetadata);
      video.addEventListener('playing', handlePlaying);
      video.addEventListener('error', handleError);
      video.addEventListener('stalled', handleStalled);
      video.addEventListener('waiting', handleWaiting);

      // cleanup
      return () => {
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
        video.removeEventListener('playing', handlePlaying);
        video.removeEventListener('error', handleError);
        video.removeEventListener('stalled', handleStalled);
        video.removeEventListener('waiting', handleWaiting);
      };
    }, [stream, mirror]);

    // 비디오 상태 모니터링 (디버그용)
    useEffect(() => {
      if (!videoRef.current || !stream) return;

      const updateDebug = () => {
        const video = videoRef.current;
        if (!video) return;

        const tracks = stream.getVideoTracks();
        const trackState = tracks.length > 0
          ? `readyState: ${tracks[0]!.readyState} (${tracks[0]!.readyState === 'live' ? 'live' : 'ended'})`
          : '트랙 없음';

        let settings = null;
        try {
          if (tracks.length > 0) {
            settings = tracks[0]!.getSettings();
          }
        } catch (e) {
          // ignore
        }

        setDebug((prev) => ({
          ...prev,
          trackState,
          settings: settings ? JSON.stringify(settings, null, 2) : undefined,
        }));
      };

      const interval = setInterval(updateDebug, 500);
      updateDebug();

      return () => clearInterval(interval);
    }, [stream, phase]);

    // 카메라 시작 (사용자 클릭 이벤트로만 실행)
    const startCamera = async (e?: React.MouseEvent) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setErrorText('카메라를 지원하지 않는 기기입니다.');
        setPhase('error');
        setDebug((prev) => ({
          ...prev,
          lastEvent: 'NotSupportedError',
          playResult: 'getUserMedia를 지원하지 않습니다.',
        }));
        return;
      }

      // 기존 스트림 정리
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      setStream(null);
      setPhase('requesting');
      setErrorText(null);
      fallbackAttemptedRef.current = false;
      setDebug({
        lastEvent: 'getUserMedia 요청 시작',
      });

      try {
        // 1차 getUserMedia 시도
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: false,
        });

        streamRef.current = mediaStream;
        setStream(mediaStream);
        setPhase('stream');
        setDebug((prev) => ({ ...prev, lastEvent: 'getUserMedia 성공 (1차)' }));

        // 3초 타임아웃 설정
        timeoutRef.current = setTimeout(() => {
          if (phase !== 'playing') {
            setDebug((prev) => ({ ...prev, lastEvent: '3초 타임아웃: playing 이벤트 미발생' }));

            // 기존 스트림 정리
            if (streamRef.current) {
              streamRef.current.getTracks().forEach((track) => track.stop());
              streamRef.current = null;
            }
            if (videoRef.current) {
              videoRef.current.srcObject = null;
            }

            // fallback 시도
            if (!fallbackAttemptedRef.current) {
              fallbackAttemptedRef.current = true;
              setDebug((prev) => ({ ...prev, lastEvent: 'fallback 시도: video:true' }));

              navigator.mediaDevices
                .getUserMedia({ video: true, audio: false })
                .then((fallbackStream) => {
                  streamRef.current = fallbackStream;
                  setStream(fallbackStream);
                  setPhase('stream');
                  setDebug((prev) => ({ ...prev, lastEvent: 'getUserMedia 성공 (fallback)' }));
                })
                .catch((fallbackError) => {
                  const err = fallbackError as DOMException;
                  console.error('fallback getUserMedia 실패:', err);
                  setPhase('error');
                  setErrorText(`Fallback 실패: ${err.name} - ${err.message}`);
                  setDebug((prev) => ({
                    ...prev,
                    lastEvent: `fallback 실패: ${err.name}`,
                    playResult: err.message,
                  }));
                });
            } else {
              setPhase('error');
              setErrorText('재생이 시작되지 않았습니다. (타임아웃)');
              setDebug((prev) => ({
                ...prev,
                lastEvent: 'fallback도 실패: 타임아웃',
              }));
            }
          }
        }, 3000);
      } catch (error) {
        const err = error as DOMException;
        console.error('getUserMedia 실패:', err);
        setPhase('error');

        const errorName = err.name || 'UnknownError';
        const errorMessage = err.message || '알 수 없는 오류';

        setErrorText(`카메라 오류: ${errorName} - ${errorMessage}`);
        setDebug((prev) => ({
          ...prev,
          lastEvent: `getUserMedia 실패: ${errorName}`,
          playResult: errorMessage,
        }));
      }
    };

    // 카메라 정지
    const stopCamera = (e?: React.MouseEvent) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

      setStream(null);
      setPhase('idle');
      setErrorText(null);
      fallbackAttemptedRef.current = false;
      setDebug({
        lastEvent: '카메라 정지됨',
      });
    };

    // 거울모드 토글
    const toggleMirror = (e: React.ChangeEvent<HTMLInputElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setMirror((prev) => !prev);
    };

    // 플로팅 모드 토글 (split 모드에서는 비활성화)
    const toggleFloating = (e?: React.MouseEvent) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (isSplitMode) return;
      setIsFloating((prev) => !prev);
    };

    // 크기 토글 (split 모드에서는 비활성화)
    const toggleSize = (e?: React.MouseEvent) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (isSplitMode) return;
      setSize((prev) => (prev === 'sm' ? 'lg' : 'sm'));
    };

    // cleanup
    useEffect(() => {
      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
      };
    }, []);

    // 플로팅 모드일 때 크기 계산
    const floatingWidth = size === 'sm' ? '240px' : '360px';
    const videoMinHeight = size === 'sm' ? '140px' : '210px';

    // 플로팅 모드일 때 wrapper 스타일
    const wrapperStyle = isFloating && !isSplitMode
      ? {
          position: 'fixed' as const,
          bottom: '16px',
          right: '16px',
          width: floatingWidth,
          zIndex: 50,
        }
      : {};

    // split 모드일 때 wrapper 스타일
    const splitWrapperStyle = isSplitMode
      ? {
          height: '100%',
          display: 'flex',
          flexDirection: 'column' as const,
        }
      : {};

    return (
      <div
        className={`bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl shadow-2xl ${isFloating && !isSplitMode ? '' : isSplitMode ? 'rounded-none border-0 bg-transparent h-full' : 'mb-6'}`}
        style={{ ...wrapperStyle, ...splitWrapperStyle }}
      >
        {/* 헤더 - split 모드일 때 컴팩트하게 (hideControls가 false일 때만) */}
        {isSplitMode && !hideControls ? (
          <div className="flex items-center justify-between p-2 border-b border-slate-700 bg-slate-900/50 flex-shrink-0">
            <h3 className="text-white font-semibold text-sm">카메라</h3>
            <div className="flex items-center gap-2">
              {isCameraOn && phase === 'playing' && (
                <span className="px-2 py-1 bg-green-600 text-white text-xs font-semibold rounded">
                  켜짐
                </span>
              )}
              {isLoading && (
                <span className="px-2 py-1 bg-yellow-600 text-white text-xs font-semibold rounded">
                  켜는 중...
                </span>
              )}
              {isCameraOn ? (
                <button
                  type="button"
                  onClick={stopCamera}
                  className="px-3 py-1 bg-red-600 text-white rounded text-xs font-semibold hover:bg-red-700 transition-colors"
                >
                  끄기
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startCamera}
                  disabled={isLoading}
                  className="px-3 py-1 bg-[#f97316] text-white rounded text-xs font-semibold hover:bg-[#ea580c] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? '켜는 중...' : '켜기'}
                </button>
              )}
            </div>
          </div>
        ) : isFloating ? (
          <div className="flex items-center justify-between p-2 border-b border-slate-700 bg-slate-900/50">
            <h3 className="text-white font-semibold text-sm">카메라</h3>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={toggleSize}
                className="px-2 py-1 bg-slate-700 text-white text-xs rounded hover:bg-slate-600 transition-colors"
                title={size === 'sm' ? '크게' : '작게'}
              >
                {size === 'sm' ? '⛶' : '⊟'}
              </button>
              <button
                type="button"
                onClick={toggleFloating}
                className="px-2 py-1 bg-slate-700 text-white text-xs rounded hover:bg-slate-600 transition-colors"
                title="플로팅 해제"
              >
                ✕
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between p-4 border-b border-slate-700">
            <h3 className="text-white font-semibold text-lg">카메라</h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleFloating}
                className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
                title="플로팅 모드"
              >
                📌
              </button>
              <button
                type="button"
                className="text-slate-400 hover:text-white transition-colors"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsOpen(!isOpen);
                }}
              >
                {isOpen ? '▼' : '▲'}
              </button>
            </div>
          </div>
        )}

        {/* 버튼 영역 - split 모드가 아닐 때만 표시 */}
        {!isSplitMode && (
          <div className={`p-4 flex items-center justify-between bg-slate-900/30 ${isFloating ? 'p-2' : ''}`}>
            <div className="flex items-center gap-2">
              {isCameraOn && phase === 'playing' && (
                <span className="px-2 py-1 bg-green-600 text-white text-xs font-semibold rounded">
                  켜짐
                </span>
              )}
              {isLoading && (
                <span className="px-2 py-1 bg-yellow-600 text-white text-xs font-semibold rounded">
                  켜는 중...
                </span>
              )}
              {phase === 'error' && (
                <span className="px-2 py-1 bg-red-600 text-white text-xs font-semibold rounded">
                  오류
                </span>
              )}
            </div>
            {isCameraOn ? (
              <button
                type="button"
                onClick={stopCamera}
                className={`px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors ${isFloating ? 'px-2 py-1 text-xs' : ''}`}
              >
                끄기
              </button>
            ) : (
              <button
                type="button"
                onClick={startCamera}
                disabled={isLoading}
                className={`px-4 py-2 bg-[#f97316] text-white rounded-lg text-sm font-semibold hover:bg-[#ea580c] transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${isFloating ? 'px-2 py-1 text-xs' : ''}`}
              >
                {isLoading ? '켜는 중...' : '켜기'}
              </button>
            )}
          </div>
        )}

        {/* 확장 영역 - split 모드일 때는 항상 표시 */}
        {(isOpen || isFloating || isSplitMode) && (
          <div className={`${isSplitMode ? 'flex-1 flex flex-col p-2 space-y-2' : `p-4 space-y-4 border-t border-slate-700 ${isFloating ? 'p-2 space-y-2' : ''}`}`}>
            {/* Phase 표시 - split 모드와 플로팅 모드일 때는 숨김 */}
            {!isFloating && !isSplitMode && (
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 bg-blue-600 text-white text-xs font-semibold rounded">
                  Phase: {phase}
                </span>
                {phase === 'playing' && (
                  <span className="px-2 py-1 bg-green-600 text-white text-xs font-semibold rounded">
                    재생 중
                  </span>
                )}
              </div>
            )}

            {/* 에러 메시지 */}
            {errorText && (
              <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-2">
                <p className="text-red-400 text-xs">{errorText}</p>
              </div>
            )}

            {/* 카메라 미리보기 - split 모드일 때 크게 */}
            <div
              className={`rounded-lg overflow-hidden ${isSplitMode ? 'flex-1 flex flex-col' : ''}`}
              style={{
                minHeight: isSplitMode ? 'calc(50dvh - 80px)' : isFloating ? videoMinHeight : '280px',
                width: '100%',
                backgroundColor: '#000',
              }}
            >
              {stream ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full"
                  style={{
                    minHeight: isSplitMode ? 'calc(50dvh - 80px)' : isFloating ? videoMinHeight : '280px',
                    width: '100%',
                    height: isSplitMode ? '100%' : 'auto',
                    backgroundColor: '#000',
                    transform: mirror ? 'scaleX(-1)' : 'none',
                    objectFit: isSplitMode ? 'cover' : 'contain',
                  }}
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (videoRef.current && videoRef.current.paused) {
                      try {
                        await videoRef.current.play();
                        setDebug((prev) => ({ ...prev, lastEvent: '수동 재생 성공' }));
                      } catch (err) {
                        const error = err as Error;
                        console.error('수동 재생 실패:', error);
                        setErrorText(`재생 실패: ${error.message}`);
                        setDebug((prev) => ({
                          ...prev,
                          lastEvent: `수동 재생 실패: ${error.message}`,
                        }));
                      }
                    }
                  }}
                />
              ) : (
                <div
                  className="flex items-center justify-center text-slate-500 text-xs"
                  style={{
                    minHeight: isSplitMode ? 'calc(50dvh - 80px)' : isFloating ? videoMinHeight : '280px',
                    width: '100%',
                    height: isSplitMode ? '100%' : 'auto',
                  }}
                >
                  {isLoading ? '켜는 중...' : '켜기 버튼을 눌러주세요'}
                </div>
              )}
            </div>

            {/* 거울모드 토글 - split 모드일 때도 표시 */}
            {isCameraOn && (
              <label className={`flex items-center gap-2 cursor-pointer flex-shrink-0 ${isFloating || isSplitMode ? 'text-xs' : ''}`}>
                <input
                  type="checkbox"
                  checked={mirror}
                  onChange={toggleMirror}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-[#f97316] focus:ring-[#f97316] focus:ring-2"
                />
                <span className="text-slate-300 text-sm">거울모드</span>
              </label>
            )}

            {/* 디버그 정보 - split 모드일 때는 숨김 */}
            {!isFloating && !isSplitMode && (
              <div className="bg-slate-900/50 rounded-lg p-3 space-y-1 text-xs">
                <p className="text-slate-400 font-semibold mb-2">디버그 정보</p>
                <p className="text-slate-500">
                  Phase: <span className="font-mono">{phase}</span>
                </p>
                <p className="text-slate-500">
                  lastEvent: <span className="font-mono">{debug.lastEvent}</span>
                </p>
                {debug.playResult && (
                  <p className="text-slate-500">
                    playResult: <span className="font-mono">{debug.playResult}</span>
                  </p>
                )}
                <p className="text-slate-500">
                  stream 존재: {stream ? '있음' : '없음'}
                </p>
                {videoRef.current && (
                  <>
                    <p className="text-slate-500">
                      readyState: {readyStateText(videoRef.current.readyState)}
                    </p>
                    <p className="text-slate-500">
                      paused: {videoRef.current.paused ? 'true' : 'false'}
                    </p>
                    <p className="text-slate-500">
                      크기: {videoRef.current.videoWidth} x {videoRef.current.videoHeight}
                    </p>
                  </>
                )}
                {debug.trackState && (
                  <p className="text-slate-500">
                    {debug.trackState}
                  </p>
                )}
                {debug.settings && (
                  <details className="text-slate-500">
                    <summary className="cursor-pointer">track.getSettings()</summary>
                    <pre className="mt-1 text-xs overflow-auto max-h-32">{debug.settings}</pre>
                  </details>
                )}
              </div>
            )}

            {/* 플로팅 모드일 때 디버그 토글 */}
            {isFloating && !isSplitMode && (
              <button
                type="button"
                onClick={() => setShowDebug(!showDebug)}
                className="w-full px-2 py-1 bg-slate-900/50 text-slate-400 text-xs rounded hover:bg-slate-900/70 transition-colors"
              >
                {showDebug ? '디버그 숨기기' : '디버그 보기'}
              </button>
            )}

            {/* 플로팅 모드일 때 디버그 정보 (토글) */}
            {isFloating && !isSplitMode && showDebug && (
              <div className="bg-slate-900/50 rounded-lg p-2 space-y-1 text-xs">
                <p className="text-slate-400 font-semibold mb-1">디버그</p>
                <p className="text-slate-500">
                  Phase: <span className="font-mono">{phase}</span>
                </p>
                <p className="text-slate-500">
                  {debug.lastEvent}
                </p>
                {videoRef.current && (
                  <p className="text-slate-500">
                    {videoRef.current.videoWidth} x {videoRef.current.videoHeight}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
);

CameraDock.displayName = 'CameraDock';

export default CameraDock;
