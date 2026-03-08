'use client';

import StatsTabContent from '../../_components/StatsTabContent';

interface StatsTabProps {
  isVisible: boolean;
}

/**
 * 통계(여정) 탭 — persistent mount.
 * Lazy fetch only when isVisible (first open).
 */
export default function StatsTab({ isVisible }: StatsTabProps) {
  return <StatsTabContent hideBottomNav isVisible={isVisible} />;
}
