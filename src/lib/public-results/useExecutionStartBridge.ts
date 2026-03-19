/**
 * FLOW-03 — 실행 시작 CTA Bridge 훅
 *
 * public result 페이지에서 "실행 시작" 클릭 시:
 * - 미로그인 → login (next=현재 결과 페이지)
 * - 로그인 + inactive → checkout (success next=onboarding-prep)
 * - 로그인 + active → onboarding-prep 또는 /app/home
 *
 * bridge context는 localStorage에 저장되어 login/pay 후에도 복구 가능.
 *
 * @see src/lib/public-results/public-result-bridge.ts
 */

'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase';
import { saveBridgeContext, buildOnboardingPrepUrl } from './public-result-bridge';
import type { BridgeResultStage } from './public-result-bridge';
import { readAnonId } from './anon-id';

export interface UseExecutionStartBridgeOptions {
  /** FLOW-02 handoff id. 없으면 bridge context 없이 진행 (fallback) */
  publicResultId: string | null;
  /** baseline | refined */
  stage: BridgeResultStage;
  /** login 후 돌아올 페이지 (현재 결과 페이지) */
  returnPath: string;
}

export interface UseExecutionStartBridgeResult {
  handleExecutionStart: () => void;
  isPending: boolean;
  error: string | null;
}

/**
 * 실행 시작 CTA 클릭 시 auth/pay 분기 처리
 */
export function useExecutionStartBridge(
  options: UseExecutionStartBridgeOptions
): UseExecutionStartBridgeResult {
  const { publicResultId, stage, returnPath } = options;
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExecutionStart = useCallback(async () => {
    if (isPending) return;
    setError(null);
    setIsPending(true);

    try {
      const { data: { session } } = await supabaseBrowser.auth.getSession();

      // 1. 미로그인 → login
      if (!session) {
        if (publicResultId) {
          saveBridgeContext({
            publicResultId,
            resultStage: stage,
            anonId: readAnonId(),
          });
        }
        const authNext = `/app/auth?next=${encodeURIComponent(returnPath)}`;
        router.push(authNext);
        return;
      }

      // 2. 로그인됨 → plan_status 확인
      const { data: userRow } = await supabaseBrowser
        .from('users')
        .select('plan_status')
        .eq('id', session.user.id)
        .single();

      const planStatus = (userRow as { plan_status?: string } | null)?.plan_status ?? null;
      const isActive = planStatus === 'active';

      // 3. active → onboarding-prep 또는 /app/home
      if (isActive) {
        if (publicResultId) {
          router.push(buildOnboardingPrepUrl(publicResultId, stage, readAnonId()));
        } else {
          router.push('/app/home');
        }
        return;
      }

      // 4. inactive → checkout
      const successNext = publicResultId
        ? buildOnboardingPrepUrl(publicResultId, stage, readAnonId())
        : '/onboarding-prep';

      if (publicResultId) {
        saveBridgeContext({
          publicResultId,
          resultStage: stage,
          anonId: readAnonId(),
        });
      }

      const checkoutRes = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          productId: 'move-re-7d',
          next: successNext,
          cancelNext: returnPath,
          consent: true,
        }),
      });

      const json = await checkoutRes.json();

      if (!checkoutRes.ok) {
        const code = json?.code ?? '';
        if (checkoutRes.status === 409 && code === 'ALREADY_ACTIVE') {
          // 결제 완료 직후 plan_status 갱신 전 재진입 등
          router.push(publicResultId ? buildOnboardingPrepUrl(publicResultId, stage) : '/app/home');
          return;
        }
        setError(json?.error || json?.message || '결제 세션 생성에 실패했습니다.');
        return;
      }

      if (json?.url) {
        window.location.href = json.url;
      } else {
        setError('결제 URL을 받지 못했습니다.');
      }
    } catch (err) {
      console.error('[useExecutionStartBridge]', err);
      setError('처리 중 오류가 발생했습니다.');
    } finally {
      setIsPending(false);
    }
  }, [publicResultId, stage, returnPath, router, isPending]);

  return { handleExecutionStart, isPending, error };
}
