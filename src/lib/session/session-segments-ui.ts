/**
 * PR-SESSION-BASELINE-01: UI segment normalization
 *
 * Composer outputs Prep / Main / Accessory / Cooldown.
 * UI shows Prep / Main / Cooldown only — Accessory merged into Main.
 * Preserves original segment_index/item_index for plan_item_key identity.
 */

import type { SessionPlanSegment, SessionPlanSegmentItem } from './client';

export type NormalizedSegmentItem = SessionPlanSegmentItem & {
  _originalSegIdx: number;
  _originalItemIdx: number;
};

export type NormalizedSegment = {
  title: string;
  duration_sec: number;
  items: NormalizedSegmentItem[];
};

/**
 * Normalize segments for UI: Prep → Main → Cooldown.
 * Accessory items are merged into Main. Original indices preserved for identity.
 */
export function normalizeSessionSegmentsForUI(
  segments: SessionPlanSegment[] | undefined
): NormalizedSegment[] {
  if (!segments?.length) return [];

  const result: NormalizedSegment[] = [];
  let mainAccum: NormalizedSegmentItem[] = [];
  let mainDuration = 0;

  const flushMain = () => {
    if (mainAccum.length > 0) {
      result.push({
        title: 'Main',
        duration_sec: mainDuration,
        items: mainAccum,
      });
      mainAccum = [];
      mainDuration = 0;
    }
  };

  for (let segIdx = 0; segIdx < segments.length; segIdx++) {
    const seg = segments[segIdx]!;
    const items = seg.items ?? [];
    const displayTitle = seg.title === 'Accessory' ? 'Main' : seg.title;

    if (displayTitle === 'Main') {
      for (let itemIdx = 0; itemIdx < items.length; itemIdx++) {
        mainAccum.push({
          ...items[itemIdx]!,
          _originalSegIdx: segIdx,
          _originalItemIdx: itemIdx,
        });
      }
      mainDuration += seg.duration_sec ?? 0;
    } else {
      flushMain();
      result.push({
        title: displayTitle,
        duration_sec: seg.duration_sec ?? 0,
        items: items.map((item, itemIdx) => ({
          ...item,
          _originalSegIdx: segIdx,
          _originalItemIdx: itemIdx,
        })),
      });
    }
  }
  flushMain();

  return result;
}
