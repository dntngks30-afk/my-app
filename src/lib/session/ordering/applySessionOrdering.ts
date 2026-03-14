/**
 * PR-ALG-17: Session Ordering Engine.
 * Pure function. Reorders items within segments for natural execution flow.
 * Applied AFTER constraint engine. Does not add/remove items.
 */

import type { PlanItem, PlanJsonOutput, PlanSegment } from '@/lib/session/plan-generator';
import type {
  OrderingContext,
  OrderingEngineMeta,
  OrderingItemMove,
  OrderingTemplateLike,
} from './types';
import { SEGMENT_ORDER } from './constants';
import { deriveOrderingBucket, getBucketPriority } from './deriveOrderingBucket';

const DIFFICULTY_ORDER: Record<string, number> = { low: 1, medium: 2, high: 3 };

function getDifficultyRank(difficulty: string | null | undefined): number {
  return DIFFICULTY_ORDER[difficulty ?? ''] ?? 2;
}

function getComplexityScore(template: OrderingTemplateLike | null): number {
  if (!template) return 0;
  const balance = template.balance_demand === 'high' ? 2 : template.balance_demand === 'medium' ? 1 : 0;
  const complexity = template.complexity === 'high' ? 2 : template.complexity === 'medium' ? 1 : 0;
  return balance + complexity;
}

function cloneSegments(segments: PlanSegment[]): PlanSegment[] {
  return segments.map((seg) => ({
    ...seg,
    items: seg.items.map((item) => ({ ...item })),
  }));
}

function ensureSegmentOrder(segments: PlanSegment[]): PlanSegment[] {
  const orderIdx = (title: string) => {
    const i = SEGMENT_ORDER.indexOf(title as (typeof SEGMENT_ORDER)[number]);
    return i >= 0 ? i : SEGMENT_ORDER.length;
  };
  return [...segments].sort((a, b) => orderIdx(a.title) - orderIdx(b.title));
}

/**
 * Sort items within a segment by ordering bucket, then difficulty/complexity.
 * First session: activation/reset/mobility first, high-load pattern last.
 * Pain mode: low complexity/balance first.
 */
function sortSegmentItems(
  items: PlanItem[],
  templateById: Map<string, OrderingTemplateLike>,
  context: OrderingContext,
  segmentTitle: string,
  moves: OrderingItemMove[]
): PlanItem[] {
  if (items.length <= 1) return items;

  const itemWithMeta = items.map((item, idx) => {
    const template = templateById.get(item.templateId);
    const bucket = deriveOrderingBucket(template, segmentTitle);
    const priority = getBucketPriority(bucket);
    const difficultyRank = getDifficultyRank(template?.difficulty);
    const complexityScore = getComplexityScore(template);
    return { item, idx, template, bucket, priority, difficultyRank, complexityScore };
  });

  const sorted = [...itemWithMeta].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;

    if (context.isFirstSession) {
      return a.difficultyRank - b.difficultyRank;
    }

    if (context.painMode === 'protected' || context.painMode === 'caution') {
      return a.complexityScore - b.complexityScore;
    }

    return a.difficultyRank - b.difficultyRank || a.item.templateId.localeCompare(b.item.templateId);
  });

  for (let i = 0; i < sorted.length; i++) {
    const origIdx = sorted[i]!.idx;
    if (origIdx !== i) {
      moves.push({
        segment: segmentTitle,
        templateId: sorted[i]!.item.templateId,
        fromIndex: origIdx,
        toIndex: i,
        rule: context.isFirstSession
          ? 'first_session_difficulty_order'
          : context.painMode && context.painMode !== 'none'
            ? 'pain_mode_safe_first'
            : 'activation_before_pattern',
      });
    }
  }

  return sorted.map((s, i) => ({ ...s.item, order: i + 1 }));
}

export function applySessionOrdering(
  plan: PlanJsonOutput,
  templates: OrderingTemplateLike[],
  context: OrderingContext
): { plan: PlanJsonOutput; meta: OrderingEngineMeta } {
  const templateById = new Map(templates.map((t) => [t.id, t]));
  const moves: OrderingItemMove[] = [];

  let segments = cloneSegments(plan.segments);
  segments = ensureSegmentOrder(segments);

  for (const segment of segments) {
    if (segment.items.length <= 1) continue;

    const mainSegments = ['Main', 'Accessory'];
    if (!mainSegments.includes(segment.title)) continue;

    segment.items = sortSegmentItems(
      segment.items,
      templateById,
      context,
      segment.title,
      moves
    );
  }

  const strategy: OrderingEngineMeta['strategy'] = context.isFirstSession
    ? 'first_session'
    : context.painMode === 'protected'
      ? 'pain_mode_protected'
      : context.painMode === 'caution'
        ? 'pain_mode_caution'
        : 'normal';

  const summary =
    moves.length > 0
      ? `Reordered ${moves.length} item(s) for ${strategy} flow`
      : `Segment order preserved (${strategy})`;

  const meta: OrderingEngineMeta = {
    version: 'session_ordering_engine_v1',
    applied: moves.length > 0,
    segment_order: segments.map((s) => s.title),
    item_moves: moves,
    strategy,
    summary,
  };

  return {
    plan: {
      ...plan,
      segments,
      meta: {
        ...plan.meta,
        ordering_engine: meta,
      },
    },
    meta,
  };
}
