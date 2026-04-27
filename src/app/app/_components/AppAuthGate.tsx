'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { supabase, getSessionSafe } from '@/lib/supabase';
import { getCachedAppBootstrap, invalidateAppBootstrapCache } from '@/lib/app/bootstrapClient';
import { isAllowed, isAllowlistEmpty } from '@/lib/appAccess';
import AppEntryLoader, { isAppBooted } from './AppEntryLoader';
import { readPilotContext } from '@/lib/pilot/pilot-context';
import { redeemPilotAccessClient } from '@/lib/pilot/redeemPilotAccessClient';
import { mapPilotRedeemErrorToMessage } from '@/lib/pilot/pilot-redeem-ui-messages';
import { loadBridgeContext } from '@/lib/public-results/public-result-bridge';
import { fetchReadinessClient } from '@/lib/readiness/fetchReadinessClient';
import { resolvePilotPostRedeemRoute } from '@/lib/pilot/pilot-post-redeem-route';

interface AppAuthGateProps {
  children: React.ReactNode;
}

function hasActivePlan(planStatus: string | null): boolean {
  return planStatus === 'active';
}

type GateStatus =
  | 'loading'
  | 'auth'
  | 'denied'
  | 'paywall'
  | 'allowed'
  | 'pilot_redeeming';

/** 탭 전환 시 동일 세션이면 재검증 스킵(users DB 조회 생략) */
export default function AppAuthGate({ children }: AppAuthGateProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState<GateStatus>('loading');
  const [skipLoader, setSkipLoader] = useState(false);
  const [paywallPilotMessage, setPaywallPilotMessage] = useState<string | null>(null);
  const lastAllowedUserIdRef = useRef<string | null>(null);
  /** userId we already attempted pilot redeem for (avoid loops; reset on user change / success path). */
  const pilotRedeemAttemptedForUserRef = useRef<string | null>(null);
  const lastSessionUserIdRef = useRef<string | null>(null);

  const isAuthPage = pathname?.startsWith('/app/auth');

  useEffect(() => {
    setSkipLoader(isAppBooted());
  }, []);

  useEffect(() => {
    let cancelled = false;
    let retryCount = 0;
    const MAX_ABORT_RETRIES = 2;

    async function check() {
      try {
        const { session, error } = await getSessionSafe();
        if (cancelled) return;

        if (error || !session) {
          lastAllowedUserIdRef.current = null;
          lastSessionUserIdRef.current = null;
          pilotRedeemAttemptedForUserRef.current = null;
          setPaywallPilotMessage(null);
          setStatus('auth');
          if (!isAuthPage) {
            const next = encodeURIComponent(pathname || '/app/home');
            router.replace(`/app/auth?next=${next}`);
          }
          return;
        }

        const userId = session.user.id;
        if (
          lastSessionUserIdRef.current !== null &&
          lastSessionUserIdRef.current !== userId
        ) {
          pilotRedeemAttemptedForUserRef.current = null;
        }
        lastSessionUserIdRef.current = userId;

        if (lastAllowedUserIdRef.current === userId && status === 'allowed') {
          return;
        }

        const email = session.user?.email ?? null;
        if (!isAllowlistEmpty() && !isAllowed(email)) {
          lastAllowedUserIdRef.current = null;
          setPaywallPilotMessage(null);
          setStatus('denied');
          return;
        }

        const result = await getCachedAppBootstrap(session.access_token);

        if (cancelled) return;

        if (!result.ok) {
          if (result.status === 401) {
            lastAllowedUserIdRef.current = null;
            lastSessionUserIdRef.current = null;
            pilotRedeemAttemptedForUserRef.current = null;
            setPaywallPilotMessage(null);
            setStatus('auth');
            if (!isAuthPage) {
              const next = encodeURIComponent(pathname || '/app/home');
              router.replace(`/app/auth?next=${next}`);
            }
            return;
          }
          lastAllowedUserIdRef.current = null;
          setPaywallPilotMessage(null);
          setStatus('paywall');
          return;
        }

        const planStatus = result.data.user.plan_status ?? null;

        if (hasActivePlan(planStatus)) {
          lastAllowedUserIdRef.current = userId;
          setPaywallPilotMessage(null);
          setStatus('allowed');
          return;
        }

        if (readPilotContext()) {
          if (pilotRedeemAttemptedForUserRef.current === userId) {
            lastAllowedUserIdRef.current = null;
            setStatus('paywall');
            return;
          }

          pilotRedeemAttemptedForUserRef.current = userId;
          setPaywallPilotMessage(null);
          setStatus('pilot_redeeming');

          const redeemResult = await redeemPilotAccessClient(session.access_token);
          if (cancelled) return;

          if (redeemResult.ok && !redeemResult.skipped) {
            pilotRedeemAttemptedForUserRef.current = null;
            invalidateAppBootstrapCache();
            const bridge = loadBridgeContext();
            const readiness = bridge ? null : await fetchReadinessClient();
            if (cancelled) return;
            const href = resolvePilotPostRedeemRoute({
              hasBridgeContext: !!bridge,
              readiness: readiness ?? undefined,
            });
            router.replace(href);
            return;
          }

          if (!redeemResult.ok) {
            setPaywallPilotMessage(
              mapPilotRedeemErrorToMessage(redeemResult.code, redeemResult.message)
            );
            lastAllowedUserIdRef.current = null;
            setStatus('paywall');
            return;
          }

          if (process.env.NODE_ENV === 'development') {
            console.warn(
              '[AppAuthGate] pilot context present but redeem skipped; showing paywall'
            );
          }
          lastAllowedUserIdRef.current = null;
          setStatus('paywall');
          return;
        }

        lastAllowedUserIdRef.current = null;
        setPaywallPilotMessage(null);
        setStatus('paywall');
      } catch (e) {
        if (cancelled) return;
        const isAbortError = e instanceof Error && e.name === 'AbortError';
        if (isAbortError && retryCount < MAX_ABORT_RETRIES) {
          retryCount += 1;
          await new Promise((r) => setTimeout(r, 80));
          if (!cancelled) check();
          return;
        }
        lastAllowedUserIdRef.current = null;
        lastSessionUserIdRef.current = null;
        pilotRedeemAttemptedForUserRef.current = null;
        setPaywallPilotMessage(null);
        setStatus('auth');
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, [pathname, isAuthPage, router]);

  // 앱 첫 진입 시에만 풀스크린 로더. 탭 전환에서는 재출현 금지.
  // skipLoader는 useEffect에서만 설정 → Hydration mismatch 방지
  if (status === 'pilot_redeeming') {
    return <AppEntryLoader status="파일럿 권한 확인 중" />;
  }

  if (status === 'loading') {
    if (skipLoader) {
      return <>{children}</>;
    }
    return <AppEntryLoader status="인증 확인 중" />;
  }

  if (status === 'auth' && isAuthPage) {
    return <>{children}</>;
  }

  if (status === 'auth') {
    return null;
  }

  if (status === 'denied') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--bg)] px-4">
        <h2 className="text-lg font-semibold text-[var(--text)]">앱 접근 권한이 없습니다</h2>
        <p className="max-w-sm text-center text-sm text-[var(--muted)]">
          현재 베타 테스트용으로 허용된 계정만 접근할 수 있습니다. 관리자에게 문의해 주세요.
        </p>
      </div>
    );
  }

  if (status === 'paywall') {
    // FLOW-08: public-first 전환 - 분석 결과 → 결제 경로로 안내
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[var(--bg)] px-4">
        <h2 className="text-lg font-semibold text-[var(--text)]">실행 권한이 필요해요</h2>
        {paywallPilotMessage ? (
          <p className="max-w-sm text-center text-sm text-amber-700 dark:text-amber-400">
            {paywallPilotMessage}
          </p>
        ) : null}
        <p className="max-w-sm text-center text-sm text-[var(--muted)]">
          분석 결과를 먼저 확인하고, 맞춤 루틴 실행을 시작할 수 있어요.
        </p>
        <div className="flex flex-col gap-2 w-full max-w-xs">
          <Link
            href="/movement-test/baseline"
            className="rounded-lg bg-[var(--brand)] px-6 py-3 text-center text-sm font-semibold text-white hover:opacity-90"
          >
            분석 결과 확인하기
          </Link>
          <Link
            href="/pricing"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-6 py-3 text-center text-sm font-semibold text-[var(--text)] hover:bg-[var(--surface-2)]"
          >
            요금제 보기
          </Link>
          <button
            type="button"
            onClick={() => supabase.auth.signOut().then(() => router.replace('/app/auth'))}
            className="text-sm text-[var(--muted)] hover:text-[var(--text)] py-2"
          >
            로그아웃
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
