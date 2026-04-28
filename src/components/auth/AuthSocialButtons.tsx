'use client';

/** INTRO 톤 — primary CTA보다 조용하게 (IntroSceneShell / PR-AUTH-UI-03) */
const AUTH_SOCIAL_BUTTON_CLASS =
  'flex h-12 w-full items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.035] text-[14px] font-medium text-[#dce1fb] transition hover:bg-white/[0.06] disabled:pointer-events-none disabled:opacity-50';

interface AuthSocialButtonsProps {
  onGoogle: () => void;
  onKakao: () => void;
  disabled?: boolean;
  oauthError: string | null;
}

export default function AuthSocialButtons({
  onGoogle,
  onKakao,
  disabled,
  oauthError,
}: AuthSocialButtonsProps) {
  return (
    <div className="space-y-3">
      <button type="button" onClick={onGoogle} disabled={disabled} className={AUTH_SOCIAL_BUTTON_CLASS}>
        Google로 계속하기
      </button>
      <button type="button" onClick={onKakao} disabled={disabled} className={AUTH_SOCIAL_BUTTON_CLASS}>
        카카오로 계속하기
      </button>
      {oauthError ? (
        <p
          role="alert"
          className="rounded-xl border border-amber-900/35 bg-amber-950/40 px-3 py-2.5 text-sm text-amber-100/90"
        >
          {oauthError}
        </p>
      ) : null}
    </div>
  );
}
