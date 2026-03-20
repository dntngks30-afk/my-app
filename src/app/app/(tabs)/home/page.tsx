/**
 * /app/home - FLOW-08 ReadinessEntryGate 통합
 *
 * FLOW-07 canonical readiness를 소비해 사용자를 올바른 next step으로 안내.
 * - claim_result: /movement-test/baseline
 * - complete_onboarding: /onboarding
 * - 그 외(create_session, open_app, blocked): pass-through → HomePageClient
 */

import { Suspense } from 'react';
import HomePageClient from './_components/HomePageClient';
import HomeLoading from './loading';
import ReadinessEntryGate from '@/app/app/_components/ReadinessEntryGate';

export default function HomePage() {
  return (
    <Suspense fallback={<HomeLoading />}>
      <ReadinessEntryGate>
        <HomePageClient />
      </ReadinessEntryGate>
    </Suspense>
  );
}
