'use client';

/**
 * TopTabs - 전역 상단 탭 네비게이션 컴포넌트
 * 
 * SDD 요구사항:
 * - 탭: 움직임유형 / 움직임테스트 / 심층분석 / 아티클
 * - 현재 라우트 기반 active 표시
 * - 모바일 대응: 가로 스크롤 또는 줄바꿈(레이아웃 깨짐 금지)
 * 
 * 변경 이력:
 * - 2026-02-05: I1 - TopTabs 공용화 + 전역 적용
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface TabItem {
  label: string;
  href: string;
  // 활성화될 경로 패턴 (정확히 일치하거나 시작하는 경로)
  activePatterns?: string[];
}

const TABS: TabItem[] = [
  {
    label: '움직임유형',
    href: '/types',
    activePatterns: ['/types'],
  },
  {
    label: '움직임테스트',
    href: '/',
    activePatterns: ['/', '/test', '/movement-test'],
  },
  {
    label: '심층분석',
    href: '/deep-analysis',
    activePatterns: ['/deep-analysis'],
  },
  {
    label: '아티클',
    href: '/articles',
    activePatterns: ['/articles'],
  },
];

export default function TopTabs() {
  const pathname = usePathname();

  // 현재 경로가 활성화될 탭인지 확인
  const isActive = (tab: TabItem): boolean => {
    if (!tab.activePatterns) {
      return pathname === tab.href;
    }
    return tab.activePatterns.some((pattern) => {
      if (pattern === '/') {
        // 루트 경로는 정확히 일치해야 함
        return pathname === '/';
      }
      return pathname === pattern || pathname.startsWith(pattern + '/');
    });
  };

  return (
    <div className="border-b border-[var(--border)] bg-[var(--surface)]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* 모바일: 가로 스크롤, 데스크톱: 일반 레이아웃 */}
        <nav className="flex gap-1 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [-webkit-scrollbar]:hidden">
          {TABS.map((tab) => {
            const active = isActive(tab);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`
                  relative whitespace-nowrap px-4 py-3 text-sm font-medium transition-colors
                  ${
                    active
                      ? 'text-[var(--brand)]'
                      : 'text-[var(--muted)] hover:text-[var(--text)]'
                  }
                `}
              >
                {tab.label}
                {/* Active 인디케이터 */}
                {active && (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--brand)]"
                    aria-hidden="true"
                  />
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
