'use client';

/**
 * PR-LEGACY-RESULT-CLEANUP — `/movement-test/result` 레거시 동물형 결과 UI 제거
 *
 * 과거: PR3-4 기반 calculateScoresV2 + RESULT_CONTENT 전체 페이지.
 * 현재: canonical public funnel은 survey → refine-bridge → baseline/refined (PublicResultRenderer).
 *
 * 이 라우트는 북마크·옛 링크 호환용으로만 유지하며, 실제 렌더 없이 canonical 경로로 수렴한다.
 * 리다이렉트 판단은 version / isCompleted / answersById 만 사용한다(레거시 세션 키 무시).
 *
 * Fallback 규칙:
 * - movementTestSession:v2 완료 + 답변 있음 → /movement-test/refine-bridge
 * - v2 미완료이나 답변 일부 있음 → /movement-test/survey
 * - 그 외 → /movement-test (공개 테스트 입구)
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const SESSION_V2_KEY = 'movementTestSession:v2';

/** 레거시 URL 진입 시 이동할 경로 (localStorage 기준) */
function resolveLegacyResultRedirect(): string {
  try {
    const raw = localStorage.getItem(SESSION_V2_KEY);
    if (!raw) return '/movement-test';
    const data = JSON.parse(raw) as {
      version?: string;
      isCompleted?: boolean;
      answersById?: Record<string, unknown>;
    };
    if (data?.version !== 'v2') return '/movement-test';

    const answers = data.answersById ?? {};
    const hasAnswers =
      typeof answers === 'object' && answers !== null && Object.keys(answers).length > 0;

    if (data.isCompleted === true && hasAnswers) {
      return '/movement-test/refine-bridge';
    }
    if (hasAnswers) {
      return '/movement-test/survey';
    }
    return '/movement-test';
  } catch {
    return '/movement-test';
  }
}

export default function LegacyMovementTestResultRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(resolveLegacyResultRedirect());
  }, [router]);

  return (
    <div
      className="mr-public-funnel-shell min-h-[100svh] flex flex-col items-center justify-center gap-2 px-6"
      style={{ fontFamily: 'var(--font-sans-noto)' }}
    >
      <p className="text-slate-400 text-sm text-center">최신 결과 화면으로 이동 중...</p>
      <p className="text-slate-600 text-xs text-center">
        이 주소는 이전 버전 호환용입니다. 잠시 후 자동으로 이동합니다.
      </p>
    </div>
  );
}
