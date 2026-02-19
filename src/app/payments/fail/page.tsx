// 결제 실패 페이지 - Toss Payments 결제 실패/취소 시
// searchParams(code, message)를 서버에서 추출해 Client에 전달
import { Suspense } from 'react';
import PaymentFailClient from './PaymentFailClient';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ code?: string; message?: string }>;

export default async function PaymentFailPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#0f172a] px-4">
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-[#f97316] border-t-transparent" />
            <p className="text-lg font-medium text-slate-100">로딩 중...</p>
          </div>
        </main>
      }
    >
      <PaymentFailClient
        codeParam={params?.code}
        messageParam={params?.message}
      />
    </Suspense>
  );
}
