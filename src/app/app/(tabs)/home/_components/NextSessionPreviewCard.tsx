'use client';

import { useRouter } from 'next/navigation';
import type { SessionPlan, ActivePlanSummary } from '@/lib/session/client';

type PreviewState = 'active_now' | 'today_completed' | 'next_pending' | 'program_complete';

function formatUnlockHint(nextUnlockAt: string | null): string {
  if (!nextUnlockAt) return '내일 다시 열립니다.';
  try {
    const d = new Date(nextUnlockAt);
    if (Number.isNaN(d.getTime())) return '내일 다시 열립니다.';
    const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
    const h = kst.getUTCHours();
    const m = kst.getUTCMinutes();
    if (h === 0 && m === 0) return '다음 세션은 내일 열립니다.';
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} 이후 열립니다.`;
  } catch {
    return '내일 다시 열립니다.';
  }
}

function getPreviewState(
  progress: { total_sessions: number; completed_sessions: number } | null,
  activePlan: SessionPlan | ActivePlanSummary | null,
  todayCompleted: boolean
): PreviewState {
  if (!progress) return 'next_pending';
  const { total_sessions, completed_sessions } = progress;
  if (completed_sessions >= total_sessions) return 'program_complete';
  if (todayCompleted) return 'today_completed';
  if (activePlan) return 'active_now';
  return 'next_pending';
}

interface NextSessionPreviewCardProps {
  totalSessions: number;
  completedSessions: number;
  activePlan: SessionPlan | ActivePlanSummary | null;
  todayCompleted: boolean;
  nextUnlockAt: string | null;
  onScrollToMap: () => void;
}

export default function NextSessionPreviewCard({
  totalSessions,
  completedSessions,
  activePlan,
  todayCompleted,
  nextUnlockAt,
  onScrollToMap,
}: NextSessionPreviewCardProps) {
  const router = useRouter();
  const progress = { total_sessions: totalSessions, completed_sessions: completedSessions };
  const state = getPreviewState(progress, activePlan, todayCompleted);
  const nextNum = Math.min(completedSessions + 1, totalSessions);

  if (state === 'program_complete') {
    return (
      <section
        className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 shadow-[2px_2px_0_0_rgba(15,23,42,0.08)]"
        aria-label="다음 세션 미리보기"
      >
        <p className="text-sm font-semibold text-slate-800">프로그램 완료!</p>
        <p className="mt-0.5 text-xs text-slate-500">
          {completedSessions}회 세션을 모두 마치셨어요.
        </p>
        <button
          type="button"
          onClick={() => router.push('/app/checkin')}
          className="mt-3 block w-full rounded-full border border-slate-300 bg-slate-50 py-2 text-xs font-medium text-slate-700"
        >
          기록 보기
        </button>
      </section>
    );
  }

  if (state === 'today_completed') {
    return (
      <section
        className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/60 px-4 py-3 shadow-[2px_2px_0_0_rgba(15,23,42,0.08)]"
        aria-label="다음 세션 미리보기"
      >
        <p className="text-sm font-semibold text-slate-800">오늘 세션 완료</p>
        <p className="mt-0.5 text-xs text-slate-600">
          다음 세션 {nextNum} · {formatUnlockHint(nextUnlockAt)}
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => router.push('/app/checkin')}
            className="flex-1 rounded-full border-2 border-slate-900 bg-slate-800 py-2 text-xs font-bold text-white shadow-[2px_2px_0_0_rgba(15,23,42,1)]"
          >
            오늘 몸상태 체크
          </button>
          <button
            type="button"
            onClick={() => router.push('/app/install?from=/app/home')}
            className="rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-600"
          >
            앱 설치
          </button>
        </div>
      </section>
    );
  }

  if (state === 'active_now') {
    const sessionNum = activePlan?.session_number ?? nextNum;
    return (
      <section
        className="rounded-2xl border-2 border-orange-200 bg-orange-50/60 px-4 py-3 shadow-[2px_2px_0_0_rgba(15,23,42,0.08)]"
        aria-label="다음 세션 미리보기"
      >
        <p className="text-sm font-semibold text-slate-800">세션 {sessionNum}</p>
        <p className="mt-0.5 text-xs text-slate-600">지금 시작 가능</p>
        <button
          type="button"
          onClick={onScrollToMap}
          className="mt-3 block w-full rounded-full border-2 border-slate-900 bg-orange-400 py-2.5 text-sm font-bold text-slate-900 shadow-[2px_2px_0_0_rgba(15,23,42,1)]"
        >
          지도에서 시작하기
        </button>
      </section>
    );
  }

  return (
    <section
      className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 shadow-[2px_2px_0_0_rgba(15,23,42,0.08)]"
      aria-label="다음 세션 미리보기"
    >
      <p className="text-sm font-semibold text-slate-800">다음 세션 {nextNum}</p>
      <p className="mt-0.5 text-xs text-slate-600">시작 준비됐어요</p>
      <button
        type="button"
        onClick={onScrollToMap}
        className="mt-3 block w-full rounded-full border-2 border-slate-900 bg-slate-800 py-2.5 text-sm font-bold text-white shadow-[2px_2px_0_0_rgba(15,23,42,1)]"
      >
        지도 보기
      </button>
    </section>
  );
}
