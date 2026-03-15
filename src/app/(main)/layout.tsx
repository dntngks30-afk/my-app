/**
 * 메인 레이아웃 (Route Group)
 *
 * pathname === '/' 일 때: Header/TopTabs 숨김 (public landing)
 * 그 외: 헤더 + TopTabs 유지
 */

import MainLayoutShell from '@/components/landing/MainLayoutShell';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MainLayoutShell>{children}</MainLayoutShell>;
}
