import type { FeedbackCategory, FeedbackStatus } from './types';

export const FEEDBACK_CATEGORY_LABEL_KO: Record<FeedbackCategory, string> = {
  general: '일반',
  bug: '오류',
  question: '질문',
  improvement: '개선 제안',
};

export const FEEDBACK_STATUS_LABEL_KO: Record<FeedbackStatus, string> = {
  new: '새 피드백',
  reviewing: '확인 중',
  resolved: '처리 완료',
  archived: '보관',
};
