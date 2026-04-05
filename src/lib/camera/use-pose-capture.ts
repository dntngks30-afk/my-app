/**
 * preview에서 전달받은 PoseFrame을 evaluator 입력용으로 축적
 * analyzer lifecycle은 CameraPreview가 맡고, 이 hook은 capture session만 관리한다.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getPoseFrameQuality,
  getOverheadPoseFrameQuality,
  getPoseFrameLandmarkCount,
  getPoseFrameVisibleRatio,
  isValidPoseFrame,
  toPoseLandmarks,
  type PoseFrame,
  type PoseLandmarks,
} from '@/lib/motion/pose-types';
import { ingestPoseFrameCameraObservability, resetPoseCameraObservabilityBuffer } from '@/lib/camera/camera-observability-pose-bridge';
import { resetSquatCameraObservabilitySession } from '@/lib/camera/camera-observability-squat-session';

const MAX_CAPTURED_FRAMES = 180; // 약 10~12초 분량 보존
const TIMESTAMP_GAP_MS = 600;
const STATS_SYNC_INTERVAL_MS = 120;

export interface PoseCaptureStats {
  sampledFrameCount: number;
  droppedFrameCount: number;
  filteredLowQualityFrameCount: number;
  unstableFrameCount: number;
  captureDurationMs: number;
  validFrameCount: number;
  averageLandmarkCount: number;
  averageVisibleLandmarkRatio: number;
  timestampDiscontinuityCount: number;
  /**
   * OBS: hook-level rejection tallies (overhead input-truth export).
   * Optional so legacy/partial stats objects (e.g. idle placeholders) stay valid.
   * Per-frame multi-reason drops may increment several counters for one droppedFrameCount.
   */
  landmarkOrAdaptorFailedFrameCount?: number;
  hookRejectLowVisibilityFrameCount?: number;
  hookRejectCoreJointsMissingFrameCount?: number;
  hookRejectBodyBoxInvalidFrameCount?: number;
  /**
   * OBS: compact measured-value echo from the first hook-level rejection that involved
   * core_joints_missing or body_box_invalid.
   * null when no such rejection has occurred this session.
   */
  hookFirstRejectionSample?: PoseHookFirstRejectionSample | null;
  /**
   * OBS: diagnostic for the first landmark/adaptor failure (pre-quality-object path).
   * Provides truthful scalar context without inventing quality measurements.
   * null when no such failure has occurred this session.
   */
  hookFirstAdaptorFailureDiag?: PoseHookAdaptorFailureDiag | null;
  /**
   * OBS: which hook quality mode is active for this capture session.
   * 'overhead-reach' uses OVERHEAD_HOOK_QUALITY_THRESHOLDS; 'default' uses HOOK_QUALITY_THRESHOLDS.
   */
  hookQualityMode?: 'default' | 'overhead-reach';
}

/** OBS: compact measured values from the first qualifying hook-level rejection frame */
export interface PoseHookFirstRejectionSample {
  coreVisibilityRatio: number;
  bodyBoxArea: number;
  bodyBoxWidth: number;
  bodyBoxHeight: number;
}

/** OBS: truthful pre-quality diagnostic for landmark/adaptor failure path */
export interface PoseHookAdaptorFailureDiag {
  rawLandmarkCount: number;
  toPoseLandmarksNull: boolean;
}

/** OH-INPUT-01: options for scoped hook quality mode */
export interface UsePoseCaptureOptions {
  /** 'overhead-reach' routes pushFrame through overhead-scoped quality profile */
  mode?: 'default' | 'overhead-reach';
}

const EMPTY_STATS: PoseCaptureStats = {
  sampledFrameCount: 0,
  droppedFrameCount: 0,
  filteredLowQualityFrameCount: 0,
  unstableFrameCount: 0,
  captureDurationMs: 0,
  validFrameCount: 0,
  averageLandmarkCount: 0,
  averageVisibleLandmarkRatio: 0,
  timestampDiscontinuityCount: 0,
  landmarkOrAdaptorFailedFrameCount: 0,
  hookRejectLowVisibilityFrameCount: 0,
  hookRejectCoreJointsMissingFrameCount: 0,
  hookRejectBodyBoxInvalidFrameCount: 0,
  hookFirstRejectionSample: null,
  hookFirstAdaptorFailureDiag: null,
  hookQualityMode: 'default',
};

export function usePoseCapture(options?: UsePoseCaptureOptions) {
  const mode = options?.mode ?? 'default';
  const resolveQuality = mode === 'overhead-reach' ? getOverheadPoseFrameQuality : getPoseFrameQuality;
  const [landmarks, setLandmarks] = useState<PoseLandmarks[]>([]);
  const [stats, setStats] = useState<PoseCaptureStats>(EMPTY_STATS);
  const sampledFrameCountRef = useRef(0);
  const droppedFrameCountRef = useRef(0);
  const filteredLowQualityFrameCountRef = useRef(0);
  const landmarkOrAdaptorFailedFrameCountRef = useRef(0);
  const hookRejectLowVisibilityFrameCountRef = useRef(0);
  const hookRejectCoreJointsMissingFrameCountRef = useRef(0);
  const hookRejectBodyBoxInvalidFrameCountRef = useRef(0);
  const unstableFrameCountRef = useRef(0);
  const validFrameCountRef = useRef(0);
  const hookFirstRejectionSampleRef = useRef<PoseHookFirstRejectionSample | null>(null);
  const hookFirstAdaptorFailureDiagRef = useRef<PoseHookAdaptorFailureDiag | null>(null);
  const landmarkCountTotalRef = useRef(0);
  const visibleRatioTotalRef = useRef(0);
  const timestampDiscontinuityCountRef = useRef(0);
  const lastTimestampMsRef = useRef<number | null>(null);
  const captureStartedAtRef = useRef<number | null>(null);
  const lastAcceptedFrameRef = useRef<PoseFrame | null>(null);
  const lastStatsSyncedAtRef = useRef(0);

  const syncStats = useCallback((durationMs?: number, force = false) => {
    const now = performance.now();
    if (!force && now - lastStatsSyncedAtRef.current < STATS_SYNC_INTERVAL_MS) {
      return;
    }
    lastStatsSyncedAtRef.current = now;

    setStats((prev) => {
      const nextStats = {
      sampledFrameCount: sampledFrameCountRef.current,
      droppedFrameCount: droppedFrameCountRef.current,
      filteredLowQualityFrameCount: filteredLowQualityFrameCountRef.current,
      unstableFrameCount: unstableFrameCountRef.current,
      captureDurationMs:
        durationMs ?? (captureStartedAtRef.current ? performance.now() - captureStartedAtRef.current : 0),
      validFrameCount: validFrameCountRef.current,
      averageLandmarkCount:
        validFrameCountRef.current > 0 ? landmarkCountTotalRef.current / validFrameCountRef.current : 0,
      averageVisibleLandmarkRatio:
        validFrameCountRef.current > 0 ? visibleRatioTotalRef.current / validFrameCountRef.current : 0,
      timestampDiscontinuityCount: timestampDiscontinuityCountRef.current,
      landmarkOrAdaptorFailedFrameCount: landmarkOrAdaptorFailedFrameCountRef.current,
      hookRejectLowVisibilityFrameCount: hookRejectLowVisibilityFrameCountRef.current,
      hookRejectCoreJointsMissingFrameCount: hookRejectCoreJointsMissingFrameCountRef.current,
      hookRejectBodyBoxInvalidFrameCount: hookRejectBodyBoxInvalidFrameCountRef.current,
      hookFirstRejectionSample: hookFirstRejectionSampleRef.current,
      hookFirstAdaptorFailureDiag: hookFirstAdaptorFailureDiagRef.current,
      hookQualityMode: mode,
      };

      return JSON.stringify(prev) === JSON.stringify(nextStats) ? prev : nextStats;
    });
  }, []);

  const pushFrame = useCallback((frame: PoseFrame) => {
    sampledFrameCountRef.current += 1;

    if (lastTimestampMsRef.current !== null && frame.timestampMs - lastTimestampMsRef.current > TIMESTAMP_GAP_MS) {
      timestampDiscontinuityCountRef.current += 1;
    }
    lastTimestampMsRef.current = frame.timestampMs;

    ingestPoseFrameCameraObservability(frame);

    const adaptedFrame = toPoseLandmarks(frame);
    if (!adaptedFrame || !isValidPoseFrame(frame)) {
      droppedFrameCountRef.current += 1;
      landmarkOrAdaptorFailedFrameCountRef.current += 1;
      if (hookFirstAdaptorFailureDiagRef.current === null) {
        hookFirstAdaptorFailureDiagRef.current = {
          rawLandmarkCount: getPoseFrameLandmarkCount(frame),
          toPoseLandmarksNull: adaptedFrame === null,
        };
      }
      syncStats();
      return;
    }

    const quality = resolveQuality(frame, lastAcceptedFrameRef.current);
    if (!quality.usable) {
      droppedFrameCountRef.current += 1;
      for (const reason of quality.reasons) {
        if (reason === 'low_visibility') hookRejectLowVisibilityFrameCountRef.current += 1;
        if (reason === 'core_joints_missing') hookRejectCoreJointsMissingFrameCountRef.current += 1;
        if (reason === 'body_box_invalid') hookRejectBodyBoxInvalidFrameCountRef.current += 1;
        if (reason === 'unstable_frame') unstableFrameCountRef.current += 1;
      }
      if (quality.reasons.some((reason) => reason === 'low_visibility' || reason === 'core_joints_missing' || reason === 'body_box_invalid')) {
        filteredLowQualityFrameCountRef.current += 1;
      }
      if (
        hookFirstRejectionSampleRef.current === null &&
        (quality.reasons.includes('core_joints_missing') || quality.reasons.includes('body_box_invalid'))
      ) {
        hookFirstRejectionSampleRef.current = {
          coreVisibilityRatio: quality.coreVisibilityRatio,
          bodyBoxArea: quality.bodyBox.area,
          bodyBoxWidth: quality.bodyBox.width,
          bodyBoxHeight: quality.bodyBox.height,
        };
      }
      syncStats();
      return;
    }

    if (quality.reasons.includes('unstable_frame')) {
      unstableFrameCountRef.current += 1;
    }

    validFrameCountRef.current += 1;
    landmarkCountTotalRef.current += getPoseFrameLandmarkCount(frame);
    visibleRatioTotalRef.current += getPoseFrameVisibleRatio(frame);
    lastAcceptedFrameRef.current = frame;

    setLandmarks((prev) => [...prev.slice(-(MAX_CAPTURED_FRAMES - 1)), adaptedFrame]);
    syncStats();
  }, [syncStats]);

  const start = useCallback(
    (_video?: HTMLVideoElement) => {
      resetPoseCameraObservabilityBuffer();
      resetSquatCameraObservabilitySession();
      sampledFrameCountRef.current = 0;
      droppedFrameCountRef.current = 0;
      filteredLowQualityFrameCountRef.current = 0;
      landmarkOrAdaptorFailedFrameCountRef.current = 0;
      hookRejectLowVisibilityFrameCountRef.current = 0;
      hookRejectCoreJointsMissingFrameCountRef.current = 0;
      hookRejectBodyBoxInvalidFrameCountRef.current = 0;
      unstableFrameCountRef.current = 0;
      validFrameCountRef.current = 0;
      hookFirstRejectionSampleRef.current = null;
      hookFirstAdaptorFailureDiagRef.current = null;
      landmarkCountTotalRef.current = 0;
      visibleRatioTotalRef.current = 0;
      timestampDiscontinuityCountRef.current = 0;
      lastTimestampMsRef.current = null;
      lastAcceptedFrameRef.current = null;
      lastStatsSyncedAtRef.current = 0;
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
    syncStats(durationMs, true);
  }, [syncStats]);

  useEffect(() => {
    return () => stop();
  }, [stop]);

  return { landmarks, stats, start, stop, pushFrame };
}
