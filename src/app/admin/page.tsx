// 관리자 대시보드 페이지 - 자동 PDF 생성 시스템
// 체크박스만 선택하면 전문적인 교정운동 PDF가 자동 생성됩니다.
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { generateCorrectionPDF, downloadPDF, DiagnosisData } from "@/lib/pdfGenerator";

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

  // 권한 체크
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !session) {
          router.push("/login");
          return;
        }

        // 관리자 이메일 리스트 (환경변수로 관리 가능)
        const adminEmails = [
          process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'dntngks30@gmail.com',
          'dntngks30@gmail.com', // 하드코딩으로 추가
          // 필요시 여기에 추가 관리자 이메일 추가
        ];

        const userEmail = session.user.email;
        
        console.log('현재 로그인 이메일:', userEmail);
        console.log('관리자 이메일 목록:', adminEmails);
        console.log('환경변수:', process.env.NEXT_PUBLIC_ADMIN_EMAIL);
        
        if (!userEmail || !adminEmails.includes(userEmail)) {
          console.error('권한 없음 - 이메일 불일치');
          alert(`관리자 권한이 없습니다.\n로그인 이메일: ${userEmail}\n필요한 이메일: ${adminEmails.join(', ')}`);
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

        setRows(data || []);
      } catch (err) {
        console.error("요청 불러오기 에러:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchRequests();
  }, [isAuthorized]);

  // PDF 자동 생성 및 다운로드
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

    setPdfGenerating(true);

    try {
      // PDF 자동 생성
      const pdfBlob = await generateCorrectionPDF(
        diagnosis,
        selected.front_url,
        selected.side_url,
        selected.user_email || '고객님'
      );

      // PDF 다운로드
      const fileName = `correction-report-${selected.user_id}-${Date.now()}.pdf`;
      downloadPDF(pdfBlob, fileName);

      alert("PDF가 생성되었습니다! 다운로드를 확인해주세요.");

      // 상태 업데이트 (옵션)
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
      console.error("PDF 생성 실패:", error);
      alert("PDF 생성 중 오류가 발생했습니다.");
    } finally {
      setPdfGenerating(false);
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

        <div className="grid gap-6 lg:grid-cols-2">
          {/* 왼쪽: 요청 목록 */}
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="mb-4 text-xl font-bold text-slate-100">요청 목록</h2>
            
            {loading ? (
              <p className="text-slate-400">로딩 중...</p>
            ) : rows.length === 0 ? (
              <p className="text-slate-400">요청이 없습니다.</p>
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
                    <div className="flex items-center justify-between">
                      <div>
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
                      </div>
                      <div className="flex gap-2">
                        {row.front_url && (
                          <span className="text-xs text-green-400">📷 정면</span>
                        )}
                        {row.side_url && (
                          <span className="text-xs text-green-400">📷 측면</span>
                        )}
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
                  <div className="grid grid-cols-2 gap-4">
                    {selected.front_url && (
                      <div>
                        <p className="mb-2 text-sm text-slate-400">정면</p>
                        <img
                          src={selected.front_url}
                          alt="정면"
                          className="w-full rounded-lg border border-slate-700"
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
                        />
                      </div>
                    )}
                  </div>
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

                {/* PDF 생성 버튼 */}
                <button
                  onClick={handleGeneratePDF}
                  disabled={pdfGenerating}
                  className="w-full rounded-lg bg-[#f97316] px-6 py-3 font-bold text-white shadow-lg transition hover:bg-[#fb923c] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {pdfGenerating ? "PDF 생성 중..." : "🎯 PDF 자동 생성"}
                </button>

                <p className="text-center text-xs text-slate-500">
                  선택한 진단에 맞는 4단계 교정운동이 자동으로 포함됩니다
                </p>
              </div>
            )}
          </div>
        </div>
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
