'use client';

/**
 * Movement Type Test - 메인 페이지
 *
 * 테스트 시작 화면
 * 네오브루탈리즘 디자인 적용
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { NeoButton, NeoCard, NeoPageLayout } from '@/components/neobrutalism';

export default function MovementTestPage() {
  const router = useRouter();
  const [isStarting, setIsStarting] = useState(false);

  const handleStart = () => {
    setIsStarting(true);
    router.push('/movement-test/survey');
  };

  return (
    <NeoPageLayout maxWidth="lg">
      {/* 헤더 */}
      <section className="py-10 sm:py-12 md:py-16 text-center">
        <h1 className="text-4xl md:text-5xl font-bold text-slate-800 mb-4">
          움직임 타입 테스트
        </h1>
        <p className="text-xl text-slate-600">
          당신의 움직임 패턴을 분석하고
          <br />
          맞춤형 교정 가이드를 제공합니다
        </p>
      </section>

      {/* 메인 카드 */}
      <NeoCard className="p-8 md:p-12 mb-16">
        <div className="space-y-6 mb-8">
          {[
            { icon: '📋', title: '40개의 질문', desc: '30개의 4지선다 질문과 10개의 예/아니오 질문으로 구성됩니다.' },
            { icon: '⏱️', title: '약 10분 소요', desc: '천천히 생각하며 답변해도 충분한 시간입니다.' },
            { icon: '🎯', title: '16가지 서브타입 분석', desc: '4가지 메인 타입과 각각의 세부 특성을 정확히 분석합니다.' },
            { icon: '💡', title: '맞춤형 교정 가이드', desc: '당신의 타입에 최적화된 운동과 생활 습관 조언을 제공합니다.' },
          ].map((item) => (
            <div key={item.title} className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-orange-100 rounded-2xl border-2 border-slate-900 flex items-center justify-center shadow-[2px_2px_0_0_rgba(15,23,42,1)]">
                <span className="text-2xl">{item.icon}</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-800 mb-2">{item.title}</h3>
                <p className="text-slate-600">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border-2 border-slate-900 bg-[#F8F6F0] p-6 mb-8 shadow-[2px_2px_0_0_rgba(15,23,42,1)]">
          <h4 className="text-slate-800 font-semibold mb-3 flex items-center gap-2">
            <span>💬</span>
            답변 시 유의사항
          </h4>
          <ul className="space-y-2 text-slate-600 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-orange-500 mt-1">•</span>
              <span>평소 가장 자주 느끼는 패턴을 기준으로 답변해주세요.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-orange-500 mt-1">•</span>
              <span>정답은 없습니다. 솔직하게 답변하는 것이 가장 정확한 결과를 얻는 방법입니다.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-orange-500 mt-1">•</span>
              <span>중간에 나가도 진행 상황이 저장됩니다.</span>
            </li>
          </ul>
        </div>

        <NeoButton
          variant="orange"
          fullWidth
          className="py-4 text-lg"
          onClick={handleStart}
          disabled={isStarting}
        >
          {isStarting ? '준비 중...' : '테스트 시작하기'}
        </NeoButton>

        <p className="text-center text-slate-500 text-sm mt-6">
          테스트 데이터는 브라우저에만 저장되며 외부로 전송되지 않습니다.
        </p>
      </NeoCard>

      {/* 4가지 메인 타입 미리보기 */}
      <section>
        <h2 className="text-2xl font-bold text-slate-800 text-center mb-8">
          4가지 메인 타입
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: '🏔️', name: '담직형', desc: '뻣뻣함, 전신 둔화' },
            { icon: '🌊', name: '날림형', desc: '불안정함, 관절 흐름' },
            { icon: '⚡', name: '버팀형', desc: '특정 부위 통증, 과로' },
            { icon: '💨', name: '흘림형', desc: '효율 저하, 힘 누수' },
          ].map((item) => (
            <div
              key={item.name}
              className="rounded-2xl border-2 border-slate-900 bg-white p-6 text-center shadow-[4px_4px_0_0_rgba(15,23,42,1)]"
            >
              <div className="text-3xl mb-3">{item.icon}</div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">{item.name}</h3>
              <p className="text-slate-600 text-sm">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </NeoPageLayout>
  );
}
