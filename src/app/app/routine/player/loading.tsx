/**
 * Segment loading skeleton for /app/routine/player
 * 네오브루탈 스타일 유지: border-2 border-slate-900 + shadow-[4px_4px_0_0_rgba(15,23,42,1)]
 */

const CARD_CLASS =
  'rounded-2xl border-2 border-slate-900 bg-white shadow-[4px_4px_0_0_rgba(15,23,42,1)]';

export default function PlayerLoading() {
  return (
    <div className="min-h-screen bg-[#f8f6f0] pb-24">
      {/* Header */}
      <header className="px-4 pt-6 pb-4">
        <div className="flex items-center gap-3">
          <div className="size-10 animate-pulse rounded-full bg-slate-200" />
          <div className="space-y-1">
            <div className="h-5 w-32 animate-pulse rounded bg-slate-200" />
            <div className="h-3 w-16 animate-pulse rounded bg-slate-200" />
          </div>
        </div>
      </header>

      <main className="px-4 space-y-4">
        {/* 상단 타이틀/Day */}
        <div className="h-6 w-40 animate-pulse rounded bg-slate-200" />

        {/* 운동 카드 2~4개 */}
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className={`${CARD_CLASS} overflow-hidden`}>
              <div className="aspect-video w-full animate-pulse bg-slate-200" />
              <div className="p-4 space-y-2">
                <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
                <div className="h-3 w-full animate-pulse rounded bg-slate-200" />
              </div>
            </div>
          ))}
        </div>

        {/* 재생 버튼 자리 */}
        <div className="flex justify-center">
          <div className="h-12 w-48 animate-pulse rounded-full bg-slate-200" />
        </div>

        {/* 하단 컨트롤 (다음/완료) */}
        <div className="fixed bottom-0 left-0 right-0 px-4 py-4 bg-[#f8f6f0] border-t-2 border-slate-900 flex gap-3">
          <div className="flex-1 h-12 animate-pulse rounded-full bg-slate-200" />
          <div className="flex-1 h-12 animate-pulse rounded-full bg-slate-200" />
        </div>
      </main>
    </div>
  );
}
