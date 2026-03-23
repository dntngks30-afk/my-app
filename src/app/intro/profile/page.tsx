'use client';

/**
 * intro profile: age + gender 입력 후 localStorage 저장
 * PR-PUBLIC-ENTRY-02 — 완료 시 항상 설문 baseline(/movement-test/survey)으로 진입.
 * 카메라 first-entry 분기 제거 (refine-bridge에서만 optional 제공).
 */
import IntroProfile from '@/components/stitch/intro/IntroProfile';

export default function IntroProfilePage() {
  return <IntroProfile />;
}
