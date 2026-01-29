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
      notes: "정면과 측면 사진을 업로드하면 자세 경향을 확인해드립니다.",
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
                ? "사진을 확인하고 있습니다..."
                : "다른 방향의 사진도 함께 올려주시면 더 맞춤화된 가이드를 만들 수 있어요.",
          },
        };
      });

      try {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("side", side);
        // user_id 추가 (로그인한 사용자 또는 세션 ID)
        const userId = user?.id || localStorage.getItem("user_id") || `anonymous-${Date.now()}`;
        fd.append("user_id", userId);
        
        console.log('📤 업로드 시작:', { side, userId, fileName: file.name });

        const res = await fetch("/api/upload", { method: "POST", body: fd });
        console.log('📥 업로드 응답:', res.status);
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
                ? "사진을 확인하고 있습니다..."
                : "다른 방향의 사진도 함께 올려주시면 더 맞춤화된 가이드를 만들 수 있어요.",
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
            "사진 업로드 완료! 전문가 확인 후 24시간 내에 운동 가이드를 보내드립니다.",
        },
      }));
    }, 10000); // 10초 후 완료 상태로 변경

    return () => clearTimeout(timeout);
  }, [session.status.stage, setSession]);

  // 업로드 가이드 모달의 열림 상태와, 어떤 방향(정면/측면)에 대한 업로드인지 기억합니다.
  const [pendingSide, setPendingSide] = useState<UploadSide | null>(null);
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);
  
  // 샘플 리포트 미리보기 모달 상태
  const [isReportPreviewOpen, setIsReportPreviewOpen] = useState<boolean>(false);
  
  // 사전 동의 모달 상태
  const [isConsentModalOpen, setIsConsentModalOpen] = useState<boolean>(false);
  const [hasAgreed, setHasAgreed] = useState<boolean>(false);
  
  // 동의 항목 체크 상태 (5개)
  const [consent1, setConsent1] = useState<boolean>(false);
  const [consent2, setConsent2] = useState<boolean>(false);
  const [consent3, setConsent3] = useState<boolean>(false);
  const [consent4, setConsent4] = useState<boolean>(false);
  const [consent5, setConsent5] = useState<boolean>(false);
  
  // 면책 배너 닫기 상태
  const [isDisclaimerBannerVisible, setIsDisclaimerBannerVisible] = useState<boolean>(true);

  // 로그인 상태 확인
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  
  // 섹션 펼치기/접기 상태
  const [showProcess, setShowProcess] = useState(false);
  const [showCorrectionSystem, setShowCorrectionSystem] = useState(false);
  
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

    // 사전 동의 상태 확인
    const agreedBefore = localStorage.getItem("service_consent_agreed");
    if (agreedBefore === "true") {
      setHasAgreed(true);
    }

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

  // 업로드 카드를 눌렀을 때: 사전 동의를 확인한 후 가이드 모달을 띄웁니다.
  const openGuideForSide = (side: UploadSide) => {
    // 사전 동의를 하지 않았다면 동의 모달을 먼저 띄움
    if (!hasAgreed) {
      setPendingSide(side);
      setIsConsentModalOpen(true);
      return;
    }
    
    // 이미 동의했다면 가이드 모달로 진행
    setPendingSide(side);
    setIsGuideOpen(true);
  };
  
  // 사전 동의 완료 처리
  const handleConsentComplete = () => {
    // 5개 항목 모두 체크했는지 확인
    if (!consent1 || !consent2 || !consent3 || !consent4 || !consent5) {
      alert("모든 항목에 동의해주셔야 서비스를 이용할 수 있습니다.");
      return;
    }
    
    setHasAgreed(true);
    setIsConsentModalOpen(false);
    
    // 동의 상태를 localStorage에 저장 (다음에는 보지 않음)
    localStorage.setItem("service_consent_agreed", "true");
    localStorage.setItem("service_consent_date", new Date().toISOString());
    
    // 동의 후 가이드 모달 열기
    if (pendingSide) {
      setIsGuideOpen(true);
    }
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

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://posturelab.com";

  return (
    <main className="flex min-h-screen flex-col bg-[#0f172a] text-slate-100">
      {/* 면책 배너 - 최상단 고정 */}
      {isDisclaimerBannerVisible && (
        <div className="sticky top-0 z-50 border-b border-amber-500/30 bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-red-500/20 backdrop-blur-sm">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
            <div className="flex items-center gap-3">
              <svg className="h-5 w-5 flex-shrink-0 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-slate-200 sm:text-sm">
                <strong className="text-amber-300">ℹ️ 중요:</strong> 본 서비스는 의료행위가 아닙니다. 통증이나 질병이 있는 경우 전문 의료기관을 방문하세요.
              </p>
            </div>
            <button
              onClick={() => setIsDisclaimerBannerVisible(false)}
              className="flex-shrink-0 rounded-full p-1 hover:bg-slate-800/50"
              aria-label="배너 닫기"
            >
              <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* 메인 컨텐츠 */}
      <div className="flex min-h-screen items-center justify-center px-4 py-8">
      {/* Toss Payments SDK 로드 */}
      <Script
        src="https://js.tosspayments.com/v1/payment"
        strategy="lazyOnload"
      />
      
      {/* 구조화된 데이터 (JSON-LD) for SEO */}
      <Script
        id="structured-data"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ProfessionalService",
            "name": "포스처랩",
            "description": "NASM-CES 전문가의 맞춤 자세 개선 운동 가이드",
            "url": baseUrl,
            "logo": `${baseUrl}/logo.png`,
            "image": `${baseUrl}/og-image.jpg`,
            "priceRange": "₩19,000 - ₩150,000",
            "address": {
              "@type": "PostalAddress",
              "addressCountry": "KR",
              "addressLocality": "서울"
            },
            "aggregateRating": {
              "@type": "AggregateRating",
              "ratingValue": "4.9",
              "reviewCount": "1245"
            },
            "offers": [
              {
                "@type": "Offer",
                "name": "BASIC 플랜",
                "price": "19000",
                "priceCurrency": "KRW",
                "description": "정적자세 평가 및 맞춤 운동 루틴 PDF 제공",
                "availability": "https://schema.org/InStock"
              },
              {
                "@type": "Offer",
                "name": "STANDARD 플랜",
                "price": "49000",
                "priceCurrency": "KRW",
                "description": "BASIC + 전문가 영상 피드백 + 주간 체크리스트",
                "availability": "https://schema.org/InStock"
              },
              {
                "@type": "Offer",
                "name": "PREMIUM 플랜",
                "price": "150000",
                "priceCurrency": "KRW",
                "description": "1:1 전담 코칭 및 카카오톡 실시간 관리",
                "availability": "https://schema.org/InStock"
              }
            ],
            "serviceType": "자세 개선 운동 가이드 전문 서비스",
            "areaServed": {
              "@type": "Country",
              "name": "대한민국"
            },
            "hasOfferCatalog": {
              "@type": "OfferCatalog",
              "name": "자세 개선 운동 서비스",
              "itemListElement": [
                {
                  "@type": "Offer",
                  "itemOffered": {
                    "@type": "Service",
                    "name": "체형 분석 및 운동 가이드",
                    "description": "NASM-CES 전문가의 4단계 운동 시스템 (억제-신장-활성화-통합)"
                  }
                }
              ]
            }
          })
        }}
      />
      
      {/* 전체를 감싸는 카드 레이아웃입니다. 모바일에서는 세로, 큰 화면에서는 좌우 분할 구조로 보입니다. */}
      <section className="relative flex w-full max-w-5xl flex-col gap-12 overflow-hidden rounded-3xl border border-slate-700/80 bg-slate-900/80 p-6 shadow-[0_25px_80px_rgba(0,0,0,0.6)] sm:p-10">
        {/* 상단 네비게이션: 로그인/회원가입 또는 사용자 정보 */}
        <nav className="absolute right-4 top-4 z-20 flex items-center gap-3 sm:right-6 sm:top-6">
          {user ? (
            <>
              <span className="text-xs text-slate-400">{user.email}</span>
              <Link
                href="/survey"
                className="text-xs font-medium text-[#f97316] hover:text-[#fb923c]"
              >
                📝 무료 자세 체크
              </Link>
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
                href="/survey"
                className="text-xs font-medium text-[#f97316] hover:text-[#fb923c]"
              >
                📝 무료 자세 체크
              </Link>
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
                사진 2장으로 시작하는
                <br />
                <span className="bg-gradient-to-r from-[#f97316] to-[#fb923c] bg-clip-text text-transparent">
                  내 몸 균형 찾기
                </span>
              </h1>
              <p className="text-lg leading-relaxed text-slate-200 sm:text-xl md:text-2xl">
                전문가가 확인하고,
                <br />
                <span className="font-bold text-white">
                  맞춤 운동 가이드를 보내드려요
                </span>
              </p>
              
              {/* 메인 CTA 버튼 */}
              <div className="pt-4">
                <Link
                  href="/free-survey"
                  className="inline-flex items-center gap-3 rounded-full bg-gradient-to-r from-[#f97316] to-[#fb923c] px-8 py-4 text-lg font-bold text-white shadow-[0_10px_40px_rgba(249,115,22,0.4)] transition hover:scale-105 hover:shadow-[0_15px_50px_rgba(249,115,22,0.5)]"
                >
                  <span className="text-2xl">📝</span>
                  <span>무료로 체크 시작하기</span>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
              </div>
              
              {/* 신뢰 배지 */}
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <svg className="h-5 w-5 text-[#f97316]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  NASM 기반
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <svg className="h-5 w-5 text-[#f97316]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  24시간 전달
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <svg className="h-5 w-5 text-[#f97316]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  1:1 맞춤
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

          {/* 오른쪽 영역: 간단한 시각적 안내 */}
          <aside className="flex flex-1 justify-center md:justify-end">
            <div className="w-full max-w-sm">
              {/* 간단한 프로세스 안내 카드 */}
              <div className="rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-900/90 to-slate-800/90 p-8 shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
                <div className="mb-4 text-center">
                  <div className="mb-2 inline-block rounded-full bg-green-500/10 px-3 py-1">
                    <span className="text-xs font-bold text-green-400">완전 무료</span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-100">
                    간단하게 시작하세요
                  </h3>
                </div>
                
                <div className="space-y-6">
                  {/* Step 1 */}
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-green-500/20 text-lg font-bold text-green-400">
                      1
                    </div>
                    <div>
                      <h4 className="mb-1 font-semibold text-slate-100">간단한 설문</h4>
                      <p className="text-sm text-slate-400">3분이면 충분해요</p>
                    </div>
                  </div>
                  
                  {/* Step 2 */}
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-green-500/20 text-lg font-bold text-green-400">
                      2
                    </div>
                    <div>
                      <h4 className="mb-1 font-semibold text-slate-100">즉시 결과 확인</h4>
                      <p className="text-sm text-slate-400">기본 자세 경향 분석</p>
                    </div>
                  </div>
                  
                  {/* Step 3 */}
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#f97316]/20 text-lg font-bold text-[#f97316]">
                      +
                    </div>
                    <div>
                      <h4 className="mb-1 font-semibold text-slate-100">원하면 업그레이드</h4>
                      <p className="text-sm text-slate-400">사진 분석 + 상세 가이드</p>
                    </div>
                  </div>
                </div>
                
                {/* 안내 문구 */}
                <div className="mt-6 rounded-lg border border-[#f97316]/30 bg-[#f97316]/5 p-4">
                  <p className="text-center text-xs text-slate-300">
                    💡 무료 버전은 간단한 경향만 확인
                    <br />
                    <span className="text-[#f97316]">더 정확한 분석이 필요하면 BASIC 플랜</span>
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>

        {/* 교정운동 소개 및 신뢰 확보 섹션 */}
        <section className="relative z-10 space-y-8">
          {/* 섹션 제목 */}
          <div className="text-center">
            <h2 className="text-3xl font-bold text-slate-100 sm:text-4xl">
              운동 전문가가
              <br />
              처음부터 끝까지 함께합니다
            </h2>
            <p className="mt-4 text-lg text-slate-400">
              NASM 기반 체계적 접근, 안전한 프로세스
            </p>
          </div>

          {/* 3가지 핵심 메시지 카드 */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {/* 메시지 1: 전문가 직접 확인 */}
            <div className="group rounded-2xl border border-slate-700/80 bg-gradient-to-br from-slate-900/90 to-slate-800/90 p-8 transition hover:border-[#f97316]/50 hover:shadow-[0_0_30px_rgba(249,115,22,0.15)]">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f97316]/10 text-4xl transition group-hover:scale-110 group-hover:bg-[#f97316]/20">
                🎓
              </div>
              <h3 className="mb-4 text-xl font-bold text-slate-100">
                국제 인증 전문가가
                <br />
                직접 확인합니다
              </h3>
              <p className="leading-relaxed text-slate-300">
                NASM-CES 자격을 보유한 운동 전문가가 사진과 설문을 직접 검토하여 당신만의 운동 루틴을 만듭니다.
                <span className="mt-2 block text-sm text-slate-400">
                  AI가 판단하지 않습니다.
                </span>
              </p>
            </div>

            {/* 메시지 2: 운동 가이드 */}
            <div className="group rounded-2xl border border-slate-700/80 bg-gradient-to-br from-slate-900/90 to-slate-800/90 p-8 transition hover:border-[#f97316]/50 hover:shadow-[0_0_30px_rgba(249,115,22,0.15)]">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f97316]/10 text-4xl transition group-hover:scale-110 group-hover:bg-[#f97316]/20">
                ✅
              </div>
              <h3 className="mb-4 text-xl font-bold text-slate-100">
                진단하지 않고,
                <br />
                균형을 찾아갑니다
              </h3>
              <p className="leading-relaxed text-slate-300">
                통증이나 질병을 치료하는 곳이 아닙니다.
                <span className="mt-2 block">
                  몸의 균형을 확인하고, 운동으로 개선해나가는 방법을 안내합니다.
                </span>
              </p>
            </div>

            {/* 메시지 3: 안전한 프로세스 */}
            <div className="group rounded-2xl border border-slate-700/80 bg-gradient-to-br from-slate-900/90 to-slate-800/90 p-8 transition hover:border-[#f97316]/50 hover:shadow-[0_0_30px_rgba(249,115,22,0.15)] sm:col-span-2 lg:col-span-1">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f97316]/10 text-4xl transition group-hover:scale-110 group-hover:bg-[#f97316]/20">
                🔒
              </div>
              <h3 className="mb-4 text-xl font-bold text-slate-100">
                사진은 24시간 내 삭제,
                <br />
                개인정보 보호
              </h3>
              <p className="leading-relaxed text-slate-300">
                업로드된 사진은 확인 후 자동 삭제되며, 암호화되어 보관됩니다.
                <span className="mt-2 block text-sm text-slate-400">
                  의료 정보가 아닌 운동 참고 자료로만 활용됩니다.
                </span>
              </p>
            </div>
          </div>

          {/* 전문가 메시지 */}
          <div className="rounded-2xl border border-[#f97316]/30 bg-gradient-to-br from-[#f97316]/5 to-transparent p-8">
            <div className="flex flex-col items-center gap-6 md:flex-row">
              <div className="flex-shrink-0">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#f97316]/20">
                  <span className="text-4xl">💬</span>
                </div>
              </div>
              <div className="flex-1 text-center md:text-left">
                <p className="text-lg leading-relaxed text-slate-200">
                  <span className="font-bold text-[#f97316]">"</span>
                  의료가 아닌, 운동으로 균형을 찾아드립니다.
                  <br className="hidden sm:block" />
                  한 분 한 분 꼼꼼하게, 천천히 함께 개선해나갑니다.
                  <span className="font-bold text-[#f97316]">"</span>
                </p>
                <p className="mt-3 text-sm text-slate-400">
                  - NASM-CES 인증 운동 전문가
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 전문가 프로필 섹션 */}
        <div className="relative z-10 rounded-2xl border border-slate-700/80 bg-gradient-to-br from-slate-900/90 to-slate-800/90 p-8 sm:p-10">
          <div className="flex flex-col gap-8 md:flex-row md:items-center">
            {/* 왼쪽: 자격증 로고와 전문가 정보 */}
            <div className="flex flex-col items-center gap-6 md:w-1/3">
              <div className="relative">
                <div className="flex h-40 w-40 items-center justify-center rounded-2xl border-2 border-[#f97316]/30 bg-slate-950/50 p-4">
                  {/* NASM-CES 로고 플레이스홀더 */}
                  <div className="text-center">
                    <div className="mb-2 text-4xl font-bold text-[#f97316]">NASM</div>
                    <div className="text-xs font-semibold text-slate-300">CES</div>
                    <div className="mt-1 text-[10px] text-slate-500">Corrective Exercise<br />Specialist</div>
                  </div>
                </div>
                <div className="absolute -bottom-2 -right-2 flex h-10 w-10 items-center justify-center rounded-full border-2 border-slate-800 bg-green-500">
                  <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
            </div>

            {/* 오른쪽: 전문가 약력 */}
            <div className="flex-1 space-y-4">
              <div>
                <h3 className="mb-2 text-2xl font-bold text-slate-100">전문가 약력</h3>
                <p className="text-sm text-slate-400">NASM 인증 운동 전문가</p>
              </div>
              <ul className="space-y-3 text-sm text-slate-300">
                <li className="flex items-start gap-3">
                  <div className="mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#f97316]/20">
                    <span className="text-xs text-[#f97316]">✓</span>
                  </div>
                  <span>NASM-CES (Corrective Exercise Specialist) 자격 보유</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#f97316]/20">
                    <span className="text-xs text-[#f97316]">✓</span>
                  </div>
                  <span>5년 이상 자세 개선 및 운동 지도 경력</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#f97316]/20">
                    <span className="text-xs text-[#f97316]">✓</span>
                  </div>
                  <span>1,000명 이상의 자세 체크 및 운동 가이드 제작</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#f97316]/20">
                    <span className="text-xs text-[#f97316]">✓</span>
                  </div>
                  <span>과학적 근거 기반의 맞춤형 운동 프로그램 전문</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* BASIC 플랜 PDF 샘플 보기 */}
        <div className="relative z-10 space-y-4 text-center">
          <div className="inline-block rounded-full border border-[#f97316]/30 bg-[#f97316]/10 px-4 py-1.5">
            <span className="text-sm font-semibold text-[#f97316]">BASIC 플랜</span>
          </div>
          <button
            onClick={() => setIsReportPreviewOpen(true)}
            className="group inline-flex items-center gap-3 rounded-xl border-2 border-[#f97316]/50 bg-gradient-to-r from-slate-900 to-slate-800 px-8 py-4 text-sm font-medium text-slate-200 transition hover:border-[#f97316] hover:shadow-[0_0_30px_rgba(249,115,22,0.3)]"
          >
            <svg className="h-6 w-6 text-[#f97316]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-base">결제 시 받게 될 PDF 샘플 보기</span>
            <svg className="h-5 w-5 transition group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <p className="text-xs text-slate-400">
            BASIC 플랜 결제 시 이메일로 받게 되는 PDF 형식입니다
          </p>
        </div>

        {/* 더 알아보기 버튼들 */}
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:justify-center">
          <button
            onClick={() => {
              setShowProcess(!showProcess);
              setShowCorrectionSystem(false);
            }}
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900/80 px-6 py-3 text-sm font-medium text-slate-200 transition hover:border-[#f97316] hover:bg-slate-800"
          >
            <span>📋</span>
            <span>{showProcess ? "진행 방식 접기" : "진행 방식 보기"}</span>
            <svg
              className={`h-4 w-4 transition-transform ${showProcess ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          <button
            onClick={() => {
              setShowCorrectionSystem(!showCorrectionSystem);
              setShowProcess(false);
            }}
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900/80 px-6 py-3 text-sm font-medium text-slate-200 transition hover:border-[#f97316] hover:bg-slate-800"
          >
            <span>🎯</span>
            <span>{showCorrectionSystem ? "교정 시스템 접기" : "교정 시스템 보기"}</span>
            <svg
              className={`h-4 w-4 transition-transform ${showCorrectionSystem ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* 서비스 진행 방식 섹션 (펼치기/접기) */}
        {showProcess && (
          <div className="relative z-10 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-800/90 p-8 sm:p-10 animate-[slideDown_0.3s_ease-out]">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-slate-100 sm:text-4xl">
                이렇게 진행됩니다
              </h2>
              <p className="mt-3 text-sm text-slate-400">
                간편한 4단계 프로세스로 당신만의 솔루션을 받아보세요
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  step: "01",
                  icon: "📸",
                  title: "정적 평가",
                  description: "정면/측면 사진 2장만 업로드하면 끝",
                  color: "from-blue-500/20 to-blue-500/5",
                  borderColor: "border-blue-500/30",
                },
                {
                  step: "02",
                  icon: "👨‍⚕️",
                  title: "전문가 분석",
                  description: "NASM 인증 전문가가 직접 체형 분석",
                  color: "from-purple-500/20 to-purple-500/5",
                  borderColor: "border-purple-500/30",
                },
                {
                  step: "03",
                  icon: "⚡",
                  title: "솔루션 생성",
                  description: "당신에게 딱 맞는 4단계 운동 프로그램 제작",
                  color: "from-orange-500/20 to-orange-500/5",
                  borderColor: "border-orange-500/30",
                },
                {
                  step: "04",
                  icon: "📄",
                  title: "PDF 전달",
                  description: "24시간 내 이메일로 상세 리포트 발송",
                  color: "from-green-500/20 to-green-500/5",
                  borderColor: "border-green-500/30",
                },
              ].map((item) => (
                <div
                  key={item.step}
                  className={`relative rounded-xl border ${item.borderColor} bg-gradient-to-br ${item.color} p-6 transition hover:scale-105`}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-3xl">{item.icon}</span>
                    <span className="text-xs font-bold text-slate-500">{item.step}</span>
                  </div>
                  <h3 className="mb-2 text-lg font-bold text-slate-100">
                    {item.title}
                  </h3>
                  <p className="text-xs leading-relaxed text-slate-300">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4단계 교정운동 프로세스 섹션 (펼치기/접기) */}
        {showCorrectionSystem && (
          <div className="relative z-10 space-y-8 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-800/90 p-8 sm:p-10 animate-[slideDown_0.3s_ease-out]">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-slate-100 sm:text-4xl">
              과학적 4단계 운동 시스템
            </h2>
            <p className="mt-4 max-w-2xl mx-auto text-sm text-slate-300 leading-relaxed">
              <span className="font-semibold text-slate-200">NASM-CES 운동 전문가 자격 기반</span>으로 설계된 체계적 프로그램입니다.<br />
              근육의 균형을 단계별로 개선하여 올바른 자세 유지를 지원합니다.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-800/80 px-4 py-2 text-xs">
                <span className="font-bold text-[#f97316]">억제</span>
                <span className="text-slate-500">→</span>
                <span className="font-bold text-[#fb923c]">신장</span>
                <span className="text-slate-500">→</span>
                <span className="font-bold text-[#fbbf24]">활성화</span>
                <span className="text-slate-500">→</span>
                <span className="font-bold text-[#fde047]">통합</span>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-[#f97316]/20 px-4 py-2 text-sm font-medium text-[#f97316]">
                <span>📄</span>
                <span>맞춤 솔루션 PDF 제공</span>
              </div>
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: "01",
                title: "억제",
                subtitle: "Inhibit",
                description: "과활성 근육의 신경 활동을 감소시켜 근긴장도를 정상화합니다.",
                gradient: "from-red-500/20 to-red-500/5",
                icon: "🔴",
                bgImage: "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=800&q=80",
              },
              {
                label: "02",
                title: "신장",
                subtitle: "Lengthen",
                description: "단축된 근섬유를 최적 길이로 회복시켜 관절가동범위를 확보합니다.",
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
              // 모든 단계 잠금 해제
              const isLocked = false;

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
                    <h3 className="mb-2 text-2xl font-bold text-black drop-shadow-[0_2px_4px_rgba(255,255,255,0.3)]">
                      {step.title}
                    </h3>
                    <p className="mb-4 text-sm font-semibold text-[#f97316] drop-shadow-lg">
                      {step.subtitle}
                    </p>
                    <p className="text-sm leading-relaxed text-black font-medium drop-shadow-[0_1px_2px_rgba(255,255,255,0.2)]">
                      {step.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          </div>
        )}

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
            {/* BASIC */}
            <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-6 transition hover:border-slate-600 hover:shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
              <div className="mb-4">
                <h3 className="mb-2 text-xl font-bold text-slate-100">BASIC</h3>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-[#f97316]">₩19,000</span>
                  <span className="text-sm text-slate-500">1회</span>
                </div>
              </div>
              <ul className="mb-6 space-y-3 text-sm text-slate-300">
                <li className="flex items-start gap-2">
                  <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#f97316]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>정적자세 평가</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#f97316]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>맞춤 교정 루틴 PDF</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#f97316]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
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

            {/* STANDARD - Best Value */}
            <div className="relative scale-105 rounded-xl border-2 border-[#f97316] bg-gradient-to-br from-slate-900 to-slate-800 p-6 shadow-[0_25px_70px_rgba(249,115,22,0.4)] transition hover:scale-[1.07] hover:shadow-[0_30px_80px_rgba(249,115,22,0.5)]">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-[#f97316] to-[#fb923c] px-5 py-1.5 text-xs font-bold text-white shadow-lg">
                ⭐ BEST VALUE
              </div>
              <div className="mb-4">
                <h3 className="mb-2 flex items-center gap-2 text-xl font-bold text-slate-100">
                  STANDARD
                  <span className="rounded-md bg-[#f97316]/20 px-2 py-0.5 text-xs font-medium text-[#f97316]">추천</span>
                </h3>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-[#f97316]">₩49,000</span>
                  <span className="text-sm text-slate-500">1회</span>
                </div>
              </div>
              <div className="mb-6 rounded-lg border border-[#f97316]/30 bg-[#f97316]/10 p-3">
                <p className="text-xs font-semibold text-[#f97316]">
                  💡 가장 많이 선택하는 플랜
                </p>
              </div>
              <ul className="mb-6 space-y-3 text-sm text-slate-300">
                <li className="flex items-start gap-2">
                  <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#f97316]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span><strong className="text-slate-100">BASIC 전체 구성</strong> 포함</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#f97316]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span><strong className="text-[#fb923c]">전문가 운동 수행 영상 피드백 1회</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#f97316]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span><strong className="text-[#fb923c]">주간 체크리스트 PDF</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#f97316]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>이메일 Q&A 지원</span>
                </li>
              </ul>
              <Link
                href="/pricing"
                className="block w-full rounded-full bg-gradient-to-r from-[#f97316] to-[#fb923c] py-3 text-center font-bold text-white shadow-[0_0_25px_rgba(249,115,22,0.6)] transition hover:shadow-[0_0_35px_rgba(249,115,22,0.8)]"
              >
                지금 시작하기
              </Link>
              <p className="mt-3 text-center text-xs text-slate-400">
                🎯 운동 효과를 확실히 보고 싶다면
              </p>
            </div>

            {/* PREMIUM */}
            <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-6 transition hover:border-slate-600 hover:shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
              <div className="mb-4">
                <h3 className="mb-2 text-xl font-bold text-slate-100">PREMIUM</h3>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-amber-400">₩150,000</span>
                  <span className="text-sm text-slate-500">/ 월</span>
                </div>
              </div>
              <ul className="mb-6 space-y-3 text-sm text-slate-300">
                <li className="flex items-start gap-2">
                  <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span><strong className="text-slate-100">STANDARD 전체 구성</strong> 포함</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span><strong className="text-amber-300">1:1 전담 코칭</strong> (주 2회 이상)</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span><strong className="text-amber-300">카카오톡 실시간 관리</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>주간 루틴 점검 및 조정</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>영상 피드백 무제한</span>
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
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#f97316]/20 px-4 py-1.5 text-xs font-semibold text-[#f97316]">
            <span>⭐</span>
            <span>가장 추천하는 플랜</span>
          </div>
          <h2 className="mb-3 text-2xl font-bold text-slate-100 sm:text-3xl">
            지금 바로 시작하세요
          </h2>
          <p className="mb-6 text-sm text-slate-300 sm:text-base">
            사진 2장 + 영상 피드백으로 체계적인 자세 개선을 시작하세요
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={() => handlePayment('basic', 19000)}
              className="group inline-flex w-full items-center justify-center gap-2 rounded-full border-2 border-slate-600 bg-slate-800 px-6 py-3 text-sm font-semibold text-slate-100 transition hover:border-slate-500 hover:bg-slate-700 sm:w-auto"
            >
              <span>BASIC ₩19,000</span>
            </button>
            <button
              type="button"
              onClick={() => handlePayment('standard', 49000)}
              className="group inline-flex w-full items-center justify-center gap-3 rounded-full bg-gradient-to-r from-[#f97316] to-[#fb923c] px-8 py-4 text-lg font-bold text-white shadow-[0_0_40px_rgba(249,115,22,0.5)] transition hover:shadow-[0_0_60px_rgba(249,115,22,0.7)] hover:scale-105 sm:w-auto"
            >
              <span>STANDARD ₩49,000</span>
              <svg className="h-6 w-6 transition group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            24시간 내 전문가 리포트 전달 · 환불 보장
          </p>
        </div>

        {/* 푸터 */}
        <footer className="relative z-10 mt-8 space-y-6 border-t border-slate-700/50 pt-8 text-slate-400">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {/* 사업자 정보 */}
            <div>
              <h4 className="mb-3 text-sm font-semibold text-slate-200">사업자 정보</h4>
              <ul className="space-y-2 text-xs">
                <li>상호명: 포스처랩</li>
                <li>대표자: 김교정</li>
                <li>사업자등록번호: 123-45-67890</li>
                <li>통신판매업신고: 2024-서울강남-1234</li>
              </ul>
            </div>

            {/* 고객 지원 */}
            <div>
              <h4 className="mb-3 text-sm font-semibold text-slate-200">고객 지원</h4>
              <ul className="space-y-2 text-xs">
                <li>이메일: support@posturelab.com</li>
                <li>운영시간: 평일 09:00 - 18:00</li>
                <li>(주말 및 공휴일 휴무)</li>
              </ul>
            </div>

            {/* 정책 링크 */}
            <div>
              <h4 className="mb-3 text-sm font-semibold text-slate-200">정책</h4>
              <ul className="space-y-2 text-xs">
                <li>
                  <Link href="/terms" className="hover:text-slate-200 transition">
                    이용약관
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="hover:text-slate-200 transition">
                    개인정보처리방침
                  </Link>
                </li>
                <li>
                  <button 
                    onClick={() => alert('환불 정책:\n\n1. 리포트 발송 전: 100% 환불\n2. 리포트 발송 후: 환불 불가\n3. 서비스 하자 발생 시: 7일 내 100% 환불\n4. 환불 처리 기간: 영업일 기준 3-5일\n\n문의: support@posturelab.com')}
                    className="hover:text-slate-200 transition text-left"
                  >
                    환불 정책
                  </button>
                </li>
              </ul>
            </div>

            {/* 소셜 미디어 */}
            <div>
              <h4 className="mb-3 text-sm font-semibold text-slate-200">팔로우</h4>
              <div className="flex gap-3">
                <a href="#" className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 transition">
                  <span className="text-sm">📘</span>
                </a>
                <a href="#" className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 transition">
                  <span className="text-sm">📷</span>
                </a>
                <a href="#" className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 transition">
                  <span className="text-sm">🐦</span>
                </a>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-700/50 pt-6 text-center">
            <p className="text-xs text-slate-500">
              © 2024 포스처랩. All rights reserved.
            </p>
          </div>
        </footer>

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

        {/* 샘플 리포트 미리보기 모달 */}
        {isReportPreviewOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
            <div
              role="dialog"
              aria-modal="true"
              className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-950 p-6 shadow-[0_20px_80px_rgba(0,0,0,0.9)]"
            >
              <header className="mb-6 flex items-center justify-between">
                <div>
                  <div className="mb-2 inline-block rounded-full border border-[#f97316]/30 bg-[#f97316]/10 px-3 py-1">
                    <span className="text-xs font-semibold text-[#f97316]">BASIC 플랜</span>
                  </div>
                  <h2 className="text-2xl font-bold text-slate-100">결제 시 받게 될 PDF 리포트</h2>
                  <p className="mt-2 text-sm text-slate-400">
                    BASIC 플랜 결제 후 이메일로 전달되는 PDF 형식입니다
                    <br />
                    <span className="text-xs text-slate-500">(실제 리포트는 고객님의 사진과 설문을 기반으로 맞춤 제작됩니다)</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsReportPreviewOpen(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 text-slate-400 transition hover:bg-slate-900 hover:text-slate-200"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </header>

              <div className="space-y-6">
                {/* 샘플 이미지 1: 체형 분석 사진 */}
                <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-6">
                  <h3 className="mb-4 text-lg font-semibold text-slate-100">1. 체형 분석 결과</h3>
                  <div className="aspect-video rounded-lg bg-gradient-to-br from-slate-800 to-slate-900 p-8 flex items-center justify-center">
                    <div className="text-center space-y-4">
                      <div className="text-6xl">📸</div>
                      <p className="text-sm text-slate-400">정면/측면 사진에 정렬선과<br />각도 측정 마커가 표시됩니다</p>
                      <div className="grid grid-cols-2 gap-4 mt-4">
                        <div className="rounded-lg bg-slate-800/80 p-4">
                          <div className="text-3xl mb-2">📐</div>
                          <p className="text-xs text-slate-300">어깨 기울기: 3.2°</p>
                        </div>
                        <div className="rounded-lg bg-slate-800/80 p-4">
                          <div className="text-3xl mb-2">📏</div>
                          <p className="text-xs text-slate-300">골반 높이차: 1.5cm</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 샘플 이미지 2: 불균형 분석 그래프 */}
                <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-6">
                  <h3 className="mb-4 text-lg font-semibold text-slate-100">2. 근육 불균형 분석</h3>
                  <div className="aspect-video rounded-lg bg-gradient-to-br from-slate-800 to-slate-900 p-8">
                    <div className="space-y-4">
                      <div className="text-center mb-6">
                        <div className="text-4xl mb-2">📊</div>
                        <p className="text-xs text-slate-400">상체/하체 근력 밸런스 차트</p>
                      </div>
                      {/* 가상 그래프 바 */}
                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between text-xs text-slate-400 mb-1">
                            <span>상부 승모근 (과활성)</span>
                            <span>85%</span>
                          </div>
                          <div className="h-3 rounded-full bg-slate-800">
                            <div className="h-full w-[85%] rounded-full bg-gradient-to-r from-red-500 to-orange-500"></div>
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs text-slate-400 mb-1">
                            <span>중/하부 승모근 (저활성)</span>
                            <span>35%</span>
                          </div>
                          <div className="h-3 rounded-full bg-slate-800">
                            <div className="h-full w-[35%] rounded-full bg-gradient-to-r from-blue-500 to-cyan-500"></div>
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs text-slate-400 mb-1">
                            <span>고관절 굴곡근 (단축)</span>
                            <span>75%</span>
                          </div>
                          <div className="h-3 rounded-full bg-slate-800">
                            <div className="h-full w-[75%] rounded-full bg-gradient-to-r from-yellow-500 to-orange-500"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 샘플 이미지 3: 맞춤 운동 프로그램 */}
                <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-6">
                  <h3 className="mb-4 text-lg font-semibold text-slate-100">3. 맞춤 교정운동 프로그램</h3>
                  <div className="aspect-video rounded-lg bg-gradient-to-br from-slate-800 to-slate-900 p-8">
                    <div className="grid grid-cols-2 gap-4 h-full">
                      <div className="rounded-lg bg-slate-800/80 p-4 flex flex-col justify-between">
                        <div>
                          <div className="text-3xl mb-2">🔴</div>
                          <h4 className="text-sm font-semibold text-[#f97316] mb-2">억제 단계</h4>
                          <ul className="text-xs text-slate-300 space-y-1">
                            <li>• 상부승모근 폼롤링</li>
                            <li>• 대흉근 이완</li>
                            <li>• 척추기립근 마사지</li>
                          </ul>
                        </div>
                        <p className="text-[10px] text-slate-500">각 30-60초 / 2-3세트</p>
                      </div>
                      <div className="rounded-lg bg-slate-800/80 p-4 flex flex-col justify-between">
                        <div>
                          <div className="text-3xl mb-2">🟠</div>
                          <h4 className="text-sm font-semibold text-orange-400 mb-2">신장 단계</h4>
                          <ul className="text-xs text-slate-300 space-y-1">
                            <li>• 대흉근 도어웨이 스트레칭</li>
                            <li>• 고관절 굴곡근 스트레칭</li>
                            <li>• 목 신전근 스트레칭</li>
                          </ul>
                        </div>
                        <p className="text-[10px] text-slate-500">각 30초 유지 / 2-3세트</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 안내 문구 */}
                <div className="rounded-xl border border-[#f97316]/30 bg-[#f97316]/10 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f97316]/20">
                      <svg className="h-5 w-5 text-[#f97316]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-[#f97316] mb-1">실제 리포트에는 더 많은 내용이 포함됩니다</p>
                      <ul className="text-xs text-slate-300 space-y-1">
                        <li>• 상세한 체형 분석 결과 (10+ 측정 지표)</li>
                        <li>• 4단계 전체 운동 프로그램 (20+ 운동)</li>
                        <li>• 각 운동별 유튜브 가이드 영상 링크</li>
                        <li>• 주차별 진행 체크리스트</li>
                        <li>• 전문가의 개인별 코멘트</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  onClick={() => setIsReportPreviewOpen(false)}
                  className="rounded-full bg-[#f97316] px-8 py-3 text-sm font-semibold text-slate-950 shadow-[0_0_20px_rgba(249,115,22,0.6)] transition hover:bg-[#fb923c]"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 사전 동의 모달 */}
        {isConsentModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
            <div
              role="dialog"
              aria-modal="true"
              className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border-2 border-red-500/50 bg-slate-950 p-6 shadow-[0_20px_80px_rgba(239,68,68,0.5)]"
            >
              {/* 헤더 */}
              <header className="mb-6 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/20">
                    <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-red-400 sm:text-2xl">
                      서비스 이용 전 필독 사항
                    </h2>
                    <p className="mt-1 text-sm text-slate-300">
                      다음 내용을 반드시 확인하고 동의해주세요
                    </p>
                  </div>
                </div>
              </header>

              {/* 중요 안내 */}
              <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-5">
                <h3 className="mb-3 flex items-center gap-2 font-bold text-red-400">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  법적 고지사항
                </h3>
                <ul className="space-y-2 text-sm text-slate-300">
                  <li>• 본 서비스는 <strong className="text-slate-100">의료행위가 아니며</strong>, 질병의 진단·치료·예방을 목적으로 하지 않습니다.</li>
                  <li>• 제공되는 운동 가이드는 <strong className="text-slate-100">참고 자료</strong>이며, 의료 전문가의 진료를 대체할 수 없습니다.</li>
                  <li>• 운동 효과는 개인의 신체 조건과 노력에 따라 다를 수 있습니다.</li>
                </ul>
              </div>

              {/* 동의 체크박스 */}
              <div className="space-y-4">
                <h3 className="font-semibold text-slate-100">다음 사항에 모두 동의합니다:</h3>
                
                {/* 동의 항목 1 */}
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-700 bg-slate-900/50 p-4 transition hover:border-slate-600">
                  <input
                    type="checkbox"
                    checked={consent1}
                    onChange={(e) => setConsent1(e.target.checked)}
                    className="mt-1 h-5 w-5 flex-shrink-0 cursor-pointer rounded border-slate-600 bg-slate-800 text-[#f97316] focus:ring-2 focus:ring-[#f97316] focus:ring-offset-0"
                  />
                  <span className="text-sm text-slate-300">
                    본 서비스는 <strong className="text-slate-100">의료행위가 아니며</strong>, 진단·치료 목적이 아님을 이해했습니다.
                  </span>
                </label>

                {/* 동의 항목 2 */}
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-700 bg-slate-900/50 p-4 transition hover:border-slate-600">
                  <input
                    type="checkbox"
                    checked={consent2}
                    onChange={(e) => setConsent2(e.target.checked)}
                    className="mt-1 h-5 w-5 flex-shrink-0 cursor-pointer rounded border-slate-600 bg-slate-800 text-[#f97316] focus:ring-2 focus:ring-[#f97316] focus:ring-offset-0"
                  />
                  <span className="text-sm text-slate-300">
                    <strong className="text-slate-100">통증, 질병, 부상이 있는 경우</strong> 의료 전문가와 먼저 상담해야 함을 이해했습니다.
                  </span>
                </label>

                {/* 동의 항목 3 */}
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-700 bg-slate-900/50 p-4 transition hover:border-slate-600">
                  <input
                    type="checkbox"
                    checked={consent3}
                    onChange={(e) => setConsent3(e.target.checked)}
                    className="mt-1 h-5 w-5 flex-shrink-0 cursor-pointer rounded border-slate-600 bg-slate-800 text-[#f97316] focus:ring-2 focus:ring-[#f97316] focus:ring-offset-0"
                  />
                  <span className="text-sm text-slate-300">
                    운동 중 발생하는 <strong className="text-slate-100">부상 및 건강 문제에 대한 책임은 이용자 본인에게 있음</strong>을 이해했습니다.
                  </span>
                </label>

                {/* 동의 항목 4 */}
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-700 bg-slate-900/50 p-4 transition hover:border-slate-600">
                  <input
                    type="checkbox"
                    checked={consent4}
                    onChange={(e) => setConsent4(e.target.checked)}
                    className="mt-1 h-5 w-5 flex-shrink-0 cursor-pointer rounded border-slate-600 bg-slate-800 text-[#f97316] focus:ring-2 focus:ring-[#f97316] focus:ring-offset-0"
                  />
                  <span className="text-sm text-slate-300">
                    제공된 운동 가이드는 <strong className="text-slate-100">참고 자료</strong>이며, 본인의 상태에 맞게 조절해야 함을 이해했습니다.
                  </span>
                </label>

                {/* 동의 항목 5 */}
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-700 bg-slate-900/50 p-4 transition hover:border-slate-600">
                  <input
                    type="checkbox"
                    checked={consent5}
                    onChange={(e) => setConsent5(e.target.checked)}
                    className="mt-1 h-5 w-5 flex-shrink-0 cursor-pointer rounded border-slate-600 bg-slate-800 text-[#f97316] focus:ring-2 focus:ring-[#f97316] focus:ring-offset-0"
                  />
                  <span className="text-sm text-slate-300">
                    본 서비스는 <strong className="text-slate-100">운동 효과를 보장하지 않으며</strong>, 개인차가 있을 수 있음을 이해했습니다.
                  </span>
                </label>
              </div>

              {/* 이용약관 링크 */}
              <div className="mt-6 text-center text-xs text-slate-400">
                자세한 내용은{" "}
                <Link href="/terms" className="text-[#f97316] hover:underline" target="_blank">
                  이용약관
                </Link>
                {" "}및{" "}
                <Link href="/privacy" className="text-[#f97316] hover:underline" target="_blank">
                  개인정보처리방침
                </Link>
                을 참조하세요.
              </div>

              {/* 버튼 */}
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setIsConsentModalOpen(false);
                    setPendingSide(null);
                  }}
                  className="rounded-full border border-slate-700 px-6 py-3 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleConsentComplete}
                  className="rounded-full bg-gradient-to-r from-[#f97316] to-[#fb923c] px-8 py-3 text-sm font-bold text-white shadow-[0_0_20px_rgba(249,115,22,0.6)] transition hover:shadow-[0_0_30px_rgba(249,115,22,0.8)] disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!consent1 || !consent2 || !consent3 || !consent4 || !consent5}
                >
                  모두 동의하고 계속하기
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
      </div>
    </main>
  );
}
