/**
 * PR-COMP-06 — 스쿼트·오버헤드 카메라 레이어(completion + internal quality)를
 * refinement / `getCameraEvidenceQuality` 경로에 연결하기 위한 **내부 어댑터** 요약.
 *
 * - UnifiedDeepResultV2 본 필드·스키마를 바꾸지 않는다.
 * - limitation 문자열은 사용자 카피로 노출하지 않고, evidence 강도(strong/partial/minimal)만 조정한다.
 * - completion 임계값·재시도·오디오·네비는 건드리지 않는다 (저장된 evaluator 스냅샷만 읽음).
 */

import type { EvaluatorResult } from '@/lib/camera/evaluators/types';
import type { QualityWindowTrace } from '@/lib/camera/stability';

/** 어댑터가 소비하는 모션별 요약 (퍼블릭 canonical result 계약 아님) */
export type CameraMotionEvidenceSummary = {
  motionType: 'squat' | 'overhead_reach';
  completionStatus: 'completed' | 'partial' | 'failed' | 'invalid';
  completionPassReason?: string;
  completionBlockedReason?: string;
  completionMachinePhase?: string;
  qualityTier?: 'high' | 'medium' | 'low';
  confidence?: number;
  limitations: string[];
};

/** 모션 단위 해석 강도 → `CameraEvidenceQuality` 보정에 사용 (다운그레이드 전용) */
export type RefinementEvidenceStrength = 'strong' | 'moderate' | 'minimal' | 'unusable';

const STRENGTH_RANK: Record<RefinementEvidenceStrength, number> = {
  unusable: 0,
  minimal: 1,
  moderate: 2,
  strong: 3,
};

function weakerStrength(
  a: RefinementEvidenceStrength,
  b: RefinementEvidenceStrength
): RefinementEvidenceStrength {
  return STRENGTH_RANK[a] <= STRENGTH_RANK[b] ? a : b;
}

function readHighlightedBool(v: unknown): boolean | undefined {
  if (v === true || v === 1) return true;
  if (v === false || v === 0) return false;
  return undefined;
}

function hasSquatInternalQuality(r: EvaluatorResult): boolean {
  return Boolean(r.debug?.squatInternalQuality);
}

function hasOverheadInternalQuality(r: EvaluatorResult): boolean {
  return Boolean(r.debug?.overheadInternalQuality);
}

/**
 * evaluator 1건에서 bridge용 요약을 만든다.
 * - debug/highlightedMetrics·internal quality가 없는 레거시 픽스처(V2-05 smoke 등)는 `null` → 레거시 경로 유지.
 * - `insufficientSignal`이면 해당 스텝은 invalid로 기록 (글로벌 pass와 별개로 모션 증거 없음).
 */
export function buildCameraMotionEvidenceSummary(r: EvaluatorResult): CameraMotionEvidenceSummary | null {
  if (r.stepId !== 'squat' && r.stepId !== 'overhead-reach') return null;

  const motionType: CameraMotionEvidenceSummary['motionType'] =
    r.stepId === 'squat' ? 'squat' : 'overhead_reach';

  if (r.insufficientSignal) {
    return {
      motionType,
      completionStatus: 'invalid',
      limitations: [],
    };
  }

  const hm = r.debug?.highlightedMetrics;
  const hasIq = motionType === 'squat' ? hasSquatInternalQuality(r) : hasOverheadInternalQuality(r);

  const hasHmSignals =
    hm != null &&
    (readHighlightedBool(hm.completionSatisfied) !== undefined ||
      (typeof hm.completionMachinePhase === 'string' && hm.completionMachinePhase.length > 0) ||
      readHighlightedBool(hm.attemptStarted) === true ||
      (typeof hm.raiseCount === 'number' && hm.raiseCount > 0) ||
      (typeof hm.peakCount === 'number' && hm.peakCount > 0));

  if (!hasIq && !hasHmSignals) {
    return null;
  }

  // internal quality만 있고 completion 스냅샷이 없는 경우: 해석 레이어는 캡처 구간 기준이므로 completed로 간주
  if (hasIq && !hasHmSignals) {
    const iq =
      motionType === 'squat' ? r.debug!.squatInternalQuality! : r.debug!.overheadInternalQuality!;
    return {
      motionType,
      completionStatus: 'completed',
      limitations: iq.limitations ?? [],
      qualityTier: iq.qualityTier,
      confidence: iq.confidence,
    };
  }

  const completionSatisfied = readHighlightedBool(hm?.completionSatisfied) === true;

  let completionStatus: CameraMotionEvidenceSummary['completionStatus'];
  if (completionSatisfied) {
    completionStatus = 'completed';
  } else if (motionType === 'squat') {
    const attempt = readHighlightedBool(hm?.attemptStarted) === true;
    const phase = String(hm?.completionMachinePhase ?? '').toLowerCase();
    const idleLike =
      phase === '' ||
      phase === 'idle' ||
      phase === 'baseline' ||
      phase === 'setup' ||
      phase === 'setup_capture' ||
      phase === 'reading';
    completionStatus = attempt || !idleLike ? 'partial' : 'failed';
  } else {
    const raise = typeof hm?.raiseCount === 'number' ? hm.raiseCount : 0;
    const peak = typeof hm?.peakCount === 'number' ? hm.peakCount : 0;
    const phase = String(hm?.completionMachinePhase ?? '').toLowerCase();
    const idleLike =
      phase === '' ||
      phase === 'idle' ||
      phase === 'baseline' ||
      phase === 'arming' ||
      phase === 'setup_capture' ||
      phase === 'reading';
    completionStatus = raise > 0 || peak > 0 || !idleLike ? 'partial' : 'failed';
  }

  const iq =
    motionType === 'squat' ? r.debug?.squatInternalQuality : r.debug?.overheadInternalQuality;

  const passReason =
    typeof hm?.completionPassReason === 'string' ? hm.completionPassReason : undefined;
  const blocked =
    typeof hm?.completionBlockedReason === 'string' ? hm.completionBlockedReason : undefined;
  const machinePhase =
    typeof hm?.completionMachinePhase === 'string' ? hm.completionMachinePhase : undefined;

  return {
    motionType,
    completionStatus,
    completionPassReason: passReason,
    completionBlockedReason: blocked,
    completionMachinePhase: machinePhase,
    qualityTier: iq?.qualityTier,
    confidence: iq?.confidence,
    limitations: iq?.limitations ?? [],
  };
}

function refinementStrengthForSummary(
  s: CameraMotionEvidenceSummary,
  hadInternalQuality: boolean
): RefinementEvidenceStrength {
  if (s.completionStatus === 'invalid' || s.completionStatus === 'failed') return 'unusable';
  if (s.completionStatus === 'partial') return 'minimal';

  if (!hadInternalQuality) {
    // 레거시/미기록 internal layer: 기존 resultEvidenceLevel 기반만 신뢰 (다운그레이드 없음)
    return 'strong';
  }

  const tier = s.qualityTier ?? 'medium';
  const conf = s.confidence ?? 0.5;
  const limN = s.limitations.length;

  if (tier === 'low' || conf < 0.42 || limN >= 4) return 'minimal';
  if (tier === 'high' && conf >= 0.55 && limN <= 1) return 'strong';
  return 'moderate';
}

/** 단일 모션에 대한 refinement 강도 (bridge 데이터 없으면 null) */
export function refinementStrengthFromEvaluatorResult(r: EvaluatorResult): RefinementEvidenceStrength | null {
  const summary = buildCameraMotionEvidenceSummary(r);
  if (!summary) return null;
  const hadIq =
    r.stepId === 'squat' ? hasSquatInternalQuality(r) : hasOverheadInternalQuality(r);
  return refinementStrengthForSummary(summary, hadIq);
}

/**
 * 스쿼트·오버헤드에 대해 가장 보수적인(약한) 강도를 고른다.
 * 둘 중 하나만 스냅샷이 있으면 그쪽만 반영한다.
 */
export function aggregateRefinementEvidenceStrength(
  results: readonly EvaluatorResult[]
): RefinementEvidenceStrength | null {
  const strengths: RefinementEvidenceStrength[] = [];
  for (const r of results) {
    if (r.stepId !== 'squat' && r.stepId !== 'overhead-reach') continue;
    const st = refinementStrengthFromEvaluatorResult(r);
    if (st != null) strengths.push(st);
  }
  if (strengths.length === 0) return null;
  return strengths.reduce(weakerStrength);
}

export function buildCameraMotionEvidenceSummaries(
  results: readonly EvaluatorResult[]
): CameraMotionEvidenceSummary[] {
  const out: CameraMotionEvidenceSummary[] = [];
  for (const r of results) {
    const s = buildCameraMotionEvidenceSummary(r);
    if (s) out.push(s);
  }
  return out;
}

/** `camera-to-evidence`와 동일한 3단계 (순환 import 방지용 로컬 별칭) */
type CameraEvidenceQualityLocal = 'strong' | 'partial' | 'minimal';

/**
 * 레거시 `resultEvidenceLevel`에서 온 `CameraEvidenceQuality`를
 * 모션 요약으로 **보수적으로만** 낮춘다 (업그레이드 금지).
 */
export function applyRefinementStrengthToCameraEvidenceQuality(
  base: CameraEvidenceQualityLocal,
  strength: RefinementEvidenceStrength | null
): CameraEvidenceQualityLocal {
  if (strength == null) return base;

  if (strength === 'unusable' || strength === 'minimal') {
    return 'minimal';
  }

  if (strength === 'moderate') {
    if (base === 'strong') return 'partial';
    return base;
  }

  return base;
}

// ─── PR-CAMERA-QUALITY-OBSERVABILITY-02 — internal observability-only DTO ───
// Pure read/assemble from existing evaluator debug/IQ objects. Does not mutate inputs.

/** highlightedMetrics 서브셋 스냅샷(pass/프로그레션 디버깅 참고용). 값 복사만 함. */
const IQ_OBS_HIGHLIGHT_KEYS = [
  'completionSatisfied',
  'completionMachinePhase',
  'completionPassReason',
  'completionBlockedReason',
  'attemptStarted',
  'raiseCount',
  'peakCount',
] as const;

function completionSnapshotFromHighlightedMetrics(
  hm: Record<string, number | string | boolean | null> | undefined
): Record<string, unknown> | undefined {
  if (!hm || typeof hm !== 'object') return undefined;
  const out: Record<string, unknown> = {};
  for (const k of IQ_OBS_HIGHLIGHT_KEYS) {
    if (Object.prototype.hasOwnProperty.call(hm, k)) out[k] = hm[k];
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * qualityTier + 이미 존재하는 limitation 코드만으로 deterministic 라벨 (새 원시 신호 계산 금지).
 * biomechanical 주장 확대 금지.
 */
export function deriveSignalIntegrityTierObservation(
  qualityTier: 'high' | 'medium' | 'low',
  limitations: readonly string[]
): string {
  const sorted = [...limitations].slice().sort();
  const compact = sorted.join('|');
  return `obs_si|tier=${qualityTier}|limcodes=${limitations.length}|${compact}`;
}

type SelectedWindowInputQualityObservation = {
  selectedWindowFrameCount: number;
  selectedWindowDurationMs: number | null;
  selectedWindowScore: number | null;
  selectedWindowSource: string;
  fallbackReason?: string | null;
};

function selectedWindowObservationFromQualityWindow(
  qualityWindow: QualityWindowTrace | undefined
): SelectedWindowInputQualityObservation | undefined {
  if (!qualityWindow) return undefined;
  return {
    selectedWindowFrameCount: qualityWindow.selectedWindowFrameCount,
    selectedWindowDurationMs: qualityWindow.selectedWindowDurationMs,
    selectedWindowScore: qualityWindow.selectedWindowScore,
    selectedWindowSource: qualityWindow.selectedWindowSource,
    ...(qualityWindow.fallbackReason !== undefined
      ? { fallbackReason: qualityWindow.fallbackReason }
      : {}),
  };
}

export type SquatInputQualityTrace = {
  qualityTier: 'high' | 'medium' | 'low';
  confidence: number;
  depthScore: number;
  controlScore: number;
  symmetryScore: number;
  recoveryScore: number;
  limitations: readonly string[];
  /** tier + 기존 limitation 코드 문자열만으로 고정된 라벨 (추측/과장 없음). */
  signalIntegrityTier: string;
  completionSnapshot?: Record<string, unknown>;
  /** depthScore 의 프록시 별칭(진폭 신호 근거는 depthScore 와 동일). */
  proxyMovementAmplitudeScore: number;
  /** controlScore 의 프록시 별칭(하단/제어 신호 근거는 controlScore 와 동일). */
  proxyBottomStabilityScore: number;
  recoveryContinuityScore: number;
  leftRightSignalBalance: number;
  selectedWindow?: SelectedWindowInputQualityObservation;
};

export type OverheadInputQualityTrace = {
  qualityTier: 'high' | 'medium' | 'low';
  confidence: number;
  mobilityScore: number;
  controlScore: number;
  symmetryScore: number;
  holdStabilityScore: number;
  limitations: readonly string[];
  signalIntegrityTier: string;
  completionSnapshot?: Record<string, unknown>;
  /** holdStabilityScore 와 동일 값(top 홀드 안정도 해석 레이어). */
  stableTopHoldScore: number;
  leftRightSignalBalance: number;
  selectedWindow?: SelectedWindowInputQualityObservation;
};

export type CameraInputQualityObservabilityV1 = {
  policy_version: 'camera_input_quality_obs_02';
  squat: SquatInputQualityTrace | null;
  overheadReach: OverheadInputQualityTrace | null;
  bridge?: {
    refinement_evidence_strength?: RefinementEvidenceStrength | null;
  };
};

function buildSquatInputQualityTrace(r: EvaluatorResult): SquatInputQualityTrace | null {
  const iq = r.debug?.squatInternalQuality;
  if (!iq) return null;
  const hm = r.debug?.highlightedMetrics;
  const completionSnapshot = completionSnapshotFromHighlightedMetrics(hm);
  const selectedWindow = selectedWindowObservationFromQualityWindow(iq.qualityWindow);
  return {
    qualityTier: iq.qualityTier,
    confidence: iq.confidence,
    depthScore: iq.depthScore,
    controlScore: iq.controlScore,
    symmetryScore: iq.symmetryScore,
    recoveryScore: iq.recoveryScore,
    limitations: iq.limitations ?? [],
    signalIntegrityTier: deriveSignalIntegrityTierObservation(iq.qualityTier, iq.limitations ?? []),
    ...(completionSnapshot != null ? { completionSnapshot } : {}),
    proxyMovementAmplitudeScore: iq.depthScore,
    proxyBottomStabilityScore: iq.controlScore,
    recoveryContinuityScore: iq.recoveryScore,
    leftRightSignalBalance: iq.symmetryScore,
    ...(selectedWindow != null ? { selectedWindow } : {}),
  };
}

function buildOverheadInputQualityTrace(r: EvaluatorResult): OverheadInputQualityTrace | null {
  const iq = r.debug?.overheadInternalQuality;
  if (!iq) return null;
  const hm = r.debug?.highlightedMetrics;
  const completionSnapshot = completionSnapshotFromHighlightedMetrics(hm);
  const selectedWindow = selectedWindowObservationFromQualityWindow(iq.qualityWindow);
  return {
    qualityTier: iq.qualityTier,
    confidence: iq.confidence,
    mobilityScore: iq.mobilityScore,
    controlScore: iq.controlScore,
    symmetryScore: iq.symmetryScore,
    holdStabilityScore: iq.holdStabilityScore,
    limitations: iq.limitations ?? [],
    signalIntegrityTier: deriveSignalIntegrityTierObservation(iq.qualityTier, iq.limitations ?? []),
    ...(completionSnapshot != null ? { completionSnapshot } : {}),
    stableTopHoldScore: iq.holdStabilityScore,
    leftRightSignalBalance: iq.symmetryScore,
    ...(selectedWindow != null ? { selectedWindow } : {}),
  };
}

/**
 * 평가기 결과 배열만 읽어 카메라 입력 해석 레이어(내부 IQ) 저품질 이유를 묶은 관측 DTO를 만든다.
 * 순수 함수 — EvaluatorResult / debug 객체 변경 없음.
 */
export function buildCameraInputQualityObservability(
  results: readonly EvaluatorResult[]
): CameraInputQualityObservabilityV1 {
  let squat: SquatInputQualityTrace | null = null;
  let overheadReach: OverheadInputQualityTrace | null = null;

  for (const r of results) {
    if (!squat && r.stepId === 'squat' && r.debug?.squatInternalQuality) {
      squat = buildSquatInputQualityTrace(r);
    }
    if (!overheadReach && r.stepId === 'overhead-reach' && r.debug?.overheadInternalQuality) {
      overheadReach = buildOverheadInputQualityTrace(r);
    }
  }

  const refinement_evidence_strength = aggregateRefinementEvidenceStrength(results);

  return {
    policy_version: 'camera_input_quality_obs_02',
    squat,
    overheadReach,
    ...(refinement_evidence_strength != null && {
      bridge: { refinement_evidence_strength },
    }),
  };
}
