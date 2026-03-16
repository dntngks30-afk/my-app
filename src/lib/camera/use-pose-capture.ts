/**
 * preview에서 전달받은 PoseFrame을 evaluator 입력용으로 축적
 * analyzer lifecycle은 CameraPreview가 맡고, 이 hook은 capture session만 관리한다.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getPoseFrameLandmarkCount,
  getPoseFrameVisibleRatio,
  isValidPoseFrame,
  toPoseLandmarks,
  type PoseFrame,
  type PoseLandmarks,
} from '@/lib/motion/pose-types';

const MAX_CAPTURED_FRAMES = 180; // 약 10~12초 분량 보존
const TIMESTAMP_GAP_MS = 600;

export interface PoseCaptureStats {
  sampledFrameCount: number;
  droppedFrameCount: number;
  captureDurationMs: number;
  validFrameCount: number;
  averageLandmarkCount: number;
  averageVisibleLandmarkRatio: number;
  timestampDiscontinuityCount: number;
}

const EMPTY_STATS: PoseCaptureStats = {
  sampledFrameCount: 0,
  droppedFrameCount: 0,
  captureDurationMs: 0,
  validFrameCount: 0,
  averageLandmarkCount: 0,
  averageVisibleLandmarkRatio: 0,
  timestampDiscontinuityCount: 0,
};

export function usePoseCapture() {
  const [landmarks, setLandmarks] = useState<PoseLandmarks[]>([]);
  const [stats, setStats] = useState<PoseCaptureStats>(EMPTY_STATS);
  const sampledFrameCountRef = useRef(0);
  const droppedFrameCountRef = useRef(0);
  const validFrameCountRef = useRef(0);
  const landmarkCountTotalRef = useRef(0);
  const visibleRatioTotalRef = useRef(0);
  const timestampDiscontinuityCountRef = useRef(0);
  const lastTimestampMsRef = useRef<number | null>(null);
  const captureStartedAtRef = useRef<number | null>(null);

  const syncStats = useCallback((durationMs?: number) => {
    setStats({
      sampledFrameCount: sampledFrameCountRef.current,
      droppedFrameCount: droppedFrameCountRef.current,
      captureDurationMs:
        durationMs ?? (captureStartedAtRef.current ? performance.now() - captureStartedAtRef.current : 0),
      validFrameCount: validFrameCountRef.current,
      averageLandmarkCount:
        validFrameCountRef.current > 0 ? landmarkCountTotalRef.current / validFrameCountRef.current : 0,
      averageVisibleLandmarkRatio:
        validFrameCountRef.current > 0 ? visibleRatioTotalRef.current / validFrameCountRef.current : 0,
      timestampDiscontinuityCount: timestampDiscontinuityCountRef.current,
    });
  }, []);

  const pushFrame = useCallback((frame: PoseFrame) => {
    sampledFrameCountRef.current += 1;

    if (lastTimestampMsRef.current !== null && frame.timestampMs - lastTimestampMsRef.current > TIMESTAMP_GAP_MS) {
      timestampDiscontinuityCountRef.current += 1;
    }
    lastTimestampMsRef.current = frame.timestampMs;

    const adaptedFrame = toPoseLandmarks(frame);
    if (!adaptedFrame || !isValidPoseFrame(frame)) {
      droppedFrameCountRef.current += 1;
      syncStats();
      return;
    }

    validFrameCountRef.current += 1;
    landmarkCountTotalRef.current += getPoseFrameLandmarkCount(frame);
    visibleRatioTotalRef.current += getPoseFrameVisibleRatio(frame);

    setLandmarks((prev) => [...prev.slice(-(MAX_CAPTURED_FRAMES - 1)), adaptedFrame]);
    syncStats();
  }, [syncStats]);

  const start = useCallback(
    (_video?: HTMLVideoElement) => {
      sampledFrameCountRef.current = 0;
      droppedFrameCountRef.current = 0;
      validFrameCountRef.current = 0;
      landmarkCountTotalRef.current = 0;
      visibleRatioTotalRef.current = 0;
      timestampDiscontinuityCountRef.current = 0;
      lastTimestampMsRef.current = null;
      captureStartedAtRef.current = performance.now();
      setLandmarks([]);
      setStats(EMPTY_STATS);
    },
    []
  );

  const stop = useCallback(() => {
    const durationMs = captureStartedAtRef.current
      ? Math.max(0, performance.now() - captureStartedAtRef.current)
      : 0;
    syncStats(durationMs);
  }, [syncStats]);

  useEffect(() => {
    return () => stop();
  }, [stop]);

  return { landmarks, stats, start, stop, pushFrame };
}
