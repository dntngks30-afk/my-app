/**
 * movement-test (설문·브리지·결과·카메라 등) — 상대적으로 가벼운 전환.
 */
import type { ReactNode } from 'react';

import { PublicChapterTransition } from '@/components/public/chapter';

export default function MovementTestPublicTemplate({
  children,
}: {
  children: ReactNode;
}) {
  return <PublicChapterTransition variant="light">{children}</PublicChapterTransition>;
}
