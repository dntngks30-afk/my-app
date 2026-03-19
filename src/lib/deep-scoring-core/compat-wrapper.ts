/**
 * Paid Deep Test — Deep Scoring Core V2 호환 래퍼
 *
 * 기존 /api/deep-test/finalize route와 deep_v3 소비 레이어를 깨지 않으면서
 * 새 scoring core의 결과를 검증(shadow compare)하는 레이어.
 *
 * 이 래퍼는:
 * - 기존 calculateDeepV3(answers) 결과를 그대로 반환 (production path 불변)
 * - 새 core 결과를 shadow로 병렬 실행하여 diff를 로그/반환
 * - finalize route에서는 아직 새 core path를 사용하지 않음
 *
 * 다음 PR에서: route가 새 core path를 primary로 사용하도록 전환.
 */

import type { DeepAnswerValue } from '@/lib/deep-test/types';
import { calculateDeepV3 } from '@/lib/deep-test/scoring/deep_v3';
import { extractPaidSurveyEvidence } from './extractors/paid-survey-extractor';
import { runDeepScoringCore } from './core';
import type { DeepScoringCoreResult } from './types';

// ─── 타입 정의 ────────────────────────────────────────────────────────────────

export interface ScoringCoreCompareResult {
  /** 기존 v3 결과 (production 동일) */
  legacy: ReturnType<typeof calculateDeepV3>;
  /** 새 core 결과 */
  core_v2: DeepScoringCoreResult;
  /** diff 플래그 */
  diff: {
    primary_type_changed: boolean;
    secondary_type_changed: boolean;
    pain_mode_changed: boolean;
    confidence_delta: number;
    flags: string[];
  };
}

// ─── 호환 래퍼 ────────────────────────────────────────────────────────────────

/**
 * runDeepScoringWithCompat
 *
 * 기존 v3 path + 새 core v2를 병렬 실행하여 diff를 반환.
 * production에서는 legacy 결과만 사용. 새 core는 검증용.
 */
export function runDeepScoringWithCompat(
  answers: Record<string, DeepAnswerValue>
): ScoringCoreCompareResult {
  // 1. 기존 v3 path (production과 동일)
  const legacy = calculateDeepV3(answers);

  // 2. 새 core v2 path (evidence 추출 → scoring core)
  const evidence = extractPaidSurveyEvidence(answers);
  const core_v2 = runDeepScoringCore(evidence);

  // 3. diff 계산
  const legacyPrimary = legacy.primary_type;
  const corePrimary = core_v2.primary_type;
  const primaryChanged = legacyPrimary !== corePrimary;

  const legacySecondary = legacy.secondary_type ?? null;
  const coreSecondary = core_v2.secondary_type ?? null;
  const secondaryChanged = String(legacySecondary) !== String(coreSecondary);

  const legacyPainMode = legacy.pain_mode;
  const corePainMode = core_v2.pain_mode;
  const painModeChanged = legacyPainMode !== corePainMode;

  const confidenceDelta = Math.abs(legacy.confidence - core_v2.confidence);

  const flags: string[] = [];
  if (primaryChanged) flags.push('primary_type_changed');
  if (secondaryChanged) flags.push('secondary_type_changed');
  if (painModeChanged) flags.push('pain_mode_changed');
  if (confidenceDelta > 0.1) flags.push('confidence_delta_significant');

  return {
    legacy,
    core_v2,
    diff: {
      primary_type_changed: primaryChanged,
      secondary_type_changed: secondaryChanged,
      pain_mode_changed: painModeChanged,
      confidence_delta: confidenceDelta,
      flags,
    },
  };
}

/**
 * runDeepScoringCoreOnly
 *
 * 새 core v2만 실행. 테스트 및 future primary path 전환용.
 * source_mode 없이 동작.
 */
export function runDeepScoringCoreOnly(
  answers: Record<string, DeepAnswerValue>
): DeepScoringCoreResult {
  const evidence = extractPaidSurveyEvidence(answers);
  return runDeepScoringCore(evidence);
}
