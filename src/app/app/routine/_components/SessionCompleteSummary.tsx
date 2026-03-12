'use client';

/**
 * SessionCompleteSummary
 *
 * complete 응답 후 표시되는 요약 화면.
 * 오늘 운동 시간 / 진척도 / 오늘 기록(exercise_logs) / 다음 테마
 * + 오늘 몸상태 체크 CTA (daily_conditions SSOT 연결)
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Home, BarChart2, Activity } from 'lucide-react';
import { NeoCard, NeoButton } from '@/components/neobrutalism';
import { CheckInModal } from '@/app/app/_components/CheckInModal';
import { getSessionSafe } from '@/lib/supabase';
import type { SessionProgress, ExerciseLogItem } from '@/lib/session/client';

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
  exerciseLogs,
  completedSessionNumber,
  onDismiss,
  showBodyCheckCta = true,
  variant = 'routine',
  onNextSessionClick,
}: {
  durationSeconds: number;
  progress: SessionProgress;
  nextTheme: string | null;
  durationClamped?: boolean;
  exerciseLogs?: ExerciseLogItem[] | null;
  completedSessionNumber?: number | null;
  onDismiss?: () => void;
  /** 오늘 몸상태 체크 CTA 표시 (post-completion reflection) */
  showBodyCheckCta?: boolean;
  /** PR-SESSION-EXPERIENCE-01: home 맥락 시 "지도 돌아가기" / "다음 세션 보기" 표시 */
  variant?: 'home' | 'routine';
  /** PR-SESSION-EXPERIENCE-01: 다음 세션 보기 클릭 시 (variant=home) */
  onNextSessionClick?: () => void;
}) {
  const router = useRouter();
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [checkInError, setCheckInError] = useState<string | null>(null);
  const [checkInSuccess, setCheckInSuccess] = useState(false);

  const handleCheckInSubmit = async (values: {
    pain_today?: number | null;
    stiffness?: number | null;
    sleep?: number | null;
    time_available_min?: number | null;
  }) => {
    const { session } = await getSessionSafe();
    if (!session?.access_token) {
      setCheckInError('로그인이 필요합니다.');
      return;
    }
    setCheckInError(null);
    const res = await fetch('/api/daily-condition/upsert', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ ...values, source: 'post_workout' }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setCheckInError(data?.error ?? '저장 실패');
      return;
    }
    setCheckInSuccess(true);
  };

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

        {exerciseLogs && exerciseLogs.length > 0 && (
          <div className="rounded-xl bg-stone-50 p-4 border border-stone-200">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">
              오늘 기록
            </p>
            <ul className="space-y-1.5">
              {exerciseLogs.map((log, i) => (
                <li key={i} className="text-sm text-slate-800">
                  {log.name}
                  {(log.sets != null || log.reps != null) && (
                    <span className="text-slate-600 ml-1">
                      · {log.sets ?? '-'}×{log.reps ?? '-'}
                    </span>
                  )}
                  {log.difficulty != null && (
                    <span className="text-slate-600 ml-1">· 난이도 {log.difficulty}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {nextTheme && (
          <div className="rounded-xl bg-violet-50 p-4 border border-violet-200">
            <p className="text-xs text-violet-600 uppercase tracking-wide mb-0.5">
              다음 세션 테마
            </p>
            <p className="text-base font-semibold text-violet-900">{nextTheme}</p>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          {variant === 'home' ? (
            <>
              <NeoButton
                variant="orange"
                fullWidth
                onClick={() => {
                  onDismiss?.();
                  router.push('/app/home');
                }}
                className="py-3 flex items-center justify-center gap-2"
              >
                <Home className="size-4" />
                지도 돌아가기
              </NeoButton>
              {onNextSessionClick && (
                <NeoButton
                  variant="secondary"
                  fullWidth
                  onClick={() => {
                    onNextSessionClick();
                  }}
                  className="py-3 flex items-center justify-center gap-2"
                >
                  <BarChart2 className="size-4" />
                  다음 세션 보기
                </NeoButton>
              )}
            </>
          ) : (
            <>
              <NeoButton
                variant="orange"
                fullWidth
                onClick={() => {
                  onDismiss?.();
                  router.push('/app/home');
                }}
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
                  const q = completedSessionNumber != null ? `?focusSession=${completedSessionNumber}` : '';
                  router.push(`/app/checkin${q}`);
                }}
                className="py-3 flex items-center justify-center gap-2"
              >
                <BarChart2 className="size-4" />
                루틴 확인
              </NeoButton>
            </>
          )}
        </div>
        {showBodyCheckCta && (
          <button
            type="button"
            onClick={() => setShowCheckIn(true)}
            className="flex w-full items-center justify-center gap-2 rounded-full border-2 border-slate-300 bg-white py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 active:scale-[0.98]"
          >
            <Activity className="size-4" />
            오늘 몸상태 체크
          </button>
        )}
      </div>

      {showCheckIn && (
        <CheckInModal
          isPostWorkout
          submitLabel="저장"
          onSubmit={handleCheckInSubmit}
          onSkip={() => setShowCheckIn(false)}
          onClose={() => setShowCheckIn(false)}
          saveError={checkInError}
          saveSuccess={checkInSuccess}
        />
      )}
    </NeoCard>
  );
}
