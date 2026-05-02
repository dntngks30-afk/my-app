import { Suspense } from 'react';
import SignupClient from './SignupClient';

type SearchParams = Promise<{ error?: string; next?: string; intent?: string }>;

export default async function SignupPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const next = typeof params?.next === 'string' ? params.next : undefined;
  const intentRaw = typeof params?.intent === 'string' ? params.intent.trim() : null;
  const intent = intentRaw && intentRaw.length > 0 ? intentRaw : null;
  return (
      <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center p-6 bg-[#F8F6F0]">
          <p className="text-sm text-slate-600">Loading...</p>
        </div>
      }
    >
      <SignupClient errorParam={params?.error} next={next} intent={intent} />
    </Suspense>
  );
}
