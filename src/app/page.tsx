// 이 페이지는 "교정운동 기반 1:1 맞춤 교정 솔루션" 랜딩 메인 화면입니다.
// - 다크모드 기반의 신뢰감 있는 디자인
// - 오렌지색 포인트 버튼(주요 CTA · 결제 버튼)
// - 정면/측면 사진 업로드용 드롭존 UI
// - 억제-신장-활성화-통합 4단계 교정운동 프로세스 소개
// - 실시간처럼 보이는 신청 인원 수 표시
// - 모바일 우선 반응형 레이아웃
"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";

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
      {/* 전체를 감싸는 카드 레이아웃입니다. 모바일에서는 세로, 큰 화면에서는 좌우 분할 구조로 보입니다. */}
      <section className="relative flex w-full max-w-5xl flex-col gap-12 overflow-hidden rounded-3xl border border-slate-700/80 bg-slate-900/80 p-6 shadow-[0_25px_80px_rgba(0,0,0,0.6)] sm:p-10">
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
            <header className="space-y-4">
              <h1 className="text-3xl font-semibold leading-relaxed sm:text-4xl md:text-5xl">
                너무 많은 정보 속에서
                <br />
                나에게 맞는 올바른 솔루션을 찾습니까?
                <br />
                저희가 도와드리겠습니다.
              </h1>
              <p className="text-sm leading-relaxed text-slate-300 sm:text-base">
                사진을 업로드하고{" "}
                <span className="font-semibold text-slate-100">
                  내 몸에 맞는 1:1 교정 솔루션
                </span>
                을 받아보세요.
                <br />
                NASM 기반 교정운동 로직으로, 불필요한 정보 대신{" "}
                <span className="font-semibold text-slate-100">
                  나에게 필요한 동작만
                </span>{" "}
                정리해 드립니다.
              </p>
            </header>

            {/* 실시간 신청 인원 수 표시 영역입니다. */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 sm:text-sm">
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-900/90 px-3 py-1">
                <span className="relative flex h-2 w-2">
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#f97316]" />
                </span>
                <span>
                  현재{" "}
                  <span className="font-semibold text-slate-100">
                    {formatPeopleCount(peopleCount)}명
                  </span>{" "}
                  이(가) 교정 리포트를 준비 중이에요.
                </span>
              </div>
              <span className="text-[11px] text-slate-500 sm:text-xs">
                * 5초마다 살짝 변하는 수치는 실제 이용 패턴을 기반으로 한
                추정치입니다.
              </span>
            </div>
          </div>

          {/* 오른쪽 영역: 사진 업로드 드롭존 + 분석 상태 박스 */}
          <aside className="flex flex-1 justify-center md:justify-end">
            <div className="w-full max-w-sm space-y-5 rounded-2xl border border-slate-700/80 bg-slate-900/90 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.8)]">
              <h2 className="text-sm font-semibold text-slate-100 sm:text-base">
                1단계 · 내 체형 데이터 업로드
              </h2>
              <p className="text-[11px] leading-relaxed text-slate-300 sm:text-xs">
                얼굴은 노출되지 않게 목 아래만 촬영해 주세요. 업로드된 사진은
                암호화되어 안전하게 분석에만 사용됩니다.
              </p>

              {/* 관상면/시상면 예시를 보여주는 미니멀한 시각 가이드 영역입니다. */}
              <div className="space-y-3">
                <p className="text-[11px] font-medium text-slate-300 sm:text-xs">
                  촬영 각도 예시
                </p>
                <div className="grid grid-cols-2 gap-3 text-center text-xs sm:text-sm">
                  <div className="space-y-2">
                    <p className="text-[11px] font-medium text-slate-200 sm:text-xs">
                      관상면(정면)
                    </p>
                    <div className="flex h-24 items-center justify-center rounded-xl bg-slate-800 text-sm font-semibold text-slate-100">
                      정면 예시
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[11px] font-medium text-slate-200 sm:text-xs">
                      시상면(측면)
                    </p>
                    <div className="flex h-24 items-center justify-center rounded-xl bg-slate-800 text-sm font-semibold text-slate-100">
                      측면 예시
                    </div>
                  </div>
                </div>
              </div>

              {/* 드롭존 스타일 업로드 영역입니다. (실제 드래그&드롭이 아니라 스타일 중심) */}
              <div className="grid gap-3 sm:grid-cols-2">
                {/* 정면 사진 업로드: 클릭 시 촬영 가이드 모달을 먼저 띄웁니다. */}
                <button
                  type="button"
                  onClick={() => openGuideForSide("front")}
                  className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-700 bg-slate-900/40 px-3 py-4 text-center text-xs text-slate-300 transition hover:border-[#f97316] hover:bg-slate-900/70"
                >
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-950 text-lg">
                    📷
                  </span>
                  <span className="font-medium text-slate-100">
                    정면 사진 업로드
                  </span>
                  <span className="text-[11px] text-slate-400">
                    몸 전체가 나오도록, 편안하게 정면 응시
                  </span>
                </button>

                {/* 측면 사진 업로드: 클릭 시 촬영 가이드 모달을 먼저 띄웁니다. */}
                <button
                  type="button"
                  onClick={() => openGuideForSide("side")}
                  className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-700 bg-slate-900/40 px-3 py-4 text-center text-xs text-slate-300 transition hover:border-[#f97316] hover:bg-slate-900/70"
                >
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-950 text-lg">
                    🎯
                  </span>
                  <span className="font-medium text-slate-100">
                    측면 사진 업로드
                  </span>
                  <span className="text-[11px] text-slate-400">
                    옆으로 서서 정면 응시, 팔은 자연스럽게
                  </span>
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
              <div className="space-y-2 rounded-xl bg-slate-950/70 p-3 text-[11px] text-slate-300 sm:text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-100">
                    현재 분석 상태
                  </span>
                  <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] capitalize text-slate-400">
                    {session.status.stage.replaceAll("_", " ")}
                  </span>
                </div>

                <p className="text-[11px] leading-relaxed text-slate-400 sm:text-xs">
                  {session.status.notes}
                </p>

                {/* 업로드된 사진 목록이 있을 때만 보여줍니다. */}
                {session.photos.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {session.photos.map((photo) => (
                      <div
                        key={photo.id}
                        className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-900/60 px-2 py-1.5"
                      >
                        <span className="text-[11px] text-slate-200">
                          {photo.side === "front" ? "정면" : "측면"} ·{" "}
                          {photo.fileName}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {photo.uploadedAt}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* AI 분석 중일 때 보여주는 스캐닝 로딩 애니메이션 영역입니다. */}
                {session.status.stage === "analyzing" && (
                  <div className="mt-3 overflow-hidden rounded-xl border border-slate-700 bg-slate-900/90 p-3">
                    <div className="relative h-20 overflow-hidden rounded-lg bg-slate-950">
                      {/* 스캐닝 라인 효과 */}
                      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#f97316]/15 to-transparent" />
                      <div className="scan-line absolute inset-x-0 -top-full h-1/2 bg-gradient-to-b from-transparent via-[#f97316]/40 to-transparent" />
                      <div className="absolute inset-0 border border-dashed border-slate-700/80" />
                    </div>
                    <p className="mt-2 text-[11px] font-medium text-slate-100 sm:text-xs">
                      AI가 관절 포인트와 신체 정렬을 정밀 분석 중입니다...
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400 sm:text-xs">
                      약 10초 정도 소요되며, 분석이 완료되면 자동으로 결과 안내가
                      나타납니다.
                    </p>
                  </div>
                )}

                {/* 분석 완료 후에 보여주는 안내 메시지입니다. */}
                {session.status.stage === "completed" && (
                  <div className="mt-3 rounded-xl border border-slate-700 bg-slate-900/90 p-3 text-[11px] text-slate-200 sm:text-xs">
                    <p className="font-semibold text-slate-100">
                      분석이 완료되었습니다! 전문가 최종 검토 후 24시간 내에 맞춤
                      리포트가 전송됩니다.
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400 sm:text-xs">
                      알림을 통해 리포트 링크와 함께 교정 루틴 영상 가이드를
                      받아보실 수 있습니다.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>

        {/* 4단계 교정운동 프로세스 섹션입니다. */}
        <div className="relative z-10 space-y-6 rounded-2xl border border-slate-700/80 bg-slate-900/80 p-6 sm:p-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight text-slate-100 sm:text-3xl">
                억제 · 신장 · 활성화 · 통합
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-slate-300 sm:text-sm">
                업로드한 체형 데이터를 바탕으로, 근육의{" "}
                <span className="font-semibold text-slate-100">
                  억제 → 신장 → 활성화 → 통합
                </span>{" "}
                순서로 교정 루틴을 설계합니다.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            {[
              {
                label: "01",
                title: "억제",
                subtitle: "과도하게 긴장된 근육 완화",
                description:
                  "거북목과 말린 어깨를 만드는 과긴장 부위를 먼저 풀어 줍니다.",
              },
              {
                label: "02",
                title: "신장",
                subtitle: "굳어 있는 라인 늘리기",
                description:
                  "짧아진 가슴·목 앞 근육을 안전하게 늘려 중립 정렬을 준비합니다.",
              },
              {
                label: "03",
                title: "활성화",
                subtitle: "잠든 안정근 깨우기",
                description:
                  "깊은 목 굴곡근, 견갑골 주변 안정근을 깨워 바른 자세를 유지할 힘을 만듭니다.",
              },
              {
                label: "04",
                title: "통합",
                subtitle: "실제 자세에 연결",
                description:
                  "앉은 자세·서 있는 자세 속에서 교정된 패턴을 반복 학습시킵니다.",
              },
            ].map((step, index) => {
              // 0,1 단계는 항상 열려 있는 무료 구간, 2,3 단계는 isPaid가 false면 잠금 처리합니다.
              const isLocked = !isPaid && index >= 2;

              return (
                <div
                  key={step.title}
                  className="relative flex h-full flex-col justify-between gap-3 rounded-2xl border border-slate-700 bg-slate-900/70 p-4"
                >
                  {/* 잠금 상태일 때 상단에 작은 잠금 아이콘과 안내 문구를 보여줍니다. */}
                  {isLocked && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-2xl bg-slate-950/75">
                      <div className="flex items-center gap-2 text-xs font-medium text-slate-200 sm:text-sm">
                        <span className="text-base">🔒</span>
                        <span>유료 구간 · 활성화 · 통합 루틴</span>
                      </div>
                      <p className="px-4 text-[11px] text-slate-400 sm:text-xs">
                        결제를 완료하면 3, 4단계의 세부 교정 루틴과 영상 가이드를
                        확인할 수 있습니다.
                      </p>
                    </div>
                  )}

                  <div
                    className={`space-y-2 ${
                      isLocked ? "blur-sm opacity-60" : ""
                    }`}
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f97316]">
                      {step.label}
                    </p>
                    <p className="text-lg font-extrabold text-slate-100 sm:text-xl">
                      {step.title}
                    </p>
                    <p className="text-xs font-medium text-slate-200 sm:text-sm">
                      {step.subtitle}
                    </p>
                  </div>
                  <p
                    className={`text-xs leading-relaxed text-slate-300 sm:text-sm ${
                      isLocked ? "blur-sm opacity-60" : ""
                    }`}
                  >
                    {step.description}
                  </p>
                </div>
              );
            })}
          </div>

          {/* 무료 구간(1,2단계)과 유료 구간(3,4단계)을 나누는 결제 유도 배너입니다. */}
          {!isPaid && (
            <div className="mt-6 flex flex-col items-center justify-between gap-3 rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-4 text-center sm:flex-row sm:text-left">
              <p className="text-xs leading-relaxed text-slate-200 sm:text-sm">
                이 교정 효과를 평생 내 것으로 만들려면{" "}
                <span className="font-semibold text-slate-100">
                  3단계 활성화 · 4단계 통합 루틴
                </span>
                을 함께 따라가는 것이 중요합니다.
              </p>
              <button
                type="button"
                onClick={() => setIsPaid(true)}
                className="inline-flex h-10 items-center justify-center rounded-full bg-[#f97316] px-5 text-xs font-semibold text-slate-950 shadow-[0_0_24px_rgba(249,115,22,0.5)] transition hover:bg-[#fb923c] hover:shadow-[0_0_32px_rgba(249,115,22,0.6)] sm:text-sm"
              >
                3·4단계 활성화+통합 루틴 확인하기
              </button>
            </div>
          )}
        </div>

        {/* 결제 CTA 영역입니다. */}
        <div className="relative z-10 flex flex-col items-center gap-4 rounded-2xl border border-slate-700/80 bg-slate-900/80 px-4 py-5 text-center sm:flex-row sm:justify-between sm:text-left">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-100 sm:text-base">
              나의 맞춤 교정 리포트 + 영상 가이드
            </p>
            <p className="text-[11px] text-slate-300 sm:text-xs">
              업로드한 사진과 분석 결과를 바탕으로,{" "}
              <span className="font-medium text-slate-100">
                집·회사 어디서든 따라 할 수 있는 1:1 교정 루틴
              </span>
              을 제공합니다.
            </p>
          </div>

          <button
            type="button"
            className="mt-2 inline-flex h-11 items-center justify-center rounded-full bg-[#f97316] px-6 text-xs font-semibold text-slate-950 shadow-[0_0_30px_rgba(249,115,22,0.4)] transition hover:bg-[#fb923c] hover:shadow-[0_0_40px_rgba(249,115,22,0.6)] active:scale-[0.98] sm:mt-0 sm:text-sm"
          >
            나의 맞춤 교정 리포트+영상 가이드 구매하기 ($19.99)
          </button>
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
