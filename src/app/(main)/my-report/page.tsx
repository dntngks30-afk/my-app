"use client";

/**
 * Legacy report compat page.
 * Owner: requests + solutions legacy rail.
 * Canonical movement-test/public_results continuity must stay separate.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LEGACY_MY_REPORT_REQUESTS_SELECT } from "@/lib/legacy/upload-report-rail";
import { supabaseBrowser as supabase, getSessionSafe } from "@/lib/supabase";
import type { Request as RequestType } from "@/lib/supabase-types";

// Request 타입의 부분 집합 (쿼리에서 선택한 필드만)
type LegacyRequestPartial = Pick<RequestType, "id" | "front_url" | "side_url" | "status" | "created_at">;

// 리포트 데이터 타입
interface LegacyReport {
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

export default function MyReportPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [reports, setReports] = useState<LegacyReport[]>([]);
  const [legacyPhotoRequests, setLegacyPhotoRequests] = useState<LegacyRequestPartial[]>([]);
  const [selectedReport, setSelectedReport] = useState<LegacyReport | null>(null);
  const [deepStatus, setDeepStatus] = useState<'loading' | 'paywall' | 'not_started' | 'in_progress' | 'done'>('loading');
  const [deepProgress, setDeepProgress] = useState<number>(0);

  useEffect(() => {
    const loadData = async () => {
      try {
        // 로그인 확인
        const { session } = await getSessionSafe();

        if (!session) {
          router.push("/app/auth?next=" + encodeURIComponent("/my-report"));
          return;
        }

        setUser({
          id: session.user.id,
          email: session.user.email || undefined,
        });

        // ✅ 내 리포트 조회: 서버 API(/api/my-report)로 조회 (Bearer 토큰)
        // Legacy report compat rail: solutions remain the content owner for this page.
        const reportRes = await fetch("/api/my-report", {
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        const reportJson = await reportRes.json();
        const reportList: LegacyReport[] = reportJson.data || [];
        setReports(reportList);

        if (reportList.length > 0) setSelectedReport(reportList[0]);

        // ✅ 내 요청 목록(사진 확인용) - requests는 클라에서 조회 (RLS 정책이 있어야 보임)
        // Legacy requests rail: photo lookup only for compat UX, never public_results continuity.
        const { data: requestData, error: requestError } = await supabase
          .from("requests")
          .select(LEGACY_MY_REPORT_REQUESTS_SELECT)
          .eq("user_id", session.user.id)
          .order("created_at", { ascending: false });

        if (!requestError && requestData) {
          setLegacyPhotoRequests(requestData as LegacyRequestPartial[]);
        }

        // 심층분석 상태: DB 직접 조회 (plan_status + deep_test_attempts)
        try {
          const { data: userRow } = await supabase
            .from("users")
            .select("plan_status")
            .eq("id", session.user.id)
            .single();

          const planStatus = userRow?.plan_status ?? "inactive";
          if (planStatus !== "active") {
            setDeepStatus("paywall");
          } else {
            const { data: attempt } = await supabase
              .from("deep_test_attempts")
              .select("status, answers")
              .eq("user_id", session.user.id)
              .eq("scoring_version", "deep_v2")
              .order("updated_at", { ascending: false })
              .limit(1)
              .maybeSingle();

            if (!attempt) {
              setDeepStatus("not_started");
            } else if (attempt.status === "final") {
              setDeepStatus("done");
            } else {
              setDeepStatus("in_progress");
              const answers = (attempt.answers ?? {}) as Record<string, unknown>;
              const s1 = ["deep_basic_age", "deep_basic_gender", "deep_basic_experience", "deep_basic_workstyle", "deep_basic_primary_discomfort"];
              const s2 = ["deep_squat_pain_intensity", "deep_squat_pain_location", "deep_squat_knee_alignment"];
              const s3 = ["deep_wallangel_pain_intensity", "deep_wallangel_pain_location", "deep_wallangel_quality", "deep_sls_pain_intensity", "deep_sls_pain_location", "deep_sls_quality"];
              const d1 = s1.some((id) => answers[id] !== undefined && answers[id] !== null && answers[id] !== "");
              const d2 = s2.some((id) => answers[id] !== undefined && answers[id] !== null && answers[id] !== "");
              const d3 = s3.some((id) => answers[id] !== undefined && answers[id] !== null && answers[id] !== "");
              setDeepProgress([d1, d2, d3].filter(Boolean).length);
            }
          }
        } catch {
          setDeepStatus("paywall");
        }
      } catch (err) {
        console.error("데이터 로드 에러:", err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/app/auth?next=" + encodeURIComponent("/my-report"));
  };

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
      {/* 디버그 배지 */}
      <div className="fixed bottom-2 right-2 z-50 rounded bg-black px-2 py-1 text-xs text-white">
        /my-report PAGE OK
      </div>

      <div className="mx-auto max-w-4xl space-y-8">
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

        {/* 심층분석 CTA - not_started/draft: 시작/이어하기, final: 내 분석결과 보기만 */}
        {deepStatus !== "loading" && (
          <section className="rounded-2xl border border-slate-700/80 bg-slate-900/80 p-6">
            <h2 className="mb-3 text-lg font-semibold text-slate-100">심층분석</h2>
            {deepStatus === "paywall" && (
              <div>
                <p className="text-sm text-slate-400">결제 완료 고객 전용 심층 테스트입니다.</p>
                <Link
                  href="/deep-analysis?pay=1"
                  className="mt-3 inline-block rounded-lg bg-[#f97316] px-6 py-3 text-sm font-semibold text-slate-950"
                >
                  유료 플랜 알아보기
                </Link>
              </div>
            )}
            {deepStatus === "not_started" && (
              <div>
                <p className="text-sm text-slate-400">결제 완료 고객 전용 심층 테스트</p>
                <Link
                  href="/app/deep-test"
                  className="mt-3 inline-block rounded-lg bg-[#f97316] px-6 py-3 text-sm font-semibold text-slate-950"
                >
                  심층분석 시작하기
                </Link>
              </div>
            )}
            {deepStatus === "in_progress" && (
              <div>
                <p className="text-sm text-slate-400">진행률 {deepProgress}/3 섹션</p>
                <Link
                  href="/app/deep-test?resume=1"
                  className="mt-3 inline-block rounded-lg bg-[#f97316] px-6 py-3 text-sm font-semibold text-slate-950"
                >
                  심층분석 이어하기 ({deepProgress}/3)
                </Link>
              </div>
            )}
            {deepStatus === "done" && (
              <div>
                <p className="text-sm text-slate-400">결과 기반 7일 루틴 시작은 곧 제공됩니다.</p>
                <Link
                  href="/app/deep-test/result"
                  className="mt-3 inline-block rounded-lg bg-[#f97316] px-6 py-3 text-sm font-semibold text-slate-950"
                >
                  내 분석결과 보기
                </Link>
              </div>
            )}
          </section>
        )}

        {legacyPhotoRequests.length > 0 && (
          <span className="sr-only">legacy photo requests loaded: {legacyPhotoRequests.length}</span>
        )}

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

        {reports.length > 0 && (
          <>
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

            {selectedReport && (
              <div className="space-y-6">
                <section className="rounded-2xl border border-slate-700/80 bg-slate-900/80 p-6">
                  <h2 className="mb-4 text-lg font-semibold text-slate-100">체형 분석 결과</h2>
                  <div className="flex flex-wrap gap-2">
                    {selectedReport.diagnoses?.length > 0 ? (
                      selectedReport.diagnoses.map((diagnosis, index) => (
                        <span
                          key={index}
                          className="rounded-full bg-[#f97316]/20 px-4 py-2 text-sm font-medium text-[#f97316]"
                        >
                          {diagnosis}
                        </span>
                      ))
                    ) : (
                      <p className="text-sm text-slate-400">분석 결과가 없습니다.</p>
                    )}
                  </div>
                </section>

                <div className="grid gap-4 sm:grid-cols-2">
                  <section className="rounded-2xl border border-slate-700/80 bg-slate-900/80 p-5">
                    <div className="mb-3 flex items-center gap-2">
                      <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-semibold text-red-400">01</span>
                      <h3 className="font-semibold text-slate-100">억제 운동</h3>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
                      {selectedReport.inhibit_content || "내용이 없습니다."}
                    </p>
                  </section>

                  <section className="rounded-2xl border border-slate-700/80 bg-slate-900/80 p-5">
                    <div className="mb-3 flex items-center gap-2">
                      <span className="rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs font-semibold text-yellow-400">02</span>
                      <h3 className="font-semibold text-slate-100">신장 운동</h3>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
                      {selectedReport.lengthen_content || "내용이 없습니다."}
                    </p>
                  </section>

                  <section className="rounded-2xl border border-slate-700/80 bg-slate-900/80 p-5">
                    <div className="mb-3 flex items-center gap-2">
                      <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-xs font-semibold text-green-400">03</span>
                      <h3 className="font-semibold text-slate-100">활성화 운동</h3>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
                      {selectedReport.activate_content || "내용이 없습니다."}
                    </p>
                  </section>

                  <section className="rounded-2xl border border-slate-700/80 bg-slate-900/80 p-5">
                    <div className="mb-3 flex items-center gap-2">
                      <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-xs font-semibold text-blue-400">04</span>
                      <h3 className="font-semibold text-slate-100">통합 운동</h3>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
                      {selectedReport.integrate_content || "내용이 없습니다."}
                    </p>
                  </section>
                </div>

                {selectedReport.expert_notes && (
                  <section className="rounded-2xl border border-slate-700/80 bg-slate-900/80 p-6">
                    <h2 className="mb-3 text-lg font-semibold text-slate-100">전문가 소견</h2>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
                      {selectedReport.expert_notes}
                    </p>
                  </section>
                )}

                <p className="text-right text-xs text-slate-500">
                  리포트 작성일: {new Date(selectedReport.created_at).toLocaleDateString("ko-KR")}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
