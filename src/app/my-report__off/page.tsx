// 내 리포트 확인 페이지입니다.
// 로그인한 사용자가 자신의 교정 리포트를 확인할 수 있습니다.
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

// 리포트 데이터 타입
interface Report {
  id: string;
  request_id: string;
  diagnoses: string[];
  inhibit_content: string;
  lengthen_content: string;
  activate_content: string;
  integrate_content: string;
  expert_notes: string;
  created_at: string;
}

// 요청 데이터 타입
interface Request {
  id: string;
  front_url: string | null;
  side_url: string | null;
  status: string;
  created_at: string;
}

export default function MyReportPage() {
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

  // 인증 및 데이터 로드
  useEffect(() => {
    const loadData = async () => {
      try {
        // 로그인 확인
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          router.push("/login");
          return;
        }

        setUser({
          id: session.user.id,
          email: session.user.email || undefined,
        });

        // 내 리포트 조회
        const reportRes = await fetch(`/api/admin/report?userId=${session.user.id}`);
        const reportData = await reportRes.json();
        setReports(reportData.data || []);

        // 가장 최근 리포트를 선택
        if (reportData.data && reportData.data.length > 0) {
          setSelectedReport(reportData.data[0]);
        }

        // 내 요청 목록 조회 (사진 확인용)
        const { data: requestData, error: requestError } = await supabase
          .from("requests")
          .select("id, front_url, side_url, status, created_at")
          .eq("user_id", session.user.id)
          .order("created_at", { ascending: false });

        if (!requestError && requestData) {
          setRequests(requestData);
        }
      } catch (err) {
        console.error("데이터 로드 에러:", err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [router]);

  // 로그아웃 처리
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  // 로딩 중
  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0f172a]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-[#f97316] border-t-transparent" />
          <p className="text-slate-400">리포트를 불러오는 중...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0f172a] px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-4xl space-y-8">
        {/* 헤더 */}
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">내 교정 리포트</h1>
            <p className="mt-1 text-sm text-slate-400">{user?.email}</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm text-slate-400 hover:text-white">
              홈으로
            </Link>
            <button
              onClick={handleLogout}
              className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
            >
              로그아웃
            </button>
          </div>
        </header>

        {/* 리포트가 없는 경우 */}
        {reports.length === 0 && (
          <div className="rounded-2xl border border-slate-700/80 bg-slate-900/80 p-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-800">
              <span className="text-2xl">📋</span>
            </div>
            <h2 className="text-lg font-semibold">아직 리포트가 없습니다</h2>
            <p className="mt-2 text-sm text-slate-400">
              사진을 업로드하고 결제를 완료하면,<br />
              전문가가 체형 분석 후 리포트를 작성해 드립니다.
            </p>
            <Link
              href="/"
              className="mt-4 inline-block rounded-lg bg-[#f97316] px-6 py-3 text-sm font-semibold text-slate-950"
            >
              체형 분석 시작하기
            </Link>
          </div>
        )}

        {/* 리포트 목록 */}
        {reports.length > 0 && (
          <>
            {/* 리포트 선택 탭 (여러 개인 경우) */}
            {reports.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {reports.map((report, index) => (
                  <button
                    key={report.id}
                    onClick={() => setSelectedReport(report)}
                    className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm transition ${
                      selectedReport?.id === report.id
                        ? "bg-[#f97316] text-slate-950"
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    리포트 #{index + 1}
                  </button>
                ))}
              </div>
            )}

            {/* 선택된 리포트 상세 */}
            {selectedReport && (
              <div className="space-y-6">
                {/* 진단 결과 */}
                <section className="rounded-2xl border border-slate-700/80 bg-slate-900/80 p-6">
                  <h2 className="mb-4 text-lg font-semibold text-slate-100">체형 진단 결과</h2>
                  <div className="flex flex-wrap gap-2">
                    {selectedReport.diagnoses.length > 0 ? (
                      selectedReport.diagnoses.map((diagnosis, index) => (
                        <span
                          key={index}
                          className="rounded-full bg-[#f97316]/20 px-4 py-2 text-sm font-medium text-[#f97316]"
                        >
                          {diagnosis}
                        </span>
                      ))
                    ) : (
                      <p className="text-sm text-slate-400">진단 결과가 없습니다.</p>
                    )}
                  </div>
                </section>

                {/* 4단계 교정 루틴 */}
                <div className="grid gap-4 sm:grid-cols-2">
                  {/* 1단계: 억제 */}
                  <section className="rounded-2xl border border-slate-700/80 bg-slate-900/80 p-5">
                    <div className="mb-3 flex items-center gap-2">
                      <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-semibold text-red-400">
                        01
                      </span>
                      <h3 className="font-semibold text-slate-100">억제 운동</h3>
                    </div>
                    <p className="text-sm leading-relaxed text-slate-300 whitespace-pre-wrap">
                      {selectedReport.inhibit_content || "내용이 없습니다."}
                    </p>
                  </section>

                  {/* 2단계: 신장 */}
                  <section className="rounded-2xl border border-slate-700/80 bg-slate-900/80 p-5">
                    <div className="mb-3 flex items-center gap-2">
                      <span className="rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs font-semibold text-yellow-400">
                        02
                      </span>
                      <h3 className="font-semibold text-slate-100">신장 운동</h3>
                    </div>
                    <p className="text-sm leading-relaxed text-slate-300 whitespace-pre-wrap">
                      {selectedReport.lengthen_content || "내용이 없습니다."}
                    </p>
                  </section>

                  {/* 3단계: 활성화 */}
                  <section className="rounded-2xl border border-slate-700/80 bg-slate-900/80 p-5">
                    <div className="mb-3 flex items-center gap-2">
                      <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-xs font-semibold text-green-400">
                        03
                      </span>
                      <h3 className="font-semibold text-slate-100">활성화 운동</h3>
                    </div>
                    <p className="text-sm leading-relaxed text-slate-300 whitespace-pre-wrap">
                      {selectedReport.activate_content || "내용이 없습니다."}
                    </p>
                  </section>

                  {/* 4단계: 통합 */}
                  <section className="rounded-2xl border border-slate-700/80 bg-slate-900/80 p-5">
                    <div className="mb-3 flex items-center gap-2">
                      <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-xs font-semibold text-blue-400">
                        04
                      </span>
                      <h3 className="font-semibold text-slate-100">통합 운동</h3>
                    </div>
                    <p className="text-sm leading-relaxed text-slate-300 whitespace-pre-wrap">
                      {selectedReport.integrate_content || "내용이 없습니다."}
                    </p>
                  </section>
                </div>

                {/* 전문가 소견 */}
                {selectedReport.expert_notes && (
                  <section className="rounded-2xl border border-slate-700/80 bg-slate-900/80 p-6">
                    <h2 className="mb-3 text-lg font-semibold text-slate-100">전문가 소견</h2>
                    <p className="text-sm leading-relaxed text-slate-300 whitespace-pre-wrap">
                      {selectedReport.expert_notes}
                    </p>
                  </section>
                )}

                {/* 작성일 */}
                <p className="text-right text-xs text-slate-500">
                  리포트 작성일: {new Date(selectedReport.created_at).toLocaleDateString("ko-KR")}
                </p>
              </div>
            )}
          </>
        )}

        {/* 내 요청 목록 */}
        {requests.length > 0 && (
          <section className="rounded-2xl border border-slate-700/80 bg-slate-900/80 p-6">
            <h2 className="mb-4 text-lg font-semibold text-slate-100">내 요청 내역</h2>
            <div className="space-y-3">
              {requests.map((req) => (
                <div
                  key={req.id}
                  className="flex items-center justify-between rounded-lg border border-slate-700/60 bg-slate-800/50 p-4"
                >
                  <div className="flex items-center gap-4">
                    {/* 썸네일 */}
                    {req.front_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={req.front_url}
                        alt="정면"
                        className="h-12 w-12 rounded-lg object-cover"
                      />
                    )}
                    <div>
                      <p className="text-sm font-medium text-slate-100">
                        요청 #{req.id.slice(0, 8)}
                      </p>
                      <p className="text-xs text-slate-400">
                        {new Date(req.created_at).toLocaleDateString("ko-KR")}
                      </p>
                    </div>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                    req.status === "completed"
                      ? "bg-green-500/20 text-green-400"
                      : req.status === "paid"
                      ? "bg-blue-500/20 text-blue-400"
                      : "bg-slate-500/20 text-slate-400"
                  }`}>
                    {req.status === "completed" ? "완료" :
                     req.status === "paid" ? "분석 중" :
                     req.status === "pending" ? "대기 중" : req.status}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
