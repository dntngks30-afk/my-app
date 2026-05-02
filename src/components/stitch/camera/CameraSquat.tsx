'use client';

/**
 * 스쿼트 카메라 페이지 chrome — 로직은 page에 두고 레이아웃·토큰만 제공
 */
import type { ReactNode } from 'react';

export type StitchCameraSquatRootProps = {
  children: React.ReactNode;
};

/** 어두운 씬 루트 (page 최상단) */
export function StitchCameraSquatRoot({ children }: StitchCameraSquatRootProps) {
  return (
    <div className="relative flex min-h-[100svh] flex-col overflow-hidden bg-black">
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
      <div className="relative z-10 flex min-h-[100svh] flex-col">{children}</div>
    </div>
  );
}

export type StitchCameraSquatHeaderProps = {
  left: ReactNode;
  center: ReactNode;
};

export function StitchCameraSquatHeader({ left, center }: StitchCameraSquatHeaderProps) {
  return (
    <header className="relative z-20 flex flex-col items-center gap-3 px-4 pb-3 pt-5">
      <div className="flex w-full items-center justify-between">
        <div className="w-12 shrink-0">{left}</div>
        <div className="min-w-0 flex-1 text-center">{center}</div>
        <div className="w-12 shrink-0" aria-hidden />
      </div>
    </header>
  );
}

/** 상단 배지 + 단계 표시 */
export function StitchCameraSquatHeaderCenter({ stepLabel }: { stepLabel: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span
        className="rounded-full border border-white/10 bg-black/50 px-4 py-1.5 text-[10px] font-medium uppercase tracking-[0.28em] text-[#ffb77d]/90 backdrop-blur-md"
        style={{ fontFamily: 'var(--font-sans-noto)' }}
      >
        Squat Analysis
      </span>
      <p className="text-sm text-slate-400" style={{ fontFamily: 'var(--font-sans-noto)' }}>
        {stepLabel}
      </p>
    </div>
  );
}

export type StitchCameraGlassPanelProps = {
  children: ReactNode;
  className?: string;
};

/** 하단 상태·힌트 glass (stitch screen 32) */
export function StitchCameraGlassPanel({ children, className = '' }: StitchCameraGlassPanelProps) {
  return (
    <div
      className={`rounded-2xl border border-white/[0.08] bg-[rgba(46,52,71,0.45)] px-4 py-3 text-center backdrop-blur-xl ${className}`}
    >
      {children}
    </div>
  );
}

export {
  StitchCameraPrimaryButton,
  type StitchCameraPrimaryButtonProps,
} from '@/components/stitch/camera/CameraButton';
