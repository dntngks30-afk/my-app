/**
 * FLOW-03 — 실행 시작 CTA Bridge 훅
 *
 * 결과 페이지에서 “움직임 리셋 시작하기” 클릭 시:
 * - bridge 저장(가능하면) 후 `/execution/start`로만 이동
 * - 미인증 시 `/app/auth?next=/execution/start`
 *
 * 분기(pilot redeem, plan, Stripe)는 소유 라우트 `src/app/execution/start`에서 처리.
 *
 * @see src/lib/public-results/public-result-bridge.ts
 */

'use client';

import { useCallback, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase';
import { saveBridgeContext, resolvePublicResultIdForBridgeStage } from './public-result-bridge';
import type { BridgeResultStage } from './public-result-bridge';
import { readAnonId } from './anon-id';

const EXECUTION_START_PATH = '/execution/start';

export interface UseExecutionStartBridgeOptions {
  /** FLOW-02 handoff id. 없으면 bridge context 없이 진행 */
  publicResultId: string | null;
  /** baseline | refined */
  stage: BridgeResultStage;
  /** 레거시 옵션(페이지 간 구분용). 새 canonical에서는 사용하지 않음 */
  returnPath: string;
}

export interface UseExecutionStartBridgeResult {
  handleExecutionStart: () => void;
  isPending: boolean;
  error: string | null;
}

/**
 * 실행 시작 CTA — bridge 저장 후 /execution/start (단일 진입점)
 */
export function useExecutionStartBridge(
  options: UseExecutionStartBridgeOptions
): UseExecutionStartBridgeResult {
  const { publicResultId, stage } = options;
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);
  const resolvedId = resolvePublicResultIdForBridgeStage(publicResultId, stage);

  const handleExecutionStart = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setError(null);
    setIsPending(true);

    try {
      if (resolvedId) {
        saveBridgeContext({
          publicResultId: resolvedId,
          resultStage: stage,
          anonId: readAnonId(),
        });
      }

      const {
        data: { session },
      } = await supabaseBrowser.auth.getSession();

      if (!session) {
        router.replace(
          `/app/auth?next=${encodeURIComponent(EXECUTION_START_PATH)}`
        );
        return;
      }

      router.replace(EXECUTION_START_PATH);
    } catch (err) {
      console.error('[useExecutionStartBridge]', err);
      setError('처리 중 오류가 발생했습니다.');
    } finally {
      inFlightRef.current = false;
      setIsPending(false);
    }
  }, [resolvedId, stage, router]);

  return { handleExecutionStart, isPending, error };
}
