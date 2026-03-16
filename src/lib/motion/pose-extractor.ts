/**
 * Pose 추출 인터페이스
 * 현재 live MediaPipe analyzer는 CameraPreview 내부에서 동작한다.
 * 이 파일은 이전 extractor 기반 흐름과의 호환을 위한 최소 stub만 유지한다.
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
