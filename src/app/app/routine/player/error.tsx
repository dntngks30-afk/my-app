'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function PlayerErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const searchParams = useSearchParams();
  const debug = searchParams.get('debug') === '1';

  return (
    <div className="min-h-screen bg-[#F8F6F0] flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full rounded-2xl border-2 border-slate-900 bg-white p-6 shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
        <h2 className="text-lg font-bold text-slate-800 mb-2">
          문제가 발생했어요
        </h2>
        <p className="text-sm text-slate-600 mb-4">
          루틴 플레이어를 불러오는 중 오류가 발생했습니다.
        </p>
        {debug && (
          <div className="mb-4 p-3 rounded-lg bg-slate-100 text-xs text-slate-700 font-mono break-all">
            <p className="font-semibold mb-1">message:</p>
            <p>{error.message}</p>
            {error.digest && (
              <>
                <p className="font-semibold mt-2 mb-1">digest:</p>
                <p>{error.digest}</p>
              </>
            )}
            <p className="font-semibold mt-2 mb-1">url:</p>
            <p>{typeof window !== 'undefined' ? window.location.href : '-'}</p>
          </div>
        )}
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="min-h-[44px] w-full px-6 py-3 rounded-full border-2 border-slate-900 bg-orange-400 font-bold text-white shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition hover:opacity-95 active:translate-x-0.5 active:translate-y-0.5"
          >
            다시 시도
          </button>
          <Link
            href="/app/routine"
            className="min-h-[44px] w-full flex items-center justify-center px-6 py-3 rounded-full border-2 border-slate-900 bg-white font-bold text-slate-800 shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition hover:opacity-95"
          >
            홈으로
          </Link>
        </div>
      </div>
    </div>
  );
}
