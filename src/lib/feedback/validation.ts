import type { FeedbackCategory } from './types';

export const MIN_FEEDBACK_LENGTH = 5;
export const MAX_FEEDBACK_LENGTH = 2000;

export const ALLOWED_FEEDBACK_CATEGORIES = new Set<FeedbackCategory>([
  'general',
  'bug',
  'question',
  'improvement',
]);

export function sanitizeFeedbackCategory(value: unknown): FeedbackCategory {
  if (typeof value !== 'string') return 'general';
  const trimmed = value.trim();
  return ALLOWED_FEEDBACK_CATEGORIES.has(trimmed as FeedbackCategory)
    ? (trimmed as FeedbackCategory)
    : 'general';
}

export function sanitizeFeedbackMessage(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
