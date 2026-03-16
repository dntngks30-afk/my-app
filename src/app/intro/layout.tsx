/**
 * intro 퍼널 공통 레이아웃
 * /intro/* 는 (main) 그룹 밖에 있어 Header/TopTabs 없음
 */
export default function IntroLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
