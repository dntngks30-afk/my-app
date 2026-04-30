'use client';

/**
 * PR-AUTH-HANDOFF-01 — 인앱 → 외부 브라우저 bridge 복구 + OAuth/이메일 진입 분기
 */

import { useEffect, useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase';
import { saveBridgeContext } from '@/lib/public-results/public-result-bridge';
import { savePilotContextFromCode } from '@/lib/pilot/pilot-context';
import { startOAuthClient, type OAuthProvider } from '@/lib/auth/startOAuthClient';
import {
  parseAuthHandoffSearchParams,
  buildExecutionStartPathWithBridgeQuery,
  sanitizeAuthNextPath,
  DEFAULT_HANDOFF_NEXT,
} from '@/lib/auth/authHandoffContract';
import type { BridgeResultStage } from '@/lib/public-results/public-result-bridge';

const FALLBACK_AUTH = `/app/auth?next=${encodeURIComponent(DEFAULT_HANDOFF_NEXT)}`;

export default function HandoffClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const spKey = useMemo(() => searchParams.toString(), [searchParams]);
  const [message, setMessage] = useState('리셋을 이어서 연결하는 중...');

  useEffect(() => {
    const parsed = parseAuthHandoffSearchParams(new URLSearchParams(spKey));
    if (!parsed.ok) {
      router.replace(FALLBACK_AUTH);
      return;
    }

    const v = parsed.value;
    setMessage('방금 확인한 결과를 안전하게 이어갈게요.');

    const oauthNext =
      v.publicResultId && v.stage
        ? buildExecutionStartPathWithBridgeQuery({
            publicResultId: v.publicResultId,
            stage: v.stage as BridgeResultStage,
            anonId: v.anonId,
            pilot: v.pilot,
          })
        : sanitizeAuthNextPath(v.next, DEFAULT_HANDOFF_NEXT);

    if (v.publicResultId && v.stage) {
      saveBridgeContext({
        publicResultId: v.publicResultId,
        resultStage: v.stage as BridgeResultStage,
        anonId: v.anonId ?? undefined,
      });
    }
    if (v.pilot) {
      savePilotContextFromCode(v.pilot, 'in_app_auth_handoff');
    }

    const flowKey = `mr_handoff_flow_${spKey}`;
    if (typeof window !== 'undefined' && sessionStorage.getItem(flowKey)) {
      return;
    }
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(flowKey, '1');
    }

    const oauthLockKey = `mr_auth_handoff_oauth_${v.ts}_${v.method}`;

    void (async () => {
      if (v.method === 'email') {
        const encNext = encodeURIComponent(oauthNext);
        if (v.mode === 'signup') {
          // Flow lock: email/signup handoff는 사용자의 회원가입 intent가 우선이다.
          // 기존 세션 short-circuit로 execution(/onboarding 포함)에 보내면
          // “회원가입 클릭 → 온보딩” 회귀가 발생하므로 signup 진입을 강제한다.
          const {
            data: { session },
          } = await supabaseBrowser.auth.getSession();
          if (session) {
            await supabaseBrowser.auth.signOut().catch(() => undefined);
          }
          router.replace(`/signup?next=${encNext}`);
        } else {
          // OAuth handoff와 달리 email/login은 기존 정책대로 session short-circuit 허용.
          const {
            data: { session },
          } = await supabaseBrowser.auth.getSession();
          if (session) {
            router.replace(oauthNext);
            return;
          }
          router.replace(`/app/auth?next=${encNext}`);
        }
        return;
      }

      const {
        data: { session },
      } = await supabaseBrowser.auth.getSession();

      // OAuth handoff(google/kakao)는 기존 session short-circuit 정책 유지.
      if (session) {
        router.replace(oauthNext);
        return;
      }

      if (typeof window !== 'undefined' && sessionStorage.getItem(oauthLockKey)) {
        return;
      }
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(oauthLockKey, '1');
      }

      const provider: OAuthProvider = v.method === 'google' ? 'google' : 'kakao';
      await startOAuthClient({
        provider,
        next: oauthNext,
        setOauthError: () => {
          router.replace(FALLBACK_AUTH);
        },
      });
    })();
  }, [router, spKey]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#0c1324] px-6">
      <p
        className="text-center text-base font-medium text-[#e8e8ef]"
        style={{ fontFamily: 'var(--font-sans-noto)' }}
      >
        {message}
      </p>
      <p className="text-center text-sm text-[#9a9aa8]" style={{ fontFamily: 'var(--font-sans-noto)' }}>
        잠시만 기다려 주세요.
      </p>
    </div>
  );
}
