import type { PlanJsonSegmentsForDisplay } from '@/lib/session/client'
import { buildPlanItemKey } from '@/lib/session/exercise-log-identity'

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
  /** HOTFIX: plan item identity — stable key for log matching (segmentIndex:itemIndex:templateId) */
  plan_item_key?: string
  segment_index?: number
  item_index?: number
}

/** Re-export for backward compat. SSOT: @/lib/session/exercise-log-identity */
export { buildPlanItemKey }

/** logs lookup key — plan_item_key 우선, templateId fallback */
export function getLogKey(item: ExerciseItem, log?: { plan_item_key?: string }): string {
  return log?.plan_item_key ?? item.plan_item_key ?? item.templateId
}

/**
 * plan_json(또는 summary)에서 전체 운동 배열을 추출한다.
 * summary/full 모두 segments만 있으면 동작. segments 순서를 유지하며 flatMap.
 */
export function extractSessionExercises(
  planJson: PlanJsonSegmentsForDisplay | undefined | null,
): ExerciseItem[] {
  if (!planJson?.segments?.length) return []

  /** PR-SESSION-BASELINE-01: Accessory를 Main에 흡수해 UI는 prep/main/cooldown만 표시 */
  return planJson.segments.flatMap((seg, segIdx) =>
    (seg.items ?? []).map((item, itemIdx) => {
      const templateId = item.templateId ?? ''
      return {
        templateId,
        name: item.name ?? '',
        targetSets: item.sets,
        targetReps: item.reps,
        holdSeconds: item.hold_seconds,
        segmentTitle: (seg.title === 'Accessory' ? 'Main' : seg.title) ?? '',
        order: item.order ?? 0,
        rationale: item.rationale ?? undefined,
        plan_item_key: buildPlanItemKey(segIdx, itemIdx, templateId),
        segment_index: segIdx,
        item_index: itemIdx,
      }
    }),
  )
}
