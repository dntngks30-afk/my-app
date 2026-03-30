/**
 * PR-HMM-04A — HMM evidence로 completion **arming**만 보조 (final pass 소유권 불변).
 *
 * - shallow but meaningful 시도에서 rule `not_armed`가 먼저 막는 것을 완화
 * - completion / finalize / blocked-reason assist 정책과 분리
 */

import type { PoseFeaturesFrame } from '@/lib/camera/pose-features';
import type { CompletionArmingState } from '@/lib/camera/squat/squat-completion-arming';
import type { SquatHmmDecodeResult } from '@/lib/camera/squat/squat-hmm';

/** evaluator MIN_VALID_FRAMES 와 정합 — 너무 짧은 버퍼는 arming assist 불가 */
const MIN_VALID_FRAMES_FOR_ARMING_ASSIST = 8;

/** standing jitter 대비 강한 shallow 사이클 후보만 허용 */
const ARMING_ASSIST_MIN_CONFIDENCE = 0.55;
const ARMING_ASSIST_MIN_EXCURSION = 0.03;
const ARMING_ASSIST_MIN_DESCENT = 2;
const ARMING_ASSIST_MIN_ASCENT = 2;

export interface SquatHmmArmingAssistDecision {
  assistEligible: boolean;
  assistApplied: boolean;
  assistReason: string | null;
  /** assistApplied 일 때만 true — synthetic arming 게이트 */
  syntheticArmed: boolean;
  notes: string[];
}

export interface SquatArmingContext {
  armed: boolean;
}

export function hmmMeetsArmingAssistEvidence(hmm: SquatHmmDecodeResult | undefined): boolean {
  if (hmm == null) return false;
  return (
    hmm.completionCandidate === true &&
    hmm.confidence >= ARMING_ASSIST_MIN_CONFIDENCE &&
    hmm.effectiveExcursion >= ARMING_ASSIST_MIN_EXCURSION &&
    hmm.dominantStateCounts.descent >= ARMING_ASSIST_MIN_DESCENT &&
    hmm.dominantStateCounts.ascent >= ARMING_ASSIST_MIN_ASCENT
  );
}

/**
 * @param valid 필터된 valid 프레임 (길이·품질은 호출자 책임)
 * @param hmm 동일 버퍼에 대한 HMM decode 결과 (보통 `decodeSquatHmm(valid)`)
 * @param arming 기존 `computeSquatCompletionArming` 의 `armed`만 사용
 */
export function getSquatHmmArmingAssistDecision(
  valid: PoseFeaturesFrame[],
  hmm: SquatHmmDecodeResult | undefined,
  arming: SquatArmingContext
): SquatHmmArmingAssistDecision {
  const notes: string[] = [];

  if (arming.armed) {
    notes.push('rule_armed_skip_hmm_arming_assist');
    return {
      assistEligible: false,
      assistApplied: false,
      assistReason: null,
      syntheticArmed: false,
      notes,
    };
  }

  if (valid.length < MIN_VALID_FRAMES_FOR_ARMING_ASSIST) {
    notes.push('valid_frames_below_arming_assist_min');
    return {
      assistEligible: false,
      assistApplied: false,
      assistReason: null,
      syntheticArmed: false,
      notes,
    };
  }

  if (!hmmMeetsArmingAssistEvidence(hmm)) {
    notes.push('hmm_below_arming_assist_evidence');
    return {
      assistEligible: false,
      assistApplied: false,
      assistReason: null,
      syntheticArmed: false,
      notes,
    };
  }

  notes.push('hmm_arming_assist_shallow_meaningful');
  return {
    assistEligible: true,
    assistApplied: true,
    assistReason: 'hmm_arming_assist_shallow_meaningful',
    syntheticArmed: true,
    notes,
  };
}

/** camera-trace / diagnostic compact — 짧은 키 */
export interface SquatArmingAssistTraceCompact {
  hae: boolean;
  haa: boolean;
  har: string | null;
  ea: boolean;
  /** PR-CAM-RETRO-ARMING-ASSIST-01: rule retro-arm 발동 여부 */
  ra: boolean;
}

export function buildSquatArmingAssistTraceCompact(
  ca: CompletionArmingState | undefined
): SquatArmingAssistTraceCompact {
  return {
    hae: ca?.hmmArmingAssistEligible ?? false,
    haa: ca?.hmmArmingAssistApplied ?? false,
    har: ca?.hmmArmingAssistReason ?? null,
    ea: ca?.effectiveArmed ?? ca?.armed ?? false,
    ra: ca?.armingRetroApplied ?? false,
  };
}
