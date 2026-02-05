'use client';

import { useState, useEffect, useRef } from 'react';
import CameraStage from './components/CameraStage';
import CameraDiagnostics from './components/CameraDiagnostics';

type Stage = 'intro' | 'camera';

const STORAGE_KEY_CALIBRATED = 'movement_test_camera_calibrated';
const STORAGE_KEY_MIRROR = 'movement_test_camera_mirror';

export default function MovementTestTestPage() {
  const [stage, setStage] = useState<Stage>('intro');
  const [currentGuideId, setCurrentGuideId] = useState<string>('neutral-stand');
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  
  // 카메라 상태 관리
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isCalibrated, setIsCalibrated] = useState(false);
  const [mirror, setMirror] = useState(true);
  const streamRef = useRef<MediaStream | null>(null);

  // LocalStorage에서 캘리브레이션 및 거울모드 상태 불러오기
  useEffect(() => {
    const calibrated = localStorage.getItem(STORAGE_KEY_CALIBRATED);
    const mirrorValue = localStorage.getItem(STORAGE_KEY_MIRROR);
    
    if (calibrated === '1') {
      setIsCalibrated(true);
    }
    if (mirrorValue === '0') {
      setMirror(false);
    }
  }, []);

  // 카메라 시작 (사용자 클릭 이벤트로만 실행)
  const startCamera = async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: false,
        });
        streamRef.current = mediaStream;
        setStream(mediaStream);
        setIsCameraOn(true);
      } else {
        alert('카메라를 지원하지 않는 기기입니다.');
      }
    } catch (error) {
      console.error('카메라 시작 실패:', error);
      const err = error as DOMException;
      const errorName = err.name || 'UnknownError';
      let errorMessage = '카메라에 접근할 수 없습니다. 권한을 확인해주세요.';

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
      }

      alert(errorMessage);
    }
  };

  // 카메라 정지
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setStream(null);
    setIsCameraOn(false);
  };

  // 거울모드 토글
  const toggleMirror = () => {
    const newMirror = !mirror;
    setMirror(newMirror);
    localStorage.setItem(STORAGE_KEY_MIRROR, newMirror ? '1' : '0');
  };

  // 캘리브레이션 완료
  const completeCalibration = () => {
    setIsCalibrated(true);
    localStorage.setItem(STORAGE_KEY_CALIBRATED, '1');
  };

  // 컴포넌트 언마운트 시 카메라 정리
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const handleStartCamera = (guideId: string) => {
    setCurrentGuideId(guideId);
    setStage('camera');
  };

  const handleComplete = () => {
    // 다음 가이드로 이동하거나 완료 처리
    // 여기서는 간단히 intro로 돌아감
    setStage('intro');
  };

  const handleSkip = () => {
    // 스킵 처리
    setStage('intro');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* 카메라 진단 패널 - 상단 고정 */}
      <div className="fixed top-4 left-4 z-40">
        <button
          type="button"
          onClick={() => setShowDiagnostics(!showDiagnostics)}
          className="px-4 py-2 bg-slate-700 text-white rounded-lg text-sm font-semibold hover:bg-slate-600 transition-colors shadow-lg"
        >
          {showDiagnostics ? '▼ 진단 닫기' : '▲ 카메라 진단'}
        </button>
      </div>

      {showDiagnostics && (
        <div className="fixed top-16 left-4 right-4 z-40 max-h-[80vh] overflow-y-auto">
          <CameraDiagnostics />
        </div>
      )}

      {/* 메인 컨텐츠 */}
      <div className="container mx-auto px-4 py-8 md:py-8 md:pt-0">
        <div className="max-w-4xl mx-auto">
          {stage === 'camera' ? (
            <CameraStage
              guideId={currentGuideId}
              stream={stream}
              mirror={mirror}
              onComplete={handleComplete}
              onSkip={handleSkip}
            />
          ) : (
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-8 shadow-2xl">
              <h1 className="text-3xl font-bold text-white mb-4">카메라 가이드 테스트</h1>
              <p className="text-slate-300 mb-6">테스트를 시작하려면 아래 버튼을 클릭하세요.</p>
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={() => handleStartCamera('neutral-stand')}
                  className="px-6 py-3 bg-[#f97316] text-white rounded-xl font-semibold hover:bg-[#ea580c] transition-all duration-200"
                >
                  중립 서기 시작
                </button>
                <div className="text-sm text-slate-400">
                  <p>• 카메라가 안 보이면 좌측 상단의 "카메라 진단" 버튼을 클릭하세요.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
