/**
 * Public funnel 전용 미디어 포맷 규칙 (실행 코어와 분리).
 * WebM/VP9 우선, 정적 이미지는 WebP 우선 — 용량·디코딩 균형을 맞추기 위한 기본 순서다.
 */

/** 비디오 `<source type>` 에 쓸 MIME (브라우저가 순서대로 선택) */
export const PUBLIC_VIDEO_SOURCE_TYPES = {
  webm: 'video/webm',
  mp4: 'video/mp4',
} as const;

export type PublicVideoSourceMap = {
  /** WebM (VP9 등) — 1순위 */
  webm?: string;
  /** H.264 MP4 — 폴백 */
  mp4?: string;
};

/**
 * WebM → MP4 순으로 `<source>` 목록을 만든다. 빈 배열이면 호출부에서 비디오를 렌더하지 않는다.
 */
export function buildOrderedPublicVideoSources(
  input: PublicVideoSourceMap
): Array<{ src: string; type: string }> {
  const out: Array<{ src: string; type: string }> = [];
  if (input.webm) {
    out.push({ src: input.webm, type: PUBLIC_VIDEO_SOURCE_TYPES.webm });
  }
  if (input.mp4) {
    out.push({ src: input.mp4, type: PUBLIC_VIDEO_SOURCE_TYPES.mp4 });
  }
  return out;
}

export type PublicStillSourceMap = {
  /** WebP — 1순위 */
  webp?: string;
  png?: string;
  jpg?: string;
  jpeg?: string;
};

/**
 * 단일 URL만 필요할 때 WebP → PNG → JPEG 순으로 첫 번째를 고른다.
 */
export function pickPreferredPublicStillUrl(sources: PublicStillSourceMap): string | undefined {
  return sources.webp ?? sources.png ?? sources.jpg ?? sources.jpeg;
}
