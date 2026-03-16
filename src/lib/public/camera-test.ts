/**
 * 카메라 동작 테스트 shell - localStorage 스키마
 * moveReCameraTest:v1
 */
import type { EvaluatorResult } from '@/lib/camera/evaluators/types';
import type { StepGuardrailResult } from '@/lib/camera/guardrails';

export const CAMERA_TEST_KEY = 'moveReCameraTest:v1';

export type CameraStepId =
  | 'squat'
  | 'overhead-reach'
  | 'wall-angel'
  | 'single-leg-balance';

/** Setup 화면 경로 (squat 전 공통 준비) - PR-CAM-UX-01 이후 squat에 병합됨, 호환용 유지 */
export const CAMERA_SETUP_PATH = '/movement-test/camera/setup';

/** squat 첫 단계 경로 (entry에서 바로 진입) */
export const CAMERA_SQUAT_PATH = '/movement-test/camera/squat';

/** 단일 카메라 화면 내 phase (PR-CAM-UX-01) */
export type CameraPhase =
  | 'setup'
  | 'arming'
  | 'countdown'
  | 'capturing'
  | 'success'
  | 'transitioning'
  | 'retry_recovery';

export const CAMERA_STEPS: { id: CameraStepId; path: string; title: string }[] = [
  { id: 'squat', path: '/movement-test/camera/squat', title: '스쿼트' },
  { id: 'overhead-reach', path: '/movement-test/camera/overhead-reach', title: '오버헤드 리치' },
];

export const DEFERRED_CAMERA_STEPS: { id: CameraStepId; path: string; title: string }[] = [
  { id: 'wall-angel', path: '/movement-test/camera/wall-angel', title: '벽 천사' },
  { id: 'single-leg-balance', path: '/movement-test/camera/single-leg-balance', title: '한발 서기' },
];

export interface CameraTestData {
  startedAt?: string;
  completedSteps?: CameraStepId[];
  lastStepAt?: string;
  /** step별 evaluator 결과 (normalize 입력) */
  evaluatorResults?: Partial<Record<CameraStepId, EvaluatorResult>>;
  /** step별 guardrail 결과 (retry / fallback 판단용) */
  guardrailResults?: Partial<Record<CameraStepId, StepGuardrailResult>>;
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

export function resetCameraTest() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(CAMERA_TEST_KEY);
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
  if (i < 0) return null;
  /** squat: setup이 병합되어 entry로 돌아감 */
  if (i === 0) return '/movement-test/camera';
  return CAMERA_STEPS[i - 1]!.path;
}
