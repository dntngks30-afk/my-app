'use client';

/**
 * PR-UX-14: Next Session Preview Card
 *
 * Completion → Next Action Bridge.
 * Shows next session number, focus, estimated time, CTA.
 * Uses existing summary-level data only. No plan_json fetch.
 *
 * Presentation: aligned with home execution sheet (midnight navy / glass).
 * Used from SessionPanelV2 only.
 */

import { ChevronRight } from 'lucide-react';
import {
  getNextSessionFocusLabel,
  normalizeNextSessionPreviewForDisplay,
  type NextSessionPreviewData,
} from '@/lib/session/next-session-preview';
import { primaryCtaRestrained } from './reset-map-v2/homeExecutionTheme';

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
  if (data.focus_label && typeof data.focus_label === 'string') {
    return data.focus_label;
  }
  return getNextSessionFocusLabel(data.focus_axes, 2) ?? '';
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
  const normalizedData = normalizeNextSessionPreviewForDisplay(data);
  const hasDetails =
    normalizedData &&
    (formatFocusLabel(normalizedData) ||
      normalizedData.estimated_time > 0 ||
      normalizedData.exercise_count > 0 ||
      normalizedData.exercises_preview.length > 0 ||
      !!normalizedData.session_rationale);

  if (!normalizedData) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4">
        <p className="text-sm font-semibold text-white/85">다음 세션</p>
        <p className="mt-1 text-xs text-white/55">
          다음 세션은 곧 준비됩니다. 지도에서 이어서 확인할 수 있습니다.
        </p>
        {onPrimaryCta && (
          <button type="button" onClick={onPrimaryCta} className={`mt-3 ${primaryCtaRestrained}`}>
            지도에서 확인하기
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }

  const focusLabel = formatFocusLabel(normalizedData);
  const estimatedTime = formatEstimatedTime(normalizedData.estimated_time);
  const exerciseCount = normalizedData.exercise_count;
  const exercisesPreview = Array.isArray(normalizedData.exercises_preview) ? normalizedData.exercises_preview : [];
  const isLockedCard = isLockedUntilTomorrow === true;
  const toneClass = isLockedCard
    ? 'border-white/10 bg-white/[0.04]'
    : 'border-violet-400/25 bg-violet-950/35';
  const eyebrowClass = isLockedCard ? 'text-white/45' : 'text-violet-200/95';
  const titleClass = isLockedCard ? 'text-white/90' : 'text-violet-100';
  const bodyClass = isLockedCard ? 'text-white/70' : 'text-violet-100/95';
  const subBodyClass = isLockedCard ? 'text-white/55' : 'text-violet-200/85';

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

  const adaptiveBoxClass = isLockedCard
    ? 'border-white/10 bg-white/[0.06]'
    : 'border-violet-400/20 bg-violet-950/50';

  return (
    <div className={`rounded-2xl border-2 px-4 py-4 ${toneClass}`}>
      <p className={`text-xs font-semibold uppercase tracking-wider ${eyebrowClass}`}>
        {isLockedCard ? '잠긴 다음 세션' : '다음 세션'}
      </p>
      <p className={`mt-0.5 text-lg font-bold ${titleClass}`}>
        {variant === 'locked-panel' ? `다음 세션 ${normalizedData.session_number}` : `세션 ${normalizedData.session_number}`}
      </p>

      {hasDetails ? (
        <>
          <p className={`mt-2 text-sm font-medium ${bodyClass}`}>
            {focusLabel ? `목표: ${focusLabel}` : '목표: 다음 세션 흐름 준비'}
          </p>
          <div className={`mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs ${bodyClass}`}>
            <span>예상 시간: {estimatedTime}</span>
            <span>
              {typeof exerciseCount === 'number' && exerciseCount > 0
                ? `운동 수: ${exerciseCount}개`
                : '운동 수: 구성 확인 중'}
            </span>
          </div>
          {normalizedData.session_rationale && (
            <p className={`mt-2 text-xs leading-relaxed ${subBodyClass}`}>{normalizedData.session_rationale}</p>
          )}
          {exercisesPreview.length > 0 && (
            <p className={`mt-1.5 text-xs leading-relaxed ${subBodyClass}`}>
              미리 볼 운동: {exercisesPreview.join(', ')}
            </p>
          )}
          {/* PR-ALG-15: Adaptive explanation (server-generated) */}
          {adaptiveExplanation ? (
            <div className={`mt-3 rounded-xl border px-3 py-2.5 ${adaptiveBoxClass}`}>
              <p className={`text-xs font-semibold ${isLockedCard ? 'text-white/90' : 'text-violet-100'}`}>
                {adaptiveExplanation.title}
              </p>
              <p className={`mt-0.5 text-xs leading-relaxed ${isLockedCard ? 'text-white/65' : 'text-violet-200/90'}`}>
                {adaptiveExplanation.message}
              </p>
            </div>
          ) : (
            conditionalMessage && (
              <p className={`mt-1.5 text-xs leading-relaxed ${subBodyClass}`}>{conditionalMessage}</p>
            )
          )}
        </>
      ) : (
        <>
          <p className={`mt-2 text-xs ${subBodyClass}`}>현재 흐름을 이어 다음 세션이 준비됩니다</p>
          <p className={`mt-0.5 text-xs ${subBodyClass}`}>예상 시간: {formatEstimatedTime(normalizedData.estimated_time)}</p>
          {adaptiveExplanation && (
            <div className={`mt-3 rounded-xl border px-3 py-2.5 ${adaptiveBoxClass}`}>
              <p className={`text-xs font-semibold ${isLockedCard ? 'text-white/90' : 'text-violet-100'}`}>
                {adaptiveExplanation.title}
              </p>
              <p className={`mt-0.5 text-xs leading-relaxed ${isLockedCard ? 'text-white/65' : 'text-violet-200/90'}`}>
                {adaptiveExplanation.message}
              </p>
            </div>
          )}
        </>
      )}

      {isLockedCard && (
        <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2.5">
          <p className="text-xs font-semibold text-white/80">내일 시작할 수 있어요</p>
          <p className="mt-0.5 text-xs leading-relaxed text-white/55">오늘은 미리보기만 확인할 수 있어요.</p>
        </div>
      )}

      {onPrimaryCta && (
        <button
          type="button"
          onClick={onPrimaryCta}
          className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold shadow-sm transition active:scale-[0.98] ${
            isLockedCard
              ? 'border border-white/15 bg-white/[0.08] text-white/75 hover:bg-white/[0.12]'
              : primaryCtaRestrained
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
