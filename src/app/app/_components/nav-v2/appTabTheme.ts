/**
 * V2 app tabs — same donor tone as /app/home (ResetMapV2 DONOR_BG).
 * Visual-only; keep in sync with HomePageClient useDonorTheme.
 */
export const APP_TAB_BG = 'oklch(0.22 0.03 245)';

export const appTabScreenStyle = { backgroundColor: APP_TAB_BG } as const;

/** Glassy card on dark navy */
export const appTabCard =
  'rounded-2xl border border-white/10 bg-white/[0.04] shadow-[0_8px_32px_rgba(0,0,0,0.18)]';

export const appTabMuted = 'text-white/70';
export const appTabSubtle = 'text-white/50';
export const appTabAccent = 'text-orange-500';
