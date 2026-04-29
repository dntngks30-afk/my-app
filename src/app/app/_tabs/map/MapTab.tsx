'use client';

import HomePageClient from '../../(tabs)/home/_components/HomePageClient';

type MapTabProps = {
  isVisible: boolean;
};

/**
 * 지도 탭 — Reset Map / Session Map.
 * Persistent mount; visibility controlled by AppShell.
 */
export default function MapTab({ isVisible }: MapTabProps) {
  return <HomePageClient hideBottomNav isVisible={isVisible} />;
}
