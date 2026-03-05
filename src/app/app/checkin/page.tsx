'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { getSessionSafe } from '@/lib/supabase';
import { NeoCard } from '@/components/neobrutalism';
import BottomNav from '../_components/BottomNav';
import { getSessionHistory } from '@/lib/session/client';
import type { SessionHistoryItem, ExerciseLogItem } from '@/lib/session/client';
import { StatsViewV2 } from '../_components/nav-v2/StatsViewV2';

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

const ORDINAL_KO: Record<number, string> = {
  1: '첫번째', 2: '두번째', 3: '세번째', 4: '네번째', 5: '다섯번째',
  6: '여섯번째', 7: '일곱번째', 8: '여덟번째', 9: '아홉번째', 10: '열번째',
  11: '열한번째', 12: '열두번째', 13: '열세번째', 14: '열네번째', 15: '열다섯번째',
  16: '열여섯번째', 17: '열일곱번째', 18: '열여덟번째', 19: '열아홉번째', 20: '스무번째',
};

function getOrdinalLabel(n: number): string {
  return ORDINAL_KO[n] ?? `${n}번째 움직임`;
}

function formatDuration(seconds: number | null): string {
  if (seconds == null) return '-';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}분 ${s}초` : `${m}분`;
}

function formatCompletedAt(iso: string): string {
  try {
    const d = new Date(iso);
    const month = d.getMonth() + 1;
    const date = d.getDate();
    const hour = d.getHours();
    const min = d.getMinutes();
    return `${month}/${date} ${hour}:${String(min).padStart(2, '0')}`;
  } catch {
    return iso;
  }
}

export default function CheckinPage() {
  const searchParams = useSearchParams();
  const focusSession = searchParams.get('focusSession');
  const focusSessionNum = focusSession ? parseInt(focusSession, 10) : null;
  const isProd = process.env.NODE_ENV === 'production';
  const navV2 = isProd ? true : searchParams.get('navV2') !== '0';

  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [reportLoading, setReportLoading] = useState(true);
  const [reportError, setReportError] = useState<string | null>(null);
  const [sessionItems, setSessionItems] = useState<SessionHistoryItem[]>([]);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [expandedSession, setExpandedSession] = useState<number | null>(null);
  const [completedSessions, setCompletedSessions] = useState(0);
  const focusRef = useRef<HTMLDivElement>(null);

  const fetchReport = async () => {
    const { session } = await getSessionSafe();
    if (!session?.access_token) {
      setReportLoading(false);
      return;
    }
    try {
      const res = await fetch('/api/report/weekly', {
        cache: 'no-store' as RequestCache,
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setReportError(body?.error || '조회 실패');
        return;
      }
      const data = await res.json();
      setReport(data);
      setReportError(null);
    } catch (e) {
      setReportError('조회 실패');
    } finally {
      setReportLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { session } = await getSessionSafe();
      if (!session?.access_token) {
        setReportLoading(false);
        setSessionLoading(false);
        return;
      }
      await fetchReport();
      if (cancelled) return;

      const result = await getSessionHistory(session.access_token, 20);
      if (cancelled) return;
      if (result.ok) {
        setSessionItems(result.data.items);
        setCompletedSessions(result.data.progress?.completed_sessions ?? result.data.items.length);
        setSessionError(null);
      } else {
        setSessionError(result.error.message);
      }
      setSessionLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (focusSessionNum != null && sessionItems.length > 0 && !sessionLoading) {
      const exists = sessionItems.some((i) => i.session_number === focusSessionNum);
      if (exists) {
        setExpandedSession(focusSessionNum);
      }
    }
  }, [focusSessionNum, sessionItems, sessionLoading]);

  useEffect(() => {
    if (expandedSession != null && focusRef.current) {
      focusRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [expandedSession]);

  if (navV2) {
    return (
      <div className="min-h-screen bg-white pb-20">
        <header className="px-4 pt-6 pb-4 border-b border-slate-100">
          <h1 className="text-2xl font-bold text-slate-800">여정</h1>
          <p className="mt-1 text-sm text-slate-500">나의 리셋 진행 현황</p>
        </header>
        <main className="overflow-y-auto">
          <StatsViewV2
            completed={completedSessions}
            currentSession={completedSessions + 1}
          />
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f6f0] pb-20">
      <header className="px-4 pt-6 pb-4">
        <h1 className="text-4xl font-bold text-slate-800">기록</h1>
        <p className="mt-2 text-base text-slate-600">지난 7일 변화와 완료 기록</p>
      </header>

      <main className="px-4 space-y-6">
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

        <NeoCard className="p-5">
          <h2 className="text-sm font-semibold text-slate-800 mb-3">세션 기록</h2>
          {sessionLoading && (
            <p className="text-sm text-slate-600">불러오는 중...</p>
          )}
          {sessionError && !sessionLoading && (
            <p className="text-sm text-slate-600">{sessionError}</p>
          )}
          {!sessionLoading && sessionItems.length === 0 && !sessionError && (
            <p className="text-sm text-slate-600">완료된 세션이 없습니다.</p>
          )}
          {!sessionLoading && sessionItems.length > 0 && (
            <div className="space-y-3">
              {sessionItems.map((item) => {
                const isExpanded = expandedSession === item.session_number;
                const title = getOrdinalLabel(item.session_number);
                return (
                  <div
                    key={item.session_number}
                    ref={item.session_number === focusSessionNum ? focusRef : undefined}
                    className="rounded-xl border-2 border-stone-200 bg-white overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedSession(isExpanded ? null : item.session_number)}
                      className="w-full flex items-center justify-between p-4 text-left hover:bg-stone-50 transition"
                    >
                      <div>
                        <p className="text-sm font-bold text-slate-800">{title}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {formatCompletedAt(item.completed_at)} · {formatDuration(item.duration_seconds)}
                        </p>
                      </div>
                      <span className="text-slate-400 text-sm">
                        {isExpanded ? '▲' : '▼'}
                      </span>
                    </button>
                    {isExpanded && item.exercise_logs && item.exercise_logs.length > 0 && (
                      <div className="px-4 pb-4 pt-0 border-t border-stone-100">
                        <ul className="space-y-2 mt-3">
                          {(item.exercise_logs as ExerciseLogItem[]).map((log, i) => (
                            <li key={i} className="text-sm text-slate-700">
                              {log.name}
                              {(log.sets != null || log.reps != null) && (
                                <span className="text-slate-600 ml-1">
                                  · {log.sets ?? '-'}×{log.reps ?? '-'}
                                </span>
                              )}
                              {log.difficulty != null && (
                                <span className="text-slate-600 ml-1">· 난이도 {log.difficulty}</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </NeoCard>
      </main>

      <BottomNav />
    </div>
  );
}
