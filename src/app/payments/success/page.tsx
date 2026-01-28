// 결제 성공 페이지입니다.
// Toss Payments에서 결제 완료 후 이 페이지로 리다이렉트됩니다.
// URL 파라미터로 전달된 정보로 서버에서 결제 승인을 완료합니다.
"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const confirmPayment = async () => {
      // URL에서 결제 정보 추출
      const paymentKey = searchParams.get("paymentKey");
      const orderId = searchParams.get("orderId");
      const amount = searchParams.get("amount");
      
      // 로컬스토리지에서 추가 정보 가져오기 (메인페이지에서 저장해둔 것)
      const requestId = localStorage.getItem("pending_request_id");
      const userId = localStorage.getItem("user_id");

      if (!paymentKey || !orderId || !amount) {
        setError("결제 정보가 올바르지 않습니다.");
        setLoading(false);
        return;
      }

      try {
        // 서버에서 결제 승인 처리
        const res = await fetch("/api/payments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentKey,
            orderId,
            amount: Number(amount),
            requestId,
            userId,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "결제 승인에 실패했습니다.");
          setLoading(false);
          return;
        }

        // 결제 성공
        setSuccess(true);
        
        // 로컬스토리지 정리
        localStorage.removeItem("pending_request_id");
        
      } catch (err) {
        console.error("결제 승인 에러:", err);
        setError("결제 처리 중 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    };

    confirmPayment();
  }, [searchParams]);

  // 로딩 중
  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0f172a] px-4">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-[#f97316] border-t-transparent" />
          <p className="text-lg font-medium text-slate-100">결제 처리 중...</p>
          <p className="mt-2 text-sm text-slate-400">잠시만 기다려주세요.</p>
        </div>
      </main>
    );
  }

  // 에러 발생
  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0f172a] px-4">
        <div className="w-full max-w-md space-y-6 rounded-2xl border border-slate-700/80 bg-slate-900/80 p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20">
            <svg className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-100">결제 실패</h1>
          <p className="text-sm text-slate-400">{error}</p>
          <div className="flex flex-col gap-3">
            <Link
              href="/"
              className="inline-block rounded-lg bg-[#f97316] px-6 py-3 text-sm font-semibold text-slate-950"
            >
              메인으로 돌아가기
            </Link>
            <button
              onClick={() => router.back()}
              className="text-sm text-slate-400 hover:text-slate-200"
            >
              다시 시도하기
            </button>
          </div>
        </div>
      </main>
    );
  }

  // 결제 성공
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0f172a] px-4">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-slate-700/80 bg-slate-900/80 p-8 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20">
          <svg className="h-8 w-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        
        <h1 className="text-2xl font-bold text-slate-100">결제 완료!</h1>
        
        <p className="text-sm text-slate-400">
          결제가 성공적으로 완료되었습니다.<br />
          전문가가 체형 분석 후 24시간 내에<br />
          맞춤 교정 리포트를 이메일로 보내드립니다.
        </p>

        <div className="rounded-lg border border-slate-700/60 bg-slate-800/50 p-4 text-left">
          <p className="text-xs text-slate-500 mb-2">안내사항</p>
          <ul className="space-y-1 text-sm text-slate-300">
            <li>• 리포트는 등록된 이메일로 발송됩니다.</li>
            <li>• 마이페이지에서도 확인하실 수 있습니다.</li>
            <li>• 문의사항은 고객센터로 연락해주세요.</li>
          </ul>
        </div>

        <div className="flex flex-col gap-3">
          <Link
            href="/my-report"
            className="inline-block rounded-lg bg-[#f97316] px-6 py-3 text-sm font-semibold text-slate-950 shadow-[0_0_24px_rgba(249,115,22,0.5)]"
          >
            내 리포트 확인하기
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
