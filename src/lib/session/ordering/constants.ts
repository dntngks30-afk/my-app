/**
 * PR-ALG-17: Session Ordering Engine — constants.
 * Ordering buckets and segment order.
 */

import type { OrderingBucket } from './types';

/** Segment order: Prep → Main → Accessory → Cooldown */
export const SEGMENT_ORDER = ['Prep', 'Main', 'Accessory', 'Cooldown'] as const;

/** Ordering bucket priority: lower = earlier in segment */
export const BUCKET_ORDER: OrderingBucket[] = [
  'reset',
  'mobility',
  'activation',
  'stability',
  'pattern',
  'integration',
  'cooldown',
];

/** focus_tags → ordering bucket mapping (first match wins) */
export const FOCUS_TAG_TO_BUCKET: Record<string, OrderingBucket> = {
  // reset / release
  full_body_reset: 'reset',
  calf_release: 'reset',
  upper_trap_release: 'reset',
  neck_mobility: 'reset',
  hip_flexor_stretch: 'reset',
  // mobility
  thoracic_mobility: 'mobility',
  shoulder_mobility: 'mobility',
  hip_mobility: 'mobility',
  ankle_mobility: 'mobility',
  // activation
  glute_activation: 'activation',
  upper_back_activation: 'activation',
  // stability
  core_stability: 'stability',
  global_core: 'stability',
  shoulder_stability: 'stability',
  core_control: 'stability',
  // pattern
  lower_chain_stability: 'pattern',
  glute_medius: 'pattern',
  basic_balance: 'pattern',
};

/** Default bucket when no tag matches */
export const DEFAULT_BUCKET: OrderingBucket = 'pattern';

export const ORDERING_ENGINE_VERSION = 'session_ordering_engine_v1' as const;
