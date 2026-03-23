import type { PublicChapterVariant } from './presets';

/** globals.css 의 `.public-chapter-content-*` 와 동기화 */
const MAP: Record<PublicChapterVariant, string> = {
  default: 'public-chapter-content-default',
  light: 'public-chapter-content-light',
  calm: 'public-chapter-content-calm',
  minimal: 'public-chapter-content-minimal',
};

/** 콘텐츠 컬럼/슬롯에만 부착 — 전체 씬 래퍼에 쓰지 말 것 */
export function publicChapterContentClass(variant: PublicChapterVariant): string {
  return MAP[variant];
}
