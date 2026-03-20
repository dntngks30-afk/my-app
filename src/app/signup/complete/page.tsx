import { Suspense } from 'react';
import CompleteClient from './CompleteClient';

type SearchParams = Promise<{ code?: string; next?: string }>;

export default async function SignupCompletePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const nextParam = typeof params?.next === 'string' ? params.next : null;
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center p-6">
          <p className="text-sm text-[var(--muted)]">Loading...</p>
        </div>
      }
    >
      <CompleteClient codeParam={params?.code} nextParam={nextParam} />
    </Suspense>
  );
}
