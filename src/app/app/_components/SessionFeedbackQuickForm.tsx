'use client';

/**
 * 최소 세션 피드백 수집 — 4개 신호, 탭 몇 번으로 완료.
 * optional: 모두 건너뛰어도 completion 차단하지 않음.
 */

import type { FeedbackPayload, SessionFeedbackPayload } from '@/lib/session/feedback-types';

type DifficultyFeedback = 'too_easy' | 'ok' | 'too_hard';

export type SessionFeedbackQuickFormVariant = 'light' | 'dark';

interface SessionFeedbackQuickFormProps {
  value: FeedbackPayload | null;
  onChange: (v: FeedbackPayload | null) => void;
  /** completion_ratio 파생용: all_done이면 1, partial이면 done/total */
  derivedCompletionRatio?: number;
  className?: string;
  /** dark: 홈 실행 모달 / 오늘 운동 기록 시트. light: 루틴 패널 등 밝은 배경 (기본) */
  variant?: SessionFeedbackQuickFormVariant;
}

const RPE_OPTIONS: { label: string; value: number }[] = [
  { label: '1', value: 1 },
  { label: '3', value: 3 },
  { label: '5', value: 5 },
  { label: '7', value: 7 },
  { label: '10', value: 10 },
];

const PAIN_OPTIONS: { label: string; value: number }[] = [
  { label: '없음', value: 0 },
  { label: '약함', value: 2 },
  { label: '보통', value: 5 },
  { label: '심함', value: 8 },
];

const RATIO_OPTIONS: { label: string; value: number }[] = [
  { label: '25%', value: 0.25 },
  { label: '50%', value: 0.5 },
  { label: '75%', value: 0.75 },
  { label: '100%', value: 1 },
];

const DIFFICULTY_OPTIONS: { label: string; value: DifficultyFeedback }[] = [
  { label: '쉬웠어요', value: 'too_easy' },
  { label: '적당해요', value: 'ok' },
  { label: '힘들었어요', value: 'too_hard' },
];

function chipClasses(active: boolean, variant: SessionFeedbackQuickFormVariant): string {
  if (variant === 'dark') {
    return active
      ? 'rounded-lg border border-orange-500/45 bg-orange-500/15 px-3 py-1.5 text-xs font-medium text-orange-100 shadow-[0_0_10px_-3px_rgba(251,146,60,0.4)] transition'
      : 'rounded-lg border border-white/12 bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-white/70 transition hover:bg-white/[0.09]';
  }
  return active
    ? 'rounded-lg px-3 py-1.5 text-xs font-medium transition bg-orange-100 text-orange-700 border border-orange-300'
    : 'rounded-lg px-3 py-1.5 text-xs font-medium transition bg-slate-100 text-slate-600 hover:bg-slate-200 border border-transparent';
}

export function SessionFeedbackQuickForm({
  value,
  onChange,
  derivedCompletionRatio,
  className = '',
  variant = 'light',
}: SessionFeedbackQuickFormProps) {
  const sf = value?.sessionFeedback ?? {};

  const update = (patch: Partial<SessionFeedbackPayload>) => {
    const next = { ...sf, ...patch };
    const hasAny = Object.values(next).some((v) => v !== undefined && v !== null);
    onChange(hasAny ? { sessionFeedback: next } : null);
  };

  const labelMuted = variant === 'dark' ? 'text-white/45' : 'text-slate-500';
  const labelSecondary = variant === 'dark' ? 'text-white/55' : 'text-slate-600';
  const hintColor = variant === 'dark' ? 'text-white/35' : 'text-slate-400';

  return (
    <div className={`space-y-3 ${className}`}>
      <p className={`text-xs font-medium uppercase tracking-wide ${labelMuted}`}>
        오늘 세션은 어땠나요? (선택)
      </p>

      {/* overall RPE 1–10 */}
      <div>
        <p className={`text-xs mb-1 ${labelSecondary}`}>전체 강도 RPE</p>
        <div className="flex flex-wrap gap-1.5">
          {RPE_OPTIONS.map(({ label, value: v }) => (
            <button
              key={v}
              type="button"
              onClick={() => update({ overallRpe: sf.overallRpe === v ? undefined : v })}
              className={chipClasses(sf.overallRpe === v, variant)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* pain after 0–10 */}
      <div>
        <p className={`text-xs mb-1 ${labelSecondary}`}>운동 후 통증</p>
        <div className="flex flex-wrap gap-1.5">
          {PAIN_OPTIONS.map(({ label, value: v }) => (
            <button
              key={v}
              type="button"
              onClick={() => update({ painAfter: sf.painAfter === v ? undefined : v })}
              className={chipClasses(sf.painAfter === v, variant)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* completion ratio 0–1 */}
      <div>
        <p className={`text-xs mb-1 ${labelSecondary}`}>완료 정도</p>
        <div className="flex flex-wrap gap-1.5">
          {RATIO_OPTIONS.map(({ label, value: v }) => (
            <button
              key={v}
              type="button"
              onClick={() => update({ completionRatio: sf.completionRatio === v ? undefined : v })}
              className={chipClasses(sf.completionRatio === v, variant)}
            >
              {label}
            </button>
          ))}
        </div>
        {derivedCompletionRatio != null && (
          <p className={`text-[10px] mt-0.5 ${hintColor}`}>
            (실제: {Math.round(derivedCompletionRatio * 100)}%)
          </p>
        )}
      </div>

      {/* difficulty feedback */}
      <div>
        <p className={`text-xs mb-1 ${labelSecondary}`}>난이도 체감</p>
        <div className="flex flex-wrap gap-1.5">
          {DIFFICULTY_OPTIONS.map(({ label, value: v }) => (
            <button
              key={v}
              type="button"
              onClick={() => update({ difficultyFeedback: sf.difficultyFeedback === v ? undefined : v })}
              className={chipClasses(sf.difficultyFeedback === v, variant)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
