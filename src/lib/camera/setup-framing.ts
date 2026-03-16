/**
 * Setup 단계 전용 framing hint
 * - 동작 분석 없음, framing/visibility만 사용
 */
import type { PoseLandmarks } from '@/lib/motion/pose-types';
import { buildPoseFeaturesFrames } from './pose-features';

const RECENT_FRAME_COUNT = 8;
const AREA_TOO_LARGE = 0.5;
const AREA_TOO_SMALL = 0.05;
const VISIBILITY_LOW = 0.4;

/**
 * 최근 landmarks로 framing suitability hint 반환
 * 실패 시 null (graceful fallback)
 */
export function getSetupFramingHint(landmarks: PoseLandmarks[]): string | null {
  if (!landmarks || landmarks.length < 5) return null;
  try {
    const frames = buildPoseFeaturesFrames('squat', landmarks);
    const recent = frames.slice(-RECENT_FRAME_COUNT);
    if (recent.length === 0) return null;

    const areas = recent.map((f) => f.bodyBox.area).filter((a) => a > 0);
    const visibilities = recent.map((f) => f.visibilitySummary.visibleLandmarkRatio);
    const meanArea = areas.length > 0 ? areas.reduce((s, a) => s + a, 0) / areas.length : 0;
    const meanVis = visibilities.length > 0 ? visibilities.reduce((s, v) => s + v, 0) / visibilities.length : 0;

    if (meanVis < VISIBILITY_LOW) return '화면이 너무 어두워요';
    if (meanArea > AREA_TOO_LARGE) return '조금 뒤로 가 주세요';
    if (meanArea > 0 && meanArea < AREA_TOO_SMALL) return '머리부터 발끝까지 보이게 해주세요';
    return null;
  } catch {
    return null;
  }
}
