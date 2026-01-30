'use client';

/**
 * 신뢰 요소 UI 컴포넌트
 * 
 * 목적:
 * - 전문성 어필
 * - 법적 보호 (의료 행위 아님 명시)
 * - 전환율 향상
 */

interface TrustBadgeProps {
  variant?: 'full' | 'compact' | 'minimal';
  showExpert?: boolean;
  showDisclaimer?: boolean;
}

export default function TrustBadge({ 
  variant = 'full', 
  showExpert = true,
  showDisclaimer = true 
}: TrustBadgeProps) {
  if (variant === 'minimal') {
    return (
      <div className="text-center text-xs text-slate-500">
        <p>NASM-CES 기반 교정운동 전문가 설계 시스템</p>
        <p className="mt-1">⚠️ 의료 행위가 아닌 운동 가이드 목적</p>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4">
        <div className="flex items-center justify-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-lg">🏆</span>
            <span className="text-slate-300">NASM-CES 인증</span>
          </div>
          <div className="h-4 w-px bg-slate-700" />
          <div className="flex items-center gap-2">
            <span className="text-lg">👥</span>
            <span className="text-slate-300">1,000명+ 분석</span>
          </div>
          <div className="h-4 w-px bg-slate-700" />
          <div className="flex items-center gap-2">
            <span className="text-lg">🔒</span>
            <span className="text-slate-300">개인정보 보호</span>
          </div>
        </div>
        {showDisclaimer && (
          <p className="mt-3 text-center text-xs text-slate-500">
            ⚠️ 본 서비스는 의료 행위가 아니며, 운동 가이드 목적으로만 제공됩니다.
          </p>
        )}
      </div>
    );
  }

  // Full variant
  return (
    <div className="rounded-xl border border-slate-700 bg-gradient-to-br from-slate-900 to-slate-800 p-6">
      {/* 타이틀 */}
      <div className="mb-6 text-center">
        <h3 className="text-lg font-bold text-slate-100">
          전문가 기반 분석 시스템
        </h3>
        <p className="mt-1 text-sm text-slate-400">
          교정운동 전문가가 설계한 AI 분석 시스템입니다
        </p>
      </div>

      {/* 신뢰 배지 */}
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-lg bg-slate-950/50 p-4 text-center">
          <span className="text-3xl">🏆</span>
          <h4 className="mt-2 font-semibold text-slate-200">국제 인증</h4>
          <p className="mt-1 text-xs text-slate-400">
            NASM-CES 교정운동 전문가
          </p>
        </div>
        <div className="rounded-lg bg-slate-950/50 p-4 text-center">
          <span className="text-3xl">👥</span>
          <h4 className="mt-2 font-semibold text-slate-200">풍부한 경험</h4>
          <p className="mt-1 text-xs text-slate-400">
            1,000명+ 체형 분석 및 운동 설계
          </p>
        </div>
        <div className="rounded-lg bg-slate-950/50 p-4 text-center">
          <span className="text-3xl">🔒</span>
          <h4 className="mt-2 font-semibold text-slate-200">개인정보 보호</h4>
          <p className="mt-1 text-xs text-slate-400">
            사진 24시간 내 자동 삭제
          </p>
        </div>
      </div>

      {/* 전문가 소개 */}
      {showExpert && (
        <div className="mb-6 rounded-lg border border-slate-700 bg-slate-950/30 p-4">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#f97316]/20 text-2xl">
              👨‍⚕️
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-slate-200">운영 전문가</h4>
              <p className="mt-1 text-sm text-slate-400">
                NASM-CES (교정운동 전문가) 국제 인증
              </p>
              <p className="mt-1 text-xs text-slate-500">
                • 피트니스 센터 10년+ 경력<br />
                • 체형 분석 및 운동 프로그램 설계 전문<br />
                • 1,000명 이상 1:1 교정운동 지도 경험
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 면책 조항 */}
      {showDisclaimer && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
          <div className="flex items-start gap-3">
            <span className="text-xl">⚠️</span>
            <div>
              <h4 className="font-semibold text-red-400">중요 안내</h4>
              <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                본 서비스는 <strong>의료 행위가 아니며</strong>, 운동 가이드 및 자세 관리 목적으로만 제공됩니다.
                질병, 통증, 부상이 있는 경우 반드시 의료기관을 방문하세요.
                모든 분석 결과는 "경향" 또는 "가능성"을 나타내며, 의학적 진단을 대체할 수 없습니다.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 인라인 신뢰 텍스트 (PDF용)
 */
export function TrustText() {
  return (
    <div className="text-xs text-slate-500 space-y-1">
      <p>• 본 분석은 NASM-CES 기반 교정운동 전문가 설계 시스템입니다.</p>
      <p>• 운영: 국제 인증 교정운동 전문가 | 1,000명+ 체형 분석 경험</p>
      <p>• ⚠️ 본 서비스는 의료 행위가 아니며, 운동 가이드 목적으로만 제공됩니다.</p>
    </div>
  );
}

/**
 * 푸터용 신뢰 요소
 */
export function TrustFooter() {
  return (
    <div className="border-t border-slate-800 bg-slate-950 py-8">
      <div className="mx-auto max-w-4xl px-4">
        <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-500">
          <div className="flex items-center gap-2">
            <span>🏆</span>
            <span>NASM-CES 인증</span>
          </div>
          <div className="flex items-center gap-2">
            <span>👥</span>
            <span>1,000명+ 분석</span>
          </div>
          <div className="flex items-center gap-2">
            <span>🔒</span>
            <span>개인정보 보호</span>
          </div>
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span>의료 행위 아님</span>
          </div>
        </div>
        <p className="mt-4 text-center text-xs text-slate-600">
          PostureLab은 운동 가이드 서비스이며, 의학적 진단이나 치료를 제공하지 않습니다.
        </p>
      </div>
    </div>
  );
}
