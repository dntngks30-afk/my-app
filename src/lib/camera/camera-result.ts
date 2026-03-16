/**
 * 카메라 결과 저장소
 * result page에서 survey/camera 공통 소비
 */
import type { NormalizedCameraResult } from './normalize';

export const CAMERA_RESULT_KEY = 'moveReCameraResult:v1';

export interface CameraResultStorage {
  completedAt: string;
  result: NormalizedCameraResult;
}

export function loadCameraResult(): CameraResultStorage | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CAMERA_RESULT_KEY);
    return raw ? (JSON.parse(raw) as CameraResultStorage) : null;
  } catch {
    return null;
  }
}

export function saveCameraResult(result: NormalizedCameraResult) {
  if (typeof window === 'undefined') return;
  try {
    const data: CameraResultStorage = {
      completedAt: new Date().toISOString(),
      result,
    };
    localStorage.setItem(CAMERA_RESULT_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

export function clearCameraResult() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(CAMERA_RESULT_KEY);
  } catch {
    // ignore
  }
}
