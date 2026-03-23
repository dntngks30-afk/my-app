'use client';

import Image from 'next/image';
import { useMemo } from 'react';

import { buildOrderedPublicVideoSources, type PublicVideoSourceMap } from '@/lib/public/media';
import { usePublicDecorativeMotionAllowed } from '@/lib/public/motion';

export type PublicDecorativeMediaProps = {
  /** WebM 우선, MP4 폴백 */
  video: PublicVideoSourceMap;
  /** 비디오 포스터 + reduced 모션 시 대체로 쓸 정적 이미지 URL */
  staticSrc: string;
  alt: string;
  className?: string;
  /** 컨테이너에 맞게 채움 */
  fill?: boolean;
  sizes?: string;
  /** 추가로 장식 모션을 끄는 플래그 (예: 페이지 옵트아웃) */
  forceStatic?: boolean;
};

/**
 * 공개 퍼널 전용 배경/장식 미디어.
 * - WebM → MP4 순 소스
 * - 감소 모션·절약 데이터·SSR 초기에는 정적 이미지
 * - 실행 코어(`/app`)에 사용하지 말 것
 */
export function PublicDecorativeMedia({
  video,
  staticSrc,
  alt,
  className,
  fill = true,
  sizes = '100vw',
  forceStatic = false,
}: PublicDecorativeMediaProps) {
  const allowMotion = usePublicDecorativeMotionAllowed();
  const sources = useMemo(() => buildOrderedPublicVideoSources(video), [video]);
  const showVideo = allowMotion && !forceStatic && sources.length > 0;

  if (!showVideo) {
    return (
      <Image
        src={staticSrc}
        alt={alt}
        fill={fill}
        className={className}
        sizes={sizes}
        priority={false}
        draggable={false}
      />
    );
  }

  return (
    <video
      className={className}
      aria-hidden
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      poster={staticSrc}
    >
      {sources.map((s) => (
        <source key={s.src} src={s.src} type={s.type} />
      ))}
    </video>
  );
}
