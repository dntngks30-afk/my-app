/**
 * 공개 퍼널 챕터 전환 프리셋 (시각 문법만 — 라우트 의미와 무관).
 * 실제 애니메이션은 `globals.css` 의 `.public-chapter-enter-*` 와 동기화한다.
 */

export type PublicChapterVariant = 'default' | 'light' | 'calm';

type Preset = {
  /** 초 단위 */
  duration: number;
  /** px — 과한 이동 금지 */
  y: number;
  /** cubic-bezier */
  ease: [number, number, number, number];
};

export const PUBLIC_CHAPTER_PRESETS: Record<PublicChapterVariant, Preset> = {
  /** 랜딩·인트로·결과 계열 */
  default: {
    duration: 0.32,
    y: 8,
    ease: [0.22, 1, 0.36, 1],
  },
  /** 설문·카메라 등 상호작용 밀도 높은 구간 — 더 짧게 */
  light: {
    duration: 0.22,
    y: 4,
    ease: [0.25, 0.9, 0.3, 1],
  },
  /** 결제 직후 실행 준비 — 차분·프리미엄 */
  calm: {
    duration: 0.38,
    y: 6,
    ease: [0.2, 0.85, 0.35, 1],
  },
};
