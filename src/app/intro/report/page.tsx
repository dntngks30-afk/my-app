import { redirect } from 'next/navigation';

/**
 * 예전 STEP 2 경로 호환: 퍼널에서 제거됨 → 첫 예시 장으로 이어짐
 */
export default function IntroReportPage() {
  redirect('/intro/examples/1');
}
