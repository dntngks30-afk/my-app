'use client';

/**
 * Movement guide card: video + text (Neo-brutal)
 * Used at section start for squat / wallangel / one-leg-stand
 */

import { useState } from 'react';

interface MovementGuideCardProps {
  title: string;
  subtitle: string;
  bullets: string[];
  videoMp4Src: string;
  videoWebmSrc?: string;
  posterSrc?: string;
  videoAlt: string;
}

const nbCard =
  'rounded-2xl border-2 border-slate-950 bg-white p-5 shadow-[4px_4px_0px_0px_rgba(2,6,23,1)]';

export default function MovementGuideCard({
  title,
  subtitle,
  bullets,
  videoMp4Src,
  videoWebmSrc,
  posterSrc,
  videoAlt,
}: MovementGuideCardProps) {
  const [videoError, setVideoError] = useState(false);

  return (
    <div className={`${nbCard} overflow-hidden`}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="order-2 md:order-1">
          <h3 className="text-base font-bold text-slate-800 mb-1">{title}</h3>
          <p className="text-sm text-stone-600 mb-3">{subtitle}</p>
          <ul className="list-disc list-inside space-y-1 text-sm text-slate-700">
            {bullets.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </div>
        <div className="order-1 md:order-2">
          {videoError ? (
            <div className="aspect-video bg-stone-100 rounded-lg flex items-center justify-center text-sm text-stone-500">
              영상을 불러올 수 없어요
            </div>
          ) : (
            <video
              autoPlay
              loop
              muted
              playsInline
              preload="metadata"
              poster={posterSrc}
              aria-label={videoAlt}
              className="w-full rounded-lg border-2 border-slate-950 object-cover"
              onError={() => setVideoError(true)}
            >
              {videoWebmSrc && (
                <source src={videoWebmSrc} type="video/webm" />
              )}
              <source src={videoMp4Src} type="video/mp4" />
            </video>
          )}
        </div>
      </div>
    </div>
  );
}
