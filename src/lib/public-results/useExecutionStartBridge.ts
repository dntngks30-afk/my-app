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
import { getSessionSafe } from '@/lib/supabase';
import { saveBridgeContext, resolvePublicResultIdForBridgeStage } from './public-result-bridge';
import type { BridgeResultStage } from './public-result-bridge';
import { readAnonId } from './anon-id';
import { getPilotCodeFromCurrentUrl } from '@/lib/pilot/pilot-context';
import {
  buildExecutionStartPathWithBridgeQuery,
  sanitizeAuthNextPath,
  DEFAULT_HANDOFF_NEXT,
} from '@/lib/auth/authHandoffContract';

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

      const { session } = await getSessionSafe();

      if (!session) {
        const pilot = getPilotCodeFromCurrentUrl();
        const nextPath = buildExecutionStartPathWithBridgeQuery({
          publicResultId: resolvedId,
          stage,
          anonId: readAnonId(),
          pilot,
        });
        const safeNext = sanitizeAuthNextPath(nextPath, DEFAULT_HANDOFF_NEXT);
        router.replace(`/app/auth?next=${encodeURIComponent(safeNext)}`);
        return;
      }

      router.replace(
        buildExecutionStartPathWithBridgeQuery({
          publicResultId: resolvedId,
          stage,
          anonId: readAnonId(),
          pilot: getPilotCodeFromCurrentUrl(),
        })
      );
    } catch (err) {
      const isAbort =
        err instanceof Error && err.name === 'AbortError';

      if (isAbort && process.env.NODE_ENV === 'development') {
        console.warn('[useExecutionStartBridge]', err);
      } else if (!isAbort) {
        console.error('[useExecutionStartBridge]', err);
      }

      if (!isAbort) {
        setError('처리 중 오류가 발생했습니다.');
      }
    } finally {
      inFlightRef.current = false;
      setIsPending(false);
    }
  }, [resolvedId, stage, router]);

  return { handleExecutionStart, isPending, error };
}
