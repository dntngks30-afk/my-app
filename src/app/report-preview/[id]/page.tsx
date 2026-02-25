// 리포트 미리보기 및 PDF 인쇄 페이지
// 한글 완벽 지원, 브라우저 인쇄 기능 사용
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface DiagnosisData {
  forwardHead: 'none' | 'mild' | 'moderate' | 'severe';
  roundedShoulder: 'none' | 'mild' | 'moderate' | 'severe';
  anteriorHumerus: 'none' | 'mild' | 'moderate' | 'severe';
  anteriorPelvicTilt: 'none' | 'mild' | 'moderate' | 'severe';
  posteriorPelvicTilt: 'none' | 'mild' | 'moderate' | 'severe';
}

export default function ReportPreviewPage() {
  const params = useParams();
  const requestId = params.id as string;
  
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<any>(null);

  useEffect(() => {
    // URL에서 진단 데이터 가져오기 (임시)
    const urlParams = new URLSearchParams(window.location.search);
    const diagnosisJson = urlParams.get('diagnosis');
    
    if (diagnosisJson) {
      try {
        const diagnosis = JSON.parse(diagnosisJson);
        setReportData({ diagnosis });
        setLoading(false);
      } catch (error) {
        console.error('진단 데이터 파싱 실패:', error);
      }
    }
  }, []);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>로딩 중...</p>
      </div>
    );
  }

  const severityText = {
    none: '정상',
    mild: '경미',
    moderate: '중등도',
    severe: '심함',
  };

  const diagnosisNames = {
    forwardHead: '거북목',
    roundedShoulder: '라운드숄더',
    anteriorHumerus: '상완골 전방활주',
    anteriorPelvicTilt: '골반 전방경사',
    posteriorPelvicTilt: '골반 후방경사',
  };

  return (
    <>
      {/* 인쇄용 스타일 */}
      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          @page {
            margin: 20mm;
          }
        }
      `}</style>

      {/* 인쇄 버튼 */}
      <div className="no-print fixed right-4 top-4 z-50">
        <button
          onClick={handlePrint}
          className="rounded-lg bg-[#f97316] px-6 py-3 font-bold text-white shadow-lg hover:bg-[#fb923c]"
        >
          📄 PDF로 저장 (인쇄)
        </button>
      </div>

      {/* 리포트 내용 */}
      <div className="mx-auto max-w-4xl bg-white p-8 text-black">
        {/* 표지 */}
        <div className="mb-12 text-center">
          <h1 className="mb-4 text-4xl font-bold text-[#f97316]">
            맞춤형 교정운동 리포트
          </h1>
          <p className="text-xl text-gray-700">고객님</p>
          <p className="mt-2 text-sm text-gray-500">
            작성일: {new Date().toLocaleDateString('ko-KR')}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            NASM-CES 기반 체계적 교정 프로그램
          </p>
        </div>

        {/* 분석 결과 */}
        <div className="mb-12">
          <h2 className="mb-6 border-b-2 border-[#f97316] pb-2 text-2xl font-bold text-[#f97316]">
            분석 결과
          </h2>
          
          {reportData?.diagnosis && Object.entries(reportData.diagnosis).map(([key, severity]: [string, any]) => {
            if (severity === 'none') return null;
            
            return (
              <div key={key} className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-[#f97316] px-3 py-1 text-sm font-bold text-white">
                    {severityText[severity as keyof typeof severityText]}
                  </span>
                  <span className="text-lg font-semibold">
                    {diagnosisNames[key as keyof typeof diagnosisNames]}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* 4단계 교정 시스템 설명 */}
        <div className="mb-12">
          <h2 className="mb-6 border-b-2 border-[#f97316] pb-2 text-2xl font-bold text-[#f97316]">
            4단계 교정 시스템
          </h2>
          
          <div className="space-y-6">
            <div className="rounded-lg border-l-4 border-red-500 bg-red-50 p-4">
              <h3 className="mb-2 text-lg font-bold">1단계: 억제 (Inhibit)</h3>
              <p className="text-sm text-gray-700">
                과활성 근육의 긴장을 완화합니다. 폼롤러와 마사지볼을 사용한 SMR(Self-Myofascial Release) 기법으로 근육의 과도한 긴장을 해소합니다.
              </p>
            </div>

            <div className="rounded-lg border-l-4 border-orange-500 bg-orange-50 p-4">
              <h3 className="mb-2 text-lg font-bold">2단계: 신장 (Lengthen)</h3>
              <p className="text-sm text-gray-700">
                단축된 근육을 최적 길이로 늘립니다. 정적 스트레칭을 통해 근섬유의 길이를 회복하고 관절가동범위를 확보합니다.
              </p>
            </div>

            <div className="rounded-lg border-l-4 border-yellow-500 bg-yellow-50 p-4">
              <h3 className="mb-2 text-lg font-bold">3단계: 활성화 (Activate)</h3>
              <p className="text-sm text-gray-700">
                약화된 근육을 깨워 강화합니다. 분리된 근력 운동으로 억제된 근육의 신경 활성도를 높이고 기능을 회복시킵니다.
              </p>
            </div>

            <div className="rounded-lg border-l-4 border-green-500 bg-green-50 p-4">
              <h3 className="mb-2 text-lg font-bold">4단계: 통합 (Integrate)</h3>
              <p className="text-sm text-gray-700">
                일상 동작에서 올바른 움직임을 통합합니다. 기능적 운동 패턴으로 개선된 자세와 움직임을 실생활에 적용합니다.
              </p>
            </div>
          </div>
        </div>

        {/* 운동 가이드 */}
        <div className="mb-12">
          <h2 className="mb-6 border-b-2 border-[#f97316] pb-2 text-2xl font-bold text-[#f97316]">
            운동 가이드
          </h2>
          
          <ul className="space-y-2 text-sm text-gray-700">
            <li className="flex items-start gap-2">
              <span className="text-[#f97316]">✓</span>
              <span>매일 규칙적으로 실시하세요. (주 5-6회 권장)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#f97316]">✓</span>
              <span>순서를 지켜주세요: 억제 → 신장 → 활성화 → 통합</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#f97316]">✓</span>
              <span>통증이 있다면 즉시 중단하고 전문가와 상담하세요.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#f97316]">✓</span>
              <span>처음에는 가벼운 강도로 시작하세요.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#f97316]">✓</span>
              <span>2-4주마다 자세를 재평가하여 진행 상황을 확인하세요.</span>
            </li>
          </ul>
        </div>

        {/* 마무리 */}
        <div className="rounded-lg bg-gray-100 p-6 text-center">
          <p className="text-sm text-gray-600">
            문의사항이 있으시면 언제든 연락주세요.
          </p>
          <p className="mt-2 font-semibold text-gray-800">
            함께 건강한 자세를 만들어가겠습니다!
          </p>
        </div>
      </div>
    </>
  );
}
