// 결제 성공 페이지입니다.
// Toss Payments에서 결제 완료 후 이 페이지로 리다이렉트됩니다.
// URL 파라미터로 전달된 정보로 서버에서 결제 승인을 완료합니다.
"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

// 동적 페이지로 설정 (빌드 시 prerender 하지 않음)
export const dynamic = 'force-dynamic';

function PaymentSuccessContent() {
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

  // 플랜 타입 확인 (orderId에서 추출)
  const orderId = searchParams.get("orderId") || "";
  const isBasicPlan = orderId.includes("basic") || orderId.includes("BASIC");
  const isStandardPlan = orderId.includes("standard") || orderId.includes("STANDARD");
  const isPremiumPlan = orderId.includes("premium") || orderId.includes("PREMIUM") || orderId.includes("vip") || orderId.includes("VIP");

  // 결제 성공 - 즉각적 보상 플로우
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0f172a] px-4 py-8">
      <div className="w-full max-w-lg space-y-6 rounded-2xl border border-slate-700/80 bg-slate-900/80 p-8">
        {/* 성공 아이콘 */}
        <div className="text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-500/20 mb-4">
            <svg className="h-10 w-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-slate-100">결제 완료!</h1>
          <p className="mt-2 text-lg text-green-400 font-semibold">
            🎉 이제 정밀 분석이 시작됩니다
          </p>
        </div>

        {/* BASIC 플랜 - 사진 업로드 안내 */}
        {isBasicPlan && (
          <div className="rounded-xl border-2 border-[#f97316] bg-gradient-to-br from-[#f97316]/10 to-slate-900 p-6">
            <div className="mb-4 flex items-center gap-3">
              <span className="text-3xl">📸</span>
              <div>
                <h2 className="text-xl font-bold text-slate-100">다음 단계: 사진 업로드</h2>
                <p className="text-sm text-slate-400">정밀 분석을 위한 사진을 등록해주세요</p>
              </div>
            </div>
            
            <div className="mb-6 space-y-3">
              <div className="flex items-center gap-3 rounded-lg bg-slate-950/50 p-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f97316] text-sm font-bold text-white">1</div>
                <span className="text-sm text-slate-300">정면 전신 사진 촬영</span>
              </div>
              <div className="flex items-center gap-3 rounded-lg bg-slate-950/50 p-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f97316] text-sm font-bold text-white">2</div>
                <span className="text-sm text-slate-300">측면 전신 사진 촬영</span>
              </div>
              <div className="flex items-center gap-3 rounded-lg bg-slate-950/50 p-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700 text-sm font-bold text-slate-400">3</div>
                <span className="text-sm text-slate-400">전문가 분석 후 24시간 내 리포트 발송</span>
              </div>
            </div>

            <Link
              href="/full-assessment"
              className="block w-full rounded-xl bg-gradient-to-r from-[#f97316] to-[#fb923c] py-4 text-center text-lg font-bold text-white shadow-[0_0_30px_rgba(249,115,22,0.5)] transition hover:shadow-[0_0_40px_rgba(249,115,22,0.6)]"
            >
              📸 지금 사진 업로드하기
            </Link>
            
            <p className="mt-3 text-center text-xs text-slate-500">
              사진을 빨리 등록할수록 리포트를 빨리 받으실 수 있습니다
            </p>
          </div>
        )}

        {/* STANDARD 이상 - 운동 영상 업로드 가이드 */}
        {(isStandardPlan || isPremiumPlan) && (
          <div className="rounded-xl border-2 border-[#f97316] bg-gradient-to-br from-[#f97316]/10 to-slate-900 p-6">
            <div className="mb-4 flex items-center gap-3">
              <span className="text-3xl">🎬</span>
              <div>
                <h2 className="text-xl font-bold text-slate-100">다음 단계: 운동 영상 업로드</h2>
                <p className="text-sm text-slate-400">1:1 피드백을 위한 영상을 등록해주세요</p>
              </div>
            </div>
            
            <div className="mb-6 space-y-3">
              <div className="flex items-center gap-3 rounded-lg bg-slate-950/50 p-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f97316] text-sm font-bold text-white">1</div>
                <span className="text-sm text-slate-300">운동 영상 촬영 (30초~1분)</span>
              </div>
              <div className="flex items-center gap-3 rounded-lg bg-slate-950/50 p-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f97316] text-sm font-bold text-white">2</div>
                <span className="text-sm text-slate-300">영상 업로드</span>
              </div>
              <div className="flex items-center gap-3 rounded-lg bg-slate-950/50 p-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700 text-sm font-bold text-slate-400">3</div>
                <span className="text-sm text-slate-400">전문가 피드백 영상 제작 (주 1회)</span>
              </div>
            </div>

            {isPremiumPlan && (
              <div className="mb-4 rounded-lg border border-purple-500/50 bg-purple-500/10 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">👑</span>
                  <span className="font-bold text-purple-400">VIP 전용</span>
                </div>
                <p className="text-sm text-slate-300">
                  1:1 Zoom 상담 일정을 예약하세요
                </p>
                <button className="mt-3 w-full rounded-lg bg-purple-600 py-2 text-sm font-semibold text-white hover:bg-purple-500">
                  📅 Zoom 상담 예약하기
                </button>
              </div>
            )}

            <Link
              href="/my-report"
              className="block w-full rounded-xl bg-gradient-to-r from-[#f97316] to-[#fb923c] py-4 text-center text-lg font-bold text-white shadow-[0_0_30px_rgba(249,115,22,0.5)] transition hover:shadow-[0_0_40px_rgba(249,115,22,0.6)]"
            >
              🎬 운동 영상 업로드하기
            </Link>
          </div>
        )}

        {/* 기본 안내 (플랜 구분 안 될 때) */}
        {!isBasicPlan && !isStandardPlan && !isPremiumPlan && (
          <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-6">
            <div className="mb-4 flex items-center gap-3">
              <span className="text-3xl">🚀</span>
              <div>
                <h2 className="text-xl font-bold text-slate-100">다음 단계</h2>
                <p className="text-sm text-slate-400">정밀 분석을 시작합니다</p>
              </div>
            </div>
            
            <Link
              href="/full-assessment"
              className="block w-full rounded-xl bg-gradient-to-r from-[#f97316] to-[#fb923c] py-4 text-center text-lg font-bold text-white"
            >
              시작하기
            </Link>
          </div>
        )}

        {/* 결제 정보 요약 */}
        <div className="rounded-lg border border-slate-700/60 bg-slate-800/50 p-4">
          <p className="text-xs text-slate-500 mb-2">결제 정보</p>
          <div className="space-y-1 text-sm text-slate-300">
            <div className="flex justify-between">
              <span>주문번호</span>
              <span className="text-slate-400 font-mono text-xs">{orderId}</span>
            </div>
            <div className="flex justify-between">
              <span>결제금액</span>
              <span className="text-[#f97316] font-semibold">
                ₩{Number(searchParams.get("amount") || 0).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* 하단 링크 */}
        <div className="flex justify-center gap-4 text-sm">
          <Link href="/my-report" className="text-slate-400 hover:text-slate-200">
            내 리포트
          </Link>
          <span className="text-slate-700">|</span>
          <Link href="/" className="text-slate-400 hover:text-slate-200">
            메인으로
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <main className="flex min-h-screen items-center justify-center bg-[#0f172a] px-4">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-[#f97316] border-t-transparent" />
          <p className="text-lg font-medium text-slate-100">결제 처리 중...</p>
          <p className="mt-2 text-sm text-slate-400">잠시만 기다려주세요.</p>
        </div>
      </main>
    }>
      <PaymentSuccessContent />
    </Suspense>
  );
}
