/**
 * 비디오 프레임에서 pose 랜드마크 수집
 * stub extractor 사용 시 대부분 null → insufficient signal
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PoseLandmarks } from '@/lib/motion/pose-types';
import { stubPoseExtractor } from '@/lib/motion/pose-extractor';

const SAMPLE_INTERVAL = 4; // 매 4프레임마다 샘플 (~15fps)
const MAX_CAPTURED_FRAMES = 180; // 약 10~12초 분량 보존

export interface UsePoseCaptureOptions {
  /** pose extractor (기본: stub) */
  extractor?: { extract(video: HTMLVideoElement): Promise<PoseLandmarks | null> };
}

export interface PoseCaptureStats {
  sampledFrameCount: number;
  droppedFrameCount: number;
  captureDurationMs: number;
}

const EMPTY_STATS: PoseCaptureStats = {
  sampledFrameCount: 0,
  droppedFrameCount: 0,
  captureDurationMs: 0,
};

export function usePoseCapture(options: UsePoseCaptureOptions = {}) {
  const extractor = options.extractor ?? stubPoseExtractor;
  const [landmarks, setLandmarks] = useState<PoseLandmarks[]>([]);
  const [stats, setStats] = useState<PoseCaptureStats>(EMPTY_STATS);
  const rafRef = useRef<number | null>(null);
  const frameCountRef = useRef(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const sampledFrameCountRef = useRef(0);
  const droppedFrameCountRef = useRef(0);
  const captureStartedAtRef = useRef<number | null>(null);

  const syncStats = useCallback((durationMs?: number) => {
    setStats({
      sampledFrameCount: sampledFrameCountRef.current,
      droppedFrameCount: droppedFrameCountRef.current,
      captureDurationMs:
        durationMs ?? (captureStartedAtRef.current ? performance.now() - captureStartedAtRef.current : 0),
    });
  }, []);

  const capture = useCallback(
    async (video: HTMLVideoElement) => {
      sampledFrameCountRef.current += 1;
      const result = await extractor.extract(video);
      if (result) {
        setLandmarks((prev) => [...prev.slice(-(MAX_CAPTURED_FRAMES - 1)), result]);
      } else {
        droppedFrameCountRef.current += 1;
      }
      syncStats();
    },
    [extractor, syncStats]
  );

  const start = useCallback(
    (video: HTMLVideoElement) => {
      videoRef.current = video;
      frameCountRef.current = 0;
      sampledFrameCountRef.current = 0;
      droppedFrameCountRef.current = 0;
      captureStartedAtRef.current = performance.now();
      setLandmarks([]);
      setStats(EMPTY_STATS);

      const loop = () => {
        const v = videoRef.current;
        if (!v || v.readyState < 2) {
          rafRef.current = requestAnimationFrame(loop);
          return;
        }
        frameCountRef.current += 1;
        if (frameCountRef.current % SAMPLE_INTERVAL === 0) {
          capture(v);
        }
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    },
    [capture]
  );

  const stop = useCallback(() => {
    const durationMs = captureStartedAtRef.current
      ? Math.max(0, performance.now() - captureStartedAtRef.current)
      : 0;
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    videoRef.current = null;
    syncStats(durationMs);
  }, [syncStats]);

  useEffect(() => {
    return () => stop();
  }, [stop]);

  return { landmarks, stats, start, stop };
}
