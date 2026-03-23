/**
 * 서버/클라이언트 공통으로 쓸 수 있는 순수 분기 (장식 모션 여부).
 * 클라이언트 훅 없이 테스트하거나 문서화할 때 사용한다.
 */
export type DecorativeMotionInput = {
  /** `usePublicReducedMotion` 결과; null 이면 보수적으로 정지 */
  reducedMotion: boolean | null;
  /** Network Information API `saveData` */
  saveData?: boolean;
  /** 스토리보드/디버그용 강제 정지 */
  forceStatic?: boolean;
};

export function shouldPlayPublicDecorativeMotion(input: DecorativeMotionInput): boolean {
  if (input.forceStatic) return false;
  if (input.reducedMotion !== false) return false;
  if (input.saveData) return false;
  return true;
}
