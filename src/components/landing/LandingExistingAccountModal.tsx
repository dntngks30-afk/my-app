'use client';

interface LandingExistingAccountModalProps {
  open: boolean;
  onContinueAccount: () => void;
  onStartFresh: () => void;
  onClose: () => void;
  isStartingFresh?: boolean;
}

export default function LandingExistingAccountModal({
  open,
  onContinueAccount,
  onStartFresh,
  onClose,
  isStartingFresh = false,
}: LandingExistingAccountModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-[#030712]/65 px-4 pb-6 pt-10 sm:items-center">
      <div className="w-full max-w-md rounded-2xl border border-[#ffb77d]/40 bg-[#0c1324] p-5 text-[#fce9df] shadow-[0_20px_50px_rgba(0,0,0,0.45)]">
        <h2 className="text-lg font-bold">이미 로그인된 계정이 있어요</h2>
        <p className="mt-2 text-sm leading-relaxed text-[#f2d8ca]">
          기존 리셋맵을 이어서 볼 수도 있고, 현재 기기에서 새 테스트를 다시 시작할 수도 있어요.
        </p>

        <div className="mt-5 grid gap-2">
          <button
            type="button"
            onClick={onContinueAccount}
            className="rounded-xl border border-[#ffb77d]/45 bg-[#111a30] px-4 py-3 text-sm font-semibold text-[#fff4eb]"
          >
            기존 계정으로 계속하기
          </button>
          <button
            type="button"
            onClick={onStartFresh}
            disabled={isStartingFresh}
            className="rounded-xl bg-[#ff9f5a] px-4 py-3 text-sm font-semibold text-[#1f130b] disabled:opacity-70"
          >
            {isStartingFresh ? '처리 중...' : '새 테스트로 다시 시작하기'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-[#ffd5bd]"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
