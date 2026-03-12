/**
 * PR-DATA-01: Session completion evidence gate
 * Server-side validation to prevent completing sessions with insufficient execution evidence.
 * Hard gates + Evidence Score v1 (minimal viable subset).
 */

export type EvidenceGateErrorCode =
  | 'NOT_ENOUGH_COMPLETION_COVERAGE'
  | 'MAIN_SEGMENT_REQUIRED'
  | 'INSUFFICIENT_EXECUTION_EVIDENCE';

export type EvidenceGateResult =
  | { allowed: true }
  | { allowed: false; code: EvidenceGateErrorCode; message: string };

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

export type ExerciseLogItem = {
  templateId: string;
  name: string;
  sets: number | null;
  reps: number | null;
  difficulty: number | null;
  rpe?: number | null;
  discomfort?: number | null;
};

export type FeedbackPayload = {
  sessionFeedback?: {
    overallRpe?: number;
    painAfter?: number;
    completionRatio?: number;
  };
  exerciseFeedback?: Array<{ exerciseKey?: string }>;
};

type PlanItemInfo = {
  templateId: string;
  segmentTitle: string;
  isMain: boolean;
};

function buildPlanItemList(planJson: PlanJson | null | undefined): PlanItemInfo[] {
  const items: PlanItemInfo[] = [];
  if (!planJson?.segments) return items;
  for (const seg of planJson.segments) {
    const title = seg.title ?? '';
    const isMain = title.toLowerCase() === 'main';
    for (const it of seg.items ?? []) {
      const tid = it?.templateId;
      if (tid) {
        items.push({ templateId: tid, segmentTitle: title, isMain });
      }
    }
  }
  return items;
}

/**
 * Match exercise_logs to plan items (1:1 by templateId, consuming logs in order).
 */
function countCompletedItems(
  planItems: PlanItemInfo[],
  exerciseLogs: ExerciseLogItem[]
): { completed: number; mainCompleted: number; withPerformedValue: number } {
  const logQueue = new Map<string, ExerciseLogItem[]>();
  for (const log of exerciseLogs) {
    const q = logQueue.get(log.templateId) ?? [];
    q.push(log);
    logQueue.set(log.templateId, q);
  }

  let completed = 0;
  let mainCompleted = 0;
  let withPerformedValue = 0;

  for (const p of planItems) {
    const q = logQueue.get(p.templateId);
    const log = q?.shift();
    if (log) {
      completed++;
      if (p.isMain) mainCompleted++;
      const hasValue =
        (typeof log.sets === 'number' && log.sets > 0) ||
        (typeof log.reps === 'number' && log.reps > 0);
      if (hasValue) withPerformedValue++;
    }
  }

  return { completed, mainCompleted, withPerformedValue };
}

/**
 * Evidence Score v1 (minimal viable).
 * - completion coverage: max 40
 * - performed value density: max 20
 * - reflection/RPE/discomfort: max 15
 */
function computeEvidenceScore(
  totalItems: number,
  completed: number,
  withPerformedValue: number,
  feedbackPayload: FeedbackPayload | null,
  exerciseLogs: ExerciseLogItem[]
): number {
  if (totalItems <= 0) return 0;

  let score = 0;

  // completion coverage: max 40
  const coverage = completed / totalItems;
  score += Math.round(coverage * 40);

  // performed value density: max 20 (actual_reps or sets present)
  const density = completed > 0 ? withPerformedValue / completed : 0;
  score += Math.round(density * 20);

  // reflection/RPE/discomfort: max 15
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
  const hasReflection = hasSessionRpe || hasPainAfter || hasExerciseRpe || hasDiscomfort;
  if (hasReflection) score += 15;

  return Math.min(85, score);
}

/**
 * Evaluate session completion against evidence gate.
 * Call before persisting completion.
 */
export function evaluateEvidenceGate(
  planJson: PlanJson | null | undefined,
  exerciseLogs: ExerciseLogItem[],
  feedbackPayload: FeedbackPayload | null
): EvidenceGateResult {
  const planItems = buildPlanItemList(planJson);
  const totalItems = planItems.length;

  if (totalItems === 0) {
    return {
      allowed: false,
      code: 'INSUFFICIENT_EXECUTION_EVIDENCE',
      message: '세션 플랜 정보가 없어 완료할 수 없습니다.',
    };
  }

  const { completed, mainCompleted, withPerformedValue } = countCompletedItems(
    planItems,
    exerciseLogs
  );

  // Hard gate 1: at least 1 MAIN segment item must be completed
  const mainItems = planItems.filter((p) => p.isMain);
  if (mainItems.length > 0 && mainCompleted < 1) {
    return {
      allowed: false,
      code: 'MAIN_SEGMENT_REQUIRED',
      message: '메인 운동을 최소 1개 이상 완료해 주세요.',
    };
  }

  // Hard gate 2: at least 60% of total items completed
  const coverageRatio = completed / totalItems;
  if (coverageRatio < 0.6) {
    return {
      allowed: false,
      code: 'NOT_ENOUGH_COMPLETION_COVERAGE',
      message: `전체 운동의 60% 이상 완료해 주세요. (현재 ${Math.round(coverageRatio * 100)}%)`,
    };
  }

  // Evidence Score v1
  const score = computeEvidenceScore(
    totalItems,
    completed,
    withPerformedValue,
    feedbackPayload,
    exerciseLogs
  );

  if (score >= 70) {
    return { allowed: true };
  }

  if (score >= 50) {
    return {
      allowed: false,
      code: 'INSUFFICIENT_EXECUTION_EVIDENCE',
      message: '운동 기록과 피드백을 더 입력해 주세요.',
    };
  }

  return {
    allowed: false,
    code: 'INSUFFICIENT_EXECUTION_EVIDENCE',
    message: '운동 실행 기록이 부족합니다. 더 많은 운동을 완료해 주세요.',
  };
}
