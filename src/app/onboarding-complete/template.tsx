import type { ReactNode } from 'react';

import { PublicChapterTransition } from '@/components/public/chapter';

export default function OnboardingCompleteTemplate({
  children,
}: {
  children: ReactNode;
}) {
  return <PublicChapterTransition variant="calm">{children}</PublicChapterTransition>;
}
