/**
 * /app/home - useSearchParams ?? ? Suspense? ??
 * AbortError / ???? ??
 */

import { Suspense } from 'react';
import HomePageClient from './_components/HomePageClient';
import HomeLoading from './loading';

export default function HomePage() {
  return (
    <Suspense fallback={<HomeLoading />}>
      <HomePageClient />
    </Suspense>
  );
}
