'use client';

/**
 * SessionCompleteSummary
 *
 * complete 응답 후 표시되는 요약 화면.
 * PR-RETENTION-01: 오늘 운동 완료 / Reset Map 진행 / 다음 세션 CTA / Return Loop
 * 오늘 운동 시간 / 진척도 / 오늘 기록(exercise_logs) / 다음 테마
 * + 오늘 몸상태 체크 CTA (daily_conditions SSOT 연결)
 */

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Home, BarChart2, Activity } from 'lucide-react';
import { NeoCard, NeoButton } from '@/components/neobrutalism';
import {
  dashedSecondaryBtn,
  primaryCtaRestrained,
  sessionGoalCard,
  sessionGoalLabel,
} from '@/app/app/(tabs)/home/_components/reset-map-v2/homeExecutionTheme';
import { CheckInModal } from '@/app/app/_components/CheckInModal';
import { getSessionSafe } from '@/lib/supabase';
import type { SessionProgress, ExerciseLogItem } from '@/lib/session/client';

type SessionProgressSummary = Pick<SessionProgress, 'completed_sessions' | 'total_sessions'>;

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
  /** PR-RETENTION-01: daily cap 시 "내일 다음 세션이 준비됩니다" 표시 */
  isNextLockedUntilTomorrow = false,
}: {
  durationSeconds: number;
  progress: SessionProgressSummary;
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
  isNextLockedUntilTomorrow?: boolean;
}) {
  const router = useRouter();
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [checkInError, setCheckInError] = useState<string | null>(null);
  const [checkInSuccess, setCheckInSuccess] = useState(false);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!checkInSuccess || !showCheckIn) return;
    closeTimeoutRef.current = setTimeout(() => {
      setShowCheckIn(false);
    }, 500);
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
    };
  }, [checkInSuccess, showCheckIn]);

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

  const isHomeSurface = variant === 'home';

  const summaryBody = (
    <>
      <div className="mb-5 flex items-center gap-3">
        <div
          className={
            isHomeSurface
              ? 'flex size-12 shrink-0 items-center justify-center rounded-full border border-emerald-500/25 bg-emerald-500/15'
              : 'flex size-12 shrink-0 items-center justify-center rounded-full bg-emerald-100'
          }
        >
          <CheckCircle2
            className={isHomeSurface ? 'size-7 text-emerald-300' : 'size-7 text-emerald-600'}
          />
        </div>
        <div>
          <h2 className={isHomeSurface ? 'text-lg font-bold text-white/90' : 'text-lg font-bold text-slate-800'}>
            오늘 세션 완료
          </h2>
          <p className={isHomeSurface ? 'text-sm text-white/55' : 'text-sm text-slate-500'}>
            Reset Map 한 칸 진행 · 잘했어요 🎉
          </p>
        </div>
      </div>

      <div className="space-y-4 mb-6">
        <div
          className={
            isHomeSurface
              ? sessionGoalCard
              : 'rounded-xl bg-stone-50 p-4 border border-stone-200'
          }
        >
          <p className={isHomeSurface ? `${sessionGoalLabel} mb-0.5` : 'text-xs text-slate-500 uppercase tracking-wide mb-0.5'}>
            오늘 운동 시간
          </p>
          <p className={isHomeSurface ? 'text-xl font-bold text-white/90' : 'text-xl font-bold text-slate-800'}>
            {formatDuration(durationSeconds)}
          </p>
          {durationClamped && (
            <p className={isHomeSurface ? 'text-xs text-amber-200/90 mt-1' : 'text-xs text-amber-600 mt-1'}>
              비정상적으로 길어 보여요. 120분으로 기록했어요.
            </p>
          )}
        </div>

        <div
          className={
            isHomeSurface
              ? sessionGoalCard
              : 'rounded-xl bg-stone-50 p-4 border border-stone-200'
          }
        >
          <p className={isHomeSurface ? `${sessionGoalLabel} mb-0.5` : 'text-xs text-slate-500 uppercase tracking-wide mb-0.5'}>
            리셋 지도 진행률
          </p>
          <p className={isHomeSurface ? 'text-xl font-bold text-white/90' : 'text-xl font-bold text-slate-800'}>
            {progress.completed_sessions} / {progress.total_sessions} 세션
          </p>
          {completedSessionNumber != null && (
            <p className={isHomeSurface ? 'text-xs text-white/65 mt-1 font-medium' : 'text-xs text-slate-600 mt-1 font-medium'}>
              Day {completedSessionNumber} 완료
            </p>
          )}
          <p className={isHomeSurface ? 'text-xs text-white/45 mt-0.5' : 'text-xs text-slate-500 mt-0.5'}>
            {Math.round((progress.completed_sessions / Math.max(1, progress.total_sessions)) * 100)}% 완료
          </p>
        </div>

        {exerciseLogs && exerciseLogs.length > 0 && (
          <div
            className={
              isHomeSurface
                ? sessionGoalCard
                : 'rounded-xl bg-stone-50 p-4 border border-stone-200'
            }
          >
            <p className={isHomeSurface ? `${sessionGoalLabel} mb-2` : 'text-xs text-slate-500 uppercase tracking-wide mb-2'}>
              오늘 기록
            </p>
            <ul className="space-y-1.5">
              {exerciseLogs.map((log, i) => (
                <li key={i} className={isHomeSurface ? 'text-sm text-white/85' : 'text-sm text-slate-800'}>
                  {log.name}
                  {(log.sets != null || log.reps != null) && (
                    <span className={isHomeSurface ? 'text-white/55 ml-1' : 'text-slate-600 ml-1'}>
                      · {log.sets ?? '-'}×{log.reps ?? '-'}
                    </span>
                  )}
                  {log.difficulty != null && (
                    <span className={isHomeSurface ? 'text-white/55 ml-1' : 'text-slate-600 ml-1'}>
                      · 난이도 {log.difficulty}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* PR-RISK-02: 다음 세션 안내는 NextSessionPreviewCard에서만 표시 (중복 제거) */}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          {variant === 'home' ? (
            <>
              <button
                type="button"
                onClick={() => {
                  onDismiss?.();
                  router.push('/app/home');
                }}
                className={`${primaryCtaRestrained} py-3 flex items-center justify-center gap-2`}
              >
                <Home className="size-4" />
                지도 돌아가기
              </button>
              {/* PR-RISK-02: 다음 세션 CTA는 NextSessionPreviewCard에서만 (중복 제거) */}
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
        {isNextLockedUntilTomorrow && (
          <p className={isHomeSurface ? 'text-center text-xs text-white/45' : 'text-center text-xs text-slate-500'}>
            내일 다음 세션이 준비됩니다
          </p>
        )}
        {/* PR-RISK-02: 다음 세션 설명은 NextSessionPreviewCard에서만 */}
        {!nextTheme && progress.completed_sessions >= progress.total_sessions && (
          <p className={isHomeSurface ? 'text-center text-xs text-white/45' : 'text-center text-xs text-slate-500'}>
            모든 세션을 완료했어요. 수고하셨습니다!
          </p>
        )}
        {showBodyCheckCta && (
          <button
            type="button"
            onClick={() => setShowCheckIn(true)}
            className={
              isHomeSurface
                ? dashedSecondaryBtn + ' rounded-full py-2.5 text-sm font-medium'
                : 'flex w-full items-center justify-center gap-2 rounded-full border-2 border-slate-300 bg-white py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 active:scale-[0.98]'
            }
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
    </>
  );

  if (isHomeSurface) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-inner shadow-black/20">
        {summaryBody}
      </div>
    );
  }

  return <NeoCard className="p-6">{summaryBody}</NeoCard>;
}
