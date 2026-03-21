'use client';

/**
 * PR-PUBLIC-SELFTEST-REMOVE-07A — Self-test 호환성 리디렉트
 *
 * 이 페이지는 더 이상 공개 테스트 플로우의 활성 단계가 아니다.
 * 구 북마크·링크로 진입하는 사용자를 안전하게 현대 경로로 유도한다.
 *
 * - 설문 답변이 있으면(완료 여부 무관) → /movement-test/refine-bridge
 * - 없으면 → /movement-test/survey
 *
 * 채점 로직, selfTest 세션 필드, finalType 은 이 파일에서 더 이상 쓰지 않는다.
 * (기존 세션에 selfTest/finalType이 남아 있어도 현대 경로는 그 값을 읽지 않는다.)
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const KEY = 'movementTestSession:v2';

function hasSurveyAnswers(): boolean {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (data?.version !== 'v2') return false;
    return (
      data.answersById &&
      typeof data.answersById === 'object' &&
      Object.keys(data.answersById).length > 0
    );
  } catch {
    return false;
  }
}

export default function SelfTestRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    if (hasSurveyAnswers()) {
      router.replace('/movement-test/refine-bridge');
    } else {
      router.replace('/movement-test/survey');
    }
  }, [router]);

  return (
    <div
      className="min-h-[100svh] flex items-center justify-center"
      style={{ backgroundColor: '#0d161f' }}
    >
      <p
        className="text-slate-400 text-sm"
        style={{ fontFamily: 'var(--font-sans-noto)' }}
      >
        이동 중...
      </p>
    </div>
  );
}
