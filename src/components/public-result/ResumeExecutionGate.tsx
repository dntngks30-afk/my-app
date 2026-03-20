'use client';

/**
 * useSearchParams() 사용 시 Next가 요구하는 Suspense 경계용 얇은 래퍼.
 * @see PR-PAY-CONTINUITY-05
 */

import { useResumeExecutionAfterAuth } from '@/lib/public-results/useResumeExecutionAfterAuth';
import type { UseResumeExecutionAfterAuthOptions } from '@/lib/public-results/useResumeExecutionAfterAuth';

export function ResumeExecutionGate(props: UseResumeExecutionAfterAuthOptions) {
  useResumeExecutionAfterAuth(props);
  return null;
}
