/**
 * Journey 요약 — movement + recent_7d 결합.
 */

import { getJourneyMovementType } from '@/lib/journey/getJourneyMovementType';
import { getRecentJourneyPerformance } from '@/lib/journey/getRecentJourneyPerformance';
import type { JourneySummaryResponse } from '@/lib/journey/types';

export async function getJourneySummary(userId: string): Promise<JourneySummaryResponse> {
  const [movement_type, recent_7d] = await Promise.all([
    getJourneyMovementType(userId),
    getRecentJourneyPerformance(userId),
  ]);

  return { movement_type, recent_7d };
}
