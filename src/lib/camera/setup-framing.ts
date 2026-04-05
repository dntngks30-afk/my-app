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

/**
 * PR-OH-CAPTURE-PROTOCOL-CONTRACT-05B
 * 오버헤드 촬영 계약 보조 문구(UX 전용). readiness·게이트·훅 임계값과 연결하지 않는다.
 * 페이지·가이드에서 기존 framing 힌트와 함께 노출할 때 사용.
 */
export const OVERHEAD_CAPTURE_PROTOCOL_SOFT_REMINDERS: readonly string[] = [
  '팔을 끝까지 올릴 때 손목이 잘리지 않게 조금 떨어져 서 주세요',
  '맨 위에서 얼굴·머리와 양 손목이 화면에 함께 보이게 해 주세요',
];

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
  /**
   * PR-OH-OBS-BLOCKER-TRACE-02C: 선택 창 기반 힌트만(꼬리 폴백 없음).
   * `evaluationWindowApplied === false` 이면 의미 없음(null).
   */
  evaluationWindowFramingHintOnly: string | null;
  /** true = framingHint 가 in-window feature 경로에서 나옴(힌트 문자열은 null 일 수 있음). */
  evaluationWindowApplied: boolean;
}

/**
 * guardrail selected window 구간만으로 framing hint 계산. 실패 시 applied=false.
 * 진단 전용 — 제품 경로는 {@link resolveOverheadReadinessFramingHint} 사용.
 */
export function computeOverheadEvaluationWindowFramingOnly(args: {
  landmarks: PoseLandmarks[];
  windowStartMs: number | null | undefined;
  windowEndMs: number | null | undefined;
}): { applied: boolean; hint: string | null } {
  const { landmarks, windowStartMs, windowEndMs } = args;
  if (!landmarks || landmarks.length < 1) {
    return { applied: false, hint: null };
  }

  const hasWindow =
    typeof windowStartMs === 'number' &&
    Number.isFinite(windowStartMs) &&
    typeof windowEndMs === 'number' &&
    Number.isFinite(windowEndMs) &&
    windowEndMs >= windowStartMs;

  if (!hasWindow) {
    return { applied: false, hint: null };
  }

  const inWindow = landmarks.filter((lm) => {
    const t = lm.timestamp;
    if (typeof t !== 'number' || !Number.isFinite(t)) return false;
    return t >= windowStartMs && t <= windowEndMs;
  });

  if (inWindow.length < MIN_LANDMARKS_IN_EVAL_WINDOW) {
    return { applied: false, hint: null };
  }

  try {
    const frames = buildPoseFeaturesFrames('overhead-reach', inWindow);
    if (frames.length === 0) {
      return { applied: false, hint: null };
    }
    const recentInWindow = frames.slice(-RECENT_FRAME_COUNT);
    return {
      applied: true,
      hint: computeFramingHintFromFeatureFrames(recentInWindow),
    };
  } catch {
    return { applied: false, hint: null };
  }
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
  const ew = computeOverheadEvaluationWindowFramingOnly({ landmarks, windowStartMs, windowEndMs });

  if (ew.applied) {
    return {
      framingHint: ew.hint,
      source: 'evaluation_window',
      evaluationWindowFramingHintOnly: ew.hint,
      evaluationWindowApplied: true,
    };
  }

  return {
    framingHint: getSetupFramingHint(landmarks ?? []),
    source: 'recent_tail_fallback',
    evaluationWindowFramingHintOnly: null,
    evaluationWindowApplied: false,
  };
}
