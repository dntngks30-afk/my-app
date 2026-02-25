/**
 * Stripe 결제 성공 페이지
 * Stripe Checkout 성공 후 리다이렉트 - session_id를 서버에서 추출해 Client에 전달
 */
import { Suspense } from 'react';
import StripeSuccessClient from './StripeSuccessClient';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ session_id?: string; next?: string }>;

export default async function StripeSuccessPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4">
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-[var(--brand)] border-t-transparent" />
            <p className="text-lg font-medium text-[var(--text)]">
              결제 확인 중...
            </p>
            <p className="mt-2 text-sm text-[var(--muted)]">
              잠시만 기다려주세요.
            </p>
          </div>
        </main>
      }
    >
      <StripeSuccessClient sessionIdParam={params?.session_id} nextParam={params?.next} />
    </Suspense>
  );
}
