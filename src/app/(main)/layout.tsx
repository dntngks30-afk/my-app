/**
 * 메인 레이아웃 (Route Group)
 * 
 * 헤더 + TopTabs가 모든 페이지에서 유지됨
 */

import Header from '@/components/Header';
import TopTabs from '@/components/TopTabs';
import ThemeSwitcher from '@/components/ThemeSwitcher';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--bg)]">
      {/* 전역 헤더 */}
      <Header />

      {/* 전역 탭 네비게이션 */}
      <TopTabs />

      {/* 개발 모드 전용 테마 스위처 */}
      <ThemeSwitcher />

      {/* 페이지 콘텐츠 */}
      <main>{children}</main>
    </div>
  );
}
