import type { PlanJsonSegmentsForDisplay } from '@/lib/session/client'

/** SessionPanelV2에서 렌더할 최소 운동 표현 */
export interface ExerciseItem {
  templateId: string
  name: string
  targetSets?: number
  targetReps?: number
  holdSeconds?: number
  segmentTitle: string
  order: number
  /** PR-ALG-10: 운동 처방 근거 */
  rationale?: string | null
}

/**
 * plan_json(또는 summary)에서 전체 운동 배열을 추출한다.
 * summary/full 모두 segments만 있으면 동작. segments 순서를 유지하며 flatMap.
 */
export function extractSessionExercises(
  planJson: PlanJsonSegmentsForDisplay | undefined | null,
): ExerciseItem[] {
  if (!planJson?.segments?.length) return []

  return planJson.segments.flatMap(seg =>
    (seg.items ?? []).map(item => ({
      templateId: item.templateId ?? '',
      name: item.name ?? '',
      targetSets: item.sets,
      targetReps: item.reps,
      holdSeconds: item.hold_seconds,
      segmentTitle: seg.title ?? '',
      order: item.order ?? 0,
      rationale: item.rationale ?? undefined,
    })),
  )
}
