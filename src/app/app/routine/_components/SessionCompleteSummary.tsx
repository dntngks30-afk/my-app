'use client';

/**
 * SessionCompleteSummary
 *
 * complete 응답 후 표시되는 요약 화면.
 * 오늘 운동 시간 / 진척도 / 다음 테마 (운동 리스트 금지)
 */

import { useRouter } from 'next/navigation';
import { CheckCircle2, Home, Calendar } from 'lucide-react';
import { NeoCard, NeoButton } from '@/components/neobrutalism';
import type { SessionProgress } from '@/lib/session/client';

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}분 ${s}초`;
}

export default function SessionCompleteSummary({
  durationSeconds,
  progress,
  nextTheme,
  durationClamped,
  onDismiss,
}: {
  durationSeconds: number;
  progress: SessionProgress;
  nextTheme: string | null;
  durationClamped?: boolean;
  onDismiss?: () => void;
}) {
  const router = useRouter();

  return (
    <NeoCard className="p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircle2 className="size-7 text-emerald-600" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-800">오늘 운동 완료!</h2>
          <p className="text-sm text-slate-500">잘했어요 🎉</p>
        </div>
      </div>

      <div className="space-y-4 mb-6">
        <div className="rounded-xl bg-stone-50 p-4 border border-stone-200">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-0.5">
            오늘 운동 시간
          </p>
          <p className="text-xl font-bold text-slate-800">
            {formatDuration(durationSeconds)}
          </p>
          {durationClamped && (
            <p className="text-xs text-amber-600 mt-1">비정상적으로 길어 보여요. 120분으로 기록했어요.</p>
          )}
        </div>

        <div className="rounded-xl bg-stone-50 p-4 border border-stone-200">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-0.5">
            진행도
          </p>
          <p className="text-xl font-bold text-slate-800">
            {progress.completed_sessions} / {progress.total_sessions} 세션
          </p>
        </div>

        {nextTheme && (
          <div className="rounded-xl bg-violet-50 p-4 border border-violet-200">
            <p className="text-xs text-violet-600 uppercase tracking-wide mb-0.5">
              다음 세션 테마
            </p>
            <p className="text-base font-semibold text-violet-900">{nextTheme}</p>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <NeoButton
          variant="orange"
          fullWidth
          onClick={() => router.push('/app/home')}
          className="py-3 flex items-center justify-center gap-2"
        >
          <Home className="size-4" />
          홈으로
        </NeoButton>
        <NeoButton
          variant="secondary"
          fullWidth
          onClick={() => {
            onDismiss?.();
            router.push('/app/routine');
          }}
          className="py-3 flex items-center justify-center gap-2"
        >
          <Calendar className="size-4" />
          루틴 확인
        </NeoButton>
      </div>
    </NeoCard>
  );
}
