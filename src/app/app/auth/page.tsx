import { Suspense } from 'react';
import AppAuthClient from './AppAuthClient';
import { sanitizeAuthNextPath } from '@/lib/auth/authHandoffContract';

type SearchParams = Promise<{ next?: string; error?: string; provider?: string }>;

export default async function AppAuthPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const next = sanitizeAuthNextPath(
    typeof params?.next === 'string' ? params.next : null,
    '/app/home',
  );
  return (
      <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center p-6 bg-[#F8F6F0]">
          <p className="text-sm text-slate-600">Loading...</p>
        </div>
      }
    >
      <AppAuthClient
        next={next}
        errorParam={params?.error}
        providerParam={params?.provider}
      />
    </Suspense>
  );
}
