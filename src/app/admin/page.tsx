// 관리자 대시보드 페이지입니다.
// 로그인 + role='admin' 권한이 있어야만 접근할 수 있습니다.
// 체형 분석 요청을 확인하고, 상세 리포트를 작성할 수 있습니다.
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// 요청 데이터 타입
type RequestRow = {
  id: string;
  user_id: string;
  front_url?: string;
  side_url?: string;
  status?: string;
  created_at?: string;
};

// 리포트 폼 데이터 타입
interface ReportForm {
  diagnoses: Record<string, boolean>;
  inhibitContent: string;
  lengthenContent: string;
  activateContent: string;
  integrateContent: string;
  expertNotes: string;
}

// 초기 리포트 폼 상태
const initialReportForm: ReportForm = {
  diagnoses: {
    turtle: false,    // 거북목
    rounded: false,   // 라운드숄더
    lordosis: false,  // 요추전만
  },
  inhibitContent: "",
  lengthenContent: "",
  activateContent: "",
  integrateContent: "",
  expertNotes: "",
};

export default function AdminPage() {
  const router = useRouter();
  
  // 인증 상태
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  
  // 데이터 상태
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [selected, setSelected] = useState<RequestRow | null>(null);
  const [loading, setLoading] = useState(false);
  
  // 리포트 폼 상태
  const [reportForm, setReportForm] = useState<ReportForm>(initialReportForm);
  
  // 이메일 발송 체크박스
  const [sendEmail, setSendEmail] = useState(true);

  // 권한 체크: 로그인 + role='admin' 검증
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // 현재 세션 확인
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !session) {
          router.push("/login");
          return;
        }

        // users 테이블에서 role 확인
        const { data: userProfile, error: profileError } = await supabase
          .from("users")
          .select("role")
          .eq("id", session.user.id)
          .single();

        if (profileError || !userProfile) {
          console.error("프로필 조회 실패:", profileError);
          router.push("/");
          return;
        }

        if (userProfile.role !== "admin") {
          alert("관리자 권한이 없습니다.");
          router.push("/");
          return;
        }

        setIsAuthorized(true);
      } catch (err) {
        console.error("인증 체크 에러:", err);
        router.push("/login");
      } finally {
        setAuthLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  // 요청 목록 가져오기
  const fetchRequests = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/requests");
    const json = await res.json();
    setRows(json.data || []);
    setLoading(false);
  };

  // 인증 성공 후 요청 목록 로드
  useEffect(() => {
    if (isAuthorized) {
      fetchRequests();
    }
  }, [isAuthorized]);

  // 요청 상세 열기
  const openDetail = (row: RequestRow) => {
    setSelected(row);
    setReportForm(initialReportForm); // 폼 초기화
  };

  // 진단 체크박스 토글
  const toggleDiagnosis = (key: string) => {
    setReportForm((prev) => ({
      ...prev,
      diagnoses: { ...prev.diagnoses, [key]: !prev.diagnoses[key] },
    }));
  };

  // 리포트 작성 내용 변경
  const updateReportContent = (field: keyof ReportForm, value: string) => {
    setReportForm((prev) => ({ ...prev, [field]: value }));
  };

  // 리포트 확정 및 저장
  const submitReport = async () => {
    if (!selected) return;

    // 최소 하나의 진단은 선택해야 함
    const selectedDiagnoses = Object.entries(reportForm.diagnoses)
      .filter(([, v]) => v)
      .map(([k]) => k === "turtle" ? "거북목" : k === "rounded" ? "라운드숄더" : "요추전만");

    if (selectedDiagnoses.length === 0) {
      alert("최소 하나의 진단을 선택해주세요.");
      return;
    }

    setLoading(true);

    try {
      // 1. 리포트 저장
      const reportRes = await fetch("/api/admin/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: selected.id,
          userId: selected.user_id,
          diagnoses: selectedDiagnoses,
          inhibitContent: reportForm.inhibitContent,
          lengthenContent: reportForm.lengthenContent,
          activateContent: reportForm.activateContent,
          integrateContent: reportForm.integrateContent,
          expertNotes: reportForm.expertNotes,
        }),
      });

      const reportData = await reportRes.json();

      if (!reportRes.ok) {
        throw new Error(reportData.error || "리포트 저장 실패");
      }

      // 2. 이메일 발송 (체크된 경우)
      if (sendEmail && selected.user_id) {
        try {
          await fetch("/api/send-report", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: selected.user_id,
              requestId: selected.id,
              diagnoses: selectedDiagnoses,
            }),
          });
        } catch (emailErr) {
          console.error("이메일 발송 에러:", emailErr);
          // 이메일 실패해도 계속 진행
        }
      }

      alert("리포트가 성공적으로 저장되었습니다.");
      await fetchRequests();
      setSelected(null);
    } catch (err) {
      alert("에러: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // 로그아웃 처리
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  // 인증 로딩 중 화면
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f172a]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-[#f97316] border-t-transparent" />
          <p className="text-slate-400">권한 확인 중...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#0f172a] p-6 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* 헤더 */}
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-extrabold">관리자 대시보드</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchRequests}
              className="rounded bg-[#f97316] px-4 py-2 font-medium text-slate-950"
            >
              새로고침
            </button>
            <button
              onClick={handleLogout}
              className="rounded border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
            >
              로그아웃
            </button>
          </div>
        </header>

        {/* 요청 목록 */}
        <section className="rounded-xl bg-slate-900/80 p-4">
          <h2 className="mb-3 text-lg font-semibold">요청 목록 (최신순)</h2>
          {loading && <p className="text-sm text-slate-400">로딩 중...</p>}
          {!loading && rows.length === 0 && (
            <p className="text-sm text-slate-500">아직 요청이 없습니다.</p>
          )}
          <ul className="space-y-2">
            {rows.map((r) => (
              <li
                key={r.id}
                className={`flex cursor-pointer items-center justify-between rounded-lg border p-3 transition ${
                  selected?.id === r.id
                    ? "border-[#f97316] bg-slate-800/80"
                    : "border-slate-700/60 hover:bg-slate-800/60"
                }`}
                onClick={() => openDetail(r)}
              >
                <div>
                  <div className="text-sm font-medium">요청 ID: {r.id.slice(0, 8)}...</div>
                  <div className="text-xs text-slate-400">사용자: {r.user_id || "익명"}</div>
                  <div className="mt-1">
                    <span className={`inline-block rounded px-2 py-0.5 text-xs ${
                      r.status === "completed" ? "bg-green-500/20 text-green-400" :
                      r.status === "paid" ? "bg-blue-500/20 text-blue-400" :
                      "bg-slate-500/20 text-slate-400"
                    }`}>
                      {r.status === "completed" ? "완료" :
                       r.status === "paid" ? "결제완료 (분석 대기)" :
                       r.status === "pending" ? "대기중" : r.status || "대기중"}
                    </span>
                  </div>
                </div>
                <div className="text-xs text-slate-400">
                  {r.created_at ? new Date(r.created_at).toLocaleString("ko-KR") : ""}
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* 선택된 요청 상세 + 리포트 작성 */}
        {selected && (
          <section className="rounded-xl bg-slate-900/80 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">리포트 작성</h2>
              <button
                onClick={() => setSelected(null)}
                className="text-sm text-slate-400 hover:text-white"
              >
                ✕ 닫기
              </button>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              {/* 왼쪽: 사진 영역 */}
              <div className="space-y-4 lg:col-span-1">
                <div className="rounded-lg bg-slate-800 p-3 text-center">
                  <p className="mb-2 text-sm font-medium">정면 사진</p>
                  {selected.front_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selected.front_url}
                      alt="front"
                      className="mx-auto max-h-64 w-auto rounded"
                    />
                  ) : (
                    <div className="flex h-40 items-center justify-center rounded bg-slate-700/50 text-slate-500">
                      사진 없음
                    </div>
                  )}
                </div>

                <div className="rounded-lg bg-slate-800 p-3 text-center">
                  <p className="mb-2 text-sm font-medium">측면 사진</p>
                  {selected.side_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selected.side_url}
                      alt="side"
                      className="mx-auto max-h-64 w-auto rounded"
                    />
                  ) : (
                    <div className="flex h-40 items-center justify-center rounded bg-slate-700/50 text-slate-500">
                      사진 없음
                    </div>
                  )}
                </div>

                {/* 진단 체크 */}
                <div className="rounded-lg border border-slate-700/60 bg-slate-800/50 p-4">
                  <p className="mb-3 font-medium">진단 체크</p>
                  {[
                    { key: "turtle", label: "거북목 (Forward Head)" },
                    { key: "rounded", label: "라운드숄더 (Rounded Shoulder)" },
                    { key: "lordosis", label: "요추전만 (Lumbar Lordosis)" },
                  ].map(({ key, label }) => (
                    <label key={key} className="mt-2 flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={reportForm.diagnoses[key]}
                        onChange={() => toggleDiagnosis(key)}
                        className="h-5 w-5 rounded border-slate-600 bg-slate-700 text-[#f97316]"
                      />
                      <span className="text-sm">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 오른쪽: 리포트 내용 작성 */}
              <div className="space-y-4 lg:col-span-2">
                {/* 4단계 교정 루틴 입력 */}
                <div className="grid gap-4 sm:grid-cols-2">
                  {/* 억제 운동 */}
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      <span className="mr-2 rounded bg-red-500/20 px-2 py-0.5 text-xs text-red-400">01</span>
                      억제 운동
                    </label>
                    <textarea
                      value={reportForm.inhibitContent}
                      onChange={(e) => updateReportContent("inhibitContent", e.target.value)}
                      placeholder="과긴장된 근육을 이완하는 운동을 작성하세요..."
                      rows={4}
                      className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-[#f97316] focus:outline-none"
                    />
                  </div>

                  {/* 신장 운동 */}
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      <span className="mr-2 rounded bg-yellow-500/20 px-2 py-0.5 text-xs text-yellow-400">02</span>
                      신장 운동
                    </label>
                    <textarea
                      value={reportForm.lengthenContent}
                      onChange={(e) => updateReportContent("lengthenContent", e.target.value)}
                      placeholder="짧아진 근육을 늘리는 스트레칭을 작성하세요..."
                      rows={4}
                      className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-[#f97316] focus:outline-none"
                    />
                  </div>

                  {/* 활성화 운동 */}
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      <span className="mr-2 rounded bg-green-500/20 px-2 py-0.5 text-xs text-green-400">03</span>
                      활성화 운동
                    </label>
                    <textarea
                      value={reportForm.activateContent}
                      onChange={(e) => updateReportContent("activateContent", e.target.value)}
                      placeholder="약화된 근육을 활성화하는 운동을 작성하세요..."
                      rows={4}
                      className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-[#f97316] focus:outline-none"
                    />
                  </div>

                  {/* 통합 운동 */}
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      <span className="mr-2 rounded bg-blue-500/20 px-2 py-0.5 text-xs text-blue-400">04</span>
                      통합 운동
                    </label>
                    <textarea
                      value={reportForm.integrateContent}
                      onChange={(e) => updateReportContent("integrateContent", e.target.value)}
                      placeholder="실제 자세에 적용하는 통합 운동을 작성하세요..."
                      rows={4}
                      className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-[#f97316] focus:outline-none"
                    />
                  </div>
                </div>

                {/* 전문가 소견 */}
                <div>
                  <label className="mb-1 block text-sm font-medium">전문가 소견</label>
                  <textarea
                    value={reportForm.expertNotes}
                    onChange={(e) => updateReportContent("expertNotes", e.target.value)}
                    placeholder="추가적인 조언이나 주의사항을 작성하세요..."
                    rows={3}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-[#f97316] focus:outline-none"
                  />
                </div>

                {/* 이메일 발송 옵션 + 제출 버튼 */}
                <div className="flex flex-col gap-4 border-t border-slate-700/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={sendEmail}
                      onChange={(e) => setSendEmail(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-600 bg-slate-700 text-[#f97316]"
                    />
                    <span className="text-sm text-slate-300">
                      리포트 작성 완료 시 사용자에게 이메일 알림 발송
                    </span>
                  </label>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setSelected(null)}
                      className="rounded-lg border border-slate-600 px-6 py-2 text-sm text-slate-300 hover:bg-slate-800"
                    >
                      취소
                    </button>
                    <button
                      onClick={submitReport}
                      disabled={loading}
                      className="rounded-lg bg-[#f97316] px-6 py-2 font-semibold text-slate-950 shadow-[0_0_20px_rgba(249,115,22,0.4)] transition hover:bg-[#fb923c] disabled:opacity-50"
                    >
                      {loading ? "저장 중..." : "리포트 확정 및 저장"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
