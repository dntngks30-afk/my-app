import { Suspense } from 'react';
import RetestComparisonClient from './RetestComparisonClient';

type SearchParams = Promise<{ original?: string; retest?: string }>;

export default async function Page({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  return (
    <Suspense fallback={<div className="p-6">로딩 중...</div>}>
      <RetestComparisonClient
        originalParam={params?.original}
        retestParam={params?.retest}
      />
    </Suspense>
  );
}
