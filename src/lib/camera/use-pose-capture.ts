/**
 * 비디오 프레임에서 pose 랜드마크 수집
 * stub extractor 사용 시 대부분 null → insufficient signal
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PoseLandmarks } from '@/lib/motion/pose-types';
import { stubPoseExtractor } from '@/lib/motion/pose-extractor';

const SAMPLE_INTERVAL = 4; // 매 4프레임마다 샘플 (~15fps)

export interface UsePoseCaptureOptions {
  /** pose extractor (기본: stub) */
  extractor?: { extract(video: HTMLVideoElement): Promise<PoseLandmarks | null> };
}

export function usePoseCapture(options: UsePoseCaptureOptions = {}) {
  const extractor = options.extractor ?? stubPoseExtractor;
  const [landmarks, setLandmarks] = useState<PoseLandmarks[]>([]);
  const rafRef = useRef<number | null>(null);
  const frameCountRef = useRef(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const capture = useCallback(
    async (video: HTMLVideoElement) => {
      const result = await extractor.extract(video);
      if (result) {
        setLandmarks((prev) => [...prev.slice(-60), result]);
      }
    },
    [extractor]
  );

  const start = useCallback(
    (video: HTMLVideoElement) => {
      videoRef.current = video;
      frameCountRef.current = 0;
      setLandmarks([]);

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
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    videoRef.current = null;
  }, []);

  useEffect(() => {
    return () => stop();
  }, [stop]);

  return { landmarks, start, stop };
}
