'use client';

/**
 * Canonical execution bridge — result CTA 저장 bridge를 이어받아
 * pilot redeem → onboarding 또는 미결제 → Stripe checkout → onboarding.
 * Owner 라우트: pilot/checkout 분기는 여기만.
 */

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabase';
import { loadBridgeContext, saveBridgeContext } from '@/lib/public-results/public-result-bridge';
import {
  readPilotContext,
  savePilotContextFromCode,
  getPilotCodeFromSearchParams,
} from '@/lib/pilot/pilot-context';
import {
  validatePublicResultIdForHandoff,
  validateStageForHandoff,
  validateAnonIdForHandoff,
  sanitizeAuthNextPath,
  DEFAULT_HANDOFF_NEXT,
} from '@/lib/auth/authHandoffContract';
import { readAnonId } from '@/lib/public-results/anon-id';
import { redeemPilotAccessClient } from '@/lib/pilot/redeemPilotAccessClient';
import { mapPilotRedeemErrorToMessage } from '@/lib/pilot/pilot-redeem-ui-messages';
import { linkActivePublicTestRunToCurrentUserClient } from '@/lib/public-test-runs/client';
import { MoveReFullscreenScreen } from '@/components/public-brand/MoveReFullscreenScreen';
import { Starfield } from '@/components/landing/Starfield';

const PILOT_VERIFICATION_CHECKOUT_MSG =
  '파일럿 권한을 확인하는 중입니다. 결제 단계로 넘어갈 수 없습니다.';

type ViewState = 'loading' | 'no_bridge' | 'error';

export default function ExecutionStartClient() {
  const router = useRouter();
  const [view, setView] = useState<ViewState>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const ranRef = useRef(false);

  useEffect(() => {
    const rawSearch =
      typeof window !== 'undefined' && window.location.search ? window.location.search : '';

    let queryAppliedPilot = false;
    let queryAppliedBridge = false;

    if (rawSearch && typeof window !== 'undefined') {
      const sp = new URLSearchParams(rawSearch);

      const pilotFromUrl = getPilotCodeFromSearchParams(sp);
      if (pilotFromUrl) {
        savePilotContextFromCode(pilotFromUrl, 'in_app_auth_handoff');
        queryAppliedPilot = true;
      }

      const pr = sp.get('publicResultId');
      const stage = sp.get('stage');
      if (pr && validatePublicResultIdForHandoff(pr) && validateStageForHandoff(stage)) {
        const rawAnon = sp.get('anonId');
        const anonOk = rawAnon && validateAnonIdForHandoff(rawAnon) ? rawAnon.trim() : null;
        saveBridgeContext({
          publicResultId: pr.trim(),
          resultStage: stage,
          anonId: anonOk ?? readAnonId() ?? undefined,
        });
        const pilotInBridgeQuery = getPilotCodeFromSearchParams(sp);
        if (pilotInBridgeQuery && !queryAppliedPilot) {
          savePilotContextFromCode(pilotInBridgeQuery, 'in_app_auth_handoff');
          queryAppliedPilot = true;
        }
        queryAppliedBridge = true;
      }
    }

    if ((queryAppliedPilot || queryAppliedBridge) && typeof window !== 'undefined') {
      window.history.replaceState(null, '', '/execution/start');
    }

    if (ranRef.current) return;
    ranRef.current = true;

    async function run() {
      const {
        data: { session },
      } = await supabaseBrowser.auth.getSession();

      if (!session) {
        const nextPath =
          rawSearch && rawSearch.length > 1
            ? `/execution/start${rawSearch}`
            : '/execution/start';
        router.replace(
          `/app/auth?next=${encodeURIComponent(sanitizeAuthNextPath(nextPath, DEFAULT_HANDOFF_NEXT))}`
        );
        return;
      }

      if (!loadBridgeContext()) {
        setView('no_bridge');
        return;
      }

      void linkActivePublicTestRunToCurrentUserClient();

      const token = session.access_token;

      const abortIfPilotBlocksCheckout = (): boolean => {
        if (!readPilotContext()) return false;
        setErrorMessage(PILOT_VERIFICATION_CHECKOUT_MSG);
        setView('error');
        return true;
      };

      if (readPilotContext()) {
        const redeemResult = await redeemPilotAccessClient(token);
        if (redeemResult.ok && !redeemResult.skipped) {
          router.replace('/onboarding');
          return;
        }
        if (!redeemResult.ok) {
          setErrorMessage(
            mapPilotRedeemErrorToMessage(redeemResult.code, redeemResult.message)
          );
          setView('error');
          return;
        }
      }

      if (abortIfPilotBlocksCheckout()) {
        return;
      }

      const { data: userRow } = await supabaseBrowser
        .from('users')
        .select('plan_status, email')
        .eq('id', session.user.id)
        .single();

      const planStatus =
        (userRow as { plan_status?: string; email?: string | null } | null)?.plan_status ?? null;
      const usersEmail =
        (userRow as { plan_status?: string; email?: string | null } | null)?.email?.trim() ?? '';
      const jwtEmail = session.user.email?.trim() ?? '';

      if (planStatus === 'active') {
        router.replace('/onboarding');
        return;
      }

      if (!jwtEmail && !usersEmail) {
        router.replace('/auth/collect-email?next=' + encodeURIComponent('/execution/start'));
        return;
      }

      if (abortIfPilotBlocksCheckout()) {
        return;
      }

      const checkoutRes = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          productId: 'move-re-7d',
          next: '/onboarding',
          cancelNext: '/movement-test/baseline',
          consent: true,
        }),
      });

      const json = (await checkoutRes.json().catch(() => ({}))) as {
        url?: string;
        code?: string;
        error?: string;
        message?: string;
      };

      if (!checkoutRes.ok) {
        const code = json?.code ?? '';
        if (checkoutRes.status === 409 && code === 'ALREADY_ACTIVE') {
          router.replace('/onboarding');
          return;
        }
        setErrorMessage(
          json?.error || json?.message || '결제 세션을 준비하지 못했습니다.'
        );
        setView('error');
        return;
      }

      if (json?.url) {
        window.location.href = json.url;
        return;
      }

      setErrorMessage('결제 URL을 받지 못했습니다.');
      setView('error');
    }

    void run().catch((err) => {
      console.error('[ExecutionStartClient]', err);
      setErrorMessage('처리 중 오류가 발생했습니다.');
      setView('error');
    });
  }, [router]);

  if (view === 'loading') {
    return (
      <MoveReFullscreenScreen backgroundSlot={<Starfield />}>
        <main className="public-chapter-content-default flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-10 text-center">
          <p
            className="text-base font-medium text-[#e8e8ef]"
            style={{ fontFamily: 'var(--font-sans-noto)' }}
          >
            실행 준비를 이어가고 있어요
          </p>
          <p
            className="mt-3 text-sm text-[#9a9aa8]"
            style={{ fontFamily: 'var(--font-sans-noto)' }}
          >
            결제 또는 파일럿 권한을 확인하고 있어요
          </p>
          <div
            className="mt-8 h-9 w-9 animate-pulse rounded-full border-2 border-[#6b6b78] border-t-[#c6c6cd]"
            aria-hidden
          />
        </main>
      </MoveReFullscreenScreen>
    );
  }

  if (view === 'no_bridge') {
    return (
      <MoveReFullscreenScreen backgroundSlot={<Starfield />}>
        <main className="public-chapter-content-default flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-10 text-center">
          <p
            className="max-w-sm text-base text-[#e8e8ef]"
            style={{ fontFamily: 'var(--font-sans-noto)' }}
          >
            실행에 필요한 결과 정보를 찾지 못했어요. 결과 화면에서 다시 시작해 주세요.
          </p>
          <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
            <Link
              href="/movement-test/baseline"
              className="rounded-xl bg-[#c6c6cd] px-4 py-3 text-center text-sm font-semibold text-[#12121a]"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              결과 다시 확인하기
            </Link>
            <Link
              href="/intro/welcome"
              className="rounded-xl border border-[#3f3f4a] px-4 py-3 text-center text-sm text-[#c6c6cd]"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              처음부터 다시 하기
            </Link>
          </div>
        </main>
      </MoveReFullscreenScreen>
    );
  }

  return (
    <MoveReFullscreenScreen backgroundSlot={<Starfield />}>
      <main className="public-chapter-content-default flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-10 text-center">
        <p
          className="max-w-sm text-base text-[#fcb973]"
          style={{ fontFamily: 'var(--font-sans-noto)' }}
        >
          {errorMessage ?? '처리 중 오류가 발생했습니다.'}
        </p>
        <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
          <Link
            href="/movement-test/baseline"
            className="rounded-xl bg-[#c6c6cd] px-4 py-3 text-center text-sm font-semibold text-[#12121a]"
            style={{ fontFamily: 'var(--font-sans-noto)' }}
          >
            결과 다시 확인하기
          </Link>
          <Link
            href="/intro/welcome"
            className="rounded-xl border border-[#3f3f4a] px-4 py-3 text-center text-sm text-[#c6c6cd]"
            style={{ fontFamily: 'var(--font-sans-noto)' }}
          >
            처음부터 다시 하기
          </Link>
        </div>
      </main>
    </MoveReFullscreenScreen>
  );
}
