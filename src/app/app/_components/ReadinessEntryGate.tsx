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
 * GO_PAYMENT           → pass-through (AppAuthGate)
 * GO_RESULT            → /movement-test/baseline
 * GO_ONBOARDING        → /onboarding
 * GO_SESSION_CREATE    → pass-through
 * GO_APP_HOME          → pass-through
 * fetch 실패 / null    → pass-through (safe fallback, execution core 차단 없음)
 *
 * ─── 반복 리다이렉트 방지 ────────────────────────────────────────────────────
 * sessionStorage 'move-re-readiness-checked:v1' 플래그를 사용해
 * 같은 세션에서 한 번만 readiness 체크를 실행한다.
 * - 리다이렉트 대상 페이지(/onboarding 등) 에서 되돌아올 때 재체크 차단.
 * - 탭 전환/재진입 시 불필요한 fetch 방지.
 *
 * ─── FLOW-09+ 준비 ──────────────────────────────────────────────────────────
 * - 이 컴포넌트를 교체하거나 확장해 더 정교한 readiness 처리 추가 가능.
 * - readiness 객체를 context로 내려보내는 패턴도 이 파일에서 확장 가능.
 */

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchReadinessClient } from '@/lib/readiness/fetchReadinessClient';
import type { SessionReadinessNextAction } from '@/lib/readiness/types';
import {
  clearReadinessCheck,
  isReadinessAlreadyChecked,
  markReadinessChecked,
} from '@/lib/readiness/readinessSessionFlag';

interface ReadinessEntryGateProps {
  children: React.ReactNode;
}

/**
 * ReadinessEntryGate
 *
 * AppAuthGate(인증+plan_status 통과) 이후, 최초 1회 readiness 체크 후
 * 필요시 claim_result / complete_onboarding 경로로 리다이렉트.
 * 준비된 사용자 또는 체크 불필요 시 즉시 children 렌더링.
 */
export default function ReadinessEntryGate({ children }: ReadinessEntryGateProps) {
  const router = useRouter();
  // 체크 대기 중이 아니면 즉시 children 노출 (깜빡임 없음)
  const [gating, setGating] = useState(false);
  const checkedRef = useRef(false);

  useEffect(() => {
    // 이미 이 세션에서 체크했으면 건너뜀
    if (checkedRef.current || isReadinessAlreadyChecked()) return;
    checkedRef.current = true;

    let cancelled = false;

    (async () => {
      const readiness = await fetchReadinessClient();

      if (cancelled) return;

      // fetch 실패 시 pass-through
      if (!readiness) {
        setGating(false);
        markReadinessChecked();
        return;
      }

      const code: SessionReadinessNextAction = readiness.next_action.code;

      if (code === 'GO_RESULT') {
        markReadinessChecked();
        router.replace('/movement-test/baseline');
        return;
      }

      if (code === 'GO_ONBOARDING') {
        markReadinessChecked();
        router.replace('/onboarding');
        return;
      }

      if (code === 'GO_AUTH') {
        markReadinessChecked();
        router.replace('/app/auth');
        return;
      }

      // GO_PAYMENT, GO_SESSION_CREATE, GO_APP_HOME → pass-through
      markReadinessChecked();
      setGating(false);
    })().catch(() => {
      if (!cancelled) {
        markReadinessChecked();
        setGating(false);
      }
    });

    return () => { cancelled = true; };
  }, [router]);

  // gating 중이면 children를 렌더링하지 않는다 (플래시 방지).
  // 단, 기본값 false이므로 실제로는 거의 항상 즉시 children 노출.
  if (gating) return null;

  return <>{children}</>;
}
