import type { SessionPlanJson } from '@/lib/session/client'

/** SessionPanelV2에서 렌더할 최소 운동 표현 */
export interface ExerciseItem {
  templateId: string
  name: string
  targetSets?: number
  targetReps?: number
  holdSeconds?: number
  segmentTitle: string
  order: number
}

/**
 * plan_json에서 전체 운동 배열을 추출한다.
 * segments 순서를 유지하며 flatMap한다.
 * plan_json이 없거나 segments가 없으면 빈 배열을 반환한다.
 */
export function extractSessionExercises(
  planJson: SessionPlanJson | undefined | null,
): ExerciseItem[] {
  if (!planJson?.segments?.length) return []

  return planJson.segments.flatMap(seg =>
    seg.items.map(item => ({
      templateId: item.templateId,
      name: item.name,
      targetSets: item.sets,
      targetReps: item.reps,
      holdSeconds: item.hold_seconds,
      segmentTitle: seg.title,
      order: item.order,
    })),
  )
}
