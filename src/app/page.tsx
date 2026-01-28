// 이 페이지는 "교정운동 기반 1:1 맞춤 교정 솔루션" 랜딩 메인 화면입니다.
// - 다크모드 기반의 신뢰감 있는 디자인
// - 오렌지색 포인트 버튼(주요 CTA · 결제 버튼)
// - 정면/측면 사진 업로드용 드롭존 UI
// - 억제-신장-활성화-통합 4단계 교정운동 프로세스 소개
// - 실시간처럼 보이는 신청 인원 수 표시
// - 모바일 우선 반응형 레이아웃
// - Toss Payments 결제 연동
"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import Script from "next/script";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// 업로드할 사진의 방향(정면/측면)을 구분하기 위한 타입입니다.
type UploadSide = "front" | "side";

// 사용자가 업로드한 사진 한 장을 표현하는 데이터 구조입니다.
interface UploadedPhoto {
  id: string; // 간단한 식별자(현재는 업로드 시점 기반으로 생성)
  side: UploadSide; // 정면(front) 또는 측면(side)
  fileName: string; // 사용자가 업로드한 실제 파일 이름
  url?: string; // 업로드된 파일의 접근 URL (서버 업로드 후 반환)
  uploadedAt: string; // 업로드 시각(문자열로 관리하면 UI에 바로 출력하기 편합니다)
}

// 체형 분석의 진행 상태를 표현하는 타입입니다.
type AnalysisStage =
  | "idle" // 아직 아무 것도 하지 않은 상태
  | "waiting_for_photos" // 사진 업로드를 기다리는 상태
  | "ready_for_analysis" // 사진 업로드는 완료, 분석 시작 전
  | "analyzing" // 분석이 진행 중인 상태
  | "completed"; // 분석이 완료된 상태

// 체형 분석 진행 상황 전체를 표현하는 구조입니다.
interface AnalysisStatus {
  stage: AnalysisStage;
  progress: number; // 0~100 사이의 단순 진행률(가상의 값)
  notes: string; // 사용자에게 보여줄 간단 안내 문구
}

// 한 번의 체형 분석 세션에서 관리할 전체 데이터 구조입니다.
interface PostureAnalysisSession {
  id: string; // 세션 식별자(지금은 단일 세션만 다루지만 확장에 대비해 둡니다)
  photos: UploadedPhoto[]; // 업로드된 사진 목록
  status: AnalysisStatus; // 현재 분석 상태
}

// 숫자를 1,245 처럼 한국어 형식으로 포맷팅해 주는 함수입니다.
const formatPeopleCount = (count: number) =>
  count.toLocaleString("ko-KR", { maximumFractionDigits: 0 });

export default function Home() {
  // 현재 서비스에 신청한 사람 수를 상태로 관리합니다.
  const [peopleCount, setPeopleCount] = useState<number>(1245);

  // 사용자가 결제를 완료했는지 여부를 나타내는 상태입니다.
  // - false: 3단계(활성화), 4단계(통합) 콘텐츠가 잠겨 있고, 블러/잠금 아이콘이 표시됩니다.
  // - true: 모든 단계의 상세 내용이 열린 상태가 됩니다.
  const [isPaid, setIsPaid] = useState<boolean>(false);

  // 사용자의 체형 분석 세션 데이터를 한 곳에서 관리합니다.
  const [session, setSession] = useState<PostureAnalysisSession>({
    id: "current-session",
    photos: [],
    status: {
      stage: "waiting_for_photos",
      progress: 0,
      notes: "정면과 측면 사진을 업로드하면, 전문가용 교정 알고리즘이 순서대로 분석을 시작합니다.",
    },
  });

  // 파일 업로드(input type="file")가 발생했을 때 호출되는 핸들러입니다.
  const handleFileChange =
    (side: UploadSide) => async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const now = new Date();
      const tempId = `${side}-${now.getTime()}`;

      // 우선 로컬 상태에 임시로 추가(업로드 중 표시 가능)
      setSession((prev) => {
        const filtered = prev.photos.filter((p) => p.side !== side);
        const updatedPhotos = [
          ...filtered,
          {
            id: tempId,
            side,
            fileName: file.name,
            uploadedAt: now.toLocaleString("ko-KR"),
          } as UploadedPhoto,
        ];

        const hasFront = updatedPhotos.some((p) => p.side === "front");
        const hasSide = updatedPhotos.some((p) => p.side === "side");
        const nextStage: AnalysisStage = hasFront && hasSide ? "analyzing" : "waiting_for_photos";

        return {
          ...prev,
          photos: updatedPhotos,
          status: {
            ...prev.status,
            stage: nextStage,
            notes:
              nextStage === "analyzing"
                ? "AI가 관절 포인트와 신체 정렬을 정밀 분석 중입니다..."
                : "다른 방향의 사진도 함께 올려주시면 더 정확한 1:1 교정 솔루션을 만들 수 있어요.",
          },
        };
      });

      try {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("side", side);
        // 필요하면 user_id 추가: fd.append("user_id", userId)

        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || "upload failed");
        }

        const publicUrl = json.url as string | undefined;

        // 서버 업로드가 성공하면 로컬 상태의 해당 사진 항목에 url을 붙여 교체
        setSession((prev) => {
          const filtered = prev.photos.filter((p) => p.side !== side);
          const updatedPhotos = [
            ...filtered,
            {
              id: tempId,
              side,
              fileName: file.name,
              uploadedAt: now.toLocaleString("ko-KR"),
              url: publicUrl,
            } as UploadedPhoto,
          ];

          const hasFront = updatedPhotos.some((p) => p.side === "front");
          const hasSide = updatedPhotos.some((p) => p.side === "side");
          const nextStage: AnalysisStage = hasFront && hasSide ? "analyzing" : "waiting_for_photos";

          return {
            ...prev,
            photos: updatedPhotos,
            status: {
              ...prev.status,
              stage: nextStage,
              notes:
                nextStage === "analyzing"
                  ? "AI가 관절 포인트와 신체 정렬을 정밀 분석 중입니다..."
                  : "다른 방향의 사진도 함께 올려주시면 더 정확한 1:1 교정 솔루션을 만들 수 있어요.",
            },
          };
        });
      } catch (err) {
        // 업로드 실패 시 사용자 알림 및 로컬 상태에서 제거
        alert("업로드 실패: " + (err as Error).message);
        setSession((prev) => ({
          ...prev,
          photos: prev.photos.filter((p) => p.id !== tempId),
          status: {
            ...prev.status,
            stage: "waiting_for_photos",
            notes: "사진 업로드 중 오류가 발생했습니다. 다시 시도해 주세요.",
          },
        }));
      }
    };

  // 간단한 타이머를 사용해서 몇 초마다 1명 정도 증감시키며
  // "실시간 신청 인원이 변하는 것처럼" 보이게 합니다.
  useEffect(() => {
    const interval = setInterval(() => {
      setPeopleCount((prev) => {
        // -1, 0, +1 중에서 랜덤으로 변동시키되, 너무 작거나 크지 않게 범위를 제한합니다.
        const deltaOptions = [-1, 0, 1];
        const delta =
          deltaOptions[Math.floor(Math.random() * deltaOptions.length)];
        const next = prev + delta;

        // 최소/최대 값으로 값을 제한(clamp)합니다.
        const min = 1200;
        const max = 1500;
        if (next < min) return min;
        if (next > max) return max;
        return next;
      });
    }, 5000); // 5초마다 한 번씩 변화

    // 컴포넌트가 화면에서 사라질 때 타이머를 정리(clean-up)합니다.
    return () => clearInterval(interval);
  }, []);

  // 사진 업로드가 모두 완료되어 stage가 "analyzing"이 되면,
  // 10초 동안 고급스러운 스캐닝 로딩 애니메이션을 보여준 뒤 "completed" 상태로 전환합니다.
  useEffect(() => {
    if (session.status.stage !== "analyzing") return;

    const timeout = setTimeout(() => {
      setSession((prev) => ({
        ...prev,
        status: {
          ...prev.status,
          stage: "completed",
          progress: 100,
          notes:
            "분석이 완료되었습니다! 전문가 최종 검토 후 24시간 내에 맞춤 리포트가 전송됩니다.",
        },
      }));
    }, 10000); // 10초 후 완료 상태로 변경

    return () => clearTimeout(timeout);
  }, [session.status.stage, setSession]);

  // 업로드 가이드 모달의 열림 상태와, 어떤 방향(정면/측면)에 대한 업로드인지 기억합니다.
  const [pendingSide, setPendingSide] = useState<UploadSide | null>(null);
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);

  // 로그인 상태 확인
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  
  useEffect(() => {
    // 현재 로그인한 사용자 확인
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email || undefined });
        // 로컬스토리지에 사용자 ID 저장 (결제 시 사용)
        localStorage.setItem("user_id", session.user.id);
      }
    };
    checkUser();

    // 인증 상태 변경 감지
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email || undefined });
        localStorage.setItem("user_id", session.user.id);
      } else {
        setUser(null);
        localStorage.removeItem("user_id");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Toss Payments 결제 처리 함수 (티어별 가격 지원)
  const handlePayment = async (tier: string = "basic", customAmount?: number) => {
    // Toss Payments SDK가 로드되었는지 확인
    // @ts-ignore - Toss SDK는 전역으로 로드됨
    if (typeof window.TossPayments === "undefined") {
      alert("결제 시스템을 불러오는 중입니다. 잠시 후 다시 시도해주세요.");
      return;
    }

    // Toss 클라이언트 키 가져오기
    const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY || "";
    if (!clientKey) {
      alert("결제 설정이 완료되지 않았습니다. 관리자에게 문의해주세요.");
      return;
    }

    // 티어별 금액 및 상품명 설정
    let amount: number;
    let orderName: string;

    if (customAmount) {
      amount = customAmount;
      orderName = tier === "basic" ? "베이직 플랜" :
                  tier === "premium" ? "프리미엄 플랜" :
                  tier === "vip" ? "VIP 플랜" : "교정운동 솔루션";
    } else {
      // 기본값 (베이직)
      amount = 19900;
      orderName = "베이직 플랜 - 맞춤 교정 리포트";
    }

    // 고유한 주문 ID 생성 (티어 정보 포함)
    const orderId = `order_${tier}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 가장 최근 업로드한 요청 ID를 저장 (결제 성공 후 연결용)
    const recentRequestId = session.photos.length > 0 ? session.id : null;
    if (recentRequestId) {
      localStorage.setItem("pending_request_id", recentRequestId);
    }
    
    // 선택한 티어 정보도 저장
    localStorage.setItem("selected_tier", tier);

    try {
      // @ts-ignore - Toss SDK 타입 정의 없음
      const tossPayments = window.TossPayments(clientKey);
      
      // 결제 요청
      await tossPayments.requestPayment("카드", {
        amount,
        orderId,
        orderName,
        customerName: user?.email?.split("@")[0] || "고객",
        successUrl: `${window.location.origin}/payments/success`,
        failUrl: `${window.location.origin}/payments/fail`,
      });
    } catch (error: any) {
      // 사용자가 결제를 취소한 경우
      if (error.code === "USER_CANCEL") {
        console.log("사용자가 결제를 취소했습니다.");
      } else {
        console.error("결제 오류:", error);
        alert("결제 중 오류가 발생했습니다: " + (error.message || "알 수 없는 오류"));
      }
    }
  };

  // 실제 파일 선택창을 열기 위한 input 참조입니다.
  const frontInputRef = useRef<HTMLInputElement | null>(null);
  const sideInputRef = useRef<HTMLInputElement | null>(null);

  // 업로드 카드를 눌렀을 때: 파일 선택창 대신 촬영 가이드 모달을 먼저 띄웁니다.
  const openGuideForSide = (side: UploadSide) => {
    setPendingSide(side);
    setIsGuideOpen(true);
  };

  // 모달에서 "가이드를 확인했습니다" 버튼을 눌렀을 때 호출됩니다.
  // 이때에만 실제 파일 선택창을 열어 줍니다.
  const handleConfirmGuide = () => {
    if (!pendingSide) {
      setIsGuideOpen(false);
      return;
    }

    if (pendingSide === "front") {
      frontInputRef.current?.click();
    } else {
      sideInputRef.current?.click();
    }

    setIsGuideOpen(false);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0f172a] px-4 py-8 text-slate-100">
      {/* Toss Payments SDK 로드 */}
      <Script
        src="https://js.tosspayments.com/v1/payment"
        strategy="lazyOnload"
      />
      
      {/* 전체를 감싸는 카드 레이아웃입니다. 모바일에서는 세로, 큰 화면에서는 좌우 분할 구조로 보입니다. */}
      <section className="relative flex w-full max-w-5xl flex-col gap-12 overflow-hidden rounded-3xl border border-slate-700/80 bg-slate-900/80 p-6 shadow-[0_25px_80px_rgba(0,0,0,0.6)] sm:p-10">
        {/* 상단 네비게이션: 로그인/회원가입 또는 사용자 정보 */}
        <nav className="absolute right-4 top-4 z-20 flex items-center gap-3 sm:right-6 sm:top-6">
          {user ? (
            <>
              <span className="text-xs text-slate-400">{user.email}</span>
              <Link
                href="/my-report"
                className="text-xs text-slate-300 hover:text-white"
              >
                내 리포트
              </Link>
              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                  setUser(null);
                }}
                className="rounded-full border border-slate-600 px-3 py-1 text-xs text-slate-300 hover:bg-slate-800"
              >
                로그아웃
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-xs text-slate-300 hover:text-white"
              >
                로그인
              </Link>
              <Link
                href="/signup"
                className="rounded-full bg-[#f97316] px-3 py-1 text-xs font-medium text-slate-950"
              >
                회원가입
              </Link>
            </>
          )}
        </nav>
        {/* 상단 영역: 좌측 소개 + 우측 업로드 & 상태 박스 */}
        <div className="relative z-10 flex flex-col gap-10 md:flex-row md:items-start">
          {/* 왼쪽 영역: 서비스 설명 + 실시간 신청 인원 */}
          <div className="flex-1 space-y-8">
            {/* 상단 라벨 배지: 서비스 컨셉을 한눈에 보여줍니다. */}
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/90 px-4 py-1.5 text-xs text-slate-300">
              <span className="h-1.5 w-1.5 rounded-full bg-[#f97316]" />
              <span className="font-medium">NASM 기반 · 교정운동 전문가</span>
            </div>

            {/* 메인 제목과 설명 문구입니다. */}
            <header className="space-y-6">
              <h1 className="text-4xl font-bold leading-tight sm:text-5xl md:text-6xl lg:text-7xl">
                사진 2장으로
                <br />
                <span className="bg-gradient-to-r from-[#f97316] to-[#fb923c] bg-clip-text text-transparent">
                  내 몸만의 솔루션
                </span>
              </h1>
              <p className="text-lg leading-relaxed text-slate-200 sm:text-xl md:text-2xl">
                거북목? 라운드숄더?
                <br />
                <span className="font-bold text-white">
                  24시간 내 맞춤 교정 운동
                </span>
                을 받아보세요.
              </p>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2 rounded-full bg-[#f97316]/10 px-4 py-2 text-sm text-slate-200">
                  <svg className="h-5 w-5 text-[#f97316]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  NASM 기반
                </div>
                <div className="flex items-center gap-2 rounded-full bg-[#f97316]/10 px-4 py-2 text-sm text-slate-200">
                  <svg className="h-5 w-5 text-[#f97316]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  24시간 이내 전달
                </div>
                <div className="flex items-center gap-2 rounded-full bg-[#f97316]/10 px-4 py-2 text-sm text-slate-200">
                  <svg className="h-5 w-5 text-[#f97316]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  1:1 맞춤 처방
                </div>
              </div>
            </header>

            {/* 실시간 신청 인원 수 표시 영역입니다. */}
            <div className="flex items-center gap-2 text-sm sm:text-base">
              <div className="flex items-center gap-2 rounded-lg border border-[#f97316]/30 bg-[#f97316]/5 px-4 py-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#f97316] opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#f97316]" />
                </span>
                <span className="font-semibold text-slate-100">
                  {formatPeopleCount(peopleCount)}명
                </span>
                <span className="text-slate-300">분석 진행 중</span>
              </div>
            </div>
          </div>

          {/* 오른쪽 영역: 사진 업로드 드롭존 + 분석 상태 박스 */}
          <aside className="flex flex-1 justify-center md:justify-end">
            <div className="w-full max-w-sm space-y-5 rounded-2xl border border-[#f97316]/20 bg-gradient-to-br from-slate-900 to-slate-800/90 p-6 shadow-[0_20px_60px_rgba(249,115,22,0.2)]">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f97316]/20">
                  <span className="text-xl">📸</span>
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-100 sm:text-lg">
                    사진 2장 업로드
                  </h2>
                  <p className="text-xs text-slate-400">정면 + 측면</p>
                </div>
              </div>


              {/* 드롭존 스타일 업로드 영역입니다. */}
              <div className="space-y-3">
                {/* 정면 사진 업로드 */}
                <button
                  type="button"
                  onClick={() => openGuideForSide("front")}
                  className="group relative w-full overflow-hidden rounded-xl border-2 border-dashed border-slate-700 bg-slate-950/50 p-6 text-center transition hover:border-[#f97316] hover:bg-slate-950"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f97316]/10 group-hover:bg-[#f97316]/20">
                        <span className="text-2xl">📷</span>
                      </div>
                      <div className="text-left">
                        <p className="font-semibold text-slate-100">정면 사진</p>
                        <p className="text-xs text-slate-400">몸 전체 정면</p>
                      </div>
                    </div>
                    <svg className="h-6 w-6 text-slate-600 group-hover:text-[#f97316]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                </button>

                {/* 측면 사진 업로드 */}
                <button
                  type="button"
                  onClick={() => openGuideForSide("side")}
                  className="group relative w-full overflow-hidden rounded-xl border-2 border-dashed border-slate-700 bg-slate-950/50 p-6 text-center transition hover:border-[#f97316] hover:bg-slate-950"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f97316]/10 group-hover:bg-[#f97316]/20">
                        <span className="text-2xl">📐</span>
                      </div>
                      <div className="text-left">
                        <p className="font-semibold text-slate-100">측면 사진</p>
                        <p className="text-xs text-slate-400">옆모습 전체</p>
                      </div>
                    </div>
                    <svg className="h-6 w-6 text-slate-600 group-hover:text-[#f97316]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                </button>

                {/* 실제 파일 업로드 input은 숨겨두고, 모달에서 확인 후에만 열어 줍니다. */}
                <input
                  ref={frontInputRef}
                  id="front-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange("front")}
                />
                <input
                  ref={sideInputRef}
                  id="side-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange("side")}
                />
              </div>

              {/* 업로드된 파일 정보 및 분석 상태 요약 영역입니다. */}
              <div className="space-y-3 rounded-xl border border-slate-700/50 bg-slate-950/50 p-4">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-[#f97316]" />
                  <span className="text-sm font-semibold text-slate-100">
                    분석 상태
                  </span>
                </div>

                <p className="text-xs leading-relaxed text-slate-300">
                  {session.status.notes}
                </p>

                {/* 업로드된 사진 목록 */}
                {session.photos.length > 0 && (
                  <div className="space-y-2">
                    {session.photos.map((photo) => (
                      <div
                        key={photo.id}
                        className="flex items-center gap-3 rounded-lg bg-[#f97316]/5 p-3"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f97316]/20">
                          <svg className="h-4 w-4 text-[#f97316]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-medium text-slate-100">
                            {photo.side === "front" ? "정면" : "측면"} 사진
                          </p>
                          <p className="text-[10px] text-slate-500">{photo.uploadedAt}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* AI 분석 중 */}
                {session.status.stage === "analyzing" && (
                  <div className="overflow-hidden rounded-xl border border-[#f97316]/30 bg-gradient-to-br from-[#f97316]/10 to-transparent p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#f97316] border-t-transparent" />
                      <div>
                        <p className="text-sm font-semibold text-slate-100">
                          AI 분석 중...
                        </p>
                        <p className="text-xs text-slate-400">
                          약 10초 소요
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* 분석 완료 */}
                {session.status.stage === "completed" && (
                  <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/20">
                        <svg className="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-green-400">
                          분석 완료!
                        </p>
                        <p className="mt-1 text-xs text-slate-300">
                          전문가 검토 후 24시간 내 리포트 전송
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>

        {/* 4단계 교정운동 프로세스 섹션입니다. */}
        <div className="relative z-10 space-y-8 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-800/90 p-8 sm:p-10">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-slate-100 sm:text-4xl">
              과학적 4단계 교정 시스템
            </h2>
            <p className="mt-3 text-sm text-slate-300 sm:text-base">
              <span className="font-bold text-[#f97316]">억제</span> →{" "}
              <span className="font-bold text-[#fb923c]">신장</span> →{" "}
              <span className="font-bold text-[#fbbf24]">활성화</span> →{" "}
              <span className="font-bold text-[#fde047]">통합</span>
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: "01",
                title: "억제",
                subtitle: "긴장 풀기",
                description: "과긴장된 근육을 먼저 이완시킵니다.",
                gradient: "from-red-500/20 to-red-500/5",
                icon: "🔴",
                bgImage: "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=800&q=80",
              },
              {
                label: "02",
                title: "신장",
                subtitle: "라인 늘리기",
                description: "짧아진 근육을 안전하게 늘립니다.",
                gradient: "from-orange-500/20 to-orange-500/5",
                icon: "🟠",
                bgImage: "https://images.unsplash.com/photo-1599901860904-17e6ed7083a0?w=800&q=80",
              },
              {
                label: "03",
                title: "활성화",
                subtitle: "힘 기르기",
                description: "약해진 근육을 깨워 강화합니다.",
                gradient: "from-yellow-500/20 to-yellow-500/5",
                icon: "🟡",
                bgImage: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=800&q=80",
              },
              {
                label: "04",
                title: "통합",
                subtitle: "일상 적용",
                description: "실제 자세에서 유지하도록 훈련합니다.",
                gradient: "from-green-500/20 to-green-500/5",
                icon: "🟢",
                bgImage: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800&q=80",
              },
            ].map((step, index) => {
              const isLocked = !isPaid && index >= 2;

              return (
                <div
                  key={step.title}
                  className={`relative overflow-hidden rounded-2xl border p-6 transition hover:scale-105 ${
                    isLocked 
                      ? "border-slate-700/50 bg-slate-900/50" 
                      : `border-slate-600/50 bg-gradient-to-br ${step.gradient}`
                  }`}
                  style={{
                    backgroundImage: !isLocked ? `url(${step.bgImage})` : undefined,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                >
                  {/* 더 진한 오버레이로 텍스트 가독성 향상 */}
                  {!isLocked && (
                    <div className={`absolute inset-0 bg-gradient-to-br ${step.gradient} opacity-95`} />
                  )}

                  {isLocked && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-2xl bg-slate-950/90 backdrop-blur-sm">
                      <span className="text-2xl">🔒</span>
                      <p className="text-xs font-medium text-slate-300">
                        유료 구간
                      </p>
                    </div>
                  )}

                  <div className={`relative z-10 ${isLocked ? "blur-sm opacity-40" : ""}`}>
                    <div className="mb-4 flex items-center justify-between">
                      <span className="text-3xl">{step.icon}</span>
                      <span className="text-xs font-bold text-slate-400">{step.label}</span>
                    </div>
                    <h3 className="mb-2 text-xl font-bold text-white drop-shadow-lg">
                      {step.title}
                    </h3>
                    <p className="mb-3 text-sm font-bold text-[#f97316] drop-shadow-lg">
                      {step.subtitle}
                    </p>
                    <p className="text-xs leading-relaxed text-white drop-shadow-md">
                      {step.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 결제 유도 배너 */}
          {!isPaid && (
            <div className="relative overflow-hidden rounded-2xl border border-[#f97316]/30 bg-gradient-to-r from-[#f97316]/10 via-slate-900/80 to-slate-900/80 p-6">
              <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
                <div className="space-y-1">
                  <p className="text-lg font-bold text-slate-100">
                    완전한 교정을 원하신다면?
                  </p>
                  <p className="text-sm text-slate-300">
                    3·4단계까지 완료해야 효과가 지속됩니다
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handlePayment}
                  className="inline-flex items-center gap-2 rounded-full bg-[#f97316] px-6 py-3 font-bold text-slate-950 shadow-[0_0_30px_rgba(249,115,22,0.4)] transition hover:bg-[#fb923c] hover:shadow-[0_0_40px_rgba(249,115,22,0.6)] hover:scale-105"
                >
                  <span>₩19,900</span>
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 서비스 티어 소개 섹션 */}
        <div className="relative z-10 space-y-12 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-800/90 p-8 sm:p-12">
          <div className="text-center">
            <h2 className="mb-4 text-3xl font-bold text-slate-100 sm:text-4xl">
              나에게 맞는 플랜을 선택하세요
            </h2>
            <p className="text-slate-300">
              단순한 분석부터 전문가 1:1 관리까지
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {/* 베이직 */}
            <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-6 transition hover:border-slate-600 hover:shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
              <div className="mb-4">
                <h3 className="mb-2 text-xl font-bold text-slate-100">베이직</h3>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-[#f97316]">₩19,900</span>
                  <span className="text-sm text-slate-500">1회</span>
                </div>
              </div>
              <ul className="mb-6 space-y-2 text-sm text-slate-300">
                <li className="flex items-start gap-2">
                  <span className="text-[#f97316]">✓</span>
                  <span>정적자세 평가</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#f97316]">✓</span>
                  <span>맞춤 교정 루틴 PDF</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#f97316]">✓</span>
                  <span>가이드 영상 링크</span>
                </li>
              </ul>
              <Link
                href="/pricing"
                className="block w-full rounded-full bg-slate-800 py-3 text-center font-semibold text-slate-100 transition hover:bg-slate-700"
              >
                자세히 보기
              </Link>
            </div>

            {/* 프리미엄 */}
            <div className="relative rounded-xl border-2 border-[#f97316] bg-gradient-to-br from-slate-900 to-slate-800 p-6 shadow-[0_20px_60px_rgba(249,115,22,0.3)]">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#f97316] px-4 py-1 text-xs font-bold text-slate-950">
                POPULAR
              </div>
              <div className="mb-4">
                <h3 className="mb-2 text-xl font-bold text-slate-100">프리미엄</h3>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-[#f97316]">₩150,000</span>
                  <span className="text-sm text-slate-500">/ 월</span>
                </div>
              </div>
              <ul className="mb-6 space-y-2 text-sm text-slate-300">
                <li className="flex items-start gap-2">
                  <span className="text-[#f97316]">✓</span>
                  <span>베이직 + 1:1 전담 코칭</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#f97316]">✓</span>
                  <span>카톡/텔레그램 관리</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#f97316]">✓</span>
                  <span>주간 루틴 점검</span>
                </li>
              </ul>
              <Link
                href="/pricing"
                className="block w-full rounded-full bg-[#f97316] py-3 text-center font-bold text-slate-950 shadow-[0_0_20px_rgba(249,115,22,0.5)] transition hover:bg-[#fb923c]"
              >
                자세히 보기
              </Link>
            </div>

            {/* VIP */}
            <div className="rounded-xl border border-amber-500/50 bg-gradient-to-br from-slate-900 via-amber-950/20 to-slate-900 p-6 transition hover:border-amber-500 hover:shadow-[0_10px_40px_rgba(245,158,11,0.3)]">
              <div className="mb-4">
                <h3 className="mb-2 text-xl font-bold text-amber-400">VIP</h3>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-amber-400">₩400,000</span>
                  <span className="text-sm text-slate-500">/ 월</span>
                </div>
              </div>
              <ul className="mb-6 space-y-2 text-sm text-slate-300">
                <li className="flex items-start gap-2">
                  <span className="text-amber-500">✓</span>
                  <span>프리미엄 + 화상 코칭</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500">✓</span>
                  <span>월 4회 실시간 세션</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500">✓</span>
                  <span>맞춤 영양 플랜</span>
                </li>
              </ul>
              <Link
                href="/pricing"
                className="block w-full rounded-full bg-gradient-to-r from-amber-500 to-amber-600 py-3 text-center font-bold text-slate-950 transition hover:from-amber-400 hover:to-amber-500"
              >
                자세히 보기
              </Link>
            </div>
          </div>

          <div className="text-center">
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200"
            >
              <span>전체 플랜 비교하기</span>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>

        {/* 최종 CTA 영역 */}
        <div className="relative z-10 overflow-hidden rounded-2xl border border-[#f97316]/50 bg-gradient-to-br from-[#f97316]/20 via-slate-900/90 to-slate-900/90 p-8 text-center shadow-[0_20px_60px_rgba(249,115,22,0.3)]">
          <h2 className="mb-3 text-2xl font-bold text-slate-100 sm:text-3xl">
            지금 바로 시작하세요
          </h2>
          <p className="mb-6 text-sm text-slate-300 sm:text-base">
            사진 2장으로 전문가가 분석한 맞춤 교정 루틴을 받아보세요
          </p>
          <button
            type="button"
            onClick={handlePayment}
            className="group inline-flex items-center gap-3 rounded-full bg-[#f97316] px-8 py-4 text-lg font-bold text-slate-950 shadow-[0_0_40px_rgba(249,115,22,0.5)] transition hover:bg-[#fb923c] hover:shadow-[0_0_60px_rgba(249,115,22,0.7)] hover:scale-105"
          >
            <span>₩19,900로 시작하기</span>
            <svg className="h-6 w-6 transition group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>
          <p className="mt-4 text-xs text-slate-500">
            24시간 내 전문가 리포트 전달 · 환불 보장
          </p>
        </div>

        {/* 사진 촬영 가이드 모달입니다. 업로드 전에 올바른 자세를 안내해 줍니다. */}
        {isGuideOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
            <div
              role="dialog"
              aria-modal="true"
              className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-950 p-5 shadow-[0_20px_80px_rgba(0,0,0,0.9)]"
            >
              <header className="mb-3 space-y-1">
                <div className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1 text-[11px] text-slate-300">
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#f97316] text-[10px] text-slate-950">
                    i
                  </span>
                  <span>정확한 분석을 위한 촬영 가이드</span>
                </div>
                <h2 className="text-sm font-semibold text-slate-100 sm:text-base">
                  NASM 기반 체형 분석을 위해 이렇게 촬영해 주세요
                </h2>
              </header>

              <div className="space-y-3 text-[11px] text-slate-300 sm:text-xs">
                <div className="rounded-xl bg-slate-900/70 p-3">
                  <p className="mb-1 font-semibold text-slate-100">
                    정면(관상면)
                  </p>
                  <p className="text-slate-300">
                    몸 전체가 나오도록, 발은 골반 너비 11자, 몸에 힘을 빼고
                    정면을 응시해 주세요.
                  </p>
                </div>

                <div className="rounded-xl bg-slate-900/70 p-3">
                  <p className="mb-1 font-semibold text-slate-100">
                    측면(시상면)
                  </p>
                  <p className="text-slate-300">
                    몸 전체가 나오도록 옆으로 서서 정면을 응시하고, 팔은
                    자연스럽게 몸 옆으로 내려 주세요.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-700 bg-slate-950/80 p-3">
                  <p className="mb-1 font-semibold text-slate-100">주의사항</p>
                  <ul className="list-disc space-y-1 pl-4 text-slate-300">
                    <li>몸에 붙는 옷(운동복 등)을 착용해 주세요.</li>
                    <li>배경은 단순한 곳(벽 또는 텅 빈 공간)에서 촬영해 주세요.</li>
                    <li>카메라는 가슴 높이 정도에서 수평으로 맞춰 주세요.</li>
                  </ul>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setIsGuideOpen(false)}
                  className="h-9 rounded-full border border-slate-700 px-4 text-xs font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-900 sm:h-8"
                >
                  닫기
                </button>
                <button
                  type="button"
                  onClick={handleConfirmGuide}
                  className="h-9 rounded-full bg-[#f97316] px-4 text-xs font-semibold text-slate-950 shadow-[0_0_20px_rgba(249,115,22,0.6)] transition hover:bg-[#fb923c] hover:shadow-[0_0_28px_rgba(249,115,22,0.7)] sm:h-8"
                >
                  가이드를 확인했습니다
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
