'use client';

/**
 * 최소 세션 피드백 수집 — 4개 신호, 탭 몇 번으로 완료.
 * optional: 모두 건너뛰어도 completion 차단하지 않음.
 */

import type { FeedbackPayload, SessionFeedbackPayload } from '@/lib/session/feedback-types';

type DifficultyFeedback = 'too_easy' | 'ok' | 'too_hard';

interface SessionFeedbackQuickFormProps {
  value: FeedbackPayload | null;
  onChange: (v: FeedbackPayload | null) => void;
  /** completion_ratio 파생용: all_done이면 1, partial이면 done/total */
  derivedCompletionRatio?: number;
  className?: string;
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

export function SessionFeedbackQuickForm({
  value,
  onChange,
  derivedCompletionRatio,
  className = '',
}: SessionFeedbackQuickFormProps) {
  const sf = value?.sessionFeedback ?? {};

  const update = (patch: Partial<SessionFeedbackPayload['sessionFeedback']>) => {
    const next = { ...sf, ...patch };
    const hasAny = Object.values(next).some((v) => v !== undefined && v !== null);
    onChange(hasAny ? { sessionFeedback: next } : null);
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
        오늘 세션은 어땠나요? (선택)
      </p>

      {/* overall RPE 1–10 */}
      <div>
        <p className="text-xs text-slate-600 mb-1">전체 강도 RPE</p>
        <div className="flex flex-wrap gap-1.5">
          {RPE_OPTIONS.map(({ label, value: v }) => (
            <button
              key={v}
              type="button"
              onClick={() => update({ overallRpe: sf.overallRpe === v ? undefined : v })}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                sf.overallRpe === v
                  ? 'bg-orange-100 text-orange-700 border border-orange-300'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-transparent'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* pain after 0–10 */}
      <div>
        <p className="text-xs text-slate-600 mb-1">운동 후 통증</p>
        <div className="flex flex-wrap gap-1.5">
          {PAIN_OPTIONS.map(({ label, value: v }) => (
            <button
              key={v}
              type="button"
              onClick={() => update({ painAfter: sf.painAfter === v ? undefined : v })}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                sf.painAfter === v
                  ? 'bg-orange-100 text-orange-700 border border-orange-300'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-transparent'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* completion ratio 0–1 */}
      <div>
        <p className="text-xs text-slate-600 mb-1">완료 정도</p>
        <div className="flex flex-wrap gap-1.5">
          {RATIO_OPTIONS.map(({ label, value: v }) => (
            <button
              key={v}
              type="button"
              onClick={() => update({ completionRatio: sf.completionRatio === v ? undefined : v })}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                sf.completionRatio === v
                  ? 'bg-orange-100 text-orange-700 border border-orange-300'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-transparent'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {derivedCompletionRatio != null && (
          <p className="text-[10px] text-slate-400 mt-0.5">
            (실제: {Math.round(derivedCompletionRatio * 100)}%)
          </p>
        )}
      </div>

      {/* difficulty feedback */}
      <div>
        <p className="text-xs text-slate-600 mb-1">난이도 체감</p>
        <div className="flex flex-wrap gap-1.5">
          {DIFFICULTY_OPTIONS.map(({ label, value: v }) => (
            <button
              key={v}
              type="button"
              onClick={() => update({ difficultyFeedback: sf.difficultyFeedback === v ? undefined : v })}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                sf.difficultyFeedback === v
                  ? 'bg-orange-100 text-orange-700 border border-orange-300'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-transparent'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
