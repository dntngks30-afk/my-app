'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

type TemplateRow = {
  id: string;
  name: string;
  level: number;
  focus_tags: string[];
  contraindications: string[];
  equipment: string[];
  duration_sec: number | null;
  is_active: boolean;
  updated_at: string | null;
};

export default function AdminTemplatesPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isAdminUser, setIsAdminUser] = useState<boolean | null>(null);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [level, setLevel] = useState<string>('');
  const [sort, setSort] = useState('updated_at');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/app/auth?next=' + encodeURIComponent('/admin/templates'));
        return;
      }
      setIsAuthorized(true);

      const res = await fetch('/api/admin/check', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const { isAdmin: ok } = await res.json();
      if (!ok) {
        setIsAdminUser(false);
      } else {
        setIsAdminUser(true);
      }
    };
    checkAuth();
  }, [router]);

  useEffect(() => {
    if (!isAuthorized || !isAdminUser) return;

    const fetchList = async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;

        const params = new URLSearchParams();
        if (q) params.set('q', q);
        if (status !== 'all') params.set('status', status);
        if (level) params.set('level', level);
        params.set('sort', sort);
        params.set('order', order);
        params.set('limit', '50');

        const res = await fetch(`/api/admin/templates?${params}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: 'no-store',
        });

        if (res.status === 403) {
          setIsAdminUser(false);
          return;
        }
        const data = await res.json();
        setTemplates(data.templates ?? []);
        setTotal(data.total ?? 0);
      } catch (err) {
        console.error('templates fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchList();
  }, [isAuthorized, isAdminUser, q, status, level, sort, order]);

  if (!isAuthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <p className="text-slate-300">권한 확인 중...</p>
      </div>
    );
  }

  if (isAdminUser === false) {
    return (
      <div className="min-h-screen bg-slate-950 p-6 flex flex-col items-center justify-center">
        <p className="text-red-400 mb-4">관리자 권한이 없습니다.</p>
        <button
          onClick={() => router.push('/admin')}
          className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700"
        >
          관리자 홈으로
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="flex size-10 items-center justify-center rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
              aria-label="뒤로가기"
            >
              <ArrowLeft className="size-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-100">템플릿 운영 콘솔</h1>
              <p className="text-sm text-slate-400">exercise_templates 메타 수정</p>
            </div>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap gap-4 rounded-xl border border-slate-800 bg-slate-900 p-4">
          <div className="flex items-center gap-2">
            <Search className="size-4 text-slate-400" />
            <input
              type="text"
              placeholder="검색 (name, id)"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
          >
            <option value="all">전체 상태</option>
            <option value="active">active</option>
            <option value="inactive">inactive</option>
          </select>
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
          >
            <option value="">전체 레벨</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
          </select>
          <select
            value={`${sort}-${order}`}
            onChange={(e) => {
              const [s, o] = e.target.value.split('-');
              setSort(s);
              setOrder(o as 'asc' | 'desc');
            }}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
          >
            <option value="updated_at-desc">최신순</option>
            <option value="updated_at-asc">오래된순</option>
            <option value="name-asc">이름 A-Z</option>
            <option value="name-desc">이름 Z-A</option>
            <option value="level-asc">레벨 낮은순</option>
            <option value="level-desc">레벨 높은순</option>
          </select>
        </div>

        {loading ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-8 text-center text-slate-400">
            로딩 중...
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="px-4 py-3 text-slate-400">ID</th>
                  <th className="px-4 py-3 text-slate-400">이름</th>
                  <th className="px-4 py-3 text-slate-400">레벨</th>
                  <th className="px-4 py-3 text-slate-400">상태</th>
                  <th className="px-4 py-3 text-slate-400">수정일</th>
                  <th className="px-4 py-3 text-slate-400"></th>
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => (
                  <tr key={t.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="px-4 py-3 font-mono text-slate-300">{t.id}</td>
                    <td className="px-4 py-3 text-slate-100">{t.name}</td>
                    <td className="px-4 py-3 text-slate-400">{t.level}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-2 py-0.5 text-xs ${
                          t.is_active ? 'bg-green-900/50 text-green-400' : 'bg-slate-700 text-slate-400'
                        }`}
                      >
                        {t.is_active ? 'active' : 'inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {t.updated_at ? new Date(t.updated_at).toLocaleString('ko-KR') : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/templates/${t.id}`}
                        className="text-orange-400 hover:underline"
                      >
                        상세
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t border-slate-800 px-4 py-2 text-slate-500 text-xs">
              총 {total}건
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
