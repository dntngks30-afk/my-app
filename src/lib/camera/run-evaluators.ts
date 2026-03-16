/**
 * step별 evaluator 실행
 */
import type { EvaluatorResult } from './evaluators/types';
import { evaluateSquat } from './evaluators/squat';
import { evaluateWallAngel } from './evaluators/wall-angel';
import { evaluateSingleLegBalance } from './evaluators/single-leg-balance';
import type { PoseLandmarks } from '@/lib/motion/pose-types';
import type { CameraStepId } from '@/lib/public/camera-test';

const EVALUATORS: Record<CameraStepId, (landmarks: PoseLandmarks[]) => EvaluatorResult> = {
  squat: evaluateSquat,
  'wall-angel': evaluateWallAngel,
  'single-leg-balance': evaluateSingleLegBalance,
};

export function runEvaluator(
  stepId: CameraStepId,
  landmarks: PoseLandmarks[]
): EvaluatorResult {
  return EVALUATORS[stepId](landmarks);
}
