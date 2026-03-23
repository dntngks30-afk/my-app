'use client';

/**
 * 결제 직후 실행 준비 chapter — onboarding-prep / session-preparing / onboarding-complete 공통 프레임
 */
import { StitchSceneShell } from '@/components/stitch/shared/SceneShell';

export function PostpayChapterShell({ children }: { children: React.ReactNode }) {
  return <StitchSceneShell>{children}</StitchSceneShell>;
}

/** stitch zip: 얇은 수직 시네마틱 레일 (0~1 채움) */
export function PostpayVerticalRail({ fraction }: { fraction: number }) {
  const pct = Math.min(100, Math.max(0, fraction * 100));
  return (
    <div
      className="mt-8 h-12 w-1 overflow-hidden rounded-full bg-[#2e3447]/30"
      aria-hidden
    >
      <div
        className="w-full bg-[#ffb77d] transition-all duration-700 ease-out"
        style={{ height: `${pct}%` }}
      />
    </div>
  );
}

/** 상단 Move Re 워드마크 (zip header 정렬감) */
export function PostpayBrandHeader() {
  return (
    <header className="relative z-20 flex h-16 shrink-0 items-center justify-center px-8">
      <span className="text-xl font-medium tracking-widest text-[#ffb77d] [font-family:var(--font-display)]">
        Move Re
      </span>
    </header>
  );
}
