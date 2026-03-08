'use client';

import HomePageClient from '../../(tabs)/home/_components/HomePageClient';

/**
 * 지도 탭 — Reset Map / Session Map.
 * Persistent mount; visibility controlled by AppShell.
 */
export default function MapTab() {
  return <HomePageClient hideBottomNav />;
}
