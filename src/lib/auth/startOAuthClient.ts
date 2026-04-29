/**
 * PR-AUTH-UI-01: OAuth 시작 로직을 보존한 client helper (의미·로그·redirect 동일).
 */
import { supabase } from '@/lib/supabase';

/** OAuth/PKCE는 canonical origin에서만 시작. env 미설정 시 현재 origin 사용(로컬/프리뷰) */
const CANONICAL_ORIGIN = process.env.NEXT_PUBLIC_CANONICAL_ORIGIN ?? null;
const SKIP_CANONICAL_REDIRECT = process.env.NEXT_PUBLIC_SKIP_CANONICAL_REDIRECT === '1';

export type OAuthProvider = 'google' | 'kakao';

export function sanitizeProvider(provider: string | null | undefined): OAuthProvider | null {
  return provider === 'google' || provider === 'kakao' ? provider : null;
}

export function getOAuthErrorMessage(provider: OAuthProvider | null): string {
  if (provider === 'google') return 'Google 로그인에 실패했습니다. 다시 시도해 주세요.';
  if (provider === 'kakao') return '카카오 로그인에 실패했습니다. 다시 시도해 주세요.';
  return 'OAuth 로그인에 실패했습니다. 다시 시도해 주세요.';
}

/** Provider OAuth 힌트 — 이전 세션으로의 조용한 자동 재로그인 가능성을 줄이기 위한 유도(쿠키 삭제 아님). */
function getOAuthQueryParams(provider: OAuthProvider): Record<string, string> {
  return provider === 'google'
    ? { prompt: 'select_account' }
    : { prompt: 'login' };
}

export async function startOAuthClient(params: {
  provider: OAuthProvider;
  next: string;
  setOauthError: (message: string | null) => void;
}): Promise<void> {
  const { provider, next, setOauthError } = params;
  setOauthError(null);

  console.info('[AUTH-OAUTH]', {
    event: 'oauth_start',
    provider,
    currentOrigin: typeof window !== 'undefined' ? window.location.origin : null,
    canonicalOriginConfigured: Boolean(CANONICAL_ORIGIN),
    canonicalOrigin: CANONICAL_ORIGIN,
    skipCanonicalRedirect: SKIP_CANONICAL_REDIRECT,
    nextPath: next,
  });

  if (
    typeof window !== 'undefined' &&
    CANONICAL_ORIGIN &&
    !SKIP_CANONICAL_REDIRECT &&
    window.location.origin !== CANONICAL_ORIGIN
  ) {
    console.info('[AUTH-OAUTH]', {
      event: 'oauth_canonical_redirect',
      provider,
      fromOrigin: window.location.origin,
      toOrigin: CANONICAL_ORIGIN,
      targetPath: window.location.pathname,
    });
    const target = `${CANONICAL_ORIGIN}${window.location.pathname}${window.location.search}`;
    window.location.replace(target);
    return;
  }

  const base = CANONICAL_ORIGIN || (typeof window !== 'undefined' ? window.location.origin : '');
  const callbackUrl = new URL('/auth/callback', base);
  callbackUrl.searchParams.set('next', next);
  callbackUrl.searchParams.set('provider', provider);
  const redirectTo = callbackUrl.toString();

  console.info('[AUTH-OAUTH]', {
    event: 'oauth_redirect_to_built',
    provider,
    redirectToOrigin: callbackUrl.origin,
    redirectToPathname: callbackUrl.pathname,
  });

  const queryParams = getOAuthQueryParams(provider);

  console.info('[AUTH-OAUTH]', {
    event: 'oauth_account_selection_hint_applied',
    provider,
    accountSelectionHint: provider === 'google' ? 'select_account' : 'login',
  });

  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      queryParams,
    },
  });
  if (error) {
    const status =
      error && typeof error === 'object' && 'status' in error
        ? (error as { status?: number }).status
        : undefined;
    console.error('[AUTH-OAUTH]', {
      event: 'oauth_signin_error',
      provider,
      message: error.message,
      name: error.name,
      status,
    });
    setOauthError(getOAuthErrorMessage(provider));
  }
}
