'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { NeoCard, NeoButton } from '@/components/neobrutalism';
import BottomNav from '../_components/BottomNav';
import { CheckInModal } from '../_components/CheckInModal';

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get('next');
  const postWorkout = searchParams.get('postWorkout') === '1';
  const [isPostWorkoutContext, setIsPostWorkoutContext] = useState(false);
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [reportLoading, setReportLoading] = useState(true);
  const [reportError, setReportError] = useState<string | null>(null);
  const [showConditionModal, setShowConditionModal] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchReport = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setReportLoading(false);
      return;
    }
    console.log('[CHECKIN_REPORT_FETCH_START]');
    try {
      const res = await fetch('/api/report/weekly', {
        cache: 'no-store' as RequestCache,
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setReportError(body?.error || '조회 실패');
        console.log('[CHECKIN_REPORT_FETCH_FAIL]', { status: res.status });
        return;
      }
      const data = await res.json();
      setReport(data);
      setReportError(null);
      console.log('[CHECKIN_REPORT_FETCH_SUCCESS]');
    } catch (e) {
      setReportError('조회 실패');
      console.log('[CHECKIN_REPORT_FETCH_FAIL]', { error: String(e) });
    } finally {
      setReportLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setReportLoading(false);
        return;
      }
      await fetchReport();
      if (cancelled) return;
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (report && !reportLoading) {
      console.log('[CHECKIN_REPORT_RENDER]', { completed_days: report.summary.completed_days });
    }
  }, [report, reportLoading]);

  /** 저장 성공 시 "저장 완료" 표시 후 next 또는 /app/routine으로 리다이렉트 */
  useEffect(() => {
    if (!saveSuccess) return;
    const target = nextUrl || '/app/routine';
    const t = setTimeout(() => {
      setShowConditionModal(false);
      setSaveSuccess(false);
      router.replace(target);
      fetchReport();
    }, 1500);
    return () => clearTimeout(t);
  }, [saveSuccess, nextUrl, router]);

  /** postWorkout=1일 때만: 오늘 컨디션 없으면 모달 자동 오픈, 있으면 스킵. URL에서 postWorkout 제거로 중복 방지 */
  useEffect(() => {
    if (!postWorkout) return;
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token || cancelled) return;
      console.log('[CHECKIN_TODAY_FETCH_START]', { source: 'postWorkout' });
      try {
        const res = await fetch('/api/daily-condition/today', {
          cache: 'no-store' as RequestCache,
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (cancelled) return;
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          console.log('[CHECKIN_TODAY_FETCH_FAIL]', { status: res.status });
          return;
        }
        const condition = data?.condition ?? null;
        if (condition) {
          console.log('[CHECKIN_TODAY_FETCH_SUCCESS]', { hasCondition: true });
        } else {
          console.log('[CHECKIN_TODAY_FETCH_EMPTY]');
        }
        const cleanPath = '/app/checkin' + (nextUrl ? `?next=${encodeURIComponent(nextUrl)}` : '');
        router.replace(cleanPath);
        if (cancelled) return;
        if (!condition) {
          setIsPostWorkoutContext(true);
          setShowConditionModal(true);
          console.log('[CHECKIN_MODAL_AUTO_OPEN]', { source: 'postWorkout' });
        }
      } catch (e) {
        if (cancelled) return;
        console.log('[CHECKIN_TODAY_FETCH_FAIL]', { error: String(e) });
        router.replace('/app/checkin' + (nextUrl ? `?next=${encodeURIComponent(nextUrl)}` : ''));
      }
    })();
    return () => { cancelled = true; };
  }, [postWorkout, nextUrl, router]);

  const handleConditionSubmit = async (values: {
    pain_today?: number | null;
    stiffness?: number | null;
    sleep?: number | null;
    time_available_min?: number | null;
    equipment_available?: string[];
  }) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;
    setIsSubmitting(true);
    setSaveError(null);
    const payload = {
      ...values,
      source: isPostWorkoutContext ? 'post_workout' : 'checkin',
    };
    try {
      const res = await fetch('/api/daily-condition/upsert', {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveError(body?.error ?? body?.details ?? '저장에 실패했습니다.');
        return;
      }
      setSaveError(null);
      setSaveSuccess(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : '저장에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f6f0] pb-20">
      {/* A) PageHeader - 통합 UI 스타일 */}
      <header className="px-4 pt-6 pb-4">
        <h1 className="text-4xl font-bold text-slate-800">기록</h1>
        <p className="mt-2 text-base text-slate-600">지난 7일 변화와 완료 기록</p>
      </header>

      <main className="px-4 space-y-6">
        {/* B) Weekly Report Card - NeoCard */}
        <NeoCard className="p-5">
          <h2 className="text-sm font-semibold text-slate-800 mb-3">7일 변화</h2>
          {reportLoading && (
            <p className="text-sm text-slate-600">불러오는 중...</p>
          )}
          {reportError && !reportLoading && (
            <p className="text-sm text-slate-600">{reportError}</p>
          )}
          {report && !reportLoading && (
            <>
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
                      <span className="text-green-600 font-bold text-sm" aria-label="완료">✓</span>
                    )}
                    {(day.pain_today != null || day.stiffness != null) && (
                      <span className="text-xs font-bold text-slate-800">
                        {day.pain_today != null ? day.pain_today : day.stiffness ?? '-'}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </NeoCard>

        {/* C) Daily Condition Log - CTA */}
        <NeoCard className="p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">오늘 컨디션</h3>
          <NeoButton
            variant="orange"
            fullWidth
            onClick={() => setShowConditionModal(true)}
            className="py-3"
          >
            오늘 컨디션 입력하기
          </NeoButton>
        </NeoCard>
      </main>

      {showConditionModal && (
        <CheckInModal
          isPostWorkout={isPostWorkoutContext}
          submitLabel={nextUrl ? '저장 후 계속하기' : '저장'}
          isSubmitting={isSubmitting}
          onSubmit={handleConditionSubmit}
          onSkip={() => {
            setShowConditionModal(false);
            setSaveError(null);
            setIsPostWorkoutContext(false);
          }}
          onClose={() => {
            setShowConditionModal(false);
            setSaveError(null);
            setIsPostWorkoutContext(false);
          }}
          saveError={saveError}
          saveSuccess={saveSuccess}
        />
      )}

      <BottomNav />
    </div>
  );
}
