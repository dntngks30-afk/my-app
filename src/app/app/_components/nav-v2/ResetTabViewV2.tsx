'use client';

import {
  Play,
  Clock,
  Sparkles,
  Activity,
  RotateCcw,
} from 'lucide-react';
import { appTabCard, appTabMuted, appTabSubtle, appTabAccent } from './appTabTheme';

const ISSUE_ROWS: { label: string; sub: string }[] = [
  { label: '거북목', sub: '목 앞쪽 리셋' },
  { label: '라운드숄더', sub: '가슴 열기 스트레칭' },
  { label: '등이 뻣뻣함', sub: '흉추 회전 리셋' },
  { label: '허리 뻐근함', sub: '골반-허리 이완' },
  { label: '고관절 뻣뻣함', sub: '고관절 앞쪽 열기' },
  { label: '햄스트링 긴장', sub: '뒤쪽 라인 이완' },
  { label: '발목 가동성 부족', sub: '발목 리셋' },
  { label: '어깨 뻐근함', sub: '어깨 가동성 리셋' },
];

export function ResetTabViewV2() {
  return (
    <div className="px-4 pb-6 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <header className="mb-6">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs text-white/80">
          <Sparkles className="size-3.5 text-orange-400/90" aria-hidden />
          <span className={appTabMuted}>거북목 · 상체 긴장 패턴</span>
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-white">
          오늘 필요한 리셋
        </h1>
        <p className={`mt-2 text-[15px] leading-relaxed ${appTabMuted}`}>
          몸의 긴장 패턴에 맞춰 가볍게 풀어보세요.
        </p>
      </header>

      {/* Featured */}
      <div
        className={`relative overflow-hidden ${appTabCard} p-5 mb-8`}
      >
        <div
          className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-orange-500/15 blur-2xl"
          aria-hidden
        />
        <div className="relative flex gap-4">
          <div
            className="flex h-[88px] w-[88px] shrink-0 flex-col items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-orange-500/25 to-transparent"
            aria-hidden
          >
            <RotateCcw className="size-7 text-orange-400/90" strokeWidth={1.75} />
            <Play className="mt-1 size-4 text-white/60" fill="currentColor" />
          </div>
          <div className="min-w-0 flex-1">
            <p className={`text-[11px] font-medium uppercase tracking-wider ${appTabSubtle}`}>
              추천
            </p>
            <h2 className="mt-1 text-base font-semibold text-white">
              거북목이 신경 쓰인다면
            </h2>
            <p className={`mt-2 text-sm leading-snug ${appTabMuted}`}>
              목 앞쪽 긴장과 등 상부 굳음을 먼저 풀어보세요.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className={`inline-flex items-center gap-1.5 text-xs ${appTabMuted}`}>
                <Clock className="size-3.5 text-white/45" aria-hidden />
                3분
              </span>
              <button
                type="button"
                className={`inline-flex items-center gap-2 rounded-full border border-orange-500/35 bg-orange-500/15 px-4 py-2 text-sm font-medium ${appTabAccent} transition hover:bg-orange-500/25`}
              >
                <Play className="size-4" aria-hidden />
                이 스트레칭 해보기
              </button>
            </div>
          </div>
        </div>
      </div>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <Activity className="size-4 text-white/45" aria-hidden />
          <h3 className="text-sm font-medium text-white/90">이슈별 리셋</h3>
        </div>
        <div className="flex flex-col gap-2">
          {ISSUE_ROWS.map((row) => (
            <button
              key={row.label}
              type="button"
              className={`flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3.5 text-left transition hover:bg-white/[0.06] active:scale-[0.99]`}
            >
              <span className="text-sm font-medium text-white">{row.label}</span>
              <span className={`text-xs ${appTabSubtle}`}>{row.sub}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
