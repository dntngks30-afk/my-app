'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Check } from 'lucide-react';
import BottomNav from '../../_components/BottomNav';

type SeriesItem = {
  day_key_utc: string;
  pain_today: number | null;
  stiffness: number | null;
  sleep: number | null;
  completed: boolean;
};

type Day7Report = {
  server_now_utc: string;
  range: { start_day_key_utc: string; end_day_key_utc: string };
  series: SeriesItem[];
  summary: {
    pain_delta: number | null;
    stiffness_delta: number | null;
    sleep_delta: number | null;
    completed_days: number;
  };
  journey_complete: boolean;
};

function formatDayLabel(dayKey: string): string {
  const d = new Date(dayKey + 'T12:00:00Z');
  const month = d.getUTCMonth() + 1;
  const date = d.getUTCDate();
  return `${month}/${date}`;
}

export default function Day7ReportPage() {
  const router = useRouter();
  const [report, setReport] = useState<Day7Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        router.push('/app/auth?next=' + encodeURIComponent('/app/report/day7'));
        return;
      }
      try {
        const res = await fetch('/api/report/day7', {
          cache: 'no-store' as RequestCache,
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body?.error ?? '조회 실패');
          return;
        }
        const data = await res.json();
        setReport(data);
      } catch (e) {
        if (!cancelled) setError('조회 실패');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f6f0] pb-20 flex items-center justify-center">
        <p className="text-slate-600">불러오는 중...</p>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-[#f8f6f0] pb-20 px-4 flex flex-col items-center justify-center gap-4">
        <p className="text-slate-600">{error ?? '데이터를 불러올 수 없습니다.'}</p>
        <Link
          href="/app/home"
          className="rounded-full border-2 border-slate-900 bg-orange-400 px-6 py-3 text-white font-bold"
        >
          홈으로
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f6f0] pb-20">
      <header className="px-4 pt-6 pb-4">
        <h1 className="text-4xl font-bold text-slate-800">7일 리포트</h1>
        <p className="mt-2 text-base text-slate-600">
          {report.journey_complete
            ? '7일 여정을 완료했습니다.'
            : `${report.summary.completed_days}/7일 완료`}
        </p>
      </header>

      <main className="px-4 space-y-6">
        <section className="rounded-2xl border-2 border-slate-900 bg-white p-5 shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
          <h2 className="text-sm font-semibold text-slate-800 mb-3">지난 7일 변화</h2>
          <div className="flex flex-wrap items-center gap-2 text-sm mb-3">
            <span className="inline-flex items-center rounded-lg border-2 border-slate-900 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 shadow-[2px_2px_0_0_rgba(15,23,42,1)]">
              완료 {report.summary.completed_days}/7
            </span>
            {report.summary.pain_delta != null && (
              <span className="text-slate-600">
                통증 {report.summary.pain_delta >= 0 ? '+' : ''}{report.summary.pain_delta}
              </span>
            )}
            {report.summary.stiffness_delta != null && (
              <span className="text-slate-600">
                뻣뻣함 {report.summary.stiffness_delta >= 0 ? '+' : ''}{report.summary.stiffness_delta}
              </span>
            )}
            {report.summary.sleep_delta != null && (
              <span className="text-slate-600">
                수면 {report.summary.sleep_delta >= 0 ? '+' : ''}{report.summary.sleep_delta}
              </span>
            )}
          </div>
          <div className="flex gap-1">
            {report.series.map((day) => (
              <div
                key={day.day_key_utc}
                className="flex-1 min-w-0 flex flex-col items-center rounded-lg border-2 border-slate-900 bg-slate-100 p-2 shadow-[2px_2px_0_0_rgba(15,23,42,1)]"
              >
                <span className="text-[10px] text-slate-600 truncate w-full text-center">
                  {formatDayLabel(day.day_key_utc)}
                </span>
                {day.completed && (
                  <Check className="size-4 text-green-600" strokeWidth={2.5} aria-label="완료" />
                )}
                {(day.pain_today != null || day.stiffness != null) && (
                  <span className="text-xs font-bold text-slate-800">
                    {day.pain_today != null ? day.pain_today : day.stiffness ?? '-'}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>

        {report.journey_complete && (
          <section className="rounded-2xl border-2 border-slate-900 bg-amber-50 p-5 shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
            <h3 className="text-sm font-semibold text-slate-800 mb-3">다음 단계</h3>
            <p className="text-sm text-slate-600 mb-4">
              미니 딥으로 몸의 변화를 간단히 점검해 보세요.
            </p>
            <Link
              href="/app/deep-test?source=day7-mini"
              className="block w-full rounded-full border-2 border-slate-900 bg-orange-400 px-6 py-4 text-center font-bold text-white shadow-[4px_4px_0_0_rgba(15,23,42,1)] hover:opacity-95"
            >
              미니 딥 시작하기
            </Link>
          </section>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
