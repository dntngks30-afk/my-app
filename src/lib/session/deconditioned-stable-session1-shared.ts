type SegmentKind = 'prep' | 'main' | 'accessory' | 'cooldown';

export type DeconditionedStablePolishAnchor = 'deconditioned' | 'balanced_reset';

export type DeconditionedStableGoldPathRule = {
  title: 'Prep' | 'Main' | 'Accessory' | 'Cooldown';
  kind: SegmentKind;
  preferredPhases: SegmentKind[];
  preferredVectors: Array<
    'lower_stability' | 'lower_mobility' | 'trunk_control' | 'upper_mobility' | 'deconditioned' | 'balanced_reset'
  >;
  fallbackVectors: Array<
    'lower_stability' | 'lower_mobility' | 'trunk_control' | 'upper_mobility' | 'deconditioned' | 'balanced_reset'
  >;
  preferredProgression: number[];
};

function makeRule(
  title: DeconditionedStableGoldPathRule['title'],
  kind: SegmentKind,
  preferredPhases: SegmentKind[],
  preferredVectors: DeconditionedStableGoldPathRule['preferredVectors'],
  fallbackVectors: DeconditionedStableGoldPathRule['fallbackVectors'],
  preferredProgression: number[]
): DeconditionedStableGoldPathRule {
  return {
    title,
    kind,
    preferredPhases,
    preferredVectors,
    fallbackVectors,
    preferredProgression,
  };
}

export function getDeconditionedFirstSessionGoldPathRules(): DeconditionedStableGoldPathRule[] {
  return [
    makeRule('Prep', 'prep', ['prep'], ['deconditioned'], ['trunk_control'], [1]),
    makeRule(
      'Main',
      'main',
      ['main'],
      ['deconditioned', 'trunk_control'],
      ['upper_mobility', 'lower_mobility'],
      [1, 2]
    ),
    makeRule(
      'Accessory',
      'accessory',
      ['accessory', 'prep'],
      ['upper_mobility', 'trunk_control'],
      ['deconditioned'],
      [1, 2]
    ),
    makeRule(
      'Cooldown',
      'cooldown',
      ['prep', 'accessory'],
      ['deconditioned'],
      ['upper_mobility', 'lower_mobility'],
      [1]
    ),
  ];
}

export function getBalancedResetFirstSessionGoldPathRules(): DeconditionedStableGoldPathRule[] {
  return [
    makeRule(
      'Prep',
      'prep',
      ['prep'],
      ['deconditioned', 'trunk_control'],
      ['upper_mobility'],
      [1]
    ),
    makeRule(
      'Main',
      'main',
      ['main'],
      ['trunk_control', 'upper_mobility'],
      ['upper_mobility', 'deconditioned'],
      [3, 2, 1]
    ),
    makeRule(
      'Accessory',
      'accessory',
      ['accessory', 'main'],
      ['upper_mobility', 'trunk_control'],
      ['deconditioned'],
      [1, 2]
    ),
    makeRule(
      'Cooldown',
      'cooldown',
      ['accessory', 'prep'],
      ['deconditioned', 'upper_mobility'],
      ['trunk_control'],
      [1]
    ),
  ];
}

export function isDeconditionedStablePolishAnchor(
  anchor?: string | null
): anchor is DeconditionedStablePolishAnchor {
  return anchor === 'deconditioned' || anchor === 'balanced_reset';
}

export function scoreDeconditionedStableIntentFit(args: {
  anchorType?: DeconditionedStablePolishAnchor | null;
  templateFocusTags: readonly string[];
  ruleKind?: SegmentKind | null;
}): number {
  const { anchorType, templateFocusTags, ruleKind } = args;
  if (!anchorType) return 0;

  const hasFullBodyReset = templateFocusTags.includes('full_body_reset');
  const hasCoreControl = templateFocusTags.includes('core_control');
  const hasCoreStability = templateFocusTags.includes('core_stability');
  const hasGlobalCore = templateFocusTags.includes('global_core');
  const hasUpperBack = templateFocusTags.includes('upper_back_activation');
  const hasShoulderStability = templateFocusTags.includes('shoulder_stability');
  const hasThoracicMobility = templateFocusTags.includes('thoracic_mobility');
  const hasShoulderMobility = templateFocusTags.includes('shoulder_mobility');
  const hasBasicBalance = templateFocusTags.includes('basic_balance');
  const hasGluteActivation = templateFocusTags.includes('glute_activation');

  if (anchorType === 'deconditioned') {
    if (!ruleKind) {
      return (
        (hasFullBodyReset ? 5 : 0) +
        (hasCoreControl ? 4 : 0) +
        (hasCoreStability ? 2 : 0) +
        (hasUpperBack || hasShoulderStability ? 1 : 0)
      );
    }
    if (ruleKind === 'prep') {
      return (
        (hasFullBodyReset ? 9 : 0) +
        (hasCoreControl ? 4 : 0) +
        ((hasThoracicMobility || hasShoulderMobility) ? 2 : 0)
      );
    }
    if (ruleKind === 'main') {
      return (
        (hasCoreControl ? 8 : 0) +
        ((hasCoreStability || hasGlobalCore) ? 6 : 0) +
        ((hasUpperBack || hasShoulderStability) ? 3 : 0)
      );
    }
    if (ruleKind === 'accessory') {
      return (
        ((hasUpperBack || hasShoulderStability) ? 7 : 0) +
        (hasBasicBalance ? 3 : 0) +
        (hasThoracicMobility ? 2 : 0)
      );
    }
    return (hasFullBodyReset ? 4 : 0) + (hasThoracicMobility ? 2 : 0);
  }

  if (!ruleKind) {
    return (
      (hasShoulderStability ? 5 : 0) +
      (hasCoreControl ? 4 : 0) +
      (hasCoreStability ? 4 : 0) +
      (hasUpperBack ? 3 : 0) +
      (hasThoracicMobility ? 3 : 0) +
      (hasBasicBalance ? 1 : 0)
    );
  }

  if (ruleKind === 'prep') {
    return (
      (hasFullBodyReset ? 6 : 0) +
      (hasCoreControl ? 3 : 0) +
      ((hasThoracicMobility || hasShoulderMobility) ? 3 : 0)
    );
  }
  if (ruleKind === 'main') {
    return (
      (hasShoulderStability ? 8 : 0) +
      (hasCoreControl ? 6 : 0) +
      (hasCoreStability ? 5 : 0) +
      (hasGlobalCore ? 3 : 0) +
      (hasUpperBack ? 3 : 0) +
      (hasThoracicMobility ? 2 : 0)
    );
  }
  if (ruleKind === 'accessory') {
    return (
      (hasUpperBack ? 5 : 0) +
      (hasShoulderStability ? 4 : 0) +
      (hasBasicBalance ? 3 : 0) +
      (hasThoracicMobility ? 2 : 0) +
      (hasGluteActivation ? 1 : 0)
    );
  }
  return (hasFullBodyReset ? 4 : 0) + (hasUpperBack ? 3 : 0) + (hasThoracicMobility ? 2 : 0);
}

export function scoreDeconditionedStableLevelPolishBonus(args: {
  anchorType?: DeconditionedStablePolishAnchor | null;
  templateLevel?: number | null;
}): number {
  const { anchorType, templateLevel } = args;
  if (anchorType !== 'balanced_reset' || typeof templateLevel !== 'number') return 0;
  return templateLevel >= 3 ? 4 : 0;
}
