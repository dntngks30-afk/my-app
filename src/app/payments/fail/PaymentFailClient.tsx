'use client';

import Link from 'next/link';

interface PaymentFailClientProps {
  codeParam?: string | null;
  messageParam?: string | null;
}

function getErrorMessage(
  code: string | null,
  message: string | null
): string {
  if (!code) return message || '결제 처리 중 오류가 발생했습니다.';

  const errorMessages: Record<string, string> = {
    PAY_PROCESS_CANCELED: '결제가 취소되었습니다.',
    PAY_PROCESS_ABORTED: '결제가 중단되었습니다.',
    REJECT_CARD_COMPANY:
      '카드사에서 결제를 거부했습니다. 다른 카드를 사용해주세요.',
    INVALID_CARD_NUMBER: '유효하지 않은 카드 번호입니다.',
    EXCEED_MAX_DAILY_PAYMENT_COUNT: '일일 결제 한도를 초과했습니다.',
    EXCEED_MAX_PAYMENT_AMOUNT: '결제 금액 한도를 초과했습니다.',
    INVALID_STOPPED_CARD: '정지된 카드입니다.',
    INVALID_CARD_LOST_OR_STOLEN: '분실/도난 카드입니다.',
    NOT_AVAILABLE_BANK: '현재 이용할 수 없는 은행입니다.',
  };

  return errorMessages[code] || message || '결제에 실패했습니다.';
}

export default function PaymentFailClient({
  codeParam,
  messageParam,
}: PaymentFailClientProps) {
  const errorCode = codeParam ?? null;
  const errorMessage = messageParam ?? null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0f172a] px-4">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-slate-700/80 bg-slate-900/80 p-8 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20">
          <svg
            className="h-8 w-8 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-slate-100">결제 실패</h1>

        <p className="text-sm text-slate-400">
          {getErrorMessage(errorCode, errorMessage)}
        </p>

        {errorCode && (
          <p className="text-xs text-slate-600">에러 코드: {errorCode}</p>
        )}

        <div className="rounded-lg border border-slate-700/60 bg-slate-800/50 p-4 text-left">
          <p className="text-xs text-slate-500 mb-2">다음을 확인해주세요</p>
          <ul className="space-y-1 text-sm text-slate-300">
            <li>• 카드 정보가 올바른지 확인해주세요.</li>
            <li>• 카드 한도가 충분한지 확인해주세요.</li>
            <li>• 다른 결제 수단을 사용해보세요.</li>
          </ul>
        </div>

        <div className="flex flex-col gap-3">
          <Link
            href="/"
            className="inline-block rounded-lg bg-[#f97316] px-6 py-3 text-sm font-semibold text-slate-950 shadow-[0_0_24px_rgba(249,115,22,0.5)]"
          >
            다시 시도하기
          </Link>
          <Link
            href="/"
            className="text-sm text-slate-400 hover:text-slate-200"
          >
            메인으로 돌아가기
          </Link>
        </div>
      </div>
    </main>
  );
}
