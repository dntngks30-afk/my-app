'use client';

import ProfileTabContent from '../../_components/ProfileTabContent';

interface MyTabProps {
  isVisible: boolean;
}

/**
 * 마이 탭 — persistent mount.
 * Lazy fetch only when isVisible (first open).
 */
export default function MyTab({ isVisible }: MyTabProps) {
  return <ProfileTabContent hideBottomNav isVisible={isVisible} />;
}
