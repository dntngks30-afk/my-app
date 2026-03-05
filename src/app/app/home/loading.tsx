/**
 * Segment loading skeleton for /app/home
 * 리셋 지도(Reset Map) UI에 맞춘 스켈레톤. 네오브루탈 스타일 유지.
 */

const CARD_CLASS =
  'rounded-2xl border-2 border-slate-900 bg-white shadow-[4px_4px_0_0_rgba(15,23,42,1)]';

export default function HomeLoading() {
  return (
    <div className="min-h-screen bg-[#f8f6f0] pb-20">
      {/* Header */}
      <header className="px-4 pt-6 pb-4">
        <h1 className="text-4xl font-bold text-orange-500">Move Re</h1>
        <div className="mt-2 h-5 w-3/4 animate-pulse rounded bg-slate-200" />
      </header>

      <main className="px-4 space-y-6">
        {/* 리셋 지도 카드 스켈레톤 */}
        <section className={`${CARD_CLASS} p-5`}>
          <div className="flex items-center justify-between mb-3">
            <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
            <div className="h-3 w-40 animate-pulse rounded bg-slate-200" />
          </div>
          <div
            className="overflow-hidden rounded-xl bg-slate-100"
            style={{ aspectRatio: '2048/1529' }}
          >
            <div className="h-full w-full animate-pulse bg-slate-200" />
          </div>
        </section>
      </main>
    </div>
  );
}
