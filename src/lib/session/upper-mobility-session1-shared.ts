export type SessionSegmentKind = 'prep' | 'main' | 'accessory' | 'cooldown';

const UPPER_MOBILITY_INTENT_TAGS = new Set([
  'shoulder_mobility',
  'thoracic_mobility',
  'upper_back_activation',
  'shoulder_stability',
]);
const TRUNK_CONTROL_TAGS = new Set(['core_control', 'core_stability', 'global_core']);

export function scoreUpperMobilityIntentFit(
  templateFocusTags: readonly string[],
  ruleKind: SessionSegmentKind
): number {
  const hasUpperIntentTag = templateFocusTags.some((tag) => UPPER_MOBILITY_INTENT_TAGS.has(tag));
  const hasTrunkControlTag = templateFocusTags.some((tag) => TRUNK_CONTROL_TAGS.has(tag));

  if (ruleKind === 'main') {
    let score = 13;
    if (hasUpperIntentTag) score += 2;
    if (hasTrunkControlTag && !hasUpperIntentTag) score -= 5;
    return score;
  }
  if (ruleKind === 'accessory') return 6;
  if (ruleKind === 'prep') return 4;
  return 2;
}

export function shouldReserveUpperMainCandidate(args: {
  anchorType?: string | null;
  ruleKind: SessionSegmentKind;
  templateFocusTags: readonly string[];
  isMainEligible: boolean;
}): boolean {
  if (args.anchorType !== 'upper_mobility') return false;
  if (args.ruleKind === 'main') return false;
  const hasUpperMainTag = args.templateFocusTags.some(
    (tag) => tag === 'upper_back_activation' || tag === 'shoulder_stability'
  );
  return hasUpperMainTag && args.isMainEligible;
}

export function shouldReplaceForbiddenDominantByAnchor(args: {
  anchorType?: string | null;
  forbiddenCount: number;
  mainItemCount: number;
}): boolean {
  if (args.anchorType === 'upper_mobility') {
    return args.forbiddenCount >= 1;
  }
  return args.forbiddenCount > args.mainItemCount / 2;
}
