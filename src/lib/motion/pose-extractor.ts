/**
 * Pose 추출 인터페이스
 * stub: 항상 null 반환 (insufficient signal)
 * 실제 MediaPipe 연동 시 이 인터페이스 구현체 교체
 */
import type { PoseLandmarks } from './pose-types';

export interface PoseExtractor {
  extract(video: HTMLVideoElement): Promise<PoseLandmarks | null>;
}

/** stub: pose 미구현 시 insufficient signal */
export const stubPoseExtractor: PoseExtractor = {
  async extract(): Promise<PoseLandmarks | null> {
    return null;
  },
};
