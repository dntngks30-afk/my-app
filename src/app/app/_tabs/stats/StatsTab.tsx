'use client';

/**
 * 리셋 탭 — AppShell 에서 노출되는 실경로(`/app/checkin`).
 * Persistent shell 이 tab children(page.tsx)을 렌더하지 않으므로 이 컴포넌트에서
 * ResetTabViewV2 를 직접 마운트한다 (@see `(tabs)/layout.tsx` TabsLayoutInner).
 */

import { ResetTabViewV2 } from '@/app/app/_components/nav-v2/ResetTabViewV2';
import { APP_TAB_BG } from '@/app/app/_components/nav-v2/appTabTheme';

interface StatsTabProps {
  /** AppShell parity — tab panel stays mounted; visibility toggled externally */
  isVisible: boolean;
}

export default function StatsTab({ isVisible }: StatsTabProps) {
  void isVisible;
  return (
    <div className="min-h-screen pb-20" style={{ backgroundColor: APP_TAB_BG }}>
      <ResetTabViewV2 />
    </div>
  );
}
