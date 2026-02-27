import { redirect } from 'next/navigation';

/**
 * /app → /app/home 리다이렉트
 * A 루트(/app 페이지) 사용 중단, B 루트(/app/home)가 유일한 홈
 */
export default function AppPage() {
  redirect('/app/home');
}
