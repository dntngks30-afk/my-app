import { Suspense } from 'react';
import CollectEmailClient from './CollectEmailClient';

export const metadata = {
  title: {
    absolute: '이메일 입력 · MOVE RE',
  },
};

export default function CollectEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#0c1324] text-[#e8e8ef]">
          로딩 중...
        </div>
      }
    >
      <CollectEmailClient />
    </Suspense>
  );
}
