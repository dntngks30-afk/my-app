/**
 * intro 패밀리 — 동일 브랜드 챕터 문법.
 */
import type { ReactNode } from 'react';

import { PublicChapterTransition } from '@/components/public/chapter';

export default function IntroPublicTemplate({
  children,
}: {
  children: ReactNode;
}) {
  return <PublicChapterTransition variant="default">{children}</PublicChapterTransition>;
}
