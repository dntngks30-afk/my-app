'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Play,
  Clock,
  Sparkles,
  Activity,
  RotateCcw,
  Loader2,
} from 'lucide-react';
import type { ResetIssueViewModel, ResetRecommendationResponse } from '@/lib/reset/types';
import { fetchResetMedia } from '@/lib/reset/client';
import {
  getCachedResetRecommendations,
  getResetRecommendationsCacheSnapshot,
} from '@/lib/reset/recommendation-cache';
import { appTabCard, appTabMuted, appTabSubtle, appTabAccent } from './appTabTheme';
import {
  ResetStretchModal,
  type ResetMediaModalState,
} from './ResetStretchModal';

/** SSOT 10 이슈 — error/loading 폴백 전용. API `issues`와 혼합하지 않는다. */
const FALLBACK_ISSUE_ROWS: readonly { label: string; sub: string }[] = [
  { label: '거북목', sub: '목 앞쪽 리셋' },
  { label: '라운드숄더', sub: '가슴·흉곽 열기' },
  { label: '등이 뻣뻣함', sub: '척추 움직임 리셋' },
  { label: '허리 뻐근함', sub: '골반·허리 이완' },
  { label: '고관절 답답함', sub: '고관절 주변 이완' },
  { label: '엉덩이 깊은 뻐근함', sub: '둔부 깊은 긴장 완화' },
  { label: '무릎 불편감', sub: '허벅지 긴장 완화' },
  { label: '목·어깨 뻐근함', sub: '목 뒤쪽 긴장 완화' },
  { label: '어깨·겨드랑이 답답함', sub: '광배근·겨드랑이 라인 이완' },
  { label: '골반-허리 긴장', sub: '골반 주변 리셋' },
] as const;

type LoadingState = 'loading' | 'ready' | 'error';

type ResetTabViewV2Props = {
  isVisible?: boolean;
};

function deriveInitialSelectedIssueKey(data: ResetRecommendationResponse): string | null {
  const { issues, featured_issue_key, featured } = data;
  if (issues.some((i) => i.issue_key === featured_issue_key)) {
    return featured_issue_key;
  }
  if (featured?.issue_key) {
    return featured.issue_key;
  }
  return issues[0]?.issue_key ?? null;
}

function deriveSelectedIssue(
  rec: ResetRecommendationResponse,
  selectedIssueKey: string | null
): ResetIssueViewModel | null {
  const { issues, featured } = rec;
  if (selectedIssueKey != null) {
    const hit = issues.find((i) => i.issue_key === selectedIssueKey);
    if (hit) return hit;
  }
  return featured ?? issues[0] ?? null;
}

function mediaFetchErrorMessage(result: {
  ok: false;
  status: number;
  error: { code: string; message: string };
}): string {
  const { status, error } = result;
  if (status === 401 || error.code === 'AUTH_REQUIRED') {
    return '영상 재생 권한을 확인할 수 없어요. 다시 로그인해 주세요.';
  }
  if (status === 403 || error.code === 'FORBIDDEN') {
    return '현재 플랜에서는 영상을 재생할 수 없어요.';
  }
  if (error.code === 'NETWORK_ERROR') {
    return '네트워크 연결을 확인해 주세요.';
  }
  return '영상을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.';
}

export function ResetTabViewV2({ isVisible = true }: ResetTabViewV2Props) {
  const [phase, setPhase] = useState<LoadingState>('loading');
  const [recommendation, setRecommendation] =
    useState<ResetRecommendationResponse | null>(null);
  const [selectedIssueKey, setSelectedIssueKey] = useState<string | null>(null);
  const [selectedStretchKey, setSelectedStretchKey] = useState<string | null>(
    null
  );
  const [previewThumbUrl, setPreviewThumbUrl] = useState<string | null>(null);
  const [previewThumbForKey, setPreviewThumbForKey] = useState<string | null>(
    null
  );
  const [previewThumbLoading, setPreviewThumbLoading] = useState(false);
  const [mediaModal, setMediaModal] = useState<ResetMediaModalState>({
    status: 'closed',
  });
  const mediaRequestIdRef = useRef(0);
  const previewRequestIdRef = useRef(0);
  const posterUrlCacheRef = useRef<Record<string, string>>({});
  const modalLoadingStretchKeyRef = useRef<string | null>(null);
  const recommendationsRequestedRef = useRef(false);

  useEffect(() => {
    if (!isVisible) return;
    if (recommendationsRequestedRef.current) return;

    const cached = getResetRecommendationsCacheSnapshot();
    if (cached) {
      recommendationsRequestedRef.current = true;
      setRecommendation(cached);
      setSelectedIssueKey(deriveInitialSelectedIssueKey(cached));
      setPhase('ready');
      return;
    }

    recommendationsRequestedRef.current = true;
    let cancelled = false;

    (async () => {
      const result = await getCachedResetRecommendations();
      if (cancelled) return;

      if (!result.ok) {
        setRecommendation(null);
        setSelectedIssueKey(null);
        setPhase('error');
        return;
      }

      const data = result.data;
      setRecommendation(data);
      setSelectedIssueKey(deriveInitialSelectedIssueKey(data));
      setPhase('ready');
    })();

    return () => {
      cancelled = true;
    };
  }, [isVisible]);

  useEffect(() => {
    return () => {
      mediaRequestIdRef.current += 1;
    };
  }, []);

  const handleCloseMediaModal = useCallback(() => {
    mediaRequestIdRef.current += 1;
    modalLoadingStretchKeyRef.current = null;
    setMediaModal({ status: 'closed' });
  }, []);

  const selectedIssue = useMemo(() => {
    if (phase !== 'ready' || !recommendation) return null;
    return deriveSelectedIssue(recommendation, selectedIssueKey);
  }, [phase, recommendation, selectedIssueKey]);

  const visibleStretchOptions = useMemo(() => {
    if (!selectedIssue) return [];
    return [
      selectedIssue.primary_stretch,
      selectedIssue.alternative_stretches[0],
    ].filter(Boolean);
  }, [selectedIssue]);

  const selectedStretch = useMemo(() => {
    if (!visibleStretchOptions.length) return null;
    const hit = visibleStretchOptions.find(
      (s) => s.stretch_key === selectedStretchKey
    );
    return hit ?? visibleStretchOptions[0];
  }, [visibleStretchOptions, selectedStretchKey]);

  useEffect(() => {
    if (!selectedIssue) {
      setSelectedStretchKey(null);
      return;
    }
    setSelectedStretchKey(selectedIssue.primary_stretch.stretch_key);
  }, [selectedIssue?.issue_key, selectedIssue?.primary_stretch?.stretch_key]);

  useEffect(() => {
    if (!isVisible) return;
    if (phase !== 'ready' || !selectedStretchKey) {
      return;
    }

    const cached = posterUrlCacheRef.current[selectedStretchKey];
    if (cached) {
      setPreviewThumbUrl(cached);
      setPreviewThumbForKey(selectedStretchKey);
      setPreviewThumbLoading(false);
      return;
    }

    previewRequestIdRef.current += 1;
    const rid = previewRequestIdRef.current;
    setPreviewThumbUrl(null);
    setPreviewThumbForKey(null);
    setPreviewThumbLoading(true);

    (async () => {
      const result = await fetchResetMedia({
        stretch_key: selectedStretchKey,
      });
      if (rid !== previewRequestIdRef.current) return;
      setPreviewThumbLoading(false);
      if (!result.ok) return;
      const url = result.data.media.posterUrl;
      if (typeof url !== 'string' || url.length === 0) return;
      posterUrlCacheRef.current = {
        ...posterUrlCacheRef.current,
        [selectedStretchKey]: url,
      };
      setPreviewThumbUrl(url);
      setPreviewThumbForKey(selectedStretchKey);
    })();
  }, [isVisible, phase, selectedStretchKey]);

  const handlePlaySelectedStretch = useCallback(async () => {
    if (phase !== 'ready' || !selectedIssue || !selectedStretch) return;

    if (
      mediaModal.status === 'loading' &&
      mediaModal.issue_key === selectedIssue.issue_key &&
      modalLoadingStretchKeyRef.current === selectedStretch.stretch_key
    ) {
      return;
    }

    mediaRequestIdRef.current += 1;
    const requestId = mediaRequestIdRef.current;

    const snapshot = {
      issue_key: selectedIssue.issue_key,
      title: selectedStretch.name_ko,
      summary: selectedIssue.card_summary,
    };

    modalLoadingStretchKeyRef.current = selectedStretch.stretch_key;

    setMediaModal({
      status: 'loading',
      ...snapshot,
    });

    const result = await fetchResetMedia({
      stretch_key: selectedStretch.stretch_key,
    });

    if (requestId !== mediaRequestIdRef.current) return;

    if (!result.ok) {
      setMediaModal({
        status: 'error',
        issue_key: snapshot.issue_key,
        message: mediaFetchErrorMessage(result),
        title: snapshot.title,
        summary: snapshot.summary,
      });
      return;
    }

    setMediaModal({ status: 'ready', data: result.data });
  }, [phase, selectedIssue, selectedStretch, mediaModal]);

  const badgeLabel = (() => {
    if (phase === 'loading') return '패턴을 불러오는 중…';
    if (phase === 'error') return '리셋 추천';
    return recommendation?.user_pattern.display_label ?? '리셋 추천';
  })();

  const baseCtaLabel =
    selectedIssue?.cta_label?.trim() || '이 스트레칭 해보기';
  const isCurrentStretchMediaLoading =
    mediaModal.status === 'loading' &&
    selectedIssue?.issue_key === mediaModal.issue_key &&
    selectedStretch != null &&
    modalLoadingStretchKeyRef.current === selectedStretch.stretch_key;
  const playLabel = isCurrentStretchMediaLoading
    ? '영상 준비 중…'
    : baseCtaLabel;
  const playBusy = isCurrentStretchMediaLoading;

  const thumbShowsPoster =
    Boolean(selectedStretch) &&
    previewThumbForKey === selectedStretch?.stretch_key &&
    Boolean(previewThumbUrl);
  const thumbAwaitingFetch =
    previewThumbLoading &&
    selectedStretchKey === selectedStretch?.stretch_key &&
    !thumbShowsPoster;

  return (
    <>
    <div className="px-4 pb-6 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <header className="mb-6">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs text-white/80">
          <Sparkles className="size-3.5 text-orange-400/90" aria-hidden />
          <span className={appTabMuted}>{badgeLabel}</span>
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-white">
          오늘 필요한 리셋
        </h1>
        <p className={`mt-2 text-[15px] leading-relaxed ${appTabMuted}`}>
          몸의 긴장 패턴에 맞춰 가볍게 풀어보세요.
        </p>
      </header>

      {/* Featured / loading / error */}
      {phase === 'loading' && (
        <div
          className={`relative overflow-hidden ${appTabCard} p-5 mb-8`}
          aria-busy="true"
          aria-live="polite"
        >
          <div className="animate-pulse space-y-3">
            <div className="h-3 w-20 rounded bg-white/10" />
            <div className="h-5 w-[85%] max-w-xs rounded bg-white/[0.09]" />
            <div className="h-4 w-full max-w-[280px] rounded bg-white/[0.07]" />
            <div className="h-4 w-2/3 max-w-[220px] rounded bg-white/[0.07]" />
            <div className="flex gap-3 pt-1">
              <div className="h-9 w-24 rounded-full bg-white/[0.08]" />
              <div className="h-9 w-44 rounded-full bg-white/[0.08]" />
            </div>
          </div>
          <p className="sr-only">리셋을 불러오는 중</p>
        </div>
      )}

      {phase === 'error' && (
        <div
          className={`relative overflow-hidden ${appTabCard} p-5 mb-8`}
          role="alert"
        >
          <h2 className="text-base font-semibold text-white">
            리셋 추천을 불러오지 못했어요.
          </h2>
          <p className={`mt-2 text-sm leading-snug ${appTabMuted}`}>
            잠시 후 다시 시도해 주세요.
          </p>
        </div>
      )}

      {phase === 'ready' && selectedIssue && recommendation && (
        <div className={`relative overflow-hidden ${appTabCard} p-5 mb-8`}>
          <div
            className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-orange-500/15 blur-2xl"
            aria-hidden
          />
          <div className="relative flex gap-4">
            <div className="relative h-[88px] w-[88px] shrink-0 overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-orange-500/25 to-transparent">
              {thumbShowsPoster ? (
                <img
                  src={previewThumbUrl!}
                  alt={selectedStretch!.name_ko}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center px-2" aria-hidden>
                  <RotateCcw className="size-7 text-orange-400/90" strokeWidth={1.75} />
                  <Play className="mt-1 size-4 text-white/60" fill="currentColor" />
                </div>
              )}
              {thumbAwaitingFetch ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                  <Loader2 className="size-6 animate-spin text-white/80" aria-hidden />
                  <span className="sr-only">썸네일 불러오는 중</span>
                </div>
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <p className={`text-[11px] font-medium uppercase tracking-wider ${appTabSubtle}`}>
                추천
              </p>
              <h2 className="mt-1 text-base font-semibold text-white">
                {selectedIssue.card_title}
              </h2>
              <p className={`mt-2 text-sm leading-snug ${appTabMuted}`}>
                {selectedIssue.card_summary}
              </p>
              {visibleStretchOptions.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="스트레칭 선택">
                  {visibleStretchOptions.map((opt) => {
                    const isChipSelected =
                      selectedStretch?.stretch_key === opt.stretch_key;
                    return (
                      <button
                        key={opt.stretch_key}
                        type="button"
                        aria-pressed={isChipSelected}
                        onClick={() => setSelectedStretchKey(opt.stretch_key)}
                        className={`max-w-[min(100%,12rem)] rounded-full border px-3 py-1.5 text-left text-[11px] font-medium leading-snug transition hover:bg-white/[0.06] ${
                          isChipSelected
                            ? `border-orange-500/45 bg-orange-500/15 ${appTabAccent}`
                            : `border-white/15 bg-white/[0.03] ${appTabMuted}`
                        }`}
                      >
                        <span className="line-clamp-2">{opt.name_ko}</span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
              <p className={`mt-1 text-xs leading-snug ${appTabSubtle}`}>
                {selectedStretch?.name_ko ?? '—'}
                {selectedStretch?.media_status === 'unmapped' ? (
                  <span className={`ml-1.5 ${appTabMuted}`}>(준비 중)</span>
                ) : null}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span className={`inline-flex min-w-0 items-center gap-1.5 text-xs ${appTabMuted}`}>
                  <Clock className="size-3.5 shrink-0 text-white/45" aria-hidden />
                  {selectedIssue.duration_label}
                </span>
                <button
                  type="button"
                  disabled={playBusy}
                  className={`inline-flex items-center gap-2 rounded-full border border-orange-500/35 bg-orange-500/15 px-4 py-2 text-sm font-medium ${appTabAccent} transition hover:bg-orange-500/25 disabled:pointer-events-none disabled:opacity-60`}
                  onClick={handlePlaySelectedStretch}
                >
                  <Play className="size-4 shrink-0" aria-hidden />
                  {playLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <section>
        <div className="mb-3 flex items-center gap-2">
          <Activity className="size-4 text-white/45" aria-hidden />
          <h3 className="text-sm font-medium text-white/90">
            이슈별 리셋
            {phase === 'loading' ? (
              <span className={`ml-2 text-xs font-normal ${appTabSubtle}`}>
                불러오는 중…
              </span>
            ) : null}
          </h3>
        </div>

        {phase === 'loading' && (
          <div className="flex flex-col gap-2" aria-hidden>
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={`sk-${i}`}
                className="h-[52px] w-full animate-pulse rounded-xl border border-white/10 bg-white/[0.06]"
              />
            ))}
          </div>
        )}

        {phase === 'error' && (
          <>
            <p className={`mb-2 text-xs ${appTabSubtle}`}>
              아래 목록은 안내용이에요. 추천이 로드되면 다시 선택할 수 있어요.
            </p>
            <div className="flex flex-col gap-2 opacity-95" role="list">
              {FALLBACK_ISSUE_ROWS.map((row) => (
                <div
                  key={row.label}
                  className="flex w-full cursor-default items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3.5 text-left"
                  role="listitem"
                >
                  <span className="text-sm font-medium text-white">{row.label}</span>
                  <span className={`max-w-[45%] text-right text-xs ${appTabSubtle}`}>
                    {row.sub}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {phase === 'ready' && recommendation && (
          <div className="flex flex-col gap-2">
            {recommendation.issues.map((issue) => {
              const isSelected = selectedIssueKey === issue.issue_key;
              return (
                <button
                  key={issue.issue_key}
                  type="button"
                  className={`flex w-full min-w-0 items-center justify-between rounded-xl border px-4 py-3.5 text-left transition hover:bg-white/[0.06] active:scale-[0.99] ${
                    isSelected
                      ? 'border-orange-500/35 bg-orange-500/[0.08]'
                      : 'border-white/10 bg-white/[0.03]'
                  }`}
                  onClick={() => setSelectedIssueKey(issue.issue_key)}
                >
                  <span className="mr-3 min-w-0 shrink text-sm font-medium text-white">
                    {issue.issue_label}
                  </span>
                  <span className={`max-w-[45%] shrink-0 text-right text-xs ${appTabSubtle}`}>
                    {issue.short_goal}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>

    {mediaModal.status !== 'closed' ? (
      <ResetStretchModal state={mediaModal} onClose={handleCloseMediaModal} />
    ) : null}
    </>
  );
}
