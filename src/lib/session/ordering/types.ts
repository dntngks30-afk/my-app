/**
 * PR-ALG-17: Session Ordering Engine — types.
 * Pure function. Post-selection ordering only.
 */

import type { PlanItem, PlanJsonOutput, PlanSegment } from '@/lib/session/plan-generator';

export type OrderingBucket =
  | 'reset'
  | 'mobility'
  | 'activation'
  | 'stability'
  | 'pattern'
  | 'integration'
  | 'cooldown';

export interface OrderingTemplateLike {
  id: string;
  focus_tags: string[];
  phase?: string | null;
  difficulty?: string | null;
  progression_level?: number | null;
  balance_demand?: string | null;
  complexity?: string | null;
}

export interface OrderingContext {
  sessionNumber: number;
  isFirstSession: boolean;
  painMode?: 'none' | 'caution' | 'protected' | null;
  priorityVector?: Record<string, number> | null;
}

export interface OrderingItemMove {
  segment: string;
  templateId: string;
  fromIndex: number;
  toIndex: number;
  rule: string;
}

export interface OrderingEngineMeta {
  version: 'session_ordering_engine_v1';
  applied: boolean;
  segment_order: string[];
  item_moves: OrderingItemMove[];
  strategy: 'normal' | 'first_session' | 'pain_mode_protected' | 'pain_mode_caution';
  summary: string;
}

export type { PlanItem, PlanJsonOutput, PlanSegment };
