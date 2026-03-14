'use client';

/**
 * PR-UX-14: Next Session Preview Card
 *
 * Completion → Next Action Bridge.
 * Shows next session number, focus, estimated time, CTA.
 * Uses existing summary-level data only. No plan_json fetch.
 */

import { ChevronRight } from 'lucide-react';
import type { NextSessionPreviewData } from '@/lib/session/next-session-preview';

const FOCUS_AXIS_LABELS: Record<string, string> = {
  lower_stability: '하체 안정',
  lower_mobility: '하체 가동성',
  upper_mobility: '상체 가동성',
  trunk_control: '몸통 제어',
  asymmetry: '좌우 균형',
  deconditioned: '전신 회복',
};

export type AdaptiveExplanation = {
  title: string;
  message: string;
};

export type NextSessionPreviewCardProps = {
  data: NextSessionPreviewData | null;
  /** 'post-completion' = after reflection submit, 'home' = home top section */
  variant?: 'post-completion' | 'home' | 'locked-panel';
  /** Primary CTA: "다음 세션 준비 보기" / "지도에서 확인하기" */
  onPrimaryCta?: () => void;
  /** When next session is locked (today completed) */
  isLockedUntilTomorrow?: boolean;
  /** Optional: last session perceived difficulty for conditional message */
  lastSessionDifficulty?: 'too_easy' | 'ok' | 'too_hard' | null;
  /** Optional: last session had pain/discomfort areas → protection message */
  lastSessionHadPainAreas?: boolean;
  /** PR-ALG-15: Server-generated adaptive explanation (from bootstrap) */
  adaptiveExplanation?: AdaptiveExplanation | null;
};

function formatFocusLabel(data: NextSessionPreviewData): string {
  const axes = data.focus_axes;
  if (Array.isArray(axes) && axes.length > 0) {
    const labels = axes.map((a) => FOCUS_AXIS_LABELS[a] ?? a).filter(Boolean);
    return labels[0] ?? '';
  }
  if (data.focus_label && typeof data.focus_label === 'string') {
    return data.focus_label;
  }
  return '';
}

function formatEstimatedTime(minutes?: number): string {
  if (typeof minutes === 'number' && minutes > 0) {
    return `${minutes}분`;
  }
  return '10~12분';
}

export function NextSessionPreviewCard({
  data,
  variant = 'home',
  onPrimaryCta,
  isLockedUntilTomorrow = false,
  lastSessionDifficulty,
  lastSessionHadPainAreas,
  adaptiveExplanation,
}: NextSessionPreviewCardProps) {
  const hasDetails = data && (formatFocusLabel(data) || data.estimated_time || data.exercise_count);

  if (!data) {
    return (
      <div className="rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-4">
        <p className="text-sm font-semibold text-slate-700">다음 세션</p>
        <p className="mt-1 text-xs text-slate-600">
          다음 세션은 곧 준비됩니다. 지도에서 이어서 확인할 수 있습니다.
        </p>
        {onPrimaryCta && (
          <button
            type="button"
            onClick={onPrimaryCta}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-orange-100 py-2.5 text-sm font-medium text-orange-700"
          >
            지도에서 확인하기
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }

  const focusLabel = formatFocusLabel(data);
  const estimatedTime = formatEstimatedTime(data.estimated_time);
  const exerciseCount = data.exercise_count;
  const exercisesPreview = Array.isArray(data.exercises_preview) ? data.exercises_preview : [];
  const isLockedCard = isLockedUntilTomorrow === true;
  const toneClass = isLockedCard
    ? 'border-slate-200 bg-slate-50'
    : 'border-violet-200 bg-violet-50';
  const eyebrowClass = isLockedCard
    ? 'text-slate-500'
    : 'text-violet-600';
  const titleClass = isLockedCard
    ? 'text-slate-900'
    : 'text-violet-900';
  const bodyClass = isLockedCard
    ? 'text-slate-700'
    : 'text-violet-700';
  const subBodyClass = isLockedCard
    ? 'text-slate-600'
    : 'text-violet-600';

  const conditionalMessage = (() => {
    if (lastSessionHadPainAreas) {
      return '다음 세션은 불편 부위를 고려해 안전한 움직임 위주로 진행됩니다.';
    }
    if (lastSessionDifficulty === 'too_hard') {
      return '이번 세션이 어려웠다면, 다음 세션은 무리 없이 이어갈 수 있도록 조정됩니다.';
    }
    if (lastSessionDifficulty === 'ok' || lastSessionDifficulty === 'too_easy') {
      return '좋아요. 다음 세션에서는 현재 흐름을 이어 조금 더 안정적으로 확장합니다.';
    }
    return null;
  })();

  return (
    <div className={`rounded-2xl border-2 px-4 py-4 ${toneClass}`}>
      <p className={`text-xs font-semibold uppercase tracking-wider ${eyebrowClass}`}>
        {isLockedCard ? '잠긴 다음 세션' : '다음 세션'}
      </p>
      <p className={`mt-0.5 text-lg font-bold ${titleClass}`}>
        세션 {data.session_number}
      </p>

      {hasDetails ? (
        <>
          {focusLabel && (
            <p className={`mt-2 text-sm font-medium ${bodyClass}`}>
              목표: {focusLabel}
            </p>
          )}
          <div className={`mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs ${bodyClass}`}>
            <span>예상 시간: {estimatedTime}</span>
            {typeof exerciseCount === 'number' && exerciseCount > 0 && (
              <span>운동 수: {exerciseCount}개</span>
            )}
          </div>
          {data.session_rationale && (
            <p className={`mt-2 text-xs leading-relaxed ${subBodyClass}`}>
              {data.session_rationale}
            </p>
          )}
          {exercisesPreview.length > 0 && (
            <p className={`mt-1.5 text-xs leading-relaxed ${subBodyClass}`}>
              미리 볼 운동: {exercisesPreview.join(', ')}
            </p>
          )}
          {/* PR-ALG-15: Adaptive explanation (server-generated) */}
          {adaptiveExplanation ? (
            <div className={`mt-3 rounded-xl border px-3 py-2.5 ${isLockedCard ? 'border-slate-200 bg-slate-100' : 'border-violet-200 bg-violet-100/80'}`}>
              <p className={`text-xs font-semibold ${isLockedCard ? 'text-slate-800' : 'text-violet-800'}`}>
                {adaptiveExplanation.title}
              </p>
              <p className={`mt-0.5 text-xs leading-relaxed ${isLockedCard ? 'text-slate-700' : 'text-violet-700'}`}>
                {adaptiveExplanation.message}
              </p>
            </div>
          ) : (
            conditionalMessage && (
              <p className={`mt-1.5 text-xs leading-relaxed ${subBodyClass}`}>
                {conditionalMessage}
              </p>
            )
          )}
        </>
      ) : (
        <>
          <p className={`mt-2 text-xs ${subBodyClass}`}>
            현재 흐름을 이어 다음 세션이 준비됩니다
          </p>
          <p className={`mt-0.5 text-xs ${subBodyClass}`}>
            예상 시간: {formatEstimatedTime(data.estimated_time)}
          </p>
          {adaptiveExplanation && (
            <div className={`mt-3 rounded-xl border px-3 py-2.5 ${isLockedCard ? 'border-slate-200 bg-slate-100' : 'border-violet-200 bg-violet-100/80'}`}>
              <p className={`text-xs font-semibold ${isLockedCard ? 'text-slate-800' : 'text-violet-800'}`}>
                {adaptiveExplanation.title}
              </p>
              <p className={`mt-0.5 text-xs leading-relaxed ${isLockedCard ? 'text-slate-700' : 'text-violet-700'}`}>
                {adaptiveExplanation.message}
              </p>
            </div>
          )}
        </>
      )}

      {isLockedCard && (
        <div className="mt-3 rounded-xl border border-slate-200 bg-white/80 px-3 py-2.5">
          <p className="text-xs font-semibold text-slate-700">내일 시작할 수 있어요</p>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
            오늘은 미리보기만 확인할 수 있어요.
          </p>
        </div>
      )}

      {onPrimaryCta && (
        <button
          type="button"
          onClick={onPrimaryCta}
          className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold shadow-sm transition active:scale-[0.98] ${
            isLockedCard
              ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              : 'bg-violet-500 text-white hover:bg-violet-600'
          }`}
        >
          {isLockedCard
            ? '미리보기만 확인할 수 있어요'
            : variant === 'post-completion'
              ? '다음 세션 준비 보기'
              : '지도에서 확인하기'}
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
