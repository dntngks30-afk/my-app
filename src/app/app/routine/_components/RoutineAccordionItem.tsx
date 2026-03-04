'use client';

/**
 * RoutineAccordionItem
 *
 * Accordion 항목: 접힘(제목+태그+메타), 펼침(mediaPayload 기반 재생/embed/placeholder).
 * 영상은 펼칠 때만 렌더(lazy).
 */

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Play } from 'lucide-react';

export type MediaPayloadHub = {
  kind: 'hls' | 'embed' | 'placeholder';
  streamUrl?: string;
  embedUrl?: string;
  posterUrl?: string;
  autoplayAllowed?: boolean;
  notes?: string[];
};

export type RoutineAccordionItemData = {
  id: string;
  title: string;
  kind?: string;
  durationSec?: number;
  videoUrl?: string | null;
  description?: string;
  templateId?: string;
  mediaRef?: unknown;
  mediaPayload?: MediaPayloadHub | null;
};

type RoutineAccordionItemProps = {
  item: RoutineAccordionItemData;
};

export default function RoutineAccordionItem({ item }: RoutineAccordionItemProps) {
  const [expanded, setExpanded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<{ destroy: () => void } | null>(null);

  const durationLabel = item.durationSec
    ? `${Math.floor(item.durationSec / 60)}분`
    : null;

  const p = item.mediaPayload;

  useEffect(() => {
    if (!expanded || !p || p.kind !== 'hls' || !p.streamUrl) return;
    const video = videoRef.current;
    if (!video) return;
    let destroyed = false;
    import('hls.js').then(({ default: HlsLib }) => {
      if (destroyed || !video) return;
      if (HlsLib.isSupported()) {
        const hls = new HlsLib();
        hlsRef.current = hls;
        hls.loadSource(p.streamUrl!);
        hls.attachMedia(video);
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = p.streamUrl!;
      }
    });
    return () => {
      destroyed = true;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      } else if (video) {
        video.src = '';
      }
    };
  }, [expanded, p?.kind, p?.streamUrl]);

  const renderMedia = () => {
    if (p?.kind === 'hls' && p.streamUrl) {
      return (
        <div className="aspect-video w-full rounded-lg overflow-hidden bg-black">
          <video
            ref={videoRef}
            className="w-full h-full object-contain"
            playsInline
            controls
            poster={p.posterUrl}
          />
        </div>
      );
    }
    if (p?.kind === 'embed' && p.embedUrl) {
      return (
        <div className="aspect-video w-full rounded-lg overflow-hidden bg-black">
          <iframe
            src={p.embedUrl}
            className="w-full h-full"
            allowFullScreen
            title={item.title}
          />
        </div>
      );
    }
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center rounded-lg bg-slate-200 text-slate-500">
        <Play className="size-12 mb-2 opacity-50" />
        <p className="text-sm">영상 준비중</p>
      </div>
    );
  };

  return (
    <div className="overflow-hidden rounded-xl border-2 border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-stone-50 transition"
      >
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-800">{item.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {item.kind && (
              <span className="inline-flex rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-slate-700">
                {item.kind}
              </span>
            )}
            {durationLabel && (
              <span className="text-xs text-slate-500">{durationLabel}</span>
            )}
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="size-5 shrink-0 text-slate-400" />
        ) : (
          <ChevronDown className="size-5 shrink-0 text-slate-400" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-stone-200 bg-stone-50/50 p-4">
          {renderMedia()}
          {item.description && (
            <p className="mt-3 text-sm text-slate-600">{item.description}</p>
          )}
        </div>
      )}
    </div>
  );
}
