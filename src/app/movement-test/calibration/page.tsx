'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

const STORAGE_KEY = 'movementTest.calibration.v1';

export default function CalibrationPage() {
  const router = useRouter();

  const TOTAL_SECONDS = 20;

  const [phase, setPhase] = useState<'idle' | 'running' | 'done'>('idle');
  const [secondsLeft, setSecondsLeft] = useState<number>(TOTAL_SECONDS);

  const intervalRef = useRef<number | null>(null);

  const progress = useMemo(() => {
    const done = TOTAL_SECONDS - secondsLeft;
    return Math.min(100, Math.max(0, (done / TOTAL_SECONDS) * 100));
  }, [secondsLeft]);

  // movement-test-result가 없으면 survey로 redirect
  useEffect(() => {
    try {
      const result = localStorage.getItem('movement-test-result');
      if (!result) {
        router.replace('/movement-test/survey');
      }
    } catch {
      router.replace('/movement-test/survey');
    }
  }, [router]);

  // 타이머 틱
  useEffect(() => {
    if (phase !== 'running') return;

    intervalRef.current = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [phase]);

  // 0초가 되면 완료 처리 + 저장 + 다음으로 이동
  useEffect(() => {
    if (phase !== 'running') return;
    if (secondsLeft !== 0) return;

    setPhase('done');

    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ completedAt: new Date().toISOString(), totalSeconds: TOTAL_SECONDS })
      );
    } catch {
      // ignore
    }

    router.replace('/movement-test/move');
  }, [phase, secondsLeft, router]);

  const start = () => {
    setSecondsLeft(TOTAL_SECONDS);
    setPhase('running');
  };

  const reset = () => {
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    intervalRef.current = null;
    setSecondsLeft(TOTAL_SECONDS);
    setPhase('idle');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto">
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-8 shadow-2xl">
            {/* 제목 */}
            <h1 className="text-3xl font-bold text-white mb-4">캘리브레이션</h1>

            {/* 부제 */}
            <p className="text-slate-300 text-lg mb-8 leading-relaxed">
              테스트 정확도를 높이기 위해, 설문 직후 20초간 몸을 중립 상태로 정렬합니다.
            </p>

            {/* 안내 bullets */}
            <div className="bg-slate-700/50 border border-slate-600 rounded-xl p-6 mb-8">
              <ul className="space-y-3 text-slate-200">
                <li className="flex items-start">
                  <span className="text-[#f97316] mr-3">•</span>
                  <span>발은 골반 너비, 발바닥 전체를 바닥에</span>
                </li>
                <li className="flex items-start">
                  <span className="text-[#f97316] mr-3">•</span>
                  <span>무릎은 잠그지 말고 살짝 풀기</span>
                </li>
                <li className="flex items-start">
                  <span className="text-[#f97316] mr-3">•</span>
                  <span>턱 살짝 당기고 어깨 힘 빼기</span>
                </li>
                <li className="flex items-start">
                  <span className="text-[#f97316] mr-3">•</span>
                  <span>코로 편하게 들이마시고 길게 내쉬기</span>
                </li>
              </ul>
            </div>

            {/* 진행바 */}
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden mb-6">
              <div
                className="h-full bg-[#f97316] transition-all duration-200 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* 타이머 */}
            <div className="flex items-center gap-6 mb-8">
              <div className="text-5xl font-bold text-white min-w-[120px]">
                {secondsLeft}s
              </div>
              <div className="text-slate-300 text-lg">
                {phase === 'idle' && '준비되면 시작을 눌러 주세요.'}
                {phase === 'running' && '힘 빼고 호흡만 유지하세요.'}
                {phase === 'done' && '완료! 다음 페이지로 이동합니다.'}
              </div>
            </div>

            {/* 버튼 */}
            <div className="flex items-center gap-4">
              {phase !== 'running' ? (
                <button
                  onClick={start}
                  className="px-6 py-3 bg-[#f97316] text-white rounded-xl font-semibold hover:bg-[#ea580c] transition-all duration-200"
                >
                  시작
                </button>
              ) : (
                <button
                  onClick={reset}
                  className="px-6 py-3 bg-slate-700 text-white rounded-xl font-semibold hover:bg-slate-600 transition-all duration-200"
                >
                  다시하기
                </button>
              )}

              <button
                onClick={() => router.replace('/movement-test/move')}
                className="px-6 py-3 bg-slate-700 text-white rounded-xl font-semibold hover:bg-slate-600 transition-all duration-200"
              >
                스킵
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
