import { redirect } from 'next/navigation';

/**
 * /login 호환 리다이렉트
 * OAuth(구글/카카오)가 있는 /app/auth로 통일
 */
type SearchParams = Promise<{ next?: string; error?: string }>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const nextRaw = typeof params?.next === 'string' ? params.next.trim() : '';
  const next =
    nextRaw.startsWith('/') && !nextRaw.startsWith('//')
      ? nextRaw
      : '/';
  const error = typeof params?.error === 'string' ? params.error : undefined;

  const search = new URLSearchParams();
  search.set('next', next);
  if (error) {
    search.set('error', error);
  }
  redirect('/app/auth?' + search.toString());
}
