/**
 * Segment loading skeleton for /app/deep-test/result
 * 네오브루탈 스타일: border-2 border-slate-900 + shadow-[4px_4px_0_0_rgba(15,23,42,1)]
 */

const CARD_CLASS =
  'rounded-2xl border-2 border-slate-900 bg-white shadow-[4px_4px_0_0_rgba(15,23,42,1)]';

export default function DeepTestResultLoading() {
  return (
    <div className="min-h-screen bg-[#f8f6f0] pb-20">
      <header className="px-4 pt-6 pb-4">
        <div className="h-10 w-48 animate-pulse rounded bg-slate-200" />
      </header>

      <main className="container mx-auto px-4">
        <div className="max-w-md mx-auto space-y-6">
          {/* PatternBanner placeholder */}
          <div className={`${CARD_CLASS} p-5`}>
            <div className="h-6 w-24 animate-pulse rounded-full bg-slate-200 mb-3" />
            <div className="h-5 w-full animate-pulse rounded bg-slate-200 mb-1" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200" />
          </div>

          {/* 시각화 섹션: Radar + ScoreCards */}
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className={`${CARD_CLASS} p-5 flex items-center justify-center min-h-[280px]`}>
              <div className="size-48 animate-pulse rounded-full bg-slate-200" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-1">
              {[1, 2, 3].map((i) => (
                <div key={i} className={`${CARD_CLASS} p-4`}>
                  <div className="h-3 w-16 animate-pulse rounded bg-slate-200 mb-2" />
                  <div className="h-5 w-20 animate-pulse rounded bg-slate-200" />
                  <div className="mt-1 h-3 w-full animate-pulse rounded bg-slate-200" />
                </div>
              ))}
            </div>
          </section>

          {/* Narrative placeholder */}
          <div className={`${CARD_CLASS} p-5 space-y-4`}>
            <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
            <div className="space-y-2">
              <div className="h-4 w-full animate-pulse rounded bg-slate-200" />
              <div className="h-4 w-11/12 animate-pulse rounded bg-slate-200" />
              <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200" />
            </div>
            <div className="pt-2 border-t border-stone-200">
              <div className="h-3 w-16 animate-pulse rounded bg-slate-200 mb-2" />
              <div className="h-4 w-full animate-pulse rounded bg-slate-200" />
            </div>
          </div>

          {/* TagChips placeholder */}
          <div className={`${CARD_CLASS} p-5 space-y-3`}>
            <div className="h-3 w-20 animate-pulse rounded bg-slate-200" />
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-6 w-16 animate-pulse rounded-full bg-slate-200" />
              ))}
            </div>
            <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-6 w-14 animate-pulse rounded-full bg-slate-200" />
              ))}
            </div>
          </div>

          {/* 다음 단계 placeholder */}
          <div className={`${CARD_CLASS} p-5`}>
            <div className="h-4 w-20 animate-pulse rounded bg-slate-200 mb-3" />
            <div className="space-y-2">
              <div className="h-4 w-full animate-pulse rounded bg-slate-200" />
              <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200" />
              <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200" />
            </div>
          </div>

          {/* CTA placeholder */}
          <div className="flex flex-col gap-3">
            <div className="h-14 w-full animate-pulse rounded-full bg-slate-200" />
            <div className="h-14 w-full animate-pulse rounded-full bg-slate-200" />
          </div>
        </div>
      </main>
    </div>
  );
}
