/**
 * Segment loading skeleton for /app/routine
 * 네오브루탈 스타일 유지: border-2 border-slate-900 + shadow-[4px_4px_0_0_rgba(15,23,42,1)]
 */

const CARD_CLASS =
  'rounded-2xl border-2 border-slate-900 bg-white shadow-[4px_4px_0_0_rgba(15,23,42,1)]';

export default function RoutineLoading() {
  return (
    <div className="min-h-screen bg-[#f8f6f0] pb-20">
      <header className="px-4 pt-6 pb-4">
        <div className="h-10 w-24 animate-pulse rounded bg-slate-200" />
        <div className="mt-2 h-5 w-48 animate-pulse rounded bg-slate-200" />
      </header>

      <main className="px-4 space-y-6">
        {/* 이어하기 카드 */}
        <div className={`${CARD_CLASS} p-5`}>
          <div className="space-y-3">
            <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200" />
            <div className="h-10 w-full animate-pulse rounded-full bg-slate-200" />
          </div>
        </div>

        {/* 루틴 리스트 */}
        <section>
          <div className="h-4 w-24 animate-pulse rounded bg-slate-200 mb-3" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className={`${CARD_CLASS} p-4`}>
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200" />
                    <div className="h-3 w-1/2 animate-pulse rounded bg-slate-200" />
                  </div>
                  <div className="size-10 shrink-0 animate-pulse rounded-full bg-slate-200" />
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
