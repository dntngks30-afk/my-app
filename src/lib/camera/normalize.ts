/**
 * Evaluator + guardrail 결과 → 정규화된 result schema
 * result consumer가 안전하게 분기할 수 있도록 additive contract 유지
 */
import type { EvaluatorResult } from './evaluators/types';
import type {
  CameraFallbackMode,
  CameraGuardrailFlag,
  CaptureQuality,
  StepGuardrailResult,
} from './guardrails';

export interface CameraResultDebug {
  perExercise: StepGuardrailResult[];
  /** PR evidence: result interpretation용 */
  resultEvidenceLevel?: string;
  resultToneMode?: string;
  interpretationDowngraded?: boolean;
  fallbackToRetryOrLowConfidence?: boolean;
}

export type ResultEvidenceLevel = 'strong_evidence' | 'shallow_evidence' | 'weak_evidence' | 'insufficient_signal';
export type ResultToneMode = 'confident' | 'conservative' | 'cautious' | 'retry_or_reset';

export interface NormalizedCameraResult {
  movementType: string;
  patternSummary: string;
  avoidItems: string[];
  resetAction: string;
  confidence: number;
  captureQuality: CaptureQuality;
  flags: CameraGuardrailFlag[];
  retryRecommended: boolean;
  fallbackMode: CameraFallbackMode;
  insufficientSignal: boolean;
  evaluatorResults: EvaluatorResult[];
  debug: CameraResultDebug;
  /** PR evidence: result layer가 tone 조절에 사용 */
  resultEvidenceLevel?: ResultEvidenceLevel;
  resultToneMode?: ResultToneMode;
}

const INSUFFICIENT_RESULT: NormalizedCameraResult = {
  movementType: 'unknown',
  patternSummary: '촬영 신호가 충분하지 않아 결과를 바로 확정하지 않았습니다.',
  avoidItems: [],
  resetAction: '전신이 보이도록 다시 촬영하거나 설문형 테스트로 전환해 보세요.',
  confidence: 0,
  captureQuality: 'invalid',
  flags: ['insufficient_signal', 'valid_frames_too_few'],
  retryRecommended: true,
  fallbackMode: 'survey',
  insufficientSignal: true,
  evaluatorResults: [],
  debug: {
    perExercise: [],
  },
};

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** concern 비율 기반 movement type 매핑 */
function inferMovementType(results: EvaluatorResult[]): string {
  const allMetrics = results.flatMap((r) => r.metrics);
  const concerns = allMetrics.filter((m) => m.trend === 'concern');
  const concernRatio = allMetrics.length > 0 ? concerns.length / allMetrics.length : 0;

  if (concernRatio >= 0.6) return 'kangaroo';
  if (concernRatio >= 0.4) return 'hedgehog';
  if (concernRatio >= 0.2) return 'crab';
  return 'monkey';
}

/** concern 메트릭 → avoid item */
function toAvoidItems(results: EvaluatorResult[]): string[] {
  const items: string[] = [];
  for (const r of results) {
    for (const m of r.metrics) {
      if (m.trend === 'concern') {
        if (m.name === 'depth') items.push('깊이를 급하게 만들려고 하지 않기');
        else if (m.name === 'knee_alignment_trend') items.push('무릎이 안쪽으로 몰리지 않기');
        else if (m.name === 'trunk_lean') items.push('상체를 과하게 숙이지 않기');
        else if (m.name === 'arm_range') items.push('어깨를 억지로 끝까지 밀어 올리지 않기');
        else if (m.name === 'lumbar_extension') items.push('허리를 꺾어 범위를 만들지 않기');
        else if (m.name === 'sway') items.push('흔들리는 상태에서 오래 버티지 않기');
      }
    }
  }
  return [...new Set(items)].slice(0, 2);
}

/** reset action 추천 */
function toResetAction(results: EvaluatorResult[]): string {
  const hasSquat = results.some((r) => r.stepId === 'squat' && !r.insufficientSignal);
  const hasOverheadReach = results.some((r) => r.stepId === 'overhead-reach' && !r.insufficientSignal);
  const hasWallAngel = results.some((r) => r.stepId === 'wall-angel' && !r.insufficientSignal);
  const hasBalance = results.some((r) => r.stepId === 'single-leg-balance' && !r.insufficientSignal);

  if (hasSquat) return '벽에 등을 대고 천천히 스쿼트 5회를 다시 맞춰 보세요.';
  if (hasOverheadReach) return '정면에서 양팔을 머리 위로 올리고 1초씩 5회 멈춰 보세요.';
  if (hasWallAngel) return '문틀에 팔을 걸고 가슴을 부드럽게 열어 20초씩 2번 해 보세요.';
  if (hasBalance) return '벽을 살짝 짚고 한발로 10초 서기를 좌우 번갈아 다시 해 보세요.';
  return '전신이 보이도록 다시 촬영하거나 설문형 테스트로 전환해 보세요.';
}

function mergeFlags(guardrails: StepGuardrailResult[]): CameraGuardrailFlag[] {
  return [...new Set(guardrails.flatMap((guardrail) => guardrail.flags))];
}

function getAverageGuardrailConfidence(guardrails: StepGuardrailResult[]): number {
  if (guardrails.length === 0) return 0;
  return round(
    clamp(guardrails.reduce((sum, guardrail) => sum + guardrail.confidence, 0) / guardrails.length)
  );
}

const AGGREGATE_CONFIDENCE_FLOOR = 0.74;

function getOverallCaptureQuality(
  guardrails: StepGuardrailResult[],
  flags: CameraGuardrailFlag[],
  confidence: number
): CaptureQuality {
  if (guardrails.some((guardrail) => guardrail.captureQuality === 'invalid')) return 'invalid';
  const okCount = guardrails.filter((g) => g.captureQuality === 'ok').length;
  const lowCount = guardrails.filter((g) => g.captureQuality === 'low').length;
  if (okCount >= 1 && lowCount >= 1 && confidence >= AGGREGATE_CONFIDENCE_FLOOR) return 'ok';
  if (okCount >= 1 && confidence >= AGGREGATE_CONFIDENCE_FLOOR) return 'ok';
  if (guardrails.some((guardrail) => guardrail.captureQuality === 'low')) return 'low';
  if (flags.includes('hard_partial')) return 'low';
  if (confidence < AGGREGATE_CONFIDENCE_FLOOR) return 'low';
  return 'ok';
}

function getFallbackMode(
  captureQuality: CaptureQuality,
  confidence: number,
  flags: CameraGuardrailFlag[]
): CameraFallbackMode {
  if (
    captureQuality === 'invalid' ||
    flags.includes('insufficient_signal') ||
    flags.includes('valid_frames_too_few')
  ) {
    return 'survey';
  }
  if (
    captureQuality === 'low' ||
    confidence < 0.74 ||
    flags.includes('hard_partial')
  ) {
    return 'retry';
  }
  return null;
}

function toPatternSummary(
  validResults: EvaluatorResult[],
  captureQuality: CaptureQuality,
  flags: CameraGuardrailFlag[]
): string {
  if (captureQuality === 'invalid') {
    return '촬영 신호가 충분하지 않아 결과를 바로 확정하지 않았습니다.';
  }
  if (captureQuality === 'low' || flags.includes('hard_partial') || flags.includes('soft_partial')) {
    return '일부 구간의 신호가 약했지만 확인 가능한 범위에서 움직임 패턴을 정리했습니다.';
  }
  return validResults.length >= 2
    ? `${validResults.length}가지 동작 분석을 바탕으로 움직임 패턴을 확인했습니다.`
    : `${validResults.length}개 동작 분석 결과입니다.`;
}

const EVIDENCE_ORDER: ResultEvidenceLevel[] = [
  'strong_evidence',
  'shallow_evidence',
  'weak_evidence',
  'insufficient_signal',
];

function getWeakestEvidenceLevel(levels: ResultEvidenceLevel[]): ResultEvidenceLevel {
  if (levels.length === 0) return 'strong_evidence';
  let worstIdx = -1;
  for (const level of levels) {
    const idx = EVIDENCE_ORDER.indexOf(level);
    if (idx >= 0 && (worstIdx < 0 || idx > worstIdx)) worstIdx = idx;
  }
  return worstIdx >= 0 ? EVIDENCE_ORDER[worstIdx]! : 'strong_evidence';
}

function getResultEvidenceFromEvaluators(
  evaluatorResults: EvaluatorResult[]
): {
  resultEvidenceLevel: ResultEvidenceLevel;
  resultToneMode: ResultToneMode;
  interpretationDowngraded: boolean;
  fallbackToRetryOrLowConfidence: boolean;
} {
  const levels: ResultEvidenceLevel[] = evaluatorResults
    .map((r) => r.debug?.squatEvidenceLevel as ResultEvidenceLevel | undefined)
    .filter((l): l is ResultEvidenceLevel => typeof l === 'string' && EVIDENCE_ORDER.includes(l));
  const resultEvidenceLevel =
    levels.length > 0 ? getWeakestEvidenceLevel(levels) : 'strong_evidence';
  const resultToneMode: ResultToneMode =
    resultEvidenceLevel === 'strong_evidence'
      ? 'confident'
      : resultEvidenceLevel === 'shallow_evidence'
        ? 'conservative'
        : resultEvidenceLevel === 'weak_evidence'
          ? 'cautious'
          : 'retry_or_reset';
  const interpretationDowngraded =
    resultEvidenceLevel === 'shallow_evidence' || resultEvidenceLevel === 'weak_evidence';
  const fallbackToRetryOrLowConfidence = resultEvidenceLevel === 'insufficient_signal';
  return {
    resultEvidenceLevel,
    resultToneMode,
    interpretationDowngraded,
    fallbackToRetryOrLowConfidence,
  };
}

export function normalizeCameraResult(
  evaluatorResults: EvaluatorResult[],
  guardrailResults: StepGuardrailResult[] = []
): NormalizedCameraResult {
  const anyInsufficient = evaluatorResults.some((r) => r.insufficientSignal);
  const validResults = evaluatorResults.filter((r) => !r.insufficientSignal);
  const flags = mergeFlags(guardrailResults);
  const confidence =
    guardrailResults.length > 0
      ? getAverageGuardrailConfidence(guardrailResults)
      : round(
          validResults.length > 0
            ? Math.min(1, validResults.length / Math.max(validResults.length, 2))
            : 0
        );
  const captureQuality =
    guardrailResults.length > 0
      ? getOverallCaptureQuality(guardrailResults, flags, confidence)
      : anyInsufficient
        ? 'invalid'
        : 'ok';
  const fallbackMode = getFallbackMode(captureQuality, confidence, flags);

  if ((anyInsufficient && validResults.length < 2) || captureQuality === 'invalid') {
    return {
      ...INSUFFICIENT_RESULT,
      confidence,
      flags: [...new Set([...INSUFFICIENT_RESULT.flags, ...flags])],
      evaluatorResults,
      resultEvidenceLevel: 'insufficient_signal' as const,
      resultToneMode: 'retry_or_reset' as const,
      debug: {
        perExercise: guardrailResults,
        resultEvidenceLevel: 'insufficient_signal',
        resultToneMode: 'retry_or_reset',
        interpretationDowngraded: false,
        fallbackToRetryOrLowConfidence: true,
      },
    };
  }

  const movementType = inferMovementType(validResults);
  const avoidItems = toAvoidItems(validResults);
  const resetAction = toResetAction(validResults);
  const patternSummary = toPatternSummary(validResults, captureQuality, flags);
  const retryRecommended = fallbackMode !== null;
  const evidence = getResultEvidenceFromEvaluators(evaluatorResults);

  return {
    movementType,
    patternSummary,
    avoidItems,
    resetAction,
    confidence,
    captureQuality,
    flags,
    retryRecommended,
    fallbackMode,
    insufficientSignal: false,
    evaluatorResults,
    resultEvidenceLevel: evidence.resultEvidenceLevel,
    resultToneMode: evidence.resultToneMode,
    debug: {
      perExercise: guardrailResults,
      resultEvidenceLevel: evidence.resultEvidenceLevel,
      resultToneMode: evidence.resultToneMode,
      interpretationDowngraded: evidence.interpretationDowngraded,
      fallbackToRetryOrLowConfidence: evidence.fallbackToRetryOrLowConfidence,
    },
  };
}
