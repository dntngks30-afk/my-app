/**
 * /app/routine - useSearchParams 사용 → Suspense로 감쌈
 * AbortError / 하얀화면 방지
 */

import { Suspense } from 'react';
import RoutineHubClient from './_components/RoutineHubClient';
import RoutineLoading from './loading';

export default function RoutinePage() {
  return (
    <Suspense fallback={<RoutineLoading />}>
      <RoutineHubClient />
    </Suspense>
  );
}
