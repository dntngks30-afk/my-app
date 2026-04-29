/**
 * PR: Home execution surfaces — className fragments only (presentation).
 * No imports from API/state; safe for SessionPanelV2 / ExercisePlayerModal styling reuse.
 */

/** Bottom sheet panel — aligns with HomePageClient donor oklch midnight navy */
export const sheetContainer =
  'mx-auto max-w-[430px] rounded-2xl border border-white/10 bg-[oklch(0.235_0.038_245)] shadow-xl shadow-black/30'

export const dragHandle = 'h-1.5 w-12 rounded-full bg-white/15'

export const panelHeaderBorder = 'border-b border-white/10'
export const panelSectionBorder = 'border-t border-white/10'

export const titlePrimary = 'text-lg font-bold text-white/90'
export const titleMuted = 'text-sm font-normal text-white/45'

export const closeButtonGhost =
  'flex h-8 w-8 items-center justify-center rounded-lg text-white/45 transition-colors hover:bg-white/[0.08] hover:text-white/90'

/** Session status chips — restrained (no orange-100 / emerald-100) */
export const statusChip = {
  current:
    'rounded-full border border-orange-500/35 bg-orange-500/12 px-2 py-0.5 text-xs font-semibold text-orange-200',
  completed:
    'rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-200',
  locked:
    'rounded-full border border-white/12 bg-white/[0.06] px-2 py-0.5 text-xs font-semibold text-white/45',
} as const

/** “오늘의 목표” inset card */
export const sessionGoalCard =
  'mb-4 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3'

export const sessionGoalLabel = 'text-xs font-semibold uppercase tracking-wider text-white/45'

export const primaryCtaRestrained =
  'flex w-full items-center justify-center gap-2 rounded-xl border border-orange-500/40 bg-orange-500/20 py-3.5 text-sm font-semibold text-orange-100 shadow-sm transition hover:bg-orange-500/28 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60'

/** Exercise modal outer sheet — matches donor navy execution surfaces */
export const modalSheetContainer =
  'mx-auto max-w-[430px] overflow-hidden rounded-t-2xl border border-white/10 bg-[oklch(0.235_0.038_245)] shadow-2xl shadow-black/40'

export const modalSectionBorder = 'border-b border-white/10'

export const setRowSurface =
  'flex flex-1 items-center gap-2 rounded-xl border border-white/12 bg-white/[0.05] px-2 py-1.5'

export const stepperBtn =
  'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.12] text-white/85 transition hover:bg-white/[0.18] active:scale-95'

export const dashedSecondaryBtn =
  'flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/18 bg-white/[0.04] py-3.5 text-sm font-semibold text-white/70 transition hover:border-white/25 hover:bg-white/[0.07]'

/** Reflection / exercise log — inactive choice chips (dark sheet) */
export const choiceChipInactive =
  'rounded-xl border border-white/12 bg-white/[0.06] text-white/70 transition hover:bg-white/[0.09] hover:border-white/16'

/** Selected: warm orange accent (difficulty, discomfort, RPE) */
export const choiceChipActiveOrange =
  'rounded-xl border border-orange-500/45 bg-orange-500/15 text-orange-100 shadow-[0_0_14px_-4px_rgba(251,146,60,0.45)]'

/** Body state: “더 편해짐” — muted emerald */
export const choiceChipActiveBetter =
  'rounded-xl border border-emerald-500/35 bg-emerald-500/12 text-emerald-100'

/** Body state: “비슷함” — warm orange */
export const choiceChipActiveSame = choiceChipActiveOrange

/** Body state: “불편해짐” — muted amber (not harsh red) */
export const choiceChipActiveWorse =
  'rounded-xl border border-amber-500/35 bg-amber-500/14 text-amber-100'

/** Dark numeric / text input inside execution sheets */
export const darkInputField =
  'w-full rounded-xl border border-white/12 bg-white/[0.06] px-3 py-2 text-sm text-white placeholder:text-white/35 outline-none transition focus:border-orange-500/35 focus:ring-1 focus:ring-orange-500/25'

export const darkFormLabel = 'block text-xs font-medium text-white/50 mb-1'

/** Nested card inside modals */
export const darkNestedCard =
  'rounded-xl border border-white/10 bg-white/[0.04] p-4 space-y-3 shadow-inner shadow-black/20'
