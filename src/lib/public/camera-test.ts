/**
 * 카메라 동작 테스트 shell - localStorage 스키마
 * moveReCameraTest:v1
 */
import type { EvaluatorResult } from '@/lib/camera/evaluators/types';

export const CAMERA_TEST_KEY = 'moveReCameraTest:v1';

export type CameraStepId = 'squat' | 'wall-angel' | 'single-leg-balance';

export const CAMERA_STEPS: { id: CameraStepId; path: string; title: string }[] = [
  { id: 'squat', path: '/movement-test/camera/squat', title: '스쿼트' },
  { id: 'wall-angel', path: '/movement-test/camera/wall-angel', title: '벽 천사' },
  { id: 'single-leg-balance', path: '/movement-test/camera/single-leg-balance', title: '한발 서기' },
];

export interface CameraTestData {
  startedAt?: string;
  completedSteps?: CameraStepId[];
  lastStepAt?: string;
  /** step별 evaluator 결과 (normalize 입력) */
  evaluatorResults?: Partial<Record<CameraStepId, EvaluatorResult>>;
}

export function loadCameraTest(): CameraTestData {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(CAMERA_TEST_KEY);
    return raw ? (JSON.parse(raw) as CameraTestData) : {};
  } catch {
    return {};
  }
}

export function saveCameraTest(data: Partial<CameraTestData>) {
  if (typeof window === 'undefined') return;
  try {
    const current = loadCameraTest();
    const merged = { ...current, ...data };
    localStorage.setItem(CAMERA_TEST_KEY, JSON.stringify(merged));
  } catch {
    // ignore
  }
}

export function getNextStepPath(currentId: CameraStepId): string | null {
  const i = CAMERA_STEPS.findIndex((s) => s.id === currentId);
  if (i < 0 || i >= CAMERA_STEPS.length - 1) return null;
  return CAMERA_STEPS[i + 1]!.path;
}

export function getPrevStepPath(currentId: CameraStepId): string | null {
  const i = CAMERA_STEPS.findIndex((s) => s.id === currentId);
  if (i <= 0) return null;
  return CAMERA_STEPS[i - 1]!.path;
}
