/**
 * PR-PAY-CONTINUITY-05 — 인증 후 결과 페이지 복귀 시 실행 분기 자동 이어가기
 *
 * - 실행 시작 CTA로 `/app/auth?next=/movement-test/...?continue=execution` 진입 시
 * - 로그인/회원가입 완료 후 같은 결과 URL로 돌아오면
 * - `moveReBridgeContext:v1`가 있을 때만 `handleExecutionStart`를 한 번 호출한다.
 * - bridge가 없으면(북마크 등) `continue` 쿼리만 제거해 혼란을 줄인다.
 *
 * @see useExecutionStartBridge
 * @see appendContinueExecutionParam (public-result-bridge.ts)
 */

'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase';
import {
  CONTINUE_EXECUTION_QUERY,
  CONTINUE_EXECUTION_VALUE,
  loadBridgeContext,
} from './public-result-bridge';

export interface UseResumeExecutionAfterAuthOptions {
  /** 결과 본문이 준비된 뒤 true (예: baseline/refined state 로드 완료) */
  enabled: boolean;
  /** 깨끗한 복귀 경로 (쿼리 없음), 예: `/movement-test/baseline` */
  returnPathClean: string;
  /** useExecutionStartBridge에서 온 핸들러 */
  handleExecutionStart: () => void;
}

/**
 * `?continue=execution` + 세션 + bridge가 맞을 때만 실행 분기를 한 번 트리거한다.
 */
export function useResumeExecutionAfterAuth(options: UseResumeExecutionAfterAuthOptions): void {
  const { enabled, returnPathClean, handleExecutionStart } = options;
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get(CONTINUE_EXECUTION_QUERY) !== CONTINUE_EXECUTION_VALUE) return;

    let cancelled = false;

    async function run() {
      const {
        data: { session },
      } = await supabaseBrowser.auth.getSession();
      if (cancelled) return;

      // 로그인 전이면 아무 것도 하지 않음 (미인증 사용자가 북마크로 연 경우 등)
      if (!session) return;

      const hasBridge = !!loadBridgeContext();

      // 의도 없는 continue=execution (bridge 없음) → 쿼리만 정리
      if (!hasBridge) {
        router.replace(returnPathClean);
        return;
      }

      if (!enabled) return;

      // React Strict Mode(dev)에서 effect가 두 번 돌 수 있어, 동일 세션·경로에 대해 1회만 실행
      const guardKey = `moveReResumeExec:v1:${session.user.id}:${returnPathClean}`;
      try {
        if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(guardKey)) return;
        if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(guardKey, '1');
      } catch {
        /* private mode 등 — 가드 없이 진행(이중 호출 가능성은 낮음) */
      }
      // Stripe/온보딩 이동 전에 주소에서 continue 제거 (히스토리·북마크 혼선 방지)
      router.replace(returnPathClean);
      handleExecutionStart();
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [
    enabled,
    returnPathClean,
    handleExecutionStart,
    router,
    searchParams,
  ]);
}
