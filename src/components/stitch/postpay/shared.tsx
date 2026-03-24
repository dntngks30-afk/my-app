'use client';

/**
 * 결제 직후 실행 준비 chapter — onboarding-prep / session-preparing / onboarding-complete 공통 프레임
 */
import { StitchSceneShell } from '@/components/stitch/shared/SceneShell';

export function PostpayChapterShell({ children }: { children: React.ReactNode }) {
  return <StitchSceneShell contentEnter="calm">{children}</StitchSceneShell>;
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

/**
 * PR-SESSION-PREPARING-TRANSPLANT-MIN-DWELL-02 — 가로 준비 바(0~1).
 * 백엔드 단계 정확도를 주장하지 않고, 체류·메시지 페이싱용 시각 신호만.
 */
export function PostpayHorizontalPreparingBar({ fraction }: { fraction: number }) {
  const pct = Math.min(100, Math.max(0, fraction * 100));
  return (
    <div
      className="relative h-[3px] w-full max-w-[13.5rem] overflow-hidden rounded-full bg-[#2e3447]/35"
      role="status"
      aria-live="polite"
      aria-label="세션 준비 중"
    >
      <div
        className="h-full rounded-full bg-gradient-to-r from-[#ffb77d] via-[#fcb973] to-[#ab4c00] transition-[width] duration-500 ease-out"
        style={{ width: `${pct}%` }}
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
