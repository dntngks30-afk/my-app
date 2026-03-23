import type { PublicChapterVariant } from './presets';

/** globals.css 의 `.public-chapter-enter-*` 와 동기화 */
const MAP: Record<PublicChapterVariant, string> = {
  default: 'public-chapter-enter-default',
  light: 'public-chapter-enter-light',
  calm: 'public-chapter-enter-calm',
};

export function publicChapterEnterClass(variant: PublicChapterVariant): string {
  return MAP[variant];
}
