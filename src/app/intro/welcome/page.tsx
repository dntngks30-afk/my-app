'use client';

/**
 * 공통 intro 첫 화면
 * 랜딩 CTA(설문형/동작형) 선택 후 진입.
 * entryMode는 localStorage(moveRePublicFunnel:v1)에 저장됨.
 * 이후 PR에서 실제 intro 콘텐츠 연결.
 */
export default function IntroWelcomePage() {
  return (
    <div className="min-h-[100svh] flex flex-col items-center justify-center px-6 bg-[#0d161f] text-slate-100">
      <p className="text-slate-400 text-sm" style={{ fontFamily: 'var(--font-sans-noto)' }}>
        공통 intro 첫 화면 (다음 PR에서 연결)
      </p>
    </div>
  );
}
