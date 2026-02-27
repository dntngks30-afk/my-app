'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, RotateCcw } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

type TemplateDetail = {
  id: string;
  name: string;
  level: number;
  focus_tags: string[];
  contraindications: string[];
  equipment: string[];
  duration_sec: number | null;
  media_ref: unknown;
  is_active: boolean;
  scoring_version: string;
  updated_at: string | null;
};

export default function AdminTemplateDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isAdminUser, setIsAdminUser] = useState<boolean | null>(null);
  const [template, setTemplate] = useState<TemplateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [form, setForm] = useState({
    name: '',
    level: 1,
    focus_tags: '',
    contraindications: '',
    equipment: '',
    duration_sec: 300,
    media_ref_raw: '',
  });

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/app/auth?next=' + encodeURIComponent(`/admin/templates/${id}`));
        return;
      }
      setIsAuthorized(true);

      const res = await fetch('/api/admin/check', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const { isAdmin: ok } = await res.json();
      setIsAdminUser(!!ok);
    };
    checkAuth();
  }, [router, id]);

  useEffect(() => {
    if (!isAuthorized || !isAdminUser || !id) return;

    const fetchDetail = async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;

        const res = await fetch(`/api/admin/templates/${id}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: 'no-store',
        });

        if (res.status === 403) {
          setIsAdminUser(false);
          return;
        }
        if (res.status === 404) {
          setTemplate(null);
          return;
        }

        const data = await res.json();
        const t = data.template;
        setTemplate(t);
        setForm({
          name: t.name ?? '',
          level: t.level ?? 1,
          focus_tags: Array.isArray(t.focus_tags) ? t.focus_tags.join(', ') : '',
          contraindications: Array.isArray(t.contraindications) ? t.contraindications.join(', ') : '',
          equipment: Array.isArray(t.equipment) ? t.equipment.join(', ') : '',
          duration_sec: t.duration_sec ?? 300,
          media_ref_raw: t.media_ref ? JSON.stringify(t.media_ref, null, 2) : '',
        });
      } catch (err) {
        console.error('template fetch error:', err);
        setTemplate(null);
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [isAuthorized, isAdminUser, id]);

  const handleToggleStatus = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token || !template) return;

    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/templates/${id}/toggle-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: '{}',
        cache: 'no-store',
      });
      const data = await res.json();

      if (res.ok) {
        setTemplate((prev) => (prev ? { ...prev, is_active: data.is_active } : null));
        setMessage({ type: 'success', text: `상태가 ${data.is_active ? 'active' : 'inactive'}(으)로 변경되었습니다.` });
      } else {
        setMessage({ type: 'error', text: data.error || '토글 실패' });
      }
    } catch {
      setMessage({ type: 'error', text: '네트워크 오류' });
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;

    let mediaRef: unknown = null;
    if (form.media_ref_raw.trim()) {
      try {
        mediaRef = JSON.parse(form.media_ref_raw);
      } catch {
        setMessage({ type: 'error', text: 'media_ref JSON 형식이 올바르지 않습니다.' });
        return;
      }
    }

    setSaving(true);
    setMessage(null);
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        level: form.level,
        focus_tags: form.focus_tags.split(',').map((s) => s.trim()).filter(Boolean),
        contraindications: form.contraindications.split(',').map((s) => s.trim()).filter(Boolean),
        equipment: form.equipment.split(',').map((s) => s.trim()).filter(Boolean),
        duration_sec: form.duration_sec,
        media_ref: mediaRef,
      };

      const res = await fetch(`/api/admin/templates/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
        cache: 'no-store',
      });
      const data = await res.json();

      if (res.ok) {
        setTemplate((prev) => (prev ? { ...prev, ...data.template } : data.template));
        setMessage({ type: 'success', text: '저장되었습니다.' });
      } else {
        const errMsg = Array.isArray(data.details) ? data.details.join(', ') : (data.error || '저장 실패');
        setMessage({ type: 'error', text: errMsg });
      }
    } catch {
      setMessage({ type: 'error', text: '네트워크 오류' });
    } finally {
      setSaving(false);
    }
  };

  const handleValidate = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;

    let mediaRef: unknown = null;
    if (form.media_ref_raw.trim()) {
      try {
        mediaRef = JSON.parse(form.media_ref_raw);
      } catch {
        setMessage({ type: 'error', text: 'media_ref JSON 형식이 올바르지 않습니다.' });
        return;
      }
    }

    try {
      const res = await fetch('/api/admin/templates/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ media_ref: mediaRef }),
        cache: 'no-store',
      });
      const data = await res.json();

      if (data.valid) {
        setMessage({ type: 'success', text: 'media_ref 규격이 유효합니다.' });
      } else {
        setMessage({ type: 'error', text: (data.errors || []).join(', ') || '검증 실패' });
      }
    } catch {
      setMessage({ type: 'error', text: '검증 요청 실패' });
    }
  };

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
        <Link href="/admin" className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700">
          관리자 홈으로
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <p className="text-slate-300">로딩 중...</p>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="min-h-screen bg-slate-950 p-6">
        <div className="mx-auto max-w-2xl">
          <p className="text-red-400">템플릿을 찾을 수 없습니다.</p>
          <Link href="/admin/templates" className="mt-4 inline-block text-orange-400 hover:underline">
            목록으로
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/admin/templates"
              className="flex size-10 items-center justify-center rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
              aria-label="뒤로가기"
            >
              <ArrowLeft className="size-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-slate-100">{template.id}</h1>
              <p className="text-sm text-slate-400">{template.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded px-2 py-1 text-sm ${
                template.is_active ? 'bg-green-900/50 text-green-400' : 'bg-slate-700 text-slate-400'
              }`}
            >
              {template.is_active ? 'active' : 'inactive'}
            </span>
            <button
              type="button"
              onClick={handleToggleStatus}
              disabled={saving}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700 disabled:opacity-50"
            >
              상태 토글
            </button>
          </div>
        </div>

        {message && (
          <div
            className={`mb-4 rounded-lg px-4 py-3 ${
              message.type === 'success' ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-6">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">level (1–3)</label>
            <select
              value={form.level}
              onChange={(e) => setForm((f) => ({ ...f, level: parseInt(e.target.value, 10) }))}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100"
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">focus_tags (쉼표 구분)</label>
            <input
              type="text"
              value={form.focus_tags}
              onChange={(e) => setForm((f) => ({ ...f, focus_tags: e.target.value }))}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100"
              placeholder="full_body_reset, core_control"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">contraindications (쉼표 구분)</label>
            <input
              type="text"
              value={form.contraindications}
              onChange={(e) => setForm((f) => ({ ...f, contraindications: e.target.value }))}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">equipment (쉼표 구분)</label>
            <input
              type="text"
              value={form.equipment}
              onChange={(e) => setForm((f) => ({ ...f, equipment: e.target.value }))}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">duration_sec (60–3600)</label>
            <input
              type="number"
              min={60}
              max={3600}
              value={form.duration_sec}
              onChange={(e) => setForm((f) => ({ ...f, duration_sec: parseInt(e.target.value, 10) || 300 }))}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">media_ref (JSON)</label>
            <textarea
              value={form.media_ref_raw}
              onChange={(e) => setForm((f) => ({ ...f, media_ref_raw: e.target.value }))}
              rows={6}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 font-mono text-sm text-slate-100"
              placeholder='{"provider":"mux","playback_id":"xxx"}'
            />
          </div>

          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={handleValidate}
              className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700"
            >
              <RotateCcw className="size-4" />
              Validate
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
            >
              <Save className="size-4" />
              저장
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
