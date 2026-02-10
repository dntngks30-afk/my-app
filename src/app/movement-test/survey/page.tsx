'use client';

/**
 * Movement Type Test - 설문 진행 페이지
 * 
 * I2: 공용 SurveyForm 컴포넌트 사용
 * 
 * 변경 이력:
 * - 2026-02-05: I2 - 공용 SurveyForm 컴포넌트로 교체
 */

import SurveyForm from '@/components/SurveyForm';

export default function MovementTestSurveyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <SurveyForm />
    </div>
  );
}
