'use client';

import { MoveReAuthIntroShell } from '@/components/auth/MoveReAuthIntroShell';

interface MoveReAuthScreenProps {
  /** 로그인/회원가입 hero 제목만 (설명 금지) */
  headline: string;
  /** hero 바깥 안내 — OTP 등 (카드 형태로 슬롯 내부에서 지정) */
  noticeSlot?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Auth 전용 레이아웃 — IntroSceneShell과 동일 네비/별/glow 패밀리.title-only hero.
 */
export default function MoveReAuthScreen({ headline, noticeSlot, children }: MoveReAuthScreenProps) {
  return (
    <MoveReAuthIntroShell>
      <div
        className="flex w-full max-w-[420px] flex-col gap-8"
        style={{ fontFamily: 'var(--font-sans-noto), system-ui, sans-serif' }}
      >
        <header className="text-center">
          <p className="text-[28px] font-bold leading-none tracking-[-0.04em] text-[#dce1fb]" style={{ fontFamily: 'var(--font-serif-noto), serif' }}>
            MOVE RE
          </p>
          {/* 카피 라인 노출 안 함 — 화면엔 숨김, 스크린리더만 */}
          <h1 className="sr-only">{headline}</h1>
        </header>
        {noticeSlot ? <div className="flex justify-center text-center">{noticeSlot}</div> : null}
        {children}
      </div>
    </MoveReAuthIntroShell>
  );
}
