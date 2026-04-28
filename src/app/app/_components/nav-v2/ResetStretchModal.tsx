'use client';

import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import type { ResetMediaResponse } from '@/lib/reset/types';
import { appTabCard, appTabMuted, appTabSubtle, appTabAccent } from './appTabTheme';

export type ResetMediaModalState =
  | { status: 'closed' }
  | { status: 'loading'; issue_key: string; title: string; summary: string }
  | { status: 'ready'; data: ResetMediaResponse }
  | {
      status: 'error';
      issue_key: string;
      message: string;
      title: string;
      summary: string;
    };

export type ResetStretchModalOpenState = Exclude<
  ResetMediaModalState,
  { status: 'closed' }
>;

type ResetStretchModalProps = {
  state: ResetStretchModalOpenState;
  onClose: () => void;
};

function HlsVideoBlock({
  streamUrl,
  posterUrl,
}: {
  streamUrl: string;
  posterUrl?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<{ destroy: () => void } | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let destroyed = false;

    import('hls.js').then(({ default: HlsLib }) => {
      if (destroyed || !video) return;
      if (HlsLib.isSupported()) {
        const hls = new HlsLib();
        hlsRef.current = hls;
        hls.loadSource(streamUrl);
        hls.attachMedia(video);
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = streamUrl;
      }
    });

    return () => {
      destroyed = true;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (video) {
        video.pause();
        video.removeAttribute('src');
        video.load();
      }
    };
  }, [streamUrl]);

  return (
    <video
      ref={videoRef}
      className="aspect-video w-full rounded-xl bg-black/40 object-contain"
      controls
      playsInline
      poster={posterUrl}
      preload="metadata"
    />
  );
}

export function ResetStretchModal({ state, onClose }: ResetStretchModalProps) {
  const titleId = useId();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const headerTitle =
    state.status === 'ready' ? state.data.display.title : state.title;

  return (
    <>
      <div
        aria-hidden="true"
        className="fixed inset-0 z-[60] bg-black/60 animate-in fade-in"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="fixed inset-x-0 bottom-0 z-[70] mx-auto flex max-h-[92vh] w-full max-w-[430px] flex-col rounded-t-2xl border border-white/10 bg-[oklch(0.22_0.03_245)] pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-8px_32px_rgba(0,0,0,0.35)] animate-in slide-in-from-bottom-4"
      >
        <div className="flex shrink-0 flex-col px-4 pt-3 pb-2">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" aria-hidden />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="text-lg font-semibold leading-snug text-white">
                {headerTitle}
              </h2>
              {state.status === 'loading' && (
                <p className={`mt-1 text-sm leading-snug ${appTabMuted}`}>{state.summary}</p>
              )}
              {state.status === 'error' && (
                <p className={`mt-1 text-xs leading-snug ${appTabSubtle}`}>{state.title}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="모달 닫기"
              className="shrink-0 rounded-full border border-white/15 bg-white/[0.06] p-2 text-white/80 transition hover:bg-white/10"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-5">
          {state.status === 'loading' && (
            <div className="space-y-3" aria-busy="true" aria-live="polite">
              <div
                className={`flex aspect-video w-full items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] ${appTabCard}`}
              >
                <p className={`text-sm ${appTabMuted}`}>영상을 준비하는 중…</p>
              </div>
            </div>
          )}

          {state.status === 'error' && (
            <div className={`${appTabMuted} rounded-xl border border-white/10 bg-white/[0.04] p-4`}>
              <p className={`text-base font-medium text-white`}>{state.message}</p>
              <p className={`mt-2 text-sm leading-relaxed ${appTabMuted}`}>{state.summary}</p>
              <p className={`mt-1 text-xs ${appTabSubtle}`}>{state.title}</p>
            </div>
          )}

          {state.status === 'ready' && <ReadyModalBody data={state.data} />}
        </div>
      </div>
    </>
  );
}

function ReadyModalBody({
  data,
}: {
  data: ResetMediaResponse;
}) {
  const { media, display, meta } = data;

  const isPlaceholderUnmapped = meta.source === 'placeholder_unmapped';

  const mediaSection = (() => {
    if (media.kind === 'hls' && media.streamUrl) {
      return <HlsVideoBlock streamUrl={media.streamUrl} posterUrl={media.posterUrl} />;
    }
    if (media.kind === 'embed' && media.embedUrl) {
      return (
        <div className="overflow-hidden rounded-xl border border-white/10 bg-black/30">
          <iframe
            title={display.title}
            src={media.embedUrl}
            allowFullScreen
            className="aspect-video w-full bg-black/20"
          />
        </div>
      );
    }
    return (
      <div
        className={`flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-8 text-center ${appTabCard}`}
      >
        <p className={`text-sm font-medium text-white`}>영상 준비 중</p>
        {isPlaceholderUnmapped ? (
          <p className={`max-w-[280px] text-sm leading-snug ${appTabMuted}`}>
            영상은 곧 연결될 예정이에요. 아래 방법을 참고해 주세요.
          </p>
        ) : (
          <p className={`max-w-[280px] text-sm leading-snug ${appTabMuted}`}>
            아래 방법을 참고해 주세요.
          </p>
        )}
        {media.notes && media.notes.length > 0 ? (
          <ul className={`list-inside list-disc text-left text-xs ${appTabSubtle}`}>
            {media.notes.map((note, i) => (
              <li key={`${note.slice(0, 24)}-${i}`}>{note}</li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  })();

  return (
    <div className="space-y-5">
      {mediaSection}

      <div>
        <p className={`text-xs font-medium uppercase tracking-wider ${appTabSubtle}`}>시간</p>
        <p className={`mt-1 text-sm ${appTabMuted}`}>{display.duration_label}</p>
      </div>

      <div>
        <p className={`text-xs font-medium uppercase tracking-wider ${appTabSubtle}`}>안내</p>
        <p className={`mt-2 text-sm leading-relaxed ${appTabMuted}`}>{display.description}</p>
      </div>

      {display.how_to.length > 0 ? (
        <div>
          <p className={`text-xs font-medium uppercase tracking-wider ${appTabSubtle}`}>방법</p>
          <ol className={`mt-2 list-decimal space-y-2 pl-5 text-sm leading-relaxed ${appTabMuted}`}>
            {display.how_to.map((step, idx) => (
              <li key={idx}>{step}</li>
            ))}
          </ol>
        </div>
      ) : null}

      {display.safety_note ? (
        <div className={`rounded-xl border border-orange-500/25 bg-orange-500/10 px-3 py-2.5`}>
          <p className={`text-xs font-medium ${appTabAccent}`}>안전 안내</p>
          <p className={`mt-1 text-xs leading-snug ${appTabMuted}`}>{display.safety_note}</p>
        </div>
      ) : null}
    </div>
  );
}
