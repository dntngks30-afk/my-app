'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase';
import AuthShell from '@/components/auth/AuthShell';
import { Input } from '@/components/ui/input';
import { NeoButton } from '@/components/neobrutalism';

const NEO_INPUT =
  'rounded-2xl border-2 border-slate-900 bg-white h-11 px-3 shadow-[2px_2px_0_0_rgba(15,23,42,1)] focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-0 text-slate-800 placeholder:text-slate-400';

interface CompleteClientProps {
  /** searchParams.code — OAuth code, 서버에서 전달 */
  codeParam?: string | null;
}

export default function CompleteClient({ codeParam }: CompleteClientProps) {
  const router = useRouter();
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState('');
  const [birthdate, setBirthdate] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      const code = codeParam ?? null;
      if (code) {
        const { error: exchangeErr } = await supabaseBrowser.auth.exchangeCodeForSession(code);
        if (exchangeErr) {
          router.replace('/signup?error=auth_failed');
          return;
        }
      }

      const { data: { user } } = await supabaseBrowser.auth.getUser();
      if (!user) {
        router.replace('/signup');
        return;
      }

      const { data: profile } = await supabaseBrowser
        .from('profiles')
        .select('birthdate')
        .eq('id', user.id)
        .single();

      if (profile?.birthdate) {
        router.replace('/');
        return;
      }

      setEmail(user.email ?? '');
      setLoading(false);
    };
    run();
  }, [router, codeParam]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const { data: { user } } = await supabaseBrowser.auth.getUser();
    if (!user) {
      setSubmitting(false);
      router.replace('/signup');
      return;
    }

    if (!password || password.length < 6) {
      setError('비밀번호는 최소 6자 이상이어야 합니다.');
      setSubmitting(false);
      return;
    }

    try {
      const { error: updateErr } = await supabaseBrowser.auth.updateUser({ password });
      if (updateErr) {
        setError(updateErr.message);
        setSubmitting(false);
        return;
      }

      const { error: upsertErr } = await supabaseBrowser
        .from('profiles')
        .upsert(
          {
            id: user.id,
            email: user.email ?? null,
            birthdate: birthdate || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );

      if (upsertErr) {
        setError(upsertErr.message);
        setSubmitting(false);
        return;
      }

      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <AuthShell
        badgeText="가입 완료"
        title="추가 정보 입력"
        description="잠시만 기다려주세요."
      >
        <p className="text-sm text-[var(--muted)]">로딩 중...</p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      badgeText="가입 완료"
      title="추가 정보 입력"
      description="비밀번호와 생년월일을 입력하여 가입을 완료하세요."
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-2xl border-2 border-slate-900 bg-red-50 p-3 shadow-[2px_2px_0_0_rgba(15,23,42,1)]">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-800 mb-1">
            이메일
          </label>
          <Input
            id="email"
            type="email"
            placeholder="example@email.com"
            value={email}
            disabled
            className={NEO_INPUT}
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-800 mb-1">
            비밀번호
          </label>
          <Input
            id="password"
            type="password"
            placeholder="비밀번호 (최소 6자)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={NEO_INPUT}
          />
        </div>

        <div>
          <label htmlFor="birthdate" className="block text-sm font-medium text-slate-800 mb-1">
            생년월일
          </label>
          <Input
            id="birthdate"
            type="date"
            value={birthdate}
            onChange={(e) => setBirthdate(e.target.value)}
            className={NEO_INPUT}
          />
        </div>

        <NeoButton
          type="submit"
          variant="orange"
          disabled={submitting}
          className="w-full px-6 py-3"
        >
          {submitting ? '처리 중...' : '가입 완료'}
        </NeoButton>
      </form>
    </AuthShell>
  );
}
