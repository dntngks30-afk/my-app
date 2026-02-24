// 관리자 대시보드 페이지 - 자동 PDF 생성 시스템
// 체크박스만 선택하면 전문적인 교정운동 PDF가 자동 생성됩니다.
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// 빌드 시 프리렌더링 방지 (Supabase 환경 변수 필요)
export const dynamic = 'force-dynamic';

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

  // 권한 체크
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
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
