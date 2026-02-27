import { Suspense } from 'react';
import PaymentsClient from './_components/PaymentsClient';

type SearchParams = Promise<{ product?: string; next?: string }>;

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const product = typeof params?.product === 'string' ? params.product : 'move-re-7d';
  const next = typeof params?.next === 'string' ? params.next : '/app/home';

  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center p-6">로딩 중...</div>}>
      <PaymentsClient product={product} next={next} />
    </Suspense>
  );
}
