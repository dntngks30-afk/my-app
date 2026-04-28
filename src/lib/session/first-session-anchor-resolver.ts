/**
 * PR-FIRST-SESSION-ANCHOR-SSOT-01: Session 1 gold path 단일 순서 — preview와 materialized 공유.
 *
 * priority-layer와 직접 순환 참조 피함: 아래 매핑은 BASELINE_ANCHOR_TO_GOLD_PATH와 동일 스냅샷 유지.
 */

export type FirstSessionGoldPathVector =
  | 'lower_stability'
  | 'lower_mobility'
  | 'trunk_control'
  | 'upper_mobility'
  | 'deconditioned'
  | 'balanced_reset';

const GOLD_PATH_SET = new Set<string>([
  'lower_stability',
  'lower_mobility',
  'trunk_control',
  'upper_mobility',
  'deconditioned',
  'balanced_reset',
]);

/** priority-layer BASELINE_ANCHOR_TO_GOLD_PATH 과 동치 (문서 참조 유지용) */
export const LOCAL_BASELINE_ANCHOR_TO_GOLD_PATH: Record<string, FirstSessionGoldPathVector> = {
  lower_stability: 'lower_stability',
  lower_mobility: 'lower_mobility',
  upper_mobility: 'upper_mobility',
  trunk_control: 'trunk_control',
  deconditioned: 'deconditioned',
  balanced_reset: 'balanced_reset',
};

export type GoldPathResolutionSource =
  | 'first_session_intent'
  | 'baseline_anchor'
  | 'primary_type'
  | 'priority_vector'
  | 'none';

export function isValidGoldPath(value: string | null | undefined): value is FirstSessionGoldPathVector {
  return typeof value === 'string' && GOLD_PATH_SET.has(value);
}

export function mapPrimaryTypeToGoldPath(
  primaryType: string | null | undefined
): FirstSessionGoldPathVector | null {
  const key = typeof primaryType === 'string' ? primaryType.trim() : '';
  switch (key) {
    case 'LOWER_INSTABILITY':
      return 'lower_stability';
    case 'LOWER_MOBILITY_RESTRICTION':
      return 'lower_mobility';
    case 'CORE_CONTROL_DEFICIT':
      return 'trunk_control';
    case 'UPPER_IMMOBILITY':
      return 'upper_mobility';
    case 'DECONDITIONED':
      return 'deconditioned';
    case 'STABLE':
      return 'balanced_reset';
    default:
      return null;
  }
}

export function mapBaselineAnchorToGoldPath(
  baselineSessionAnchor: string | null | undefined
): FirstSessionGoldPathVector | null {
  const trimmed = typeof baselineSessionAnchor === 'string' ? baselineSessionAnchor.trim() : '';
  if (!trimmed) return null;
  const v = LOCAL_BASELINE_ANCHOR_TO_GOLD_PATH[trimmed];
  return v ?? null;
}

export function resolveFromPriorityVector(
  priorityVector: Record<string, number> | null | undefined
): FirstSessionGoldPathVector | null {
  if (!priorityVector || typeof priorityVector !== 'object') return null;
  const ranked = Object.entries(priorityVector)
    .filter(
      (entry): entry is [FirstSessionGoldPathVector, number] =>
        GOLD_PATH_SET.has(entry[0]) && typeof entry[1] === 'number' && entry[1] > 0
    )
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));
  if (ranked.length === 0) return null;
  return ranked[0]![0];
}

export function resolveGoldPathVectorUnified(input: {
  sessionNumber: number;
  firstSessionGoldPath?: string | null;
  baselineSessionAnchor?: string | null;
  primaryType?: string | null;
  priorityVector?: Record<string, number> | null;
}): { vector: FirstSessionGoldPathVector | null; source: GoldPathResolutionSource } {
  if (input.sessionNumber === 1) {
    if (isValidGoldPath(input.firstSessionGoldPath)) {
      return { vector: input.firstSessionGoldPath, source: 'first_session_intent' };
    }

    const fromBaseline = mapBaselineAnchorToGoldPath(input.baselineSessionAnchor);
    if (fromBaseline) {
      return { vector: fromBaseline, source: 'baseline_anchor' };
    }

    const fromPrimary = mapPrimaryTypeToGoldPath(input.primaryType);
    if (fromPrimary) {
      return { vector: fromPrimary, source: 'primary_type' };
    }

    const fromPriority = resolveFromPriorityVector(input.priorityVector);
    if (fromPriority) {
      return { vector: fromPriority, source: 'priority_vector' };
    }

    return { vector: null, source: 'none' };
  }

  const fromPriority = resolveFromPriorityVector(input.priorityVector);
  if (fromPriority) {
    return { vector: fromPriority, source: 'priority_vector' };
  }

  const fromPrimary = mapPrimaryTypeToGoldPath(input.primaryType);
  if (fromPrimary) {
    return { vector: fromPrimary, source: 'primary_type' };
  }

  return { vector: null, source: 'none' };
}
