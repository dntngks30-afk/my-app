import { Suspense } from 'react';
import AppAuthClient from './AppAuthClient';
import { resolveAppAuthLoginRedirect } from '@/lib/auth/authHandoffContract';

type SearchParams = Promise<{
  next?: string;
  error?: string;
  provider?: string;
  intent?: string;
}>;

export default async function AppAuthPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const intentRaw = typeof params?.intent === 'string' ? params.intent.trim() : null;
  const intent = intentRaw && intentRaw.length > 0 ? intentRaw : null;
  const next = resolveAppAuthLoginRedirect(
    typeof params?.next === 'string' ? params.next : null,
    intent,
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
        intent={intent}
        errorParam={params?.error}
        providerParam={params?.provider}
      />
    </Suspense>
  );
}
