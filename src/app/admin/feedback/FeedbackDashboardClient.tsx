'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getSessionSafe } from '@/lib/supabase';
import type { AdminFeedbackResponse, FeedbackCategory, FeedbackReportRow, FeedbackStatus } from '@/lib/feedback/types';
import { FEEDBACK_CATEGORY_LABEL_KO, FEEDBACK_STATUS_LABEL_KO } from '@/lib/feedback/labels';

type RangePreset = 7 | 14 | 30;

function getKstDayString(date: Date): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul',
  }).format(date);
}

function addDays(day: string, delta: number): string {
  const [year, month, date] = day.split('-').map(Number);
  const ms = Date.UTC(year, month - 1, date) + delta * 24 * 60 * 60 * 1000;
  return new Date(ms).toISOString().slice(0, 10);
}

function buildRange(days: RangePreset) {
  const to = getKstDayString(new Date());
  const from = addDays(to, -(days - 1));
  return { from, to };
}

function buildQuery(params: Record<string, string | number | null | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === '') continue;
    query.set(key, String(value));
  }
  return query.toString();
}

function badgeColorCategory(cat: FeedbackCategory): string {
  switch (cat) {
    case 'bug':
      return 'bg-red-500/20 text-red-300 border-red-500/40';
    case 'question':
      return 'bg-sky-500/20 text-sky-200 border-sky-500/40';
    case 'improvement':
      return 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40';
    default:
      return 'bg-slate-700 text-slate-200 border-slate-600';
  }
}

function badgeColorStatus(st: FeedbackStatus): string {
  switch (st) {
    case 'new':
      return 'bg-orange-500/20 text-orange-200 border-orange-500/40';
    case 'reviewing':
      return 'bg-amber-500/15 text-amber-200 border-amber-500/35';
    case 'resolved':
      return 'bg-green-500/15 text-green-200 border-green-500/35';
    case 'archived':
      return 'bg-slate-600/40 text-slate-400 border-slate-600';
    default:
      return 'bg-slate-700 text-slate-200 border-slate-600';
  }
}

export default function FeedbackDashboardClient() {
  const router = useRouter();
  const [range, setRange] = useState(buildRange(7));
  const [preset, setPreset] = useState<RangePreset>(7);
  const [categoryFilter, setCategoryFilter] = useState<FeedbackCategory | ''>('');
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | ''>('');
  const [authLoading, setAuthLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AdminFeedbackResponse | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [patchingId, setPatchingId] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { session, error: sessionError } = await getSessionSafe();
      if (sessionError || !session?.access_token) {
        router.push(`/app/auth?next=${encodeURIComponent('/admin/feedback')}`);
        return;
      }

      const authHeader = { Authorization: `Bearer ${session.access_token}` };
      const params: Record<string, string | number> = {
        from: range.from,
        to: range.to,
        limit: 100,
      };
      if (categoryFilter) params.category = categoryFilter;
      if (statusFilter) params.status = statusFilter;

      const res = await fetch(`/api/admin/feedback?${buildQuery(params)}`, {
        headers: authHeader,
        cache: 'no-store',
      });

      if (res.status === 401 || res.status === 403) {
        setIsAdmin(false);
        return;
      }

      if (!res.ok) {
        throw new Error('피드백 목록을 불러오지 못했습니다.');
      }

      const json = (await res.json()) as AdminFeedbackResponse;
      if (!json.ok) {
        throw new Error('피드백 목록 응답이 올바르지 않습니다.');
      }

      setData(json);
      setNoteDrafts((prev) => {
        const next = { ...prev };
        for (const row of json.items) {
          if (next[row.id] === undefined) {
            next[row.id] = row.admin_note ?? '';
          }
        }
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to, categoryFilter, statusFilter, router]);

  useEffect(() => {
    const check = async () => {
      const { session, error: sessionError } = await getSessionSafe();
      if (sessionError || !session?.access_token) {
        router.push(`/app/auth?next=${encodeURIComponent('/admin/feedback')}`);
        return;
      }
      try {
        const res = await fetch('/api/admin/check', {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: 'no-store',
        });
        const body = await res.json();
        setIsAdmin(Boolean(body?.isAdmin));
      } catch {
        setIsAdmin(false);
      } finally {
        setAuthLoading(false);
      }
    };

    void check();
  }, [router]);

  useEffect(() => {
    if (isAdmin) {
      void loadList();
    }
  }, [isAdmin, loadList]);

  async function patchRow(id: string, body: { status?: FeedbackStatus; admin_note?: string | null }) {
    const { session } = await getSessionSafe();
    if (!session?.access_token) {
      router.push(`/app/auth?next=${encodeURIComponent('/admin/feedback')}`);
      return;
    }
    setPatchingId(id);
    try {
      const res = await fetch('/api/admin/feedback', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ id, ...body }),
      });
      if (!res.ok) {
        throw new Error('상태 저장에 실패했습니다.');
      }
      await loadList();
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 오류');
    } finally {
      setPatchingId(null);
    }
  }

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <p className="text-slate-300">관리자 권한 확인 중...</p>
      </div>
    );
  }

  if (isAdmin === false) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-8 text-center">
          <p className="text-slate-300">관리자 권한이 필요합니다.</p>
          <Link
            href="/admin"
            className="mt-4 inline-block rounded-lg bg-slate-800 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700"
          >
            어드민 홈
          </Link>
        </div>
      </div>
    );
  }

  const summary = data?.summary;

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold text-slate-100">사용자 피드백</h1>
          <p className="text-sm text-slate-400">
            파일럿 중 접수된 오류, 질문, 개선 제안을 확인합니다.
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            <Link
              href="/admin/kpi"
              className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700"
            >
              KPI 대시보드
            </Link>
            <Link
              href="/admin"
              className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700"
            >
              어드민 홈
            </Link>
            <button
              type="button"
              onClick={() => void loadList()}
              disabled={loading}
              className="rounded-lg bg-orange-500 px-3 py-2 text-sm font-medium text-white hover:bg-orange-400 disabled:opacity-60"
            >
              새로고침
            </button>
          </div>
        </header>

        {summary ? (
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <p className="text-xs text-slate-500">전체 (이 페이지)</p>
              <p className="mt-1 text-2xl font-semibold text-slate-100">{summary.total}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <p className="text-xs text-slate-500">{FEEDBACK_STATUS_LABEL_KO.new}</p>
              <p className="mt-1 text-2xl font-semibold text-orange-300">{summary.new_count}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <p className="text-xs text-slate-500">{FEEDBACK_CATEGORY_LABEL_KO.bug}</p>
              <p className="mt-1 text-2xl font-semibold text-red-300">{summary.bug_count}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <p className="text-xs text-slate-500">{FEEDBACK_CATEGORY_LABEL_KO.question}</p>
              <p className="mt-1 text-2xl font-semibold text-sky-300">{summary.question_count}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <p className="text-xs text-slate-500">{FEEDBACK_CATEGORY_LABEL_KO.improvement}</p>
              <p className="mt-1 text-2xl font-semibold text-emerald-300">{summary.improvement_count}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <p className="text-xs text-slate-500">{FEEDBACK_CATEGORY_LABEL_KO.general}</p>
              <p className="mt-1 text-2xl font-semibold text-slate-200">{summary.general_count}</p>
            </div>
          </section>
        ) : null}

        <section className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-sm font-medium text-slate-200">필터</p>
          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-slate-500 self-center mr-1">기간</span>
            {([7, 14, 30] as const).map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => {
                  setPreset(days);
                  setRange(buildRange(days));
                }}
                className={`rounded-lg px-3 py-1.5 text-sm ${
                  preset === days ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {days}일
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            <label className="flex flex-col gap-1 text-xs text-slate-400">
              카테고리
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter((e.target.value || '') as FeedbackCategory | '')}
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
              >
                <option value="">전체</option>
                <option value="general">{FEEDBACK_CATEGORY_LABEL_KO.general}</option>
                <option value="bug">{FEEDBACK_CATEGORY_LABEL_KO.bug}</option>
                <option value="question">{FEEDBACK_CATEGORY_LABEL_KO.question}</option>
                <option value="improvement">{FEEDBACK_CATEGORY_LABEL_KO.improvement}</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-400">
              상태
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter((e.target.value || '') as FeedbackStatus | '')}
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
              >
                <option value="">전체</option>
                <option value="new">{FEEDBACK_STATUS_LABEL_KO.new}</option>
                <option value="reviewing">{FEEDBACK_STATUS_LABEL_KO.reviewing}</option>
                <option value="resolved">{FEEDBACK_STATUS_LABEL_KO.resolved}</option>
                <option value="archived">{FEEDBACK_STATUS_LABEL_KO.archived}</option>
              </select>
            </label>
          </div>
        </section>

        {error ? (
          <div className="rounded-xl border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-200">{error}</div>
        ) : null}

        {loading && !data?.items?.length ? (
          <p className="text-sm text-slate-400">불러오는 중...</p>
        ) : null}

        <ul className="space-y-4">
          {(data?.items ?? []).map((row: FeedbackReportRow) => (
            <li
              key={row.id}
              className="rounded-xl border border-slate-800 bg-slate-900/90 p-4 shadow-sm shadow-black/20"
            >
              <div className="flex flex-wrap items-start gap-2">
                <span
                  className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${badgeColorCategory(row.category)}`}
                >
                  {FEEDBACK_CATEGORY_LABEL_KO[row.category]}
                </span>
                <span
                  className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${badgeColorStatus(row.status)}`}
                >
                  {FEEDBACK_STATUS_LABEL_KO[row.status]}
                </span>
                <span className="text-xs text-slate-500 ml-auto">
                  {new Date(row.created_at).toLocaleString('ko-KR')}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-400">
                {row.user_email?.trim() ? row.user_email : 'unknown'}
              </p>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-100">{row.message}</p>
              <p className="mt-2 break-all text-xs text-slate-500">
                referer: {row.referer?.trim() ? row.referer : '—'}
              </p>
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-slate-500">user agent</summary>
                <p className="mt-1 break-all text-xs text-slate-600">{row.user_agent?.trim() ? row.user_agent : '—'}</p>
              </details>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={patchingId === row.id || row.status === 'reviewing'}
                  onClick={() => void patchRow(row.id, { status: 'reviewing' })}
                  className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700 disabled:opacity-40"
                >
                  확인 중
                </button>
                <button
                  type="button"
                  disabled={patchingId === row.id || row.status === 'resolved'}
                  onClick={() => void patchRow(row.id, { status: 'resolved' })}
                  className="rounded-lg bg-emerald-700/80 px-3 py-1.5 text-xs text-white hover:bg-emerald-600 disabled:opacity-40"
                >
                  처리 완료
                </button>
                <button
                  type="button"
                  disabled={patchingId === row.id || row.status === 'archived'}
                  onClick={() => void patchRow(row.id, { status: 'archived' })}
                  className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-600 disabled:opacity-40"
                >
                  보관
                </button>
              </div>

              <div className="mt-4 space-y-2 border-t border-slate-800 pt-4">
                <label className="block text-xs text-slate-500">메모 (관리자)</label>
                <textarea
                  value={noteDrafts[row.id] ?? ''}
                  onChange={(e) =>
                    setNoteDrafts((prev) => ({
                      ...prev,
                      [row.id]: e.target.value,
                    }))
                  }
                  rows={2}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600"
                  placeholder="내부 메모"
                />
                <button
                  type="button"
                  disabled={patchingId === row.id}
                  onClick={() =>
                    void patchRow(row.id, {
                      admin_note: (noteDrafts[row.id] ?? '').trim() || null,
                    })
                  }
                  className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700 disabled:opacity-40"
                >
                  메모 저장
                </button>
              </div>
            </li>
          ))}
        </ul>

        {!loading && data && data.items.length === 0 ? (
          <p className="text-sm text-slate-500">조건에 맞는 피드백이 없습니다.</p>
        ) : null}
      </div>
    </div>
  );
}
