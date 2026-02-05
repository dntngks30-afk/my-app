'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import CameraDock, { CameraDockRef } from '../test/components/CameraDock';

const STORAGE_KEY = 'movementTest.move.v1';
const STORAGE_KEY_CAMERA_HEIGHT = 'movement_move_camera_height_vh';
const STORAGE_KEY_PREFACE_TEXT = 'movement_move_preface_text';

type TestState = {
  checks: boolean[];
};

type Step = 'calibration' | 'test';

export default function MovePage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('calibration');
  const [cameraHeightVh, setCameraHeightVh] = useState<number>(45);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [cameraPhase, setCameraPhase] = useState<'idle' | 'requesting' | 'stream' | 'binding' | 'playing' | 'error'>('idle');
  const [prefaceText, setPrefaceText] = useState<string>('');
  const [secLeft, setSecLeft] = useState<number>(20);
  const [showPreface, setShowPreface] = useState<boolean>(false);
  const cameraDockRef = useRef<CameraDockRef>(null);

  const [tests, setTests] = useState<TestState[]>([
    { checks: [false, false, false] },
    { checks: [false, false, false] },
    { checks: [false, false, false] },
  ]);

  // localStorage에서 카메라 높이 불러오기
  useEffect(() => {
    const savedHeight = localStorage.getItem(STORAGE_KEY_CAMERA_HEIGHT);
    if (savedHeight) {
      const height = parseInt(savedHeight, 10);
      if (height >= 25 && height <= 70) {
        setCameraHeightVh(height);
      }
    }
  }, []);

  // localStorage에서 안내문구 불러오기
  useEffect(() => {
    const savedPreface = localStorage.getItem(STORAGE_KEY_PREFACE_TEXT);
    if (savedPreface) {
      setPrefaceText(savedPreface);
    }
  }, []);

  // 카메라 높이 저장
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_CAMERA_HEIGHT, cameraHeightVh.toString());
  }, [cameraHeightVh]);

  // 안내문구 저장
  useEffect(() => {
    if (prefaceText) {
      localStorage.setItem(STORAGE_KEY_PREFACE_TEXT, prefaceText);
    }
  }, [prefaceText]);

  // 켈리브레이션 타이머
  useEffect(() => {
    if (step !== 'calibration' || secLeft <= 0) return;

    const timer = setInterval(() => {
      setSecLeft((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [step, secLeft]);

  // 카메라 상태 변경 핸들러
  const handleCameraStateChange = (isOn: boolean, phase: typeof cameraPhase) => {
    setIsCameraOn(isOn);
    setCameraPhase(phase);
  };

  const toggleCheck = (testIdx: number, checkIdx: number) => {
    setTests((t) => {
      const nt = [...t];
      nt[testIdx].checks[checkIdx] = !nt[testIdx].checks[checkIdx];
      return nt;
    });
  };

  const totalChecked = tests.reduce((sum, t) => sum + t.checks.filter(Boolean).length, 0);

  const handleNavigate = () => {
    try {
      const data = {
        completedAt: new Date().toISOString(),
        totalChecked,
        tests: tests.map((t) => ({
          checks: t.checks,
        })),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // ignore
    }
    router.push('/movement-test/result');
  };

  const getResultMessage = () => {
    if (totalChecked <= 2) {
      return '현재 움직임이 비교적 안정적이에요. 다음 단계로 루틴만 꾸준히 하면 됩니다.';
    } else if (totalChecked <= 5) {
      return '보상이 자주 나와요. 이번 주는 "기초 안정화"부터 시작하는 게 효율적이에요.';
    } else {
      return '기본 패턴 보상이 뚜렷해요. 먼저 "안전 루트(호흡/중립/가동성)"로 기반을 잡아야 합니다.';
    }
  };

  const handleStartCamera = async () => {
    if (cameraDockRef.current) {
      await cameraDockRef.current.startCamera();
    }
  };

  const handleStopCamera = () => {
    if (cameraDockRef.current) {
      cameraDockRef.current.stopCamera();
    }
  };

  const handleStartTest = () => {
    setStep('test');
  };

  return (
    <div
      className="flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"
      style={{
        height: '100dvh',
        overflow: 'hidden',
      }}
    >
      {/* 상단 컨트롤바 - 고정 높이 */}
      <div
        className="flex-shrink-0 bg-slate-800/95 backdrop-blur-sm border-b border-slate-700 px-4 py-2 flex items-center gap-3 z-10"
        style={{
          flex: '0 0 48px',
        }}
      >
        <label className="text-white text-xs font-semibold whitespace-nowrap">
          카메라 크기
        </label>
        <input
          type="range"
          min="25"
          max="70"
          step="1"
          value={cameraHeightVh}
          onChange={(e) => setCameraHeightVh(parseInt(e.target.value, 10))}
          className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#f97316]"
          style={{
            background: `linear-gradient(to right, #f97316 0%, #f97316 ${((cameraHeightVh - 25) / (70 - 25)) * 100}%, #475569 ${((cameraHeightVh - 25) / (70 - 25)) * 100}%, #475569 100%)`,
          }}
        />
        <span className="text-white text-xs font-semibold whitespace-nowrap min-w-[3rem] text-right">
          {Math.round(cameraHeightVh)}%
        </span>
        {/* 카메라 끄기 버튼 - 카메라 ON일 때만 표시 */}
        {isCameraOn && (
          <button
            type="button"
            onClick={handleStopCamera}
            className="ml-2 px-3 py-1 bg-red-600 text-white rounded text-xs font-semibold hover:bg-red-700 transition-colors shadow-lg"
          >
            끄기
          </button>
        )}
      </div>

      {/* 카메라 영역 - 고정 높이 */}
      <div
        className="flex-shrink-0 bg-slate-900 relative"
        style={{
          flex: '0 0 auto',
          height: `calc(${cameraHeightVh} * 1dvh)`,
          minHeight: 'calc(25 * 1dvh)',
          maxHeight: 'calc(70 * 1dvh)',
        }}
      >
        {/* CameraDock - compact 모드 (컨트롤 숨김) */}
        <div className="w-full h-full flex flex-col">
          <CameraDock
            ref={cameraDockRef}
            mode="split"
            hideControls={true}
            onStateChange={handleCameraStateChange}
          />
        </div>

        {/* 카메라 OFF일 때 중앙 "테스트 시작" 버튼 오버레이 */}
        {!isCameraOn && cameraPhase === 'idle' && (
          <div
            className="absolute inset-0 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm z-20"
            style={{ pointerEvents: 'auto' }}
          >
            <button
              type="button"
              onClick={handleStartCamera}
              disabled={cameraPhase === 'requesting' || cameraPhase === 'binding'}
              className="px-12 py-6 bg-[#f97316] text-white rounded-2xl text-xl font-bold hover:bg-[#ea580c] transition-all duration-200 shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105"
            >
              {cameraPhase === 'requesting' || cameraPhase === 'binding' ? '켜는 중...' : '테스트 시작'}
            </button>
          </div>
        )}
      </div>

      {/* 하단 콘텐츠 영역 - 스크롤 가능 */}
      <div
        className="flex-1 overflow-y-auto"
        style={{
          minHeight: 0,
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {step === 'calibration' ? (
          /* 켈리브레이션 단계 */
          <div className="container mx-auto px-4 py-8">
            <div className="max-w-4xl mx-auto space-y-6">
              {/* 타이틀 */}
              <div className="text-center">
                <h1 className="text-3xl font-bold text-white mb-2">움직임 평가</h1>
                <p className="text-slate-300 text-sm">
                  테스트 전 준비 단계입니다. 아래 안내문구를 작성해주세요.
                </p>
              </div>

              {/* 안내문구 입력 */}
              <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6 shadow-2xl">
                <label className="block text-white font-semibold mb-2">
                  테스트 안내문구 (선택사항)
                </label>
                <textarea
                  value={prefaceText}
                  onChange={(e) => setPrefaceText(e.target.value)}
                  placeholder="예: 이 테스트는 진단이 아니라 내 움직임 습관을 확인하는 단계예요. 각 항목은 한 번이라도 그랬으면 체크하세요."
                  className="w-full h-32 px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#f97316] resize-none"
                />
                <p className="mt-2 text-slate-400 text-xs">
                  작성한 안내문구는 테스트 화면에서 확인할 수 있습니다.
                </p>
              </div>

              {/* 타이머 및 시작 버튼 */}
              <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6 shadow-2xl text-center">
                <div className="mb-4">
                  {secLeft > 0 ? (
                    <p className="text-slate-300 text-sm mb-2">
                      준비 시간: <span className="text-[#f97316] font-bold text-lg">{secLeft}초</span>
                    </p>
                  ) : (
                    <p className="text-green-400 font-semibold mb-2">
                      준비 완료! 테스트를 시작할 수 있습니다.
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleStartTest}
                  disabled={secLeft > 0}
                  className="px-12 py-4 bg-[#f97316] text-white rounded-xl text-lg font-bold hover:bg-[#ea580c] transition-all duration-200 shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#f97316]"
                >
                  테스트 시작
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* 테스트 단계 */
          <>
            {/* 안내문구 토글 버튼 */}
            <div className="sticky top-0 z-10 bg-slate-800/95 backdrop-blur-sm border-b border-slate-700">
              <button
                type="button"
                onClick={() => setShowPreface(!showPreface)}
                className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-700/50 transition-colors"
              >
                <span className="text-slate-300 font-semibold flex items-center gap-2">
                  <span className="text-lg">ℹ️</span>
                  안내 보기
                </span>
                <span className="text-slate-400 text-sm">
                  {showPreface ? '▼' : '▶'}
                </span>
              </button>
              {showPreface && prefaceText && (
                <div className="px-4 py-3 bg-slate-900/50 border-t border-slate-700">
                  <p className="text-slate-300 text-sm whitespace-pre-wrap">
                    {prefaceText}
                  </p>
                </div>
              )}
            </div>

            {/* 테스트 콘텐츠 */}
            <div className="container mx-auto px-4 py-16">
              <div className="max-w-4xl mx-auto space-y-8">
                {/* 테스트 1: 호흡 + 팔 올리기 */}
                <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-8 shadow-2xl">
                  <h2 className="text-3xl font-bold text-white mb-4">테스트 1: 호흡 + 팔 올리기</h2>
                  <p className="text-slate-300 mb-4">
                    거울 또는 전면카메라 화면을 켜고, 발은 골반 너비로 서주세요.
                  </p>
                  <p className="text-slate-300 mb-4">
                    숨을 천천히 내쉬면서 갈비뼈를 살짝 아래로 내려요. (배를 힘으로 쥐어짜지 말고
                    "갈비뼈만 살짝 내려오는 느낌")
                  </p>
                  <p className="text-slate-300 mb-4">
                    그 상태를 유지한 채, 양팔을 천천히 머리 위로 올렸다가 내려요.
                  </p>
                  <p className="text-slate-300 mb-6">3번을 3회 반복합니다.</p>

                  <details className="mb-6">
                    <summary className="text-slate-400 cursor-pointer text-sm mb-2">
                      주의사항 보기
                    </summary>
                    <div className="mt-2 text-slate-300 text-sm space-y-1 pl-4">
                      <p>• 빠르게 올리지 말고 천천히 올리기(천천히 해야 실수가 드러남)</p>
                      <p>• 팔을 올릴 때 "허리로 버티는 느낌"이 들면 속도를 더 줄이기</p>
                      <p>• 통증(찌릿/날카로움/저림)이 있으면 범위를 줄이고 중단</p>
                    </div>
                  </details>

                  <div className="space-y-3 mb-6">
                    <label className="flex items-start gap-3 text-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={tests[0].checks[0]}
                        onChange={() => toggleCheck(0, 0)}
                        className="mt-1 w-4 h-4"
                      />
                      <div className="flex-1">
                        <span>갈비뼈/배가 튀어나왔다</span>
                        <details className="mt-1">
                          <summary className="text-slate-400 cursor-pointer text-xs">
                            어떨 때 체크?
                          </summary>
                          <p className="text-slate-400 text-xs mt-1 pl-4">
                            팔을 올릴 때 배가 앞으로 나오거나 갈비뼈가 들리며 가슴이 들썩이면 체크
                          </p>
                        </details>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 text-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={tests[0].checks[1]}
                        onChange={() => toggleCheck(0, 1)}
                        className="mt-1 w-4 h-4"
                      />
                      <div className="flex-1">
                        <span>어깨가 귀 쪽으로 올라갔다</span>
                        <details className="mt-1">
                          <summary className="text-slate-400 cursor-pointer text-xs">
                            어떨 때 체크?
                          </summary>
                          <p className="text-slate-400 text-xs mt-1 pl-4">
                            팔을 올릴 때 어깨가 으쓱/목이 짧아지는 느낌이면 체크
                          </p>
                        </details>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 text-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={tests[0].checks[2]}
                        onChange={() => toggleCheck(0, 2)}
                        className="mt-1 w-4 h-4"
                      />
                      <div className="flex-1">
                        <span>허리가 과하게 꺾였다(요추 과신전)</span>
                        <details className="mt-1">
                          <summary className="text-slate-400 cursor-pointer text-xs">
                            어떨 때 체크?
                          </summary>
                          <p className="text-slate-400 text-xs mt-1 pl-4">
                            팔을 올릴 때 허리가 더 꺾이거나 골반이 앞으로 기울며 허리로 받치면 체크
                          </p>
                        </details>
                      </div>
                    </label>
                  </div>
                </div>

                {/* 테스트 2: 힙힌지 */}
                <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-8 shadow-2xl">
                  <h2 className="text-3xl font-bold text-white mb-4">테스트 2: 힙힌지(엉덩이 접기)</h2>
                  <p className="text-slate-300 mb-4">
                    거울을 옆으로 두거나(가능하면), 전면카메라를 옆모습이 보이게 세워요.
                  </p>
                  <p className="text-slate-300 mb-4">
                    무릎은 살짝만 굽히고, 엉덩이를 뒤로 보내며 상체를 숙여요.
                  </p>
                  <p className="text-slate-300 mb-4">
                    허리를 둥글게 굽히는 게 아니라, 엉덩이가 접히는 느낌으로 내려갑니다.
                  </p>
                  <p className="text-slate-300 mb-6">내려갔다가 올라오기 3회 반복.</p>

                  <details className="mb-6">
                    <summary className="text-slate-400 cursor-pointer text-sm mb-2">
                      주의사항 보기
                    </summary>
                    <div className="mt-2 text-slate-300 text-sm space-y-1 pl-4">
                      <p>• "더 많이 숙이기"가 목표가 아니라 엉덩이가 뒤로 빠지는지가 목표</p>
                      <p>• 허리 통증이 있으면 범위를 절반으로 줄이기</p>
                      <p>• 내려갈 때 숨 참지 말고 자연스럽게 내쉬기</p>
                    </div>
                  </details>

                  <div className="space-y-3 mb-6">
                    <label className="flex items-start gap-3 text-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={tests[1].checks[0]}
                        onChange={() => toggleCheck(1, 0)}
                        className="mt-1 w-4 h-4"
                      />
                      <div className="flex-1">
                        <span>허리가 먼저 굽었다(등이 둥글어졌다)</span>
                        <details className="mt-1">
                          <summary className="text-slate-400 cursor-pointer text-xs">
                            어떨 때 체크?
                          </summary>
                          <p className="text-slate-400 text-xs mt-1 pl-4">
                            내려갈 때 허리/등이 말리거나 허리부터 접히면 체크
                          </p>
                        </details>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 text-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={tests[1].checks[1]}
                        onChange={() => toggleCheck(1, 1)}
                        className="mt-1 w-4 h-4"
                      />
                      <div className="flex-1">
                        <span>엉덩이가 뒤로 안 빠지고 상체만 숙여졌다</span>
                        <details className="mt-1">
                          <summary className="text-slate-400 cursor-pointer text-xs">
                            어떨 때 체크?
                          </summary>
                          <p className="text-slate-400 text-xs mt-1 pl-4">
                            엉덩이는 그대로인데 얼굴/가슴만 앞으로 떨어지거나 무릎이 과하게 앞으로
                            나가면 체크
                          </p>
                        </details>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 text-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={tests[1].checks[2]}
                        onChange={() => toggleCheck(1, 2)}
                        className="mt-1 w-4 h-4"
                      />
                      <div className="flex-1">
                        <span>좌우로 쏠렸다/한쪽 다리에 더 실렸다</span>
                        <details className="mt-1">
                          <summary className="text-slate-400 cursor-pointer text-xs">
                            어떨 때 체크?
                          </summary>
                          <p className="text-slate-400 text-xs mt-1 pl-4">
                            내려갈 때 몸이 기울거나 한쪽 엉덩이/다리에 힘이 몰리면 체크
                          </p>
                        </details>
                      </div>
                    </label>
                  </div>
                </div>

                {/* 테스트 3: 하프 스쿼트 */}
                <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-8 shadow-2xl">
                  <h2 className="text-3xl font-bold text-white mb-4">테스트 3: 하프 스쿼트(반만 앉기)</h2>
                  <p className="text-slate-300 mb-4">
                    거울 정면을 보거나 전면카메라를 켭니다.
                  </p>
                  <p className="text-slate-300 mb-4">
                    발은 어깨너비, 발끝은 자연스럽게(살짝 바깥도 OK).
                  </p>
                  <p className="text-slate-300 mb-4">
                    의자에 앉듯이 엉덩이를 뒤로 보내며 "반만" 앉았다가 올라옵니다.
                  </p>
                  <p className="text-slate-300 mb-6">3회 반복.</p>

                  <details className="mb-6">
                    <summary className="text-slate-400 cursor-pointer text-sm mb-2">
                      주의사항 보기
                    </summary>
                    <div className="mt-2 text-slate-300 text-sm space-y-1 pl-4">
                      <p>• 깊게 앉지 말고 반만(깊이는 욕심 금지)</p>
                      <p>• 무릎이 아프면 더 얕게, 속도를 더 느리게</p>
                      <p>• 올라올 때 "무릎으로 일어난다" 느낌이 강하면 엉덩이를 더 뒤로</p>
                    </div>
                  </details>

                  <div className="space-y-3 mb-6">
                    <label className="flex items-start gap-3 text-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={tests[2].checks[0]}
                        onChange={() => toggleCheck(2, 0)}
                        className="mt-1 w-4 h-4"
                      />
                      <div className="flex-1">
                        <span>무릎이 안쪽으로 모였다(무릎 붕괴)</span>
                        <details className="mt-1">
                          <summary className="text-slate-400 cursor-pointer text-xs">
                            어떨 때 체크?
                          </summary>
                          <p className="text-slate-400 text-xs mt-1 pl-4">
                            내려갈 때 무릎이 가까워지거나 X자로 모이면 체크
                          </p>
                        </details>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 text-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={tests[2].checks[1]}
                        onChange={() => toggleCheck(2, 1)}
                        className="mt-1 w-4 h-4"
                      />
                      <div className="flex-1">
                        <span>발이 무너졌다(아치 붕괴/뒤꿈치 뜸)</span>
                        <details className="mt-1">
                          <summary className="text-slate-400 cursor-pointer text-xs">
                            어떨 때 체크?
                          </summary>
                          <p className="text-slate-400 text-xs mt-1 pl-4">
                            발 안쪽이 꺾이거나 엄지/새끼 쪽이 들썩이거나 뒤꿈치가 뜨면 체크
                          </p>
                        </details>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 text-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={tests[2].checks[2]}
                        onChange={() => toggleCheck(2, 2)}
                        className="mt-1 w-4 h-4"
                      />
                      <div className="flex-1">
                        <span>한쪽으로 쏠렸다(골반 shift)</span>
                        <details className="mt-1">
                          <summary className="text-slate-400 cursor-pointer text-xs">
                            어떨 때 체크?
                          </summary>
                          <p className="text-slate-400 text-xs mt-1 pl-4">
                            내려갈 때 엉덩이가 한쪽으로 밀리거나 한쪽 다리만 더 쓰면 체크
                          </p>
                        </details>
                      </div>
                    </label>
                  </div>
                </div>

                {/* 결과 문구 */}
                {totalChecked > 0 && (
                  <div className="sticky bottom-4 bg-slate-800/95 backdrop-blur-sm border border-slate-700 rounded-xl p-6 shadow-2xl">
                    <p className="text-slate-200 text-center">{getResultMessage()}</p>
                  </div>
                )}

                {/* 완료 버튼 */}
                <div className="flex items-center justify-center gap-4 pb-8">
                  <button
                    type="button"
                    onClick={handleNavigate}
                    className="px-8 py-4 bg-slate-700 text-white rounded-xl font-semibold hover:bg-slate-600 transition-all duration-200"
                  >
                    건너뛰기
                  </button>
                  <button
                    type="button"
                    onClick={handleNavigate}
                    className="px-8 py-4 bg-[#f97316] text-white rounded-xl font-semibold hover:bg-[#ea580c] transition-all duration-200"
                  >
                    결과지 보기
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
