'use client';

import { useEffect, useState } from 'react';
import AuthCard from '@/components/auth/AuthCard';
import MoveReAuthScreen from '@/components/auth/MoveReAuthScreen';
import AuthSocialButtons from '@/components/auth/AuthSocialButtons';
import {
  startOAuthClient,
  sanitizeProvider,
  getOAuthErrorMessage,
  type OAuthProvider,
} from '@/lib/auth/startOAuthClient';

interface AppAuthClientProps {
  next: string;
  errorParam?: string | null;
  providerParam?: string | null;
}

const LOGIN_HEADLINE = '내 분석을 이어서 확인하세요';

export default function AppAuthClient({
  next,
  errorParam,
  providerParam,
}: AppAuthClientProps) {
  const [oauthError, setOauthError] = useState<string | null>(null);

  useEffect(() => {
    if (errorParam === 'oauth') {
      const provider = sanitizeProvider(providerParam);
      setOauthError(getOAuthErrorMessage(provider));
    }
  }, [errorParam, providerParam]);

  const runOAuth = (provider: OAuthProvider) =>
    startOAuthClient({ provider, next, setOauthError });

  return (
    <MoveReAuthScreen headline={LOGIN_HEADLINE}>
      <AuthCard
        mode="login"
        errorParam={errorParam}
        redirectTo={next}
        compactHeader
        signupLayout="embedded"
        oauthSlot={
          <AuthSocialButtons
            onGoogle={() => runOAuth('google')}
            onKakao={() => runOAuth('kakao')}
            oauthError={oauthError}
          />
        }
      />
    </MoveReAuthScreen>
  );
}
