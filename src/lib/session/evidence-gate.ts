/**
 * PR-DATA-01: Session completion evidence gate
 * PR-DATA-01A: Observability and threshold-tuning support.
 * PR-RISK-08a: Relaxed evidence gate observability — allow/reject both emit evidence meta.
 *   - relaxed threshold operation must remain observable
 *   - threshold changes should be evaluated against allow-quality metrics
 * Server-side validation to prevent completing sessions with insufficient execution evidence.
 */

import { buildPlanItemKey } from './exercise-log-identity';
import type { ExerciseLogItem } from './types';
import {
  EVIDENCE_GATE_COMPLETION_MIN_RATIO,
  EVIDENCE_GATE_SCORE_ALLOW_THRESHOLD,
  EVIDENCE_GATE_SCORE_RECOVERABLE_MIN,
  EVIDENCE_GATE_THRESHOLD_PROFILE,
  EVIDENCE_SCORE_COVERAGE_MAX,
  EVIDENCE_SCORE_PERFORMED_VALUE_MAX,
  EVIDENCE_SCORE_REFLECTION_MAX,
} from './evidence-gate-constants';

export type EvidenceGateErrorCode =
  | 'NOT_ENOUGH_COMPLETION_COVERAGE'
  | 'MAIN_SEGMENT_REQUIRED'
  | 'INSUFFICIENT_EXECUTION_EVIDENCE';

/** Internal reason detail for observability. Not exposed to frontend. */
export type RejectReasonDetail =
  | 'MISSING_PLAN_STRUCTURE'
  | 'EMPTY_PLAN_SEGMENTS'
  | 'NO_EXECUTION_LOGS'
  | 'LOW_EVIDENCE_SCORE'
  | 'LOW_PERFORMED_VALUE_DENSITY'
  | 'MAIN_SEGMENT_ABSENT_BUT_SKIPPED';

export type EvidenceGateObservability = {
  total_items: number;
  completed_items: number;
  completion_ratio: number;
  /** PR-RISK-08a: alias for completion_ratio (allow/reject meta parity) */
  coverage_ratio: number;
  main_segment_required: boolean;
  main_segment_completed: number;
  main_gate_skipped?: boolean;
  main_gate_skip_reason?: string;
  performed_value_count: number;
  reflection_present: boolean;
  rpe_present: boolean;
  discomfort_present: boolean;
  evidence_score_total: number;
  evidence_score_breakdown: {
    coverage: number;
    performed_value: number;
    reflection: number;
  };
  threshold_used: {
    completion_min_ratio: number;
    score_allow: number;
    score_recoverable_min: number;
  };
  /** PR-RISK-08a: relaxed/strict — threshold changes evaluated against allow-quality metrics */
  threshold_profile: string;
  received_exercise_logs_count: number;
  rejected_or_allowed: 'rejected' | 'allowed';
  reject_reason_code?: EvidenceGateErrorCode;
  reject_reason_detail?: RejectReasonDetail;
  /** HOTFIX: identity match observability — plan_item_key vs templateId fallback */
  identity_match?: {
    matched_by_plan_item_key_count: number;
    matched_by_template_fallback_count: number;
    unmatched_plan_items_count: number;
  };
  /** PR-RISK-04: cooldown parity debug — segment별 완료 수 */
  segment_completion?: {
    cooldown_items_count: number;
    cooldown_completed_count: number;
  };
};

export type EvidenceGateResult =
  | { allowed: true; observability: EvidenceGateObservability }
  | {
      allowed: false;
      code: EvidenceGateErrorCode;
      message: string;
      observability: EvidenceGateObservability;
    };

type PlanSegment = {
  title?: string;
  items?: Array<{
    templateId?: string;
    sets?: number;
    reps?: number;
    hold_seconds?: number;
  }>;
};

type PlanJson = {
  segments?: PlanSegment[];
};

export type { ExerciseLogItem } from './types';

export type FeedbackPayload = {
  sessionFeedback?: {
    overallRpe?: number;
    painAfter?: number;
    completionRatio?: number;
    difficultyFeedback?: 'too_easy' | 'ok' | 'too_hard';
    painAreas?: string[];
  };
  exerciseFeedback?: Array<{ exerciseKey?: string }>;
};

type PlanItemInfo = {
  templateId: string;
  segmentTitle: string;
  isMain: boolean;
  isCooldown: boolean;
  plan_item_key: string;
};

type CompletedItemCounts = {
  completed: number;
  mainCompleted: number;
  withPerformedValue: number;
  matchedByPlanItemKey: number;
  matchedByTemplateFallback: number;
  cooldownItemsCount: number;
  cooldownCompleted: number;
};

function buildPlanItemList(planJson: PlanJson | null | undefined): PlanItemInfo[] {
  const items: PlanItemInfo[] = [];
  if (!planJson?.segments) return items;
  for (let segIdx = 0; segIdx < planJson.segments.length; segIdx++) {
    const seg = planJson.segments[segIdx]!;
    const title = seg.title ?? '';
    const isMain = title.toLowerCase() === 'main';
    for (let itemIdx = 0; itemIdx < (seg.items ?? []).length; itemIdx++) {
      const it = seg.items![itemIdx];
      const tid = it?.templateId;
      if (tid) {
        items.push({
          templateId: tid,
          segmentTitle: title,
          isMain,
          isCooldown: title.toLowerCase() === 'cooldown',
          plan_item_key: buildPlanItemKey(segIdx, itemIdx, tid),
        });
      }
    }
  }
  return items;
}

/**
 * Match exercise_logs to plan items. plan_item_key 우선, templateId fallback (backward compat).
 * templateId-only matching is legacy fallback; new paths must provide plan_item_key.
 */
function countCompletedItems(
  planItems: PlanItemInfo[],
  exerciseLogs: ExerciseLogItem[]
): CompletedItemCounts {
  const byPlanItemKey = new Map<string, ExerciseLogItem>();
  const logQueueByTemplateId = new Map<string, ExerciseLogItem[]>();
  for (const log of exerciseLogs) {
    if (log.plan_item_key) {
      byPlanItemKey.set(log.plan_item_key, log);
    } else {
      const q = logQueueByTemplateId.get(log.templateId) ?? [];
      q.push(log);
      logQueueByTemplateId.set(log.templateId, q);
    }
  }

  let completed = 0;
  let mainCompleted = 0;
  let withPerformedValue = 0;
  let matchedByPlanItemKey = 0;
  let matchedByTemplateFallback = 0;

  let cooldownCompleted = 0;
  for (const p of planItems) {
    let log: ExerciseLogItem | undefined = byPlanItemKey.get(p.plan_item_key);
    if (log) {
      matchedByPlanItemKey++;
    } else {
      const q = logQueueByTemplateId.get(p.templateId);
      log = q?.shift();
      if (log) matchedByTemplateFallback++;
    }
    if (log) {
      completed++;
      if (p.isMain) mainCompleted++;
      if (p.isCooldown) cooldownCompleted++;
      const hasValue =
        (typeof log.sets === 'number' && log.sets > 0) ||
        (typeof log.reps === 'number' && log.reps > 0);
      if (hasValue) withPerformedValue++;
    }
  }

  const cooldownItemsCount = planItems.filter((p) => p.isCooldown).length;
  return {
    completed,
    mainCompleted,
    withPerformedValue,
    matchedByPlanItemKey,
    matchedByTemplateFallback,
    cooldownItemsCount,
    cooldownCompleted,
  };
}

function computeReflectionFlags(
  feedbackPayload: FeedbackPayload | null,
  exerciseLogs: ExerciseLogItem[]
): { reflection: boolean; rpe: boolean; discomfort: boolean } {
  const hasSessionRpe =
    typeof feedbackPayload?.sessionFeedback?.overallRpe === 'number';
  const hasPainAfter =
    typeof feedbackPayload?.sessionFeedback?.painAfter === 'number';
  const hasExerciseRpe = exerciseLogs.some(
    (l) => typeof l.rpe === 'number' && l.rpe >= 0
  );
  const hasDiscomfort = exerciseLogs.some(
    (l) => typeof l.discomfort === 'number' && l.discomfort >= 0
  );
  const hasDifficultyFeedback =
    feedbackPayload?.sessionFeedback?.difficultyFeedback != null;
  const hasPainAreas =
    Array.isArray(feedbackPayload?.sessionFeedback?.painAreas) &&
    feedbackPayload.sessionFeedback.painAreas.length > 0;
  return {
    reflection: hasSessionRpe || hasPainAfter || hasExerciseRpe || hasDiscomfort ||
      hasDifficultyFeedback || hasPainAreas,
    rpe: hasSessionRpe || hasExerciseRpe,
    discomfort: hasPainAfter || hasDiscomfort,
  };
}

/**
 * Evidence Score v1 with breakdown. Uses constants from evidence-gate-constants.
 */
function computeEvidenceScoreWithBreakdown(
  totalItems: number,
  completed: number,
  withPerformedValue: number,
  feedbackPayload: FeedbackPayload | null,
  exerciseLogs: ExerciseLogItem[]
): { total: number; breakdown: { coverage: number; performed_value: number; reflection: number } } {
  if (totalItems <= 0) {
    return { total: 0, breakdown: { coverage: 0, performed_value: 0, reflection: 0 } };
  }

  const coverage = completed / totalItems;
  const coveragePoints = Math.round(coverage * EVIDENCE_SCORE_COVERAGE_MAX);

  const density = completed > 0 ? withPerformedValue / completed : 0;
  const performedValuePoints = Math.round(density * EVIDENCE_SCORE_PERFORMED_VALUE_MAX);

  const { reflection } = computeReflectionFlags(feedbackPayload, exerciseLogs);
  const reflectionPoints = reflection ? EVIDENCE_SCORE_REFLECTION_MAX : 0;

  const total = Math.min(
    EVIDENCE_SCORE_COVERAGE_MAX + EVIDENCE_SCORE_PERFORMED_VALUE_MAX + EVIDENCE_SCORE_REFLECTION_MAX,
    coveragePoints + performedValuePoints + reflectionPoints
  );

  return {
    total,
    breakdown: { coverage: coveragePoints, performed_value: performedValuePoints, reflection: reflectionPoints },
  };
}

function buildObservability(
  totalItems: number,
  completed: number,
  mainCompleted: number,
  mainItemsCount: number,
  withPerformedValue: number,
  feedbackPayload: FeedbackPayload | null,
  exerciseLogs: ExerciseLogItem[],
  scoreResult: { total: number; breakdown: { coverage: number; performed_value: number; reflection: number } },
  allowed: boolean,
  code?: EvidenceGateErrorCode,
  rejectDetail?: RejectReasonDetail,
  mainGateSkipped?: boolean,
  identityMatch?: { matchedByPlanItemKey: number; matchedByTemplateFallback: number },
  segmentCompletion?: { cooldown_items_count: number; cooldown_completed_count: number }
): EvidenceGateObservability {
  const receivedExerciseLogsCount = exerciseLogs.length;
  const { reflection, rpe, discomfort } = computeReflectionFlags(feedbackPayload, exerciseLogs);
  const completionRatio = totalItems > 0 ? completed / totalItems : 0;

  const obs: EvidenceGateObservability = {
    total_items: totalItems,
    completed_items: completed,
    completion_ratio: completionRatio,
    coverage_ratio: completionRatio,
    main_segment_required: mainItemsCount > 0,
    main_segment_completed: mainCompleted,
    performed_value_count: withPerformedValue,
    reflection_present: reflection,
    rpe_present: rpe,
    discomfort_present: discomfort,
    evidence_score_total: scoreResult.total,
    evidence_score_breakdown: scoreResult.breakdown,
    threshold_used: {
      completion_min_ratio: EVIDENCE_GATE_COMPLETION_MIN_RATIO,
      score_allow: EVIDENCE_GATE_SCORE_ALLOW_THRESHOLD,
      score_recoverable_min: EVIDENCE_GATE_SCORE_RECOVERABLE_MIN,
    },
    threshold_profile: EVIDENCE_GATE_THRESHOLD_PROFILE,
    received_exercise_logs_count: receivedExerciseLogsCount,
    rejected_or_allowed: allowed ? 'allowed' : 'rejected',
  };

  if (mainGateSkipped) {
    obs.main_gate_skipped = true;
    obs.main_gate_skip_reason = 'no_main_segment';
  }
  if (!allowed && code) obs.reject_reason_code = code;
  if (!allowed && rejectDetail) obs.reject_reason_detail = rejectDetail;
  if (identityMatch) {
    obs.identity_match = {
      matched_by_plan_item_key_count: identityMatch.matchedByPlanItemKey,
      matched_by_template_fallback_count: identityMatch.matchedByTemplateFallback,
      unmatched_plan_items_count: totalItems - completed,
    };
  }
  if (segmentCompletion) obs.segment_completion = segmentCompletion;

  return obs;
}

/**
 * Evaluate session completion against evidence gate.
 * Call before persisting completion.
 * Returns observability for both allowed and rejected paths.
 */
export function evaluateEvidenceGate(
  planJson: PlanJson | null | undefined,
  exerciseLogs: ExerciseLogItem[],
  feedbackPayload: FeedbackPayload | null
): EvidenceGateResult {
  const planItems = buildPlanItemList(planJson);
  const totalItems = planItems.length;
  const mainItems = planItems.filter((p) => p.isMain);
  const mainItemsCount = mainItems.length;

  if (totalItems === 0) {
    const rejectDetail: RejectReasonDetail = !planJson
      ? 'MISSING_PLAN_STRUCTURE'
      : !planJson.segments?.length
        ? 'EMPTY_PLAN_SEGMENTS'
        : 'EMPTY_PLAN_SEGMENTS';
    const obs = buildObservability(
      0, 0, 0, 0, 0, feedbackPayload, exerciseLogs,
      { total: 0, breakdown: { coverage: 0, performed_value: 0, reflection: 0 } },
      false,
      'INSUFFICIENT_EXECUTION_EVIDENCE',
      rejectDetail
    );
    return {
      allowed: false,
      code: 'INSUFFICIENT_EXECUTION_EVIDENCE',
      message: '세션 플랜 정보가 없어 완료할 수 없습니다.',
      observability: obs,
    };
  }

  const {
    completed,
    mainCompleted,
    withPerformedValue,
    matchedByPlanItemKey,
    matchedByTemplateFallback,
    cooldownItemsCount,
    cooldownCompleted,
  } = countCompletedItems(planItems, exerciseLogs);

  const scoreResult = computeEvidenceScoreWithBreakdown(
    totalItems,
    completed,
    withPerformedValue,
    feedbackPayload,
    exerciseLogs
  );

  const identityMatch = { matchedByPlanItemKey, matchedByTemplateFallback };
  const segmentCompletion: { cooldown_items_count: number; cooldown_completed_count: number } | undefined =
    cooldownItemsCount > 0 ? { cooldown_items_count: cooldownItemsCount, cooldown_completed_count: cooldownCompleted } : undefined;

  // Hard gate 1 (relaxed): block only when there are main items and nothing at all was completed.
  // If the user completed prep/cooldown items with enough overall evidence, let later gates decide.
  if (mainItemsCount > 0 && mainCompleted < 1 && completed === 0) {
    const obs = buildObservability(
      totalItems, completed, mainCompleted, mainItemsCount, withPerformedValue,
      feedbackPayload, exerciseLogs, scoreResult, false,
      'MAIN_SEGMENT_REQUIRED',
      undefined,
      undefined,
      identityMatch,
      segmentCompletion
    );
    return {
      allowed: false,
      code: 'MAIN_SEGMENT_REQUIRED',
      message: '메인 운동을 최소 1개 이상 완료해 주세요.',
      observability: obs,
    };
  }

  const mainGateSkipped = mainItemsCount === 0;
  if (mainGateSkipped) {
    // Record skip trace for observability
  }

  // Hard gate 2: require at least the configured minimum completion ratio.
  const coverageRatio = completed / totalItems;
  if (coverageRatio < EVIDENCE_GATE_COMPLETION_MIN_RATIO) {
    const coverageRejectDetail: RejectReasonDetail | undefined =
      exerciseLogs.length === 0 ? 'NO_EXECUTION_LOGS' : undefined;
    const obs = buildObservability(
      totalItems, completed, mainCompleted, mainItemsCount, withPerformedValue,
      feedbackPayload, exerciseLogs, scoreResult, false,
      'NOT_ENOUGH_COMPLETION_COVERAGE',
      coverageRejectDetail,
      undefined,
      identityMatch,
      segmentCompletion
    );
    if (mainGateSkipped) {
      obs.main_gate_skipped = true;
      obs.main_gate_skip_reason = 'no_main_segment';
    }
    return {
      allowed: false,
      code: 'NOT_ENOUGH_COMPLETION_COVERAGE',
      message: `전체 운동의 ${Math.round(EVIDENCE_GATE_COMPLETION_MIN_RATIO * 100)}% 이상 완료해 주세요. (현재 ${Math.round(coverageRatio * 100)}%)`,
      observability: obs,
    };
  }

  // Evidence Score v1
  const { total: score } = scoreResult;

  if (score >= EVIDENCE_GATE_SCORE_ALLOW_THRESHOLD) {
    const obs = buildObservability(
      totalItems, completed, mainCompleted, mainItemsCount, withPerformedValue,
      feedbackPayload, exerciseLogs, scoreResult, true,
      undefined,
      undefined,
      undefined,
      identityMatch
    );
    if (mainGateSkipped) {
      obs.main_gate_skipped = true;
      obs.main_gate_skip_reason = 'no_main_segment';
    }
    return { allowed: true, observability: obs };
  }

  const rejectDetail: RejectReasonDetail =
    score < EVIDENCE_GATE_SCORE_RECOVERABLE_MIN
      ? 'LOW_EVIDENCE_SCORE'
      : withPerformedValue / Math.max(1, completed) < 0.5
        ? 'LOW_PERFORMED_VALUE_DENSITY'
        : 'LOW_EVIDENCE_SCORE';

  const obs = buildObservability(
    totalItems, completed, mainCompleted, mainItemsCount, withPerformedValue,
    feedbackPayload, exerciseLogs, scoreResult, false,
    'INSUFFICIENT_EXECUTION_EVIDENCE',
    rejectDetail,
    undefined,
    identityMatch,
    segmentCompletion
  );
  if (mainGateSkipped) {
    obs.main_gate_skipped = true;
    obs.main_gate_skip_reason = 'no_main_segment';
  }

  if (score >= EVIDENCE_GATE_SCORE_RECOVERABLE_MIN) {
    return {
      allowed: false,
      code: 'INSUFFICIENT_EXECUTION_EVIDENCE',
      message: '운동 기록과 피드백을 더 입력해 주세요.',
      observability: obs,
    };
  }

  return {
    allowed: false,
    code: 'INSUFFICIENT_EXECUTION_EVIDENCE',
    message: '운동 실행 기록이 부족합니다. 더 많은 운동을 완료해 주세요.',
    observability: obs,
  };
}
