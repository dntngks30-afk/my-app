/**
 * PR-ALG-15: Adaptive Explanation Templates
 *
 * Human-readable messages for modifier types.
 * Short, clear, action-oriented. No technical wording.
 */

export type TemplateKey =
  | 'difficulty_reduction'
  | 'difficulty_progression'
  | 'volume_reduction'
  | 'volume_increase'
  | 'protection_mode'
  | 'discomfort_protection'
  | 'neutral';

export type ExplanationTemplate = {
  title: string;
  message: string;
};

export const EXPLANATION_TEMPLATES: Record<Exclude<TemplateKey, 'neutral'>, ExplanationTemplate> = {
  difficulty_reduction: {
    title: '세션 조정',
    message:
      '지난 세션의 난이도가 높았기 때문에\n이번 세션은 난이도를 조금 낮췄습니다.',
  },
  difficulty_progression: {
    title: '세션 조정',
    message:
      '지난 세션을 안정적으로 완료했기 때문에\n이번 세션에서는 조금 더 발전된 동작을 시도합니다.',
  },
  volume_reduction: {
    title: '세션 조정',
    message:
      '세션 수행이 어려웠던 것으로 보여\n운동 볼륨을 약간 줄였습니다.',
  },
  volume_increase: {
    title: '세션 조정',
    message:
      '지난 세션을 잘 소화했기 때문에\n이번 세션은 조금 더 풍부하게 구성했습니다.',
  },
  protection_mode: {
    title: '세션 조정',
    message:
      '몸 상태 변화를 고려해\n다음 세션은 더 안전한 움직임 중심으로 구성했습니다.',
  },
  discomfort_protection: {
    title: '세션 조정',
    message:
      '불편했던 부위를 고려하여\n해당 부위 부담을 줄이는 세션으로 조정했습니다.',
  },
};
