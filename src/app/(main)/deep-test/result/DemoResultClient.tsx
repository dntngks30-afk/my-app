'use client';

/**
 * Demo Deep Test - Result client (localStorage load)
 * 앱과 동일한 UI: DeepTestResultContent 사용
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { load, reset } from '@/lib/demo/deepTestDemoStorage';
import {
  getEffectiveConfidence,
  toConfidenceSourceFromDerived,
} from '@/lib/deep-result/effective-confidence';
import DeepTestResultContent from '@/app/app/deep-test/result/_components/DeepTestResultContent';
import type { DeepTestResultContentProps } from '@/app/app/deep-test/result/_components/DeepTestResultContent';

interface DerivedData {
  result_type?: string;
  confidence?: number;
  algorithm_scores?: DeepTestResultContentProps['algorithmScores'];
  focus_tags?: string[];
  avoid_tags?: string[];
}

const nbCard = 'rounded-2xl border-2 border-slate-950 bg-white p-4 shadow-[4px_4px_0_0_rgba(2,6,23,1)]';
const nbBtnPrimary = 'rounded-full border-2 border-slate-950 bg-slate-800 px-6 py-3 text-sm font-bold text-white shadow-[4px_4px_0_0_rgba(2,6,23,1)] transition hover:opacity-95';

export default function DemoResultClient() {
  const router = useRouter();
  const [derived, setDerived] = useState<DerivedData | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const data = load();
    if (data?.derived && typeof data.derived === 'object') {
      setDerived(data.derived as DerivedData);
    } else {
      setDerived(null);
    }
    setMounted(true);
  }, []);

  const handleReset = () => {
    reset();
    router.push('/deep-test');
  };

  if (!mounted) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-sm text-stone-500">로딩 중...</p>
      </div>
    );
  }

  const hasResult = derived?.result_type && typeof derived.result_type === 'string';

  if (!hasResult) {
    return (
      <div className="max-w-md mx-auto space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400 text-slate-900 text-xs font-bold mb-4">
          DEMO (NO LOGIN)
        </div>
        <div className={nbCard}>
          <h2 className="text-lg font-bold text-slate-800 mb-2">결과가 없어요</h2>
          <p className="text-sm text-slate-600 mb-4">
            데모 테스트를 완료하면 여기에 결과가 표시됩니다.
          </p>
          <Link href="/deep-test/run" className={nbBtnPrimary + ' inline-block'}>
            데모 테스트 시작
          </Link>
        </div>
      </div>
    );
  }

  const effectiveConfidence = getEffectiveConfidence(toConfidenceSourceFromDerived(derived));

  return (
    <DeepTestResultContent
      resultType={derived.result_type}
      confidence={effectiveConfidence}
      focusTags={derived.focus_tags ?? []}
      avoidTags={derived.avoid_tags ?? []}
      algorithmScores={derived.algorithm_scores ?? undefined}
      variant="demo"
      onReset={handleReset}
    />
  );
}
