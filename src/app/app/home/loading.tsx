/**
 * Segment loading skeleton for /app/home
 * 네오브루탈 스타일 유지: border-2 border-slate-900 + shadow-[4px_4px_0_0_rgba(15,23,42,1)]
 */

const CARD_CLASS =
  'rounded-2xl border-2 border-slate-900 bg-white shadow-[4px_4px_0_0_rgba(15,23,42,1)]';

export default function HomeLoading() {
  return (
    <div className="min-h-screen bg-[#f8f6f0] pb-20">
      {/* Header */}
      <header className="px-4 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div className="h-4 w-20 animate-pulse rounded bg-slate-200" />
          <div className="size-9 animate-pulse rounded-full bg-slate-200" />
        </div>
        <div className="mt-2 h-10 w-32 animate-pulse rounded bg-slate-200" />
        <div className="mt-2 h-5 w-3/4 animate-pulse rounded bg-slate-200" />
      </header>

      <main className="px-4 space-y-6">
        {/* Day selector (7 pills) */}
        <section>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="flex shrink-0 flex-col items-center gap-1">
                <div className="size-12 shrink-0 animate-pulse rounded-full bg-slate-200" />
                <div className="h-3 w-12 animate-pulse rounded bg-slate-200" />
              </div>
            ))}
          </div>
        </section>

        {/* XP Progress card */}
        <section className={`${CARD_CLASS} p-5`}>
          <div className="flex items-center justify-between">
            <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-12 animate-pulse rounded bg-slate-200" />
          </div>
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div className="h-full w-1/3 rounded-full bg-slate-300 animate-pulse" />
          </div>
          <div className="mt-2 h-3 w-20 animate-pulse rounded bg-slate-200" />
        </section>

        {/* Main CTA card (오늘 루틴) */}
        <section>
          <div
            className={`flex items-center gap-4 rounded-full border-2 border-slate-900 bg-white px-6 py-5 shadow-[4px_4px_0_0_rgba(15,23,42,1)]`}
          >
            <div className="size-12 shrink-0 animate-pulse rounded-full bg-slate-200" />
            <div className="h-6 flex-1 animate-pulse rounded bg-slate-200" />
            <div className="size-10 shrink-0 animate-pulse rounded-full bg-slate-200" />
          </div>
          <div className="mt-2 h-3 w-24 mx-auto animate-pulse rounded bg-slate-200" />
        </section>

        {/* Body status summary */}
        <section className="rounded-2xl bg-slate-100/50 p-5">
          <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
          <div className="mt-3 flex items-start gap-3">
            <div className="size-5 shrink-0 animate-pulse rounded bg-slate-200" />
            <div className="h-4 flex-1 animate-pulse rounded bg-slate-200" />
          </div>
          <div className="mt-4 h-8 w-40 animate-pulse rounded-lg bg-slate-200" />
        </section>
      </main>
    </div>
  );
}
