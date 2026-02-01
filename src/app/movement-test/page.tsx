'use client';

/**
 * Movement Type Test - 메인 페이지
 * 
 * 테스트 시작 화면
 * - 테스트 소개
 * - 소요 시간 안내
 * - 테스트 시작 버튼
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function MovementTestPage() {
  const router = useRouter();
  const [isStarting, setIsStarting] = useState(false);

  const handleStart = () => {
    setIsStarting(true);
    // 테스트 페이지로 이동
    router.push('/movement-test/survey');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          {/* 헤더 */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              움직임 타입 테스트
            </h1>
            <p className="text-xl text-slate-300">
              당신의 움직임 패턴을 분석하고<br />
              맞춤형 교정 가이드를 제공합니다
            </p>
          </div>

          {/* 메인 카드 */}
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-8 md:p-12 shadow-2xl">
            {/* 테스트 정보 */}
            <div className="space-y-6 mb-8">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-[#f97316] rounded-xl flex items-center justify-center">
                  <span className="text-2xl">📋</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">
                    40개의 질문
                  </h3>
                  <p className="text-slate-300">
                    30개의 4지선다 질문과 10개의 예/아니오 질문으로 구성됩니다.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-[#f97316] rounded-xl flex items-center justify-center">
                  <span className="text-2xl">⏱️</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">
                    약 10분 소요
                  </h3>
                  <p className="text-slate-300">
                    천천히 생각하며 답변해도 충분한 시간입니다.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-[#f97316] rounded-xl flex items-center justify-center">
                  <span className="text-2xl">🎯</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">
                    16가지 서브타입 분석
                  </h3>
                  <p className="text-slate-300">
                    4가지 메인 타입과 각각의 세부 특성을 정확히 분석합니다.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-[#f97316] rounded-xl flex items-center justify-center">
                  <span className="text-2xl">💡</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">
                    맞춤형 교정 가이드
                  </h3>
                  <p className="text-slate-300">
                    당신의 타입에 최적화된 운동과 생활 습관 조언을 제공합니다.
                  </p>
                </div>
              </div>
            </div>

            {/* 주의사항 */}
            <div className="bg-slate-900/50 border border-slate-600 rounded-xl p-6 mb-8">
              <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                <span>💬</span>
                답변 시 유의사항
              </h4>
              <ul className="space-y-2 text-slate-300 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-[#f97316] mt-1">•</span>
                  <span>평소 가장 자주 느끼는 패턴을 기준으로 답변해주세요.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#f97316] mt-1">•</span>
                  <span>정답은 없습니다. 솔직하게 답변하는 것이 가장 정확한 결과를 얻는 방법입니다.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#f97316] mt-1">•</span>
                  <span>중간에 나가도 진행 상황이 저장됩니다.</span>
                </li>
              </ul>
            </div>

            {/* 시작 버튼 */}
            <button
              onClick={handleStart}
              disabled={isStarting}
              className={`
                w-full py-4 px-8 rounded-xl font-semibold text-lg
                transition-all duration-300 transform
                ${isStarting 
                  ? 'bg-slate-600 cursor-not-allowed' 
                  : 'bg-[#f97316] hover:bg-[#ea580c] hover:scale-[1.02] active:scale-[0.98]'
                }
                text-white shadow-lg
              `}
            >
              {isStarting ? '준비 중...' : '테스트 시작하기'}
            </button>

            {/* 개인정보 안내 */}
            <p className="text-center text-slate-400 text-sm mt-6">
              테스트 데이터는 브라우저에만 저장되며 외부로 전송되지 않습니다.
            </p>
          </div>

          {/* 4가지 메인 타입 미리보기 */}
          <div className="mt-16">
            <h2 className="text-2xl font-bold text-white text-center mb-8">
              4가지 메인 타입
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-6 text-center">
                <div className="text-3xl mb-3">🏔️</div>
                <h3 className="text-lg font-semibold text-white mb-2">담직형</h3>
                <p className="text-slate-400 text-sm">
                  뻣뻣함, 전신 둔화
                </p>
              </div>

              <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-6 text-center">
                <div className="text-3xl mb-3">🌊</div>
                <h3 className="text-lg font-semibold text-white mb-2">날림형</h3>
                <p className="text-slate-400 text-sm">
                  불안정함, 관절 흐름
                </p>
              </div>

              <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-6 text-center">
                <div className="text-3xl mb-3">⚡</div>
                <h3 className="text-lg font-semibold text-white mb-2">버팀형</h3>
                <p className="text-slate-400 text-sm">
                  특정 부위 통증, 과로
                </p>
              </div>

              <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-6 text-center">
                <div className="text-3xl mb-3">💨</div>
                <h3 className="text-lg font-semibold text-white mb-2">흘림형</h3>
                <p className="text-slate-400 text-sm">
                  효율 저하, 힘 누수
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
