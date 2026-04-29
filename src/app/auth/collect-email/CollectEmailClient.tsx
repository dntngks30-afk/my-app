'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase';
import { MoveReFullscreenScreen } from '@/components/public-brand/MoveReFullscreenScreen';
import { Starfield } from '@/components/landing/Starfield';
import { Input } from '@/components/ui/input';
import { sanitizeAuthNextPath } from '@/lib/auth/authHandoffContract';

const COLLECT_NEXT_DEFAULT = '/execution/start';

export default function CollectEmailClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const spKey = useMemo(() => searchParams.toString(), [searchParams]);

  const safeNext = useMemo(() => {
    const raw = new URLSearchParams(spKey).get('next');
    return sanitizeAuthNextPath(raw, COLLECT_NEXT_DEFAULT);
  }, [spKey]);

  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const {
        data: { session },
      } = await supabaseBrowser.auth.getSession();
      if (cancelled) return;
      if (!session) {
        const enc = encodeURIComponent(safeNext);
        router.replace(`/app/auth?next=${enc}`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, safeNext]);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setBusy(true);
      try {
        const {
          data: { session },
        } = await supabaseBrowser.auth.getSession();
        if (!session?.access_token) {
          const enc = encodeURIComponent(safeNext);
          router.replace(`/app/auth?next=${enc}`);
          return;
        }

        const res = await fetch('/api/auth/collect-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ email: email.trim() }),
        });

        const json = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: { message?: string };
        };

        if (!res.ok || !json.ok) {
          setError(json.error?.message ?? '저장에 실패했습니다. 다시 시도해 주세요.');
          return;
        }

        await supabaseBrowser.auth.refreshSession().catch(() => undefined);
        router.replace(safeNext);
      } finally {
        setBusy(false);
      }
    },
    [email, router, safeNext],
  );

  return (
    <MoveReFullscreenScreen backgroundSlot={<Starfield />}>
      <main className="public-chapter-content-default flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm space-y-6 text-center">
          <h1
            className="text-lg font-semibold text-[#e8e8ef]"
            style={{ fontFamily: 'var(--font-sans-noto)' }}
          >
            이메일을 입력해 주세요
          </h1>
          <p className="text-sm text-[#9a9aa8]" style={{ fontFamily: 'var(--font-sans-noto)' }}>
            결제와 계정 확인을 위해 이메일이 필요해요.
          </p>
          <form onSubmit={(e) => void onSubmit(e)} className="space-y-4 text-left">
            <div>
              <label htmlFor="collect-email" className="mb-1.5 block text-xs font-medium text-[#dce1fb]/75">
                이메일
              </label>
              <Input
                id="collect-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                className="h-12 rounded-xl border-white/[0.12] bg-white/[0.06] text-[#e8e8ef]"
                placeholder="name@example.com"
              />
            </div>
            {error ? (
              <p className="text-sm text-[#fcb973]" role="alert">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={busy}
              className="flex h-12 w-full items-center justify-center rounded-2xl bg-[#c6c6cd] text-sm font-semibold text-[#12121a] disabled:opacity-50"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              {busy ? '저장 중...' : '이메일 저장하고 계속하기'}
            </button>
          </form>
        </div>
      </main>
    </MoveReFullscreenScreen>
  );
}
