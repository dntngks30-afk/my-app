/**
 * Setup 단계 전용 framing hint
 * - 동작 분석 없음, framing/visibility만 사용
 */
import type { PoseLandmarks } from '@/lib/motion/pose-types';
import type { PoseFeaturesFrame } from './pose-features';
import { buildPoseFeaturesFrames } from './pose-features';

const RECENT_FRAME_COUNT = 8;
const AREA_TOO_LARGE = 0.5;
const AREA_TOO_SMALL = 0.05;
const VISIBILITY_LOW = 0.4;
/** guardrail selected window 내 최소 샘플 수 (setup 과 동일한 하한) */
const MIN_LANDMARKS_IN_EVAL_WINDOW = 5;

function computeFramingHintFromFeatureFrames(frames: PoseFeaturesFrame[]): string | null {
  if (frames.length === 0) return null;

  const areas = frames.map((f) => f.bodyBox.area).filter((a) => a > 0);
  const visibilities = frames.map((f) => f.visibilitySummary.visibleLandmarkRatio);
  const meanArea = areas.length > 0 ? areas.reduce((s, a) => s + a, 0) / areas.length : 0;
  const meanVis = visibilities.length > 0 ? visibilities.reduce((s, v) => s + v, 0) / visibilities.length : 0;

  if (meanVis < VISIBILITY_LOW) return '화면이 너무 어두워요';
  if (meanArea > AREA_TOO_LARGE) return '조금 뒤로 가 주세요';
  if (meanArea > 0 && meanArea < AREA_TOO_SMALL) return '머리부터 발끝까지 보이게 해주세요';
  return null;
}

/**
 * 최근 landmarks로 framing suitability hint 반환
 * 실패 시 null (graceful fallback)
 */
export function getSetupFramingHint(landmarks: PoseLandmarks[]): string | null {
  if (!landmarks || landmarks.length < 5) return null;
  try {
    const frames = buildPoseFeaturesFrames('squat', landmarks);
    const recent = frames.slice(-RECENT_FRAME_COUNT);
    return computeFramingHintFromFeatureFrames(recent);
  } catch {
    return null;
  }
}

export type OverheadReadinessFramingHintSource = 'evaluation_window' | 'recent_tail_fallback';

export interface OverheadReadinessFramingHintResult {
  framingHint: string | null;
  source: OverheadReadinessFramingHintSource;
}

/**
 * 오버헤드 readiness blocker용 framing hint: guardrail 품질 선택 창과 동일한 시간 구간의 랜드마크만 사용.
 * 버퍼 꼬리(동작 후 폰으로 접근 등) 오염으로 primary blocker가 덮이지 않게 한다.
 * 창/타임스탬프 불충분 시 {@link getSetupFramingHint} 로 폴백한다.
 */
export function resolveOverheadReadinessFramingHint(args: {
  landmarks: PoseLandmarks[];
  windowStartMs: number | null | undefined;
  windowEndMs: number | null | undefined;
}): OverheadReadinessFramingHintResult {
  const { landmarks, windowStartMs, windowEndMs } = args;
  const tailFallback = (): OverheadReadinessFramingHintResult => ({
    framingHint: getSetupFramingHint(landmarks),
    source: 'recent_tail_fallback',
  });

  if (!landmarks || landmarks.length < 1) {
    return { framingHint: null, source: 'recent_tail_fallback' };
  }

  const hasWindow =
    typeof windowStartMs === 'number' &&
    Number.isFinite(windowStartMs) &&
    typeof windowEndMs === 'number' &&
    Number.isFinite(windowEndMs) &&
    windowEndMs >= windowStartMs;

  if (!hasWindow) {
    return tailFallback();
  }

  const inWindow = landmarks.filter((lm) => {
    const t = lm.timestamp;
    if (typeof t !== 'number' || !Number.isFinite(t)) return false;
    return t >= windowStartMs && t <= windowEndMs;
  });

  if (inWindow.length < MIN_LANDMARKS_IN_EVAL_WINDOW) {
    return tailFallback();
  }

  try {
    const frames = buildPoseFeaturesFrames('overhead-reach', inWindow);
    if (frames.length === 0) {
      return tailFallback();
    }
    const recentInWindow = frames.slice(-RECENT_FRAME_COUNT);
    return {
      framingHint: computeFramingHintFromFeatureFrames(recentInWindow),
      source: 'evaluation_window',
    };
  } catch {
    return tailFallback();
  }
}
