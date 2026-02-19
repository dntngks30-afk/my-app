import { Suspense } from 'react';
import SignupClient from './SignupClient';

type SearchParams = Promise<{ error?: string }>;

export default async function SignupPage({
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
      <SignupClient errorParam={params?.error} />
    </Suspense>
  );
}
