import type { ReactNode } from 'react';

import { PublicChapterTransition } from '@/components/public/chapter';

export default function OnboardingTemplate({
  children,
}: {
  children: ReactNode;
}) {
  return <PublicChapterTransition variant="calm">{children}</PublicChapterTransition>;
}
