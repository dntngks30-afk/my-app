// 관리자 대시보드 페이지 - 자동 PDF 생성 시스템
// 체크박스만 선택하면 전문적인 교정운동 PDF가 자동 생성됩니다.
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase, getSessionSafe } from "@/lib/supabase";

// 빌드 시 프리렌더링 방지 (Supabase 환경 변수 필요)
export const dynamic = 'force-dynamic';

type AdminTab = "requests" | "plan-override" | "backfill";

// 진단 데이터 타입
interface DiagnosisData {
  forwardHead: 'none' | 'mild' | 'moderate' | 'severe';
  roundedShoulder: 'none' | 'mild' | 'moderate' | 'severe';
  anteriorHumerus: 'none' | 'mild' | 'moderate' | 'severe';
  anteriorPelvicTilt: 'none' | 'mild' | 'moderate' | 'severe';
  posteriorPelvicTilt: 'none' | 'mild' | 'moderate' | 'severe';
}

// 요청 데이터 타입
type RequestRow = {
  id: string;
  user_id: string;
  front_url?: string;
  side_url?: string;
  status?: string;
  created_at?: string;
  user_email?: string;
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
  
  // 진단 체크박스 상태
  const [diagnosis, setDiagnosis] = useState<DiagnosisData>({
    forwardHead: 'none',
    roundedShoulder: 'none',
    anteriorHumerus: 'none',
    anteriorPelvicTilt: 'none',
    posteriorPelvicTilt: 'none',
  });
  
  // PDF 생성 로딩 상태
  const [pdfGenerating, setPdfGenerating] = useState(false);

  // 탭 및 플랜 권한 부여
  const [activeTab, setActiveTab] = useState<AdminTab>("requests");
  const [isPlanAdmin, setIsPlanAdmin] = useState<boolean | null>(null);
  const [planOverrideLoading, setPlanOverrideLoading] = useState(false);
  const [planOverrideMsg, setPlanOverrideMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [planForm, setPlanForm] = useState({
    targetEmail: "",
    targetUserId: "",
    plan_status: "active" as string,
    plan_tier: "" as string,
    reason: "",
  });

  // 백필
  const [isBackfillAdmin, setIsBackfillAdmin] = useState<boolean | null>(null);
  const [backfillLoading, setBackfillLoading] = useState(false);
  const [backfillDryRun, setBackfillDryRun] = useState(false);
  const [backfillLimit, setBackfillLimit] = useState(10);
  const [backfillResult, setBackfillResult] = useState<Record<string, unknown> | null>(null);

  // 권한 체크
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { session, error: sessionError } = await getSessionSafe();
        
        if (sessionError || !session) {
          router.push("/app/auth?next=" + encodeURIComponent("/admin"));
          return;
        }

        // 임시: 모든 로그인 사용자에게 관리자 권한 부여 (개발/테스트용)
        // 나중에 특정 이메일만 허용하도록 변경 가능
        console.log('로그인한 사용자:', session.user.email);
        console.log('✅ 관리자 권한 부여됨');

        setIsAuthorized(true);
      } catch (err) {
        console.error("인증 체크 에러:", err);
        router.push("/app/auth?next=" + encodeURIComponent("/admin"));
      } finally {
        setAuthLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  // 요청 목록 불러오기
  useEffect(() => {
    if (!isAuthorized) return;

    const fetchRequests = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("requests")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) {
          console.error("요청 목록 조회 실패:", error);
          return;
        }

        console.log('📋 불러온 요청 수:', data?.length);
        console.log('📸 첫 번째 요청 데이터:', data?.[0]);
        
        setRows(data || []);
      } catch (err) {
        console.error("요청 불러오기 에러:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchRequests();
  }, [isAuthorized]);

  // 플랜 권한 부여: plan-override 탭 활성 시 admin 체크
  useEffect(() => {
    if (!isAuthorized || activeTab !== "plan-override") return;

    const checkPlanAdmin = async () => {
      const { session } = await getSessionSafe();
      if (!session?.access_token) {
        setIsPlanAdmin(false);
        return;
      }
      try {
        const res = await fetch("/api/admin/check", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const { isAdmin: ok } = await res.json();
        setIsPlanAdmin(!!ok);
      } catch {
        setIsPlanAdmin(false);
      }
    };

    setIsPlanAdmin(null);
    checkPlanAdmin();
  }, [isAuthorized, activeTab]);

  // 백필 탭: admin 체크
  useEffect(() => {
    if (!isAuthorized || activeTab !== "backfill") return;

    const check = async () => {
      const { session } = await getSessionSafe();
      if (!session?.access_token) {
        setIsBackfillAdmin(false);
        return;
      }
      try {
        const res = await fetch("/api/admin/check", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const { isAdmin: ok } = await res.json();
        setIsBackfillAdmin(!!ok);
      } catch {
        setIsBackfillAdmin(false);
      }
    };

    setIsBackfillAdmin(null);
    check();
  }, [isAuthorized, activeTab]);

  // 백필 실행
  const handleBackfillRun = async () => {
    const { session } = await getSessionSafe();
    if (!session?.access_token) {
      setBackfillResult({ error: "로그인이 필요합니다." });
      return;
    }

    setBackfillLoading(true);
    setBackfillResult(null);
    try {
      const res = await fetch("/api/admin/backfill/routine-plans", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          dryRun: backfillDryRun,
          limit: backfillLimit,
        }),
      });
      const data = await res.json().catch(() => ({}));
      setBackfillResult(data);
    } catch (err) {
      setBackfillResult({
        error: err instanceof Error ? err.message : "네트워크 오류",
      });
    } finally {
      setBackfillLoading(false);
    }
  };

  // 플랜 권한 부여 제출
  const handlePlanOverrideSubmit = async () => {
    if (!planForm.targetEmail?.trim() && !planForm.targetUserId?.trim()) {
      setPlanOverrideMsg({ type: "error", text: "이메일 또는 사용자 ID를 입력하세요." });
      return;
    }
    if (!planForm.reason?.trim()) {
      setPlanOverrideMsg({ type: "error", text: "변경 사유를 입력하세요." });
      return;
    }

    const { session } = await getSessionSafe();
    if (!session?.access_token) {
      setPlanOverrideMsg({ type: "error", text: "로그인이 필요합니다." });
      return;
    }

    setPlanOverrideLoading(true);
    setPlanOverrideMsg(null);
    try {
      const body: Record<string, string> = {
        plan_status: planForm.plan_status,
        reason: planForm.reason.trim(),
      };
      if (planForm.targetEmail?.trim()) body.targetEmail = planForm.targetEmail.trim();
      if (planForm.targetUserId?.trim()) body.targetUserId = planForm.targetUserId.trim();
      if (planForm.plan_tier?.trim()) body.plan_tier = planForm.plan_tier.trim();

      const res = await fetch("/api/admin/users/plan-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setPlanOverrideMsg({ type: "success", text: "권한이 부여되었습니다." });
        setPlanForm((prev) => ({ ...prev, reason: "" }));
      } else if (res.status === 403) {
        setPlanOverrideMsg({ type: "error", text: "관리자 권한이 없습니다." });
      } else if (res.status === 404) {
        setPlanOverrideMsg({ type: "error", text: "대상 사용자를 찾을 수 없습니다." });
      } else if (res.status === 400) {
        setPlanOverrideMsg({ type: "error", text: data?.error || "잘못된 요청입니다." });
      } else {
        setPlanOverrideMsg({ type: "error", text: data?.error || data?.details || "오류가 발생했습니다." });
      }
    } catch (err) {
      setPlanOverrideMsg({ type: "error", text: "네트워크 오류가 발생했습니다." });
    } finally {
      setPlanOverrideLoading(false);
    }
  };

  // HTML 리포트 페이지 열기 (한글 완벽 지원)
  const handleGeneratePDF = async () => {
    if (!selected) {
      alert("요청을 선택해주세요.");
      return;
    }

    // 진단 항목이 하나라도 선택되었는지 확인
    const hasAnyDiagnosis = Object.values(diagnosis).some(v => v !== 'none');
    if (!hasAnyDiagnosis) {
      alert("최소 하나의 진단 항목을 선택해주세요.");
      return;
    }

    try {
      // 진단 데이터를 URL 파라미터로 전달
      const diagnosisJson = encodeURIComponent(JSON.stringify(diagnosis));
      const reportUrl = `/report-preview/${selected.id}?diagnosis=${diagnosisJson}`;
      
      // 새 탭에서 리포트 열기
      window.open(reportUrl, '_blank');
      
      // 상태 업데이트
      await supabase
        .from("requests")
        .update({ status: "completed" })
        .eq("id", selected.id);

      // 목록 새로고침
      const { data } = await supabase
        .from("requests")
        .select("*")
        .order("created_at", { ascending: false });
      setRows(data || []);

    } catch (error) {
      console.error("리포트 생성 실패:", error);
      alert("리포트 생성 중 오류가 발생했습니다.");
    }
  };

  // 진단 변경 핸들러
  const handleDiagnosisChange = (
    key: keyof DiagnosisData,
    value: 'none' | 'mild' | 'moderate' | 'severe'
  ) => {
    setDiagnosis(prev => ({ ...prev, [key]: value }));
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <p className="text-slate-300">권한 확인 중...</p>
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="mx-auto max-w-7xl">
        {/* 헤더 */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-100">관리자 대시보드</h1>
            <p className="mt-2 text-sm text-slate-400">
              체크박스만 선택하면 자동으로 전문 PDF가 생성됩니다
            </p>
          </div>
          <button
            onClick={() => router.push("/")}
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700"
          >
            메인으로
          </button>
        </div>

        {/* 탭 메뉴 */}
        <div className="mb-6 flex gap-2 border-b border-slate-800">
          <button
            onClick={() => setActiveTab("requests")}
            className={`rounded-t-lg px-4 py-2 text-sm font-medium transition ${
              activeTab === "requests"
                ? "border border-b-0 border-slate-800 border-b-slate-950 bg-slate-900 text-slate-100"
                : "text-slate-400 hover:bg-slate-900/50 hover:text-slate-300"
            }`}
          >
            요청 목록
          </button>
          <button
            onClick={() => setActiveTab("plan-override")}
            className={`rounded-t-lg px-4 py-2 text-sm font-medium transition ${
              activeTab === "plan-override"
                ? "border border-b-0 border-slate-800 border-b-slate-950 bg-slate-900 text-slate-100"
                : "text-slate-400 hover:bg-slate-900/50 hover:text-slate-300"
            }`}
          >
            플랜 권한 부여
          </button>
          <button
            onClick={() => setActiveTab("backfill")}
            className={`rounded-t-lg px-4 py-2 text-sm font-medium transition ${
              activeTab === "backfill"
                ? "border border-b-0 border-slate-800 border-b-slate-950 bg-slate-900 text-slate-100"
                : "text-slate-400 hover:bg-slate-900/50 hover:text-slate-300"
            }`}
          >
            루틴 플랜 백필
          </button>
          <Link
            href="/admin/templates"
            className="rounded-t-lg px-4 py-2 text-sm font-medium text-slate-400 hover:bg-slate-900/50 hover:text-slate-300 transition"
          >
            템플릿 운영
          </Link>
          <Link
            href="/admin/dogfooding"
            className="rounded-t-lg px-4 py-2 text-sm font-medium text-slate-400 hover:bg-slate-900/50 hover:text-slate-300 transition"
          >
            도그푸딩 Ops
          </Link>
        </div>

        {activeTab === "backfill" ? (
          /* 루틴 플랜 백필 섹션 */
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 max-w-2xl">
            <h2 className="mb-4 text-xl font-bold text-slate-100">루틴 플랜 백필</h2>
            <p className="mb-6 text-sm text-slate-400">
              Deep 완료 유저의 미완료 Day 2~7 플랜을 새 규칙으로 생성합니다.
            </p>

            {isBackfillAdmin === null ? (
              <p className="text-slate-400">권한 확인 중...</p>
            ) : !isBackfillAdmin ? (
              <div className="rounded-lg border border-slate-700 bg-slate-800 p-6 text-center">
                <p className="text-slate-300">관리자 권한이 없습니다.</p>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="backfill-dryrun"
                    checked={backfillDryRun}
                    onChange={(e) => setBackfillDryRun(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-600 bg-slate-800"
                  />
                  <label htmlFor="backfill-dryrun" className="text-sm text-slate-300">
                    미리보기 (dryRun) — 체크 시 DB에 저장하지 않고 결과만 확인
                  </label>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-300">처리 인원 수 (limit)</label>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={backfillLimit}
                    onChange={(e) => setBackfillLimit(Math.min(200, Math.max(1, parseInt(e.target.value, 10) || 10)))}
                    className="w-32 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100"
                  />
                  <p className="mt-1 text-xs text-slate-500">1~200 (기본 10)</p>
                </div>
                <button
                  onClick={handleBackfillRun}
                  disabled={backfillLoading}
                  className="rounded-lg bg-[#f97316] px-6 py-3 font-bold text-white transition hover:bg-[#fb923c] disabled:opacity-60"
                >
                  {backfillLoading ? "처리 중..." : backfillDryRun ? "미리보기 실행" : "백필 실행"}
                </button>
                {backfillResult && (
                  <div className="rounded-lg border border-slate-700 bg-slate-800 p-4 text-sm">
                    <pre className="whitespace-pre-wrap break-all text-slate-300 font-mono">
                      {JSON.stringify(backfillResult, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : activeTab === "plan-override" ? (
          /* 플랜 권한 부여 섹션 */
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 max-w-2xl">
            <h2 className="mb-6 text-xl font-bold text-slate-100">7일 루틴 권한 부여</h2>

            {isPlanAdmin === null ? (
              <p className="text-slate-400">권한 확인 중...</p>
            ) : !isPlanAdmin ? (
              <div className="rounded-lg border border-slate-700 bg-slate-800 p-6 text-center">
                <p className="text-slate-300">관리자 권한이 없습니다.</p>
                <p className="mt-2 text-sm text-slate-500">ADMIN_EMAIL_ALLOWLIST 또는 users.role=admin 사용자만 이용할 수 있습니다.</p>
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-300">대상 이메일</label>
                  <input
                    type="email"
                    placeholder="user@example.com"
                    value={planForm.targetEmail}
                    onChange={(e) => setPlanForm((p) => ({ ...p, targetEmail: e.target.value }))}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 placeholder:text-slate-500"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-400">사용자 ID (선택)</label>
                  <input
                    type="text"
                    placeholder="선택: 이메일 대신 사용"
                    value={planForm.targetUserId}
                    onChange={(e) => setPlanForm((p) => ({ ...p, targetUserId: e.target.value }))}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 placeholder:text-slate-500"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-300">plan_status</label>
                  <select
                    value={planForm.plan_status}
                    onChange={(e) => setPlanForm((p) => ({ ...p, plan_status: e.target.value }))}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100"
                  >
                    <option value="active">active (7일 루틴 권한 부여)</option>
                    <option value="inactive">inactive</option>
                    <option value="cancelled">cancelled</option>
                    <option value="expired">expired</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-400">plan_tier (선택)</label>
                  <select
                    value={planForm.plan_tier}
                    onChange={(e) => setPlanForm((p) => ({ ...p, plan_tier: e.target.value }))}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100"
                  >
                    <option value="">— 선택 안 함 —</option>
                    <option value="free">free</option>
                    <option value="standard">standard</option>
                    <option value="basic">basic</option>
                    <option value="premium">premium</option>
                    <option value="vip">vip</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-300">변경 사유 (필수)</label>
                  <textarea
                    placeholder="변경 사유를 입력하세요"
                    value={planForm.reason}
                    onChange={(e) => setPlanForm((p) => ({ ...p, reason: e.target.value }))}
                    rows={3}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 placeholder:text-slate-500"
                  />
                </div>
                {planOverrideMsg && (
                  <div
                    className={`rounded-lg px-3 py-2 text-sm ${
                      planOverrideMsg.type === "success"
                        ? "bg-green-500/20 text-green-400"
                        : "bg-red-500/20 text-red-400"
                    }`}
                  >
                    {planOverrideMsg.text}
                  </div>
                )}
                <button
                  onClick={handlePlanOverrideSubmit}
                  disabled={planOverrideLoading}
                  className="w-full rounded-lg bg-[#f97316] px-6 py-3 font-bold text-white transition hover:bg-[#fb923c] disabled:opacity-60"
                >
                  {planOverrideLoading ? "처리 중..." : "권한 부여"}
                </button>
              </div>
            )}
          </div>
        ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* 왼쪽: 요청 목록 */}
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="mb-4 text-xl font-bold text-slate-100">요청 목록</h2>
            
            {loading ? (
              <p className="text-slate-400">로딩 중...</p>
            ) : rows.length === 0 ? (
              <div className="rounded-lg border border-slate-700 bg-slate-800 p-8 text-center">
                <p className="text-lg text-slate-300">📭 요청이 없습니다</p>
                <p className="mt-2 text-sm text-slate-400">
                  메인 페이지에서 사진을 업로드해주세요.
                </p>
                <div className="mt-4 rounded-lg bg-slate-900 p-4 text-left text-xs text-slate-500">
                  <p className="font-semibold text-slate-400 mb-2">테스트 데이터 추가하기:</p>
                  <p>1. Supabase Dashboard → SQL Editor</p>
                  <p>2. 다음 SQL 실행:</p>
                  <pre className="mt-2 overflow-x-auto rounded bg-slate-950 p-2 text-green-400">
{`INSERT INTO requests (user_id, front_url, side_url, status)
VALUES (
  'test-user',
  'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400',
  'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=400',
  'pending'
);`}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {rows.map((row) => (
                  <div
                    key={row.id}
                    onClick={() => setSelected(row)}
                    className={`cursor-pointer rounded-lg border p-4 transition ${
                      selected?.id === row.id
                        ? "border-[#f97316] bg-[#f97316]/10"
                        : "border-slate-700 bg-slate-800 hover:border-slate-600"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* 썸네일 */}
                      <div className="flex gap-2 flex-shrink-0">
                        {row.front_url && (
                          <img 
                            src={row.front_url} 
                            alt="정면" 
                            className="w-12 h-16 object-cover rounded border border-slate-600"
                          />
                        )}
                        {row.side_url && (
                          <img 
                            src={row.side_url} 
                            alt="측면" 
                            className="w-12 h-16 object-cover rounded border border-slate-600"
                          />
                        )}
                        {!row.front_url && !row.side_url && (
                          <div className="w-12 h-16 flex items-center justify-center bg-slate-700 rounded border border-slate-600">
                            <span className="text-xs text-slate-500">📷</span>
                          </div>
                        )}
                      </div>
                      
                      {/* 정보 */}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-100">
                          요청 ID: {row.id.slice(0, 8)}
                        </p>
                        <p className="text-sm text-slate-400">
                          사용자: {row.user_id.slice(0, 8)}
                        </p>
                        {row.created_at && (
                          <p className="text-xs text-slate-500">
                            {new Date(row.created_at).toLocaleString('ko-KR')}
                          </p>
                        )}
                        <div className="mt-2 flex gap-2">
                          {row.front_url && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-green-500/20 px-2 py-0.5 text-xs text-green-400">
                              ✓ 정면
                            </span>
                          )}
                          {row.side_url && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-green-500/20 px-2 py-0.5 text-xs text-green-400">
                              ✓ 측면
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 오른쪽: 진단 및 PDF 생성 */}
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
            {!selected ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-slate-400">왼쪽에서 요청을 선택해주세요</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* 사진 미리보기 */}
                <div>
                  <h3 className="mb-3 text-lg font-bold text-slate-100">업로드된 사진</h3>
                  {!selected.front_url && !selected.side_url ? (
                    <div className="rounded-lg border border-slate-700 bg-slate-800 p-8 text-center">
                      <p className="text-slate-400">📷 업로드된 사진이 없습니다</p>
                      <p className="mt-2 text-xs text-slate-500">
                        사용자 ID: {selected.user_id}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      {selected.front_url && (
                        <div>
                          <p className="mb-2 text-sm text-slate-400">정면</p>
                          <img
                            src={selected.front_url}
                            alt="정면"
                            className="w-full rounded-lg border border-slate-700"
                            onError={(e) => {
                              console.error('정면 사진 로드 실패:', selected.front_url);
                              e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="300"%3E%3Crect width="200" height="300" fill="%23334155"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" fill="%23cbd5e1" font-size="14"%3E이미지 로드 실패%3C/text%3E%3C/svg%3E';
                            }}
                          />
                        </div>
                      )}
                      {selected.side_url && (
                        <div>
                          <p className="mb-2 text-sm text-slate-400">측면</p>
                          <img
                            src={selected.side_url}
                            alt="측면"
                            className="w-full rounded-lg border border-slate-700"
                            onError={(e) => {
                              console.error('측면 사진 로드 실패:', selected.side_url);
                              e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="300"%3E%3Crect width="200" height="300" fill="%23334155"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" fill="%23cbd5e1" font-size="14"%3E이미지 로드 실패%3C/text%3E%3C/svg%3E';
                            }}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 진단 체크박스 */}
                <div>
                  <h3 className="mb-4 text-lg font-bold text-slate-100">진단 선택</h3>
                  
                  <div className="space-y-4">
                    {/* 거북목 */}
                    <DiagnosisCheckbox
                      label="거북목 (Forward Head)"
                      value={diagnosis.forwardHead}
                      onChange={(v) => handleDiagnosisChange('forwardHead', v)}
                    />
                    
                    {/* 라운드숄더 */}
                    <DiagnosisCheckbox
                      label="라운드숄더 (Rounded Shoulder)"
                      value={diagnosis.roundedShoulder}
                      onChange={(v) => handleDiagnosisChange('roundedShoulder', v)}
                    />
                    
                    {/* 상완골 전방활주 */}
                    <DiagnosisCheckbox
                      label="상완골 전방활주 (Anterior Humerus)"
                      value={diagnosis.anteriorHumerus}
                      onChange={(v) => handleDiagnosisChange('anteriorHumerus', v)}
                    />
                    
                    {/* 골반 전방경사 */}
                    <DiagnosisCheckbox
                      label="골반 전방경사 (Anterior Pelvic Tilt)"
                      value={diagnosis.anteriorPelvicTilt}
                      onChange={(v) => handleDiagnosisChange('anteriorPelvicTilt', v)}
                    />
                    
                    {/* 골반 후방경사 */}
                    <DiagnosisCheckbox
                      label="골반 후방경사 (Posterior Pelvic Tilt)"
                      value={diagnosis.posteriorPelvicTilt}
                      onChange={(v) => handleDiagnosisChange('posteriorPelvicTilt', v)}
                    />
                  </div>
                </div>

                {/* 리포트 생성 버튼 */}
                <button
                  onClick={handleGeneratePDF}
                  className="w-full rounded-lg bg-[#f97316] px-6 py-3 font-bold text-white shadow-lg transition hover:bg-[#fb923c]"
                >
                  🎯 리포트 생성 (한글 지원)
                </button>

                <p className="text-center text-xs text-slate-500">
                  새 탭에서 리포트가 열립니다. 브라우저 인쇄 기능으로 PDF 저장 가능
                </p>
              </div>
            )}
          </div>
        </div>
        )}
      </div>
    </div>
  );
}

// 진단 체크박스 컴포넌트
function DiagnosisCheckbox({
  label,
  value,
  onChange,
}: {
  label: string;
  value: 'none' | 'mild' | 'moderate' | 'severe';
  onChange: (value: 'none' | 'mild' | 'moderate' | 'severe') => void;
}) {
  const options = [
    { value: 'none', label: '정상', color: 'bg-slate-700' },
    { value: 'mild', label: '경미', color: 'bg-yellow-600' },
    { value: 'moderate', label: '중등도', color: 'bg-orange-600' },
    { value: 'severe', label: '심함', color: 'bg-red-600' },
  ] as const;

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
      <p className="mb-3 font-medium text-slate-200">{label}</p>
      <div className="flex gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
              value === option.value
                ? `${option.color} text-white shadow-lg`
                : "bg-slate-700 text-slate-300 hover:bg-slate-600"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
