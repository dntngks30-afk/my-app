'use client';

import Image from 'next/image';

const LOADING_COPIES = [
  '내 리셋 지도를 준비하고 있어요',
  '진행 상태를 확인하는 중',
];

interface BootSplashProps {
  /** 로딩 문구 (기본: 첫 번째) */
  copy?: string;
  /** aria-live 영역용 보조 문구 */
  status?: string;
}

export default function BootSplash({ copy = LOADING_COPIES[0], status }: BootSplashProps) {
  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#faf8f5] px-6"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 2rem)' }}
      aria-busy="true"
      aria-live="polite"
      role="status"
    >
      {/* Logo */}
      <div className="relative mb-6 animate-in fade-in" style={{ animationDuration: '500ms' }}>
        <div className="relative h-24 w-48 sm:h-28 sm:w-56">
          <Image
            src="/brand/move-re-logo.png"
            alt="MOVE RE"
            fill
            priority
            sizes="(max-width: 640px) 192px, 224px"
            className="object-contain"
          />
        </div>
      </div>

      {/* Wordmark */}
      <p className="mb-4 text-xl font-bold tracking-tight text-[#0F172A] animate-in fade-in" style={{ animationDuration: '500ms', animationDelay: '100ms', animationFillMode: 'both' }}>
        MOVE RE
      </p>

      {/* Loading copy */}
      <p className="text-sm text-[#475569] animate-in fade-in" style={{ animationDuration: '500ms', animationDelay: '200ms', animationFillMode: 'both' }}>
        {copy}
      </p>

      {/* Shimmer bar */}
      <div className="mt-6 h-0.5 w-32 overflow-hidden rounded-full bg-[#e2e8f0] animate-in fade-in" style={{ animationDuration: '500ms', animationDelay: '300ms', animationFillMode: 'both' }}>
        <div className="boot-shimmer h-full w-1/2 rounded-full bg-gradient-to-r from-transparent via-[#f97316]/40 to-transparent" />
      </div>

      {/* Screen reader status */}
      {status && (
        <span className="sr-only">{status}</span>
      )}
    </div>
  );
}
