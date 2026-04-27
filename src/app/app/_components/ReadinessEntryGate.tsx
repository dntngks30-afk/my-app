'use client';

/**
 * FLOW-08 — Readiness Entry Gate
 *
 * AppAuthGate가 인증 + plan_status를 통과시킨 이후,
 * FLOW-07 canonical readiness를 기반으로 사용자를 올바른 next step으로 안내한다.
 *
 * ─── 역할 경계 ─────────────────────────────────────────────────────────────────
 * - 이 컴포넌트는 readiness 소비 및 라우팅만 담당한다.
 * - readiness 계산은 GET /api/readiness (FLOW-07)가 담당.
 * - session create / claim / onboarding 로직 변경 없음.
 * - AppShell / execution core 변경 없음.
 *
 * ─── next_action 매핑 (PR-FLOW-06 SessionReadinessNextAction) ─────────────────
 * GO_AUTH              → /app/auth
 * GO_RESULT            → /movement-test/baseline
 * GO_ONBOARDING        → /onboarding
 * GO_SESSION_CREATE    → /session-preparing
 * GO_PAYMENT           → pass-through (AppAuthGate)
 * GO_APP_HOME          → pass-through
 * fetch 실패 / null    → pass-through (safe fallback, execution core 차단 없음)
 *
 * ─── 반복 실행 방지 ───────────────────────────────────────────────────────────
 * `checkedRef`만 사용: 동일 마운트에서 effect가 readiness fetch·분기를 한 번만 실행.
 * sessionStorage `move-re-readiness-checked:v1`는 pass-through 경로에서만 기록(불필요 재요청 완화).
 * 리다이렉트 분기에서는 기록하지 않음 → 다른 단계 완료 후 /app/home 재진입 시 readiness 재조회.
 *
 * ─── FLOW-09+ 준비 ───────────────────────────────────────────────────────────
 * - 이 컴포넌트를 교체하거나 확장해 더 정교한 readiness 처리 추가 가능.
 * - readiness 객체를 context로 내려보내는 패턴도 이 파일에서 확장 가능.
 */

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchReadinessClient } from '@/lib/readiness/fetchReadinessClient';
import type { SessionReadinessNextAction } from '@/lib/readiness/types';
import { markReadinessChecked } from '@/lib/readiness/readinessSessionFlag';

interface ReadinessEntryGateProps {
  children: React.ReactNode;
}

/**
 * ReadinessEntryGate
 *
 * AppAuthGate(인증+plan_status 통과) 이후 readiness 조회가 끝날 때까지 children을 숨기고,
 * 필요 시 claim / onboarding / session-preparing / auth로 리다이렉트.
 */
export default function ReadinessEntryGate({ children }: ReadinessEntryGateProps) {
  const router = useRouter();
  const [gating, setGating] = useState(true);
  const checkedRef = useRef(false);

  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;

    let cancelled = false;

    async function run() {
      const readiness = await fetchReadinessClient();

      if (cancelled) return;

      if (!readiness) {
        markReadinessChecked();
        setGating(false);
        return;
      }

      const code: SessionReadinessNextAction = readiness.next_action.code;

      if (code === 'GO_RESULT') {
        router.replace('/movement-test/baseline');
        return;
      }

      if (code === 'GO_ONBOARDING') {
        router.replace('/onboarding');
        return;
      }

      if (code === 'GO_AUTH') {
        router.replace('/app/auth');
        return;
      }

      if (code === 'GO_SESSION_CREATE') {
        router.replace('/session-preparing');
        return;
      }

      // GO_PAYMENT, GO_APP_HOME → pass-through
      markReadinessChecked();
      setGating(false);
    }

    void run().catch(() => {
      if (!cancelled) {
        markReadinessChecked();
        setGating(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (gating) return null;

  return <>{children}</>;
}
