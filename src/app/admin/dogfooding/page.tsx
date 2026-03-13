'use client';

/**
 * Admin: Dogfooding / Launch Ops — User journey snapshot
 * Search by email or userId, inspect one user's core journey.
 */

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSessionSafe } from '@/lib/supabase';
import type { UserSnapshotResponse } from '@/app/api/admin/dogfooding/user-snapshot/route';

export const dynamic = 'force-dynamic';

export default function AdminDogfoodingPage() {
  const router = useRouter();
  const [searchEmail, setSearchEmail] = useState('');
  const [searchUserId, setSearchUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<UserSnapshotResponse | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    const check = async () => {
      const { session, error: sessionError } = await getSessionSafe();
      if (sessionError || !session) {
        router.push('/app/auth?next=' + encodeURIComponent('/admin/dogfooding'));
        return;
      }
      try {
        const res = await fetch('/api/admin/check', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const { isAdmin: ok } = await res.json();
        setIsAdmin(!!ok);
      } catch {
        setIsAdmin(false);
      } finally {
        setAuthLoading(false);
      }
    };
    check();
  }, [router]);

  const checkAdmin = useCallback(async () => {
    const { session } = await getSessionSafe();
    if (!session?.access_token) {
      router.push('/app/auth?next=' + encodeURIComponent('/admin/dogfooding'));
      return false;
    }
    try {
      const res = await fetch('/api/admin/check', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const { isAdmin: ok } = await res.json();
      setIsAdmin(!!ok);
      return !!ok;
    } catch {
      setIsAdmin(false);
      return false;
    }
  }, [router]);

  const handleSearch = async () => {
    if (!searchEmail.trim() && !searchUserId.trim()) {
      setError('이메일 또는 사용자 ID를 입력하세요.');
      return;
    }
    const ok = await checkAdmin();
    if (!ok) return;

    setLoading(true);
    setError(null);
    setSnapshot(null);
    try {
      const { session } = await getSessionSafe();
      if (!session?.access_token) {
        setError('로그인이 필요합니다.');
        return;
      }
      const params = new URLSearchParams();
      if (searchEmail.trim()) params.set('email', searchEmail.trim());
      if (searchUserId.trim()) params.set('userId', searchUserId.trim());
      const res = await fetch(
        `/api/admin/dogfooding/user-snapshot?${params.toString()}`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message ?? data?.error ?? '조회 실패');
        return;
      }
      if (data.ok) {
        setSnapshot(data);
      } else {
        setError(data?.message ?? '조회 실패');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '네트워크 오류');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <p className="text-slate-300">권한 확인 중...</p>
      </div>
    );
  }

  if (isAdmin === false) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-8 text-center">
          <p className="text-slate-300">관리자 권한이 없습니다.</p>
          <Link
            href="/admin"
            className="mt-4 inline-block rounded-lg bg-slate-800 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700"
          >
            관리자 대시보드
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">도그푸딩 / 런칭 Ops</h1>
            <p className="mt-1 text-sm text-slate-400">
              사용자별 여정 스냅샷 — Deep Test, 세션, 피드백, 적응형 요약 검수
            </p>
          </div>
          <Link
            href="/admin"
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700"
          >
            관리자 대시보드
          </Link>
        </div>

        <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900 p-4">
          <h2 className="mb-3 text-lg font-semibold text-slate-100">검색</h2>
          <div className="flex flex-wrap gap-3">
            <input
              type="email"
              placeholder="이메일"
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 placeholder:text-slate-500 w-64"
            />
            <input
              type="text"
              placeholder="사용자 ID (UUID)"
              value={searchUserId}
              onChange={(e) => setSearchUserId(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 placeholder:text-slate-500 w-64"
            />
            <button
              onClick={handleSearch}
              disabled={loading}
              className="rounded-lg bg-[#f97316] px-4 py-2 font-medium text-white hover:bg-[#fb923c] disabled:opacity-60"
            >
              {loading ? '조회 중...' : '조회'}
            </button>
          </div>
          {error && (
            <p className="mt-2 text-sm text-red-400">{error}</p>
          )}
        </div>

        {snapshot && (
          <div className="space-y-4">
            {snapshot.triageFlags.length > 0 && (
              <div className="rounded-xl border border-amber-700/50 bg-amber-950/30 p-4">
                <h3 className="mb-2 font-semibold text-amber-200">Triage 플래그</h3>
                <div className="flex flex-wrap gap-2">
                  {snapshot.triageFlags.map((f) => (
                    <span
                      key={f}
                      className="rounded-full bg-amber-500/20 px-3 py-1 text-sm text-amber-300"
                    >
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <Section title="A. User Summary">
              {snapshot.user ? (
                <pre className="overflow-x-auto rounded-lg bg-slate-800 p-4 text-sm text-slate-300">
                  {JSON.stringify(snapshot.user, null, 2)}
                </pre>
              ) : (
                <p className="text-slate-500">유저 없음</p>
              )}
            </Section>

            <Section title="B. Deep Test Snapshot">
              {snapshot.deepTest ? (
                <pre className="overflow-x-auto rounded-lg bg-slate-800 p-4 text-sm text-slate-300">
                  {JSON.stringify(
                    {
                      ...snapshot.deepTest,
                      scores: snapshot.deepTest.scores
                        ? '(present)'
                        : null,
                    },
                    null,
                    2
                  )}
                </pre>
              ) : (
                <p className="text-slate-500">Deep Test 없음</p>
              )}
            </Section>

            <Section title="C. Session Journey (최근 5개)">
              {snapshot.sessions.length > 0 ? (
                <div className="space-y-2">
                  {snapshot.sessions.map((s) => (
                    <div
                      key={s.session_number}
                      className="rounded-lg border border-slate-700 bg-slate-800 p-3 text-sm"
                    >
                      <span className="font-medium text-slate-200">
                        #{s.session_number}
                      </span>{' '}
                      {s.status} · {s.theme}
                      {s.completed_at && (
                        <span className="text-slate-500">
                          {' '}
                          · 완료 {new Date(s.completed_at).toLocaleDateString('ko-KR')}
                        </span>
                      )}
                      {s.adaptation_summary && (
                        <p className="mt-1 text-xs text-slate-400">
                          적응: {s.adaptation_summary}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500">세션 없음</p>
              )}
            </Section>

            <Section title="D. Latest Feedback">
              {snapshot.feedback ? (
                <pre className="overflow-x-auto rounded-lg bg-slate-800 p-4 text-sm text-slate-300">
                  {JSON.stringify(snapshot.feedback, null, 2)}
                </pre>
              ) : (
                <p className="text-slate-500">피드백 없음</p>
              )}
            </Section>

            <Section title="E. Latest Adaptive Summary">
              {snapshot.adaptiveSummary ? (
                <pre className="overflow-x-auto rounded-lg bg-slate-800 p-4 text-sm text-slate-300">
                  {JSON.stringify(snapshot.adaptiveSummary, null, 2)}
                </pre>
              ) : (
                <p className="text-slate-500">적응형 요약 없음</p>
              )}
            </Section>

            <Section title="F. Admin Audit (최근 5개)">
              {snapshot.adminActions.length > 0 ? (
                <div className="space-y-2">
                  {snapshot.adminActions.map((a, i) => (
                    <div
                      key={i}
                      className="rounded-lg border border-slate-700 bg-slate-800 p-3 text-sm"
                    >
                      <span className="font-medium text-slate-200">{a.action}</span>{' '}
                      · {a.reason}
                      <p className="mt-1 text-xs text-slate-500">
                        {new Date(a.created_at).toLocaleString('ko-KR')}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500">관리자 변경 이력 없음</p>
              )}
            </Section>
          </div>
        )}

        {!snapshot && !loading && (
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-8 text-center">
            <p className="text-slate-400">
              이메일 또는 사용자 ID로 검색하여 여정 스냅샷을 확인하세요.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              docs/ops/dogfooding-runbook.md 참조
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <h3 className="mb-3 font-semibold text-slate-200">{title}</h3>
      {children}
    </div>
  );
}
