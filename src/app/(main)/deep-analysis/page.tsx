/**
 * 심층분석 랜딩 페이지 (v1)
 * docs/ui-spec/stitch/deep-analysis-v1.html 기반
 * useSearchParams 사용 → Suspense로 감쌈
 */

import { Suspense } from 'react';
import DeepAnalysisClient from './_components/DeepAnalysisClient';

export default function DeepAnalysisPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[var(--bg)]"><p className="text-sm text-[var(--muted)]">로딩 중...</p></div>}>
      <DeepAnalysisClient />
    </Suspense>
  );
}
