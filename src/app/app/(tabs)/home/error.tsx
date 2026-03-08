'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

/**
 * useSearchParams 제거 — Suspense 없이 사용 시 "Cannot access '$' before initialization" 등
 * ReferenceError 유발 가능. window.location으로 debug 파라미터만 클라이언트에서 읽음.
 */
export default function HomeErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [debug, setDebug] = useState(false);
  useEffect(() => {
    try {
      setDebug(typeof window !== 'undefined' && window.location?.search?.includes('debug=1'));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    console.error('[home/error]', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#F8F6F0] flex flex-col items-center justify-center px-4 pb-20">
      <div className="max-w-md w-full rounded-2xl border-2 border-slate-900 bg-white p-6 shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
        <h2 className="text-lg font-bold text-slate-800 mb-2">
          문제가 발생했어요
        </h2>
        <p className="text-sm text-slate-600 mb-4">
          대시보드를 불러오는 중 오류가 발생했습니다.
        </p>
        {debug && (
          <div className="mb-4 p-3 rounded-lg bg-slate-100 text-xs text-slate-700 font-mono break-all">
            <p>{error.message}</p>
            {error.digest && <p className="mt-1">digest: {error.digest}</p>}
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
            href="/app/home"
            className="min-h-[44px] w-full flex items-center justify-center px-6 py-3 rounded-full border-2 border-slate-900 bg-white font-bold text-slate-800 shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition hover:opacity-95"
          >
            홈으로
          </Link>
        </div>
      </div>
    </div>
  );
}
