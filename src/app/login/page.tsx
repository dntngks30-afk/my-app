import { Suspense } from 'react';
import LoginClient from './LoginClient';

type SearchParams = Promise<{ error?: string }>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center p-6">
          <p className="text-sm text-[var(--muted)]">Loading...</p>
        </div>
      }
    >
      <LoginClient errorParam={params?.error} />
    </Suspense>
  );
}
