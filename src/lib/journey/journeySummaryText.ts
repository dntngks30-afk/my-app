/**
 * Journey 최근 7일 요약 한 줄 (순수 규칙).
 */

import type { JourneyRecent7dBlock } from '@/lib/journey/types';

export type SummaryInput = Pick<
  JourneyRecent7dBlock,
  'completed_count' | 'target_frequency'
> & {
  difficultyLabel: string;
  qualityLabel: string;
};

export function buildJourneyRecent7dSummary(input: SummaryInput): string {
  const { completed_count, target_frequency, difficultyLabel, qualityLabel } = input;

  if (completed_count === 0) {
    return '아직 최근 운동 기록이 부족해요. 첫 세션을 완료하면 여기에 상태가 쌓여요.';
  }
  if (difficultyLabel === '어려운 편') {
    return '최근 기록을 보면 현재 세션이 조금 어렵게 느껴질 수 있어요.';
  }
  if (qualityLabel === '주의 필요') {
    return '최근 기록에서 불편감 신호가 있어 다음 세션은 무리하지 않는 게 좋아요.';
  }
  if (completed_count >= target_frequency) {
    return '최근 7일 기준 목표 빈도를 잘 채우고 있어요.';
  }
  return '최근 기록을 보면 현재 세션 난이도는 대체로 잘 맞고 있어요.';
}
