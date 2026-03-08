'use client';

/**
 * PR-P2-2: 4세션 변화 리포트 카드 (최소 UI foundation)
 * 진행 상황 요약만. 진단/치료 표현 금지.
 */

import { useState, useEffect } from 'react';
import { getSessionSafe } from '@/lib/supabase';
import { getProgressReport, type ProgressWindowReport } from '@/lib/session/client';

export default function ProgressReportCard() {
  const [report, setReport] = useState<ProgressWindowReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { session } = await getSessionSafe();
      if (!session?.access_token || cancelled) {
        if (!cancelled) setLoading(false);
        return;
      }
      try {
        const result = await getProgressReport(session.access_token);
        if (cancelled) return;
        if (result.ok) {
          setReport(result.data);
          setError(null);
        } else {
          setReport(null);
          setError(result.error?.message ?? '로드 실패');
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '로드 실패');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <section className="rounded-2xl border-2 border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-800">진행 요약</h3>
        <div className="mt-3 h-16 animate-pulse rounded-lg bg-slate-100" />
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-2xl border-2 border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-800">진행 요약</h3>
        <p className="mt-2 text-sm text-slate-500">{error}</p>
      </section>
    );
  }

  if (!report) return null;

  const { summary, current, sufficient_data } = report;

  return (
    <section className="rounded-2xl border-2 border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-800">진행 요약</h3>
      <p className="mt-2 text-sm text-slate-700">{summary.headline}</p>
      {sufficient_data && summary.bullets.length > 0 && (
        <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-600">
          {summary.bullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      )}
      {summary.caution && (
        <p className="mt-2 text-xs text-amber-700">{summary.caution}</p>
      )}
      {sufficient_data && current.top_problem_exercises && current.top_problem_exercises.length > 0 && (
        <p className="mt-2 text-xs text-slate-500">
          특정 운동에서 부담 신호 {current.top_problem_exercises.length}건
        </p>
      )}
    </section>
  );
}
