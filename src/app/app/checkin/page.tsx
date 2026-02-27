'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import AppHeader from '../_components/AppHeader';
import BottomNav from '../_components/BottomNav';

type SeriesItem = {
  day_key_utc: string;
  pain_today: number | null;
  stiffness: number | null;
  sleep: number | null;
  completed: boolean;
};

type WeeklyReport = {
  server_now_utc: string;
  range: { start_day_key_utc: string; end_day_key_utc: string };
  series: SeriesItem[];
  summary: {
    pain_delta: number | null;
    stiffness_delta: number | null;
    sleep_delta: number | null;
    completed_days: number;
  };
};

function formatDayLabel(dayKey: string): string {
  const d = new Date(dayKey + 'T12:00:00Z');
  const month = d.getUTCMonth() + 1;
  const date = d.getUTCDate();
  return `${month}/${date}`;
}

export default function CheckinPage() {
  const [sliderValue, setSliderValue] = useState(50);
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [reportLoading, setReportLoading] = useState(true);
  const [reportError, setReportError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchReport() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          if (!cancelled) setReportLoading(false);
          return;
        }
        const res = await fetch('/api/report/weekly', {
          cache: 'no-store' as RequestCache,
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setReportError(body?.error || '조회 실패');
          setReportLoading(false);
          return;
        }
        const data = await res.json();
        setReport(data);
        setReportError(null);
        console.log('[REPORT_WEEKLY_RENDER]', {
          summary: data.summary,
          completed_days: data.summary?.completed_days,
        });
      } catch (e) {
        if (!cancelled) {
          setReportError('조회 실패');
          console.error('[REPORT_WEEKLY_RENDER]', e);
        }
      } finally {
        if (!cancelled) setReportLoading(false);
      }
    }
    fetchReport();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg)] pb-20">
      <AppHeader title="출석" />
      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* 7일 변화 리포트 */}
        <section className="rounded-[var(--radius)] bg-[var(--surface)] border border-[color:var(--border)] shadow-[var(--shadow-0)] p-4">
          <h2
            className="text-base font-semibold text-[var(--text)] mb-3"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            7일 변화
          </h2>
          {reportLoading && (
            <p className="text-sm text-[var(--muted)]">불러오는 중...</p>
          )}
          {reportError && !reportLoading && (
            <p className="text-sm text-[var(--muted)]">{reportError}</p>
          )}
          {report && !reportLoading && (
            <>
              <div className="flex flex-wrap items-center gap-2 text-sm mb-3">
                <span className="rounded-full border border-[color:var(--border)] bg-[var(--surface-2)] px-2 py-0.5 font-medium text-[var(--text)]">
                  완료 {report.summary.completed_days}/7
                </span>
                {report.summary.pain_delta != null && (
                  <span className="text-[var(--muted)]">
                    통증 {report.summary.pain_delta >= 0 ? '+' : ''}{report.summary.pain_delta}
                  </span>
                )}
                {report.summary.stiffness_delta != null && (
                  <span className="text-[var(--muted)]">
                    뻣뻣함 {report.summary.stiffness_delta >= 0 ? '+' : ''}{report.summary.stiffness_delta}
                  </span>
                )}
                {report.summary.sleep_delta != null && (
                  <span className="text-[var(--muted)]">
                    수면 {report.summary.sleep_delta >= 0 ? '+' : ''}{report.summary.sleep_delta}
                  </span>
                )}
              </div>
              <div className="flex gap-1">
                {report.series.map((day) => (
                  <div
                    key={day.day_key_utc}
                    className="flex-1 min-w-0 flex flex-col items-center rounded border border-[color:var(--border)] bg-[var(--surface-2)] p-2"
                  >
                    <span className="text-[10px] text-[var(--muted)] truncate w-full text-center">
                      {formatDayLabel(day.day_key_utc)}
                    </span>
                    {day.completed && (
                      <span className="text-green-600 font-bold text-sm" aria-label="완료">✓</span>
                    )}
                    {(day.pain_today != null || day.stiffness != null) && (
                      <span className="text-xs font-medium text-[var(--text)]">
                        {day.pain_today != null ? day.pain_today : day.stiffness != null ? day.stiffness : '-'}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        <section className="rounded-[var(--radius)] bg-[var(--surface)] border border-[color:var(--border)] shadow-[var(--shadow-0)] p-6">
          <h2
            className="text-base font-semibold text-[var(--text)] mb-4"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            오늘 운동은 어떠셨나요?
          </h2>
          <div className="space-y-4">
            <div className="flex justify-between text-sm text-[var(--muted)]">
              <span>쉬웠어요</span>
              <span>적당해요</span>
              <span>힘들었어요</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={sliderValue}
              onChange={(e) => setSliderValue(Number(e.target.value))}
              className="w-full h-3 rounded-full appearance-none bg-[var(--surface-2)] accent-[var(--brand)]"
            />
            <p className="text-center text-sm text-[var(--muted)]">
              {sliderValue < 33 ? '쉬웠어요' : sliderValue < 66 ? '적당해요' : '힘들었어요'}
            </p>
          </div>
          <button
            type="button"
            className="mt-6 w-full rounded-[var(--radius)] bg-[var(--brand)] py-3 text-sm font-medium text-white"
          >
            출석 완료
          </button>
        </section>
      </main>
      <BottomNav />
    </div>
  );
}
