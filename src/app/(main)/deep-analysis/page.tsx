'use client';

/**
 * 심층분석 소개 페이지
 * 
 * I3: 탭 라우팅 확정
 * SDD 라우트: /deep-analysis
 */

export default function DeepAnalysisPage() {
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-8 text-center">
          심층분석
        </h1>
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-8 md:p-12">
          <p className="text-slate-300 text-lg text-center mb-6">
            사진/영상 업로드와 전문가 코멘트를 통한 심층 분석 서비스
          </p>
          <p className="text-slate-400 text-center">
            (준비 중)
          </p>
        </div>
      </div>
    </div>
  );
}
