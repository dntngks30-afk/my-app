'use client';

const BOOT_FLAG = 'move-re-app-booted';

export function setAppBooted(): void {
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.setItem(BOOT_FLAG, '1');
    } catch {
      /* ignore */
    }
  }
}

export function isAppBooted(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(BOOT_FLAG) === '1';
  } catch {
    return false;
  }
}

interface AppEntryLoaderProps {
  /** aria-live용 보조 문구 */
  status?: string;
}

export default function AppEntryLoader({ status = '로딩 중' }: AppEntryLoaderProps) {
  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#faf8f5] px-6"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 2rem)' }}
      aria-busy="true"
      aria-live="polite"
      role="status"
    >
      {/* Spinner */}
      <div
        className="mb-6 h-10 w-10 rounded-full border-2 border-[#e2e8f0] border-t-[#0F172A] app-entry-spinner"
        aria-hidden
      />

      {/* Main copy */}
      <p className="text-base font-medium text-[#0F172A]">
        리셋 지도를 생성중이에요
      </p>

      {status && <span className="sr-only">{status}</span>}
    </div>
  );
}
