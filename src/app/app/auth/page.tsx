import { Suspense } from 'react';
import AppAuthClient from './AppAuthClient';

type SearchParams = Promise<{ next?: string; error?: string }>;

export default async function AppAuthPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const next = typeof params?.next === 'string' ? params.next : '/app';
  return (
      <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center p-6 bg-[#F8F6F0]">
          <p className="text-sm text-slate-600">Loading...</p>
        </div>
      }
    >
      <AppAuthClient next={next} errorParam={params?.error} />
    </Suspense>
  );
}
