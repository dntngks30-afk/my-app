'use client';

/**
 * Demo Deep Test - Result client (localStorage load, same UI as paid)
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { load, reset } from '@/lib/demo/deepTestDemoStorage';
import { getCopy } from '@/lib/deep-result/copy';
import { toRadarScores } from '@/lib/deep-result/score-utils';
import PatternBanner from '@/app/app/deep-test/result/_components/PatternBanner';
import RadarChart from '@/app/app/deep-test/result/_components/RadarChart';
import ResultNarrative from '@/app/app/deep-test/result/_components/ResultNarrative';
import ScoreCards from '@/app/app/deep-test/result/_components/ScoreCards';
import TagChips from '@/app/app/deep-test/result/_components/TagChips';

interface DerivedData {
  result_type?: string;
  algorithm_scores?: {
    upper_score?: number;
    lower_score?: number;
    core_score?: number;
    balance_score?: number;
    pain_risk?: number;
  };
  focus_tags?: string[];
  avoid_tags?: string[];
}

const nbCard = 'rounded-2xl border-2 border-slate-950 bg-white p-4 shadow-[4px_4px_0_0_rgba(2,6,23,1)]';
const nbBtnPrimary = 'rounded-full border-2 border-slate-950 bg-slate-800 px-6 py-3 text-sm font-bold text-white shadow-[4px_4px_0_0_rgba(2,6,23,1)] transition hover:opacity-95';
const nbBtnSecondary = 'rounded-full border-2 border-slate-950 bg-white px-6 py-3 text-sm font-bold text-slate-800 transition hover:opacity-95';

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

  const hasResult =
    derived?.result_type && typeof derived.result_type === 'string';

  if (!hasResult) {
    return (
      <div className="max-w-md mx-auto space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400 text-slate-900 text-xs font-bold mb-4">
          DEMO (NO LOGIN)
        </div>
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

  const copy = getCopy(derived.result_type);
  const radarScores = toRadarScores(derived.algorithm_scores);
  const focusTags = derived.focus_tags ?? [];
  const avoidTags = derived.avoid_tags ?? [];

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400 text-slate-900 text-xs font-bold">
        DEMO (NO LOGIN)
      </div>

      <div>
        <h1 className="text-xl font-bold text-slate-800 mb-2">
          나의 움직임 경향
        </h1>
      </div>

      <PatternBanner copy={copy} />

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <RadarChart scores={radarScores} maxScore={10} size={240} />
        <ScoreCards scores={radarScores} maxScore={10} />
      </section>

      <ResultNarrative copy={copy} />
      <TagChips focusTags={focusTags} avoidTags={avoidTags} />

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
