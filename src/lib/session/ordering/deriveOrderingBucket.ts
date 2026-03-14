/**
 * PR-ALG-17: Derive ordering bucket from template metadata.
 * focus_tags / phase / difficulty / progression_level based.
 */

import type { OrderingBucket } from './types';
import type { OrderingTemplateLike } from './types';
import {
  BUCKET_ORDER,
  FOCUS_TAG_TO_BUCKET,
  DEFAULT_BUCKET,
} from './constants';

/**
 * Derive ordering bucket for an item.
 * First checks focus_tags, then falls back to phase/difficulty heuristics.
 */
export function deriveOrderingBucket(
  template: OrderingTemplateLike | null,
  segmentTitle: string
): OrderingBucket {
  if (segmentTitle === 'Cooldown') {
    return 'cooldown';
  }

  if (!template?.focus_tags?.length) {
    return DEFAULT_BUCKET;
  }

  for (const tag of template.focus_tags) {
    const bucket = FOCUS_TAG_TO_BUCKET[tag];
    if (bucket) return bucket;
  }

  return DEFAULT_BUCKET;
}

/**
 * Get numeric priority for sorting (lower = earlier).
 */
export function getBucketPriority(bucket: OrderingBucket): number {
  const idx = BUCKET_ORDER.indexOf(bucket);
  return idx >= 0 ? idx : BUCKET_ORDER.length;
}
