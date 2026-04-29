import { Suspense } from 'react';
import HandoffClient from './HandoffClient';

export default function AuthHandoffPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#0c1324] px-6">
          <p className="text-sm text-[#9a9aa8]" style={{ fontFamily: 'var(--font-sans-noto)' }}>
            리셋을 이어서 연결하는 중...
          </p>
        </div>
      }
    >
      <HandoffClient />
    </Suspense>
  );
}
