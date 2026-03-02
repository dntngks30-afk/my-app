'use client';

/**
 * Demo Deep Test - Result client (localStorage load, shared DeepResultViewClient)
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { load, reset } from '@/lib/demo/deepTestDemoStorage';
import DeepResultViewClient, {
  type DeepResultDerived,
} from '@/components/deep-result/DeepResultViewClient';

const nbCard =
  'rounded-2xl border-2 border-slate-950 bg-white p-4 shadow-[4px_4px_0_0_rgba(2,6,23,1)]';
const nbBtnPrimary =
  'rounded-full border-2 border-slate-950 bg-slate-800 px-6 py-3 text-sm font-bold text-white shadow-[4px_4px_0_0_rgba(2,6,23,1)] transition hover:opacity-95';
const nbBtnSecondary =
  'rounded-full border-2 border-slate-950 bg-white px-6 py-3 text-sm font-bold text-slate-800 transition hover:opacity-95';

export default function DemoResultClient() {
  const router = useRouter();
  const [derived, setDerived] = useState<DeepResultDerived | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const data = load();
    if (data?.derived && typeof data.derived === 'object') {
      setDerived(data.derived as DeepResultDerived);
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

  const hasResult =
    derived?.result_type && typeof derived.result_type === 'string';

  if (!hasResult) {
    return (
      <div className="max-w-md mx-auto space-y-6">
        <div className={nbCard}>
          <h2 className="text-lg font-bold text-slate-800 mb-2">
            결과가 없어요
          </h2>
          <p className="text-sm text-stone-600 mb-4">
            데모 테스트를 완료하면 여기에 결과가 표시됩니다.
          </p>
          <Link href="/deep-test/run" className={nbBtnPrimary + ' inline-block'}>
            데모 테스트 시작
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      <DeepResultViewClient derived={derived} variant="demo" />

      <div className="flex gap-3 pt-4">
        <Link href="/deep-test/run" className={nbBtnPrimary}>
          다시 하기
        </Link>
        <button type="button" onClick={handleReset} className={nbBtnSecondary}>
          초기화
        </button>
      </div>
    </div>
  );
}
