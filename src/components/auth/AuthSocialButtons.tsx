'use client';

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
      <button
        type="button"
        onClick={onGoogle}
        disabled={disabled}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-[#151b2d]/80 px-4 text-sm font-medium text-[#dce1fb] shadow-sm backdrop-blur-sm transition hover:border-[#ffb77d]/35 hover:bg-[#1a2235] disabled:pointer-events-none disabled:opacity-50"
      >
        Google로 계속하기
      </button>
      <button
        type="button"
        onClick={onKakao}
        disabled={disabled}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-[#151b2d]/80 px-4 text-sm font-medium text-[#dce1fb] shadow-sm backdrop-blur-sm transition hover:border-[#ffb77d]/35 hover:bg-[#1a2235] disabled:pointer-events-none disabled:opacity-50"
      >
        카카오로 계속하기
      </button>
      {oauthError ? (
        <p
          role="alert"
          className="rounded-xl border border-amber-900/40 bg-amber-950/35 px-3 py-2.5 text-sm text-amber-100/90 backdrop-blur-sm"
        >
          {oauthError}
        </p>
      ) : null}
    </div>
  );
}
