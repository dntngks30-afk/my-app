'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSessionSafe } from '@/lib/supabase';

const PUSH_OPEN_SESSION_DELAYS_MS = [120, 250, 500, 900] as const;
const ALLOWED_PUSH_TARGETS = new Set(['/app/home']);
const ALLOWED_PUSH_TYPES = new Set(['test', 'daily_session', 'session_reminder']);
const DEFAULT_PUSH_TARGET = '/app/home';
const UNKNOWN_PUSH_TYPE = 'unknown';

function sanitizePushTarget(value: string | null): string {
  if (!value) return DEFAULT_PUSH_TARGET;

  const trimmed = value.trim();

  if (!trimmed.startsWith('/')) return DEFAULT_PUSH_TARGET;
  if (trimmed.startsWith('//')) return DEFAULT_PUSH_TARGET;
  if (trimmed.includes(':')) return DEFAULT_PUSH_TARGET;
  if (trimmed.startsWith('/app/auth')) return DEFAULT_PUSH_TARGET;

  const [path] = trimmed.split('?');
  if (!ALLOWED_PUSH_TARGETS.has(path)) return DEFAULT_PUSH_TARGET;

  return path;
}

function sanitizePushType(value: string | null): string {
  if (!value) return UNKNOWN_PUSH_TYPE;
  const trimmed = value.trim();
  return ALLOWED_PUSH_TYPES.has(trimmed) ? trimmed : UNKNOWN_PUSH_TYPE;
}

function buildPushAppTarget(targetPath: string, pushType: string): string {
  const params = new URLSearchParams();
  params.set('source', 'push');
  params.set('type', pushType);
  return `${targetPath}?${params.toString()}`;
}

function PushOpenLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0c1324] px-5 text-center text-white">
      <section className="max-w-sm rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-orange-300/80">
          MOVE RE
        </p>
        <h1 className="mt-3 text-xl font-semibold">알림을 열고 있어요</h1>
        <p className="mt-2 text-sm leading-6 text-white/60">
          오늘의 세션으로 이동하는 중이에요. 잠시만 기다려 주세요.
        </p>
      </section>
    </main>
  );
}

function PushOpenPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawTarget = searchParams.get('to');
  const rawType = searchParams.get('type');

  useEffect(() => {
    let cancelled = false;
    const targetPath = sanitizePushTarget(rawTarget);
    const pushType = sanitizePushType(rawType);
    const appTarget = buildPushAppTarget(targetPath, pushType);

    async function run() {
      for (let attempt = 0; attempt <= PUSH_OPEN_SESSION_DELAYS_MS.length; attempt += 1) {
        const { session } = await getSessionSafe().catch(() => ({
          session: null,
          error: null,
        }));

        if (cancelled) return;

        if (session) {
          router.replace(appTarget);
          return;
        }

        const delay = PUSH_OPEN_SESSION_DELAYS_MS[attempt];
        if (delay == null) break;

        await new Promise((resolve) => window.setTimeout(resolve, delay));
      }

      if (cancelled) return;
      router.replace(`/app/auth?next=${encodeURIComponent(appTarget)}`);
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [rawTarget, rawType, router]);

  return <PushOpenLoading />;
}

export default function PushOpenPage() {
  return (
    <Suspense fallback={<PushOpenLoading />}>
      <PushOpenPageInner />
    </Suspense>
  );
}
