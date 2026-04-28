/**
 * PR-RESET-BE-03 — reset media 공개 API 표면(route·테스트 진입 단순화).
 */
export {
  validateResetMediaRequestBody,
  resolveResetMediaSelection,
  buildPlaceholderResetMediaResponse,
  buildDisplayFromSelection,
  NOTES_UNMAPPED,
  NOTES_MISSING_TEMPLATE,
  NOTES_MISSING_MEDIA,
} from '@/lib/reset/reset-media-core';

export { buildResetMediaResponseForSelection } from '@/lib/reset/reset-media-fetch';
