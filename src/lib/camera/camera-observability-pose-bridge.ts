/**
 * CAM-OBS: 최근 PoseFrame의 runtime/pose_quality 를 trace/observation 이 읽을 수 있게 버퍼링.
 * 캡처 루프 cadence·판정 로직은 변경하지 않는다.
 */
import type { CameraPoseFrameObservability, PoseFrame } from '@/lib/motion/pose-types';

let lastObs: CameraPoseFrameObservability | null = null;

export function ingestPoseFrameCameraObservability(frame: PoseFrame): void {
  if (frame.cameraObservability == null) return;
  lastObs = frame.cameraObservability;
}

export function peekLastPoseCameraObservability(): CameraPoseFrameObservability | null {
  return lastObs;
}

export function resetPoseCameraObservabilityBuffer(): void {
  lastObs = null;
}
