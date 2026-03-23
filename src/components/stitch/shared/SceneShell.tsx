'use client';

import { cn } from '@/lib/utils';
import { publicChapterContentClass, type PublicChapterVariant } from '@/lib/public/chapter';

/**
 * landing / survey / bridge / onboarding 공용 풀스크린 배경
 */
export function StitchSceneBackdrop() {
  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[100] opacity-[0.04]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E\")",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 opacity-20"
        style={{
          backgroundImage: `
            radial-gradient(1px 1px at 20px 30px, #ffffff, rgba(0,0,0,0)),
            radial-gradient(1.5px 1.5px at 40px 70px, #ffb77d, rgba(0,0,0,0)),
            radial-gradient(1px 1px at 50px 160px, #dce1fb, rgba(0,0,0,0)),
            radial-gradient(1.5px 1.5px at 90px 40px, #ffffff, rgba(0,0,0,0)),
            radial-gradient(1px 1px at 130px 80px, #ffb77d, rgba(0,0,0,0))
          `,
          backgroundRepeat: 'repeat',
          backgroundSize: '250px 250px',
        }}
      />
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[1]">
        <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-[#ffb77d]/5 blur-[100px]" />
        <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-[#fcb973]/5 blur-[100px]" />
        <div className="absolute left-1/2 top-1/2 h-[68vw] w-[68vw] max-h-[780px] max-w-[780px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#ffb77d]/6 blur-[140px]" />
      </div>
    </>
  );
}

export type StitchSceneShellProps = {
  children: React.ReactNode;
  /** 카메라 등 어두운 씬 — 배경만 살짝 다름 */
  variant?: 'cosmic' | 'camera';
  /**
   * 배경·글로우는 고정, z-10 콘텐츠 컬럼만 챕터 진입 연출.
   * `camera` 변형이면 항상 끔(캡처 씬 저모션).
   */
  contentEnter?: PublicChapterVariant | 'off';
};

function contentEnterLayerClass(
  variant: 'cosmic' | 'camera',
  contentEnter?: StitchSceneShellProps['contentEnter']
): string | undefined {
  if (variant === 'camera') return undefined;
  if (contentEnter === 'off') return undefined;
  const preset = contentEnter ?? 'default';
  return publicChapterContentClass(preset);
}

export function StitchSceneShell({
  children,
  variant = 'cosmic',
  contentEnter,
}: StitchSceneShellProps) {
  const bg =
    variant === 'camera'
      ? 'bg-black'
      : 'bg-[#0c1324]';

  const enterClass = contentEnterLayerClass(variant, contentEnter);

  return (
    <div className={`relative min-h-[100svh] overflow-hidden text-[#dce1fb] ${bg}`}>
      {variant === 'cosmic' ? <StitchSceneBackdrop /> : <StitchCameraBackdrop />}
      <div
        className={cn('relative z-10 flex min-h-[100svh] flex-col', enterClass)}
      >
        {children}
      </div>
    </div>
  );
}

/** 카메라 씬: 순수 블랙 + 미세 코너 글로우 (stitch screen 32) */
function StitchCameraBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0">
      <div className="absolute inset-0 bg-gradient-to-b from-[#0c1324]/80 via-black to-black" />
      <div className="absolute -left-32 top-0 h-64 w-64 rounded-full bg-[#ffb77d]/5 blur-[80px]" />
      <div className="absolute -right-32 bottom-0 h-64 w-64 rounded-full bg-[#fcb973]/4 blur-[80px]" />
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E\")",
        }}
      />
    </div>
  );
}
