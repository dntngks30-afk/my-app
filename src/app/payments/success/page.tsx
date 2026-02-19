// 결제 성공 페이지 - Toss Payments 결제 완료 후
// searchParams(paymentKey, orderId, amount)를 서버에서 추출해 Client에 전달
import { Suspense } from 'react';
import PaymentSuccessClient from './PaymentSuccessClient';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{
  paymentKey?: string;
  orderId?: string;
  amount?: string;
}>;

export default async function PaymentSuccessPage({
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
            <p className="text-lg font-medium text-slate-100">결제 처리 중...</p>
            <p className="mt-2 text-sm text-slate-400">잠시만 기다려주세요.</p>
          </div>
        </main>
      }
    >
      <PaymentSuccessClient
        paymentKeyParam={params?.paymentKey}
        orderIdParam={params?.orderId}
        amountParam={params?.amount}
      />
    </Suspense>
  );
}
