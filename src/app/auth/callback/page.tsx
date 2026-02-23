import { Suspense } from 'react';
import CallbackClient from './CallbackClient';

type SearchParams = Promise<{ code?: string; next?: string }>;

export default async function AuthCallbackPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center p-6">
          <p className="text-sm text-[var(--muted)]">처리 중...</p>
        </div>
      }
    >
      <CallbackClient
        codeParam={params?.code}
        nextParam={params?.next}
      />
    </Suspense>
  );
}
