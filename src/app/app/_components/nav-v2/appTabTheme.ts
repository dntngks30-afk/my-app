/**
 * V2 app tabs — same donor tone as /app/home (ResetMapV2 DONOR_BG).
 * Visual-only; keep in sync with HomePageClient useDonorTheme.
 */
export const APP_TAB_BG = 'oklch(0.22 0.03 245)';

export const appTabScreenStyle = { backgroundColor: APP_TAB_BG } as const;

/** Glassy card on dark navy */
export const appTabCard =
  'rounded-2xl border border-white/10 bg-white/[0.04] shadow-[0_8px_32px_rgba(0,0,0,0.18)]';

/** 도움말·정책 시트 — 불투명 다크 서페이스. appTabCard(글래스)와 분리. */
export const appTabModalSurface =
  'rounded-2xl border border-white/10 bg-[#101827] shadow-[0_24px_80px_rgba(0,0,0,0.55)]';

export const appTabModalBody = 'text-slate-200';

export const appTabModalMuted = 'text-slate-300';

/** 닫기: 터치 타깃 유지 (min 44px) */
export const appTabModalClose =
  'flex min-h-11 min-w-11 items-center justify-center rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white';

export const appTabMuted = 'text-white/70';
export const appTabSubtle = 'text-white/50';
export const appTabAccent = 'text-orange-500';
