import type { PlanJsonOutput } from '@/lib/session/plan-generator';
import type {
  AlignmentAuditTrace,
  AlignmentMode,
  AlignmentStrength,
  PhaseSemanticGuardrail,
  ReplacementEffect,
} from '@/lib/session/session-snapshot';
import type { SessionAnalysisSourceMode } from '@/lib/session/resolveSessionAnalysisInput';

interface BuildAlignmentAuditInput {
  analysisSourceMode: SessionAnalysisSourceMode;
  sourcePublicResultId: string | null;
  isPublicResultTruthOwner: boolean;
  fallbackReason: string | null;
  baselineSessionAnchor: string | null | undefined;
  baselinePrimaryType: string | null | undefined;
  planJson: PlanJsonOutput | Record<string, unknown>;
}

type PlanMetaShape = {
  baseline_alignment?: {
    baseline_session_anchor?: string | null;
    first_session_intent_anchor?: string | null;
    gold_path_vector?: string | null;
    intent_source?: 'baseline_anchor' | 'legacy_band' | 'none' | null;
  } | null;
  constraint_flags?: {
    fallback_used?: boolean;
  } | null;
  constraint_engine?: {
    reasons?: Array<{
      code?: string;
      beforeValue?: string | number;
      afterValue?: string | number;
    }>;
  } | null;
};

function asPlanMeta(planJson: PlanJsonOutput | Record<string, unknown>): PlanMetaShape {
  const rawMeta = (planJson as { meta?: unknown })?.meta;
  if (!rawMeta || typeof rawMeta !== 'object') return {};
  return rawMeta as PlanMetaShape;
}

function countSegmentItems(planJson: PlanJsonOutput | Record<string, unknown>, title: string): number {
  const segments = (planJson as { segments?: unknown })?.segments;
  if (!Array.isArray(segments)) return 0;
  const segment = segments.find((entry) => {
    if (!entry || typeof entry !== 'object') return false;
    return ((entry as { title?: unknown }).title ?? null) === title;
  }) as { items?: unknown } | undefined;
  if (!segment || !Array.isArray(segment.items)) return 0;
  return segment.items.length;
}

function resolveAlignmentMode(input: {
  analysisSourceMode: SessionAnalysisSourceMode;
  isPublicResultTruthOwner: boolean;
  selectedAnchor: string | null;
  realizedIntentAnchor: string | null;
  intentSource: 'baseline_anchor' | 'legacy_band' | 'none' | 'unknown';
  fallbackUsedByGenerator: boolean;
}): AlignmentMode {
  if (input.analysisSourceMode === 'legacy_paid_deep' || !input.isPublicResultTruthOwner) {
    return 'fallback';
  }

  if (!input.selectedAnchor) {
    if (input.fallbackUsedByGenerator) return 'degraded';
    // Anchor 근거가 없을 때는 intent source + realized anchor가 모두 있어야만 translated로 인정한다.
    if (input.intentSource === 'baseline_anchor' && !!input.realizedIntentAnchor) {
      return 'translated';
    }
    return 'degraded';
  }

  if (input.intentSource === 'baseline_anchor' && input.realizedIntentAnchor === input.selectedAnchor) {
    return 'direct';
  }

  if (input.intentSource === 'baseline_anchor' && !!input.realizedIntentAnchor) {
    return 'translated';
  }

  if (input.fallbackUsedByGenerator || input.intentSource !== 'baseline_anchor') {
    return 'degraded';
  }

  return 'degraded';
}

function resolveGuardrail(input: {
  mainCount: number;
  prepCount: number;
  hasPhaseOrderViolation: boolean;
  hasDegradeReason: boolean;
}): {
  phaseSemanticGuardrail: PhaseSemanticGuardrail;
  prepDominanceAvoided: 'avoided' | 'not_avoided' | 'unknown';
  warningCodes: string[];
} {
  const warningCodes: string[] = [];
  if (input.hasPhaseOrderViolation) {
    warningCodes.push('phase_order_violation');
    return {
      phaseSemanticGuardrail: 'violated',
      prepDominanceAvoided: 'not_avoided',
      warningCodes,
    };
  }

  if (input.mainCount === 0 && input.prepCount > 0) {
    warningCodes.push('main_segment_missing');
    return {
      phaseSemanticGuardrail: 'violated',
      prepDominanceAvoided: 'not_avoided',
      warningCodes,
    };
  }

  if (input.prepCount > input.mainCount && input.mainCount > 0) {
    warningCodes.push('prep_item_count_gt_main');
    return {
      phaseSemanticGuardrail: 'warning',
      prepDominanceAvoided: 'unknown',
      warningCodes,
    };
  }

  if (input.hasDegradeReason) {
    warningCodes.push('constraint_degrade_applied');
    return {
      phaseSemanticGuardrail: 'warning',
      prepDominanceAvoided: 'unknown',
      warningCodes,
    };
  }

  return {
    phaseSemanticGuardrail: 'preserved',
    prepDominanceAvoided: 'avoided',
    warningCodes,
  };
}

function resolveStrength(input: {
  mode: AlignmentMode;
  phaseSemanticGuardrail: PhaseSemanticGuardrail;
  fallbackUsedByGenerator: boolean;
}): AlignmentStrength {
  if (input.mode === 'fallback') return 'fallback_only';
  if (input.mode === 'degraded') return 'weak';
  if (input.mode === 'translated') return 'partial';
  if (input.mode === 'direct' && input.phaseSemanticGuardrail === 'preserved' && !input.fallbackUsedByGenerator) {
    return 'strong';
  }
  return 'partial';
}

function resolveReplacementEffect(input: {
  replacementApplied: boolean;
  alignmentMode: AlignmentMode;
}): ReplacementEffect {
  if (!input.replacementApplied) return 'none';
  if (input.alignmentMode === 'direct' || input.alignmentMode === 'translated') {
    return 'alignment_preserving';
  }
  if (input.alignmentMode === 'degraded' || input.alignmentMode === 'fallback') {
    return 'alignment_weakening';
  }
  return 'unknown';
}

/**
 * PR3 alignment-audit contract builder.
 * Additive trace only: computes explicit alignment/guardrail outcomes
 * from canonical selected truth + generated plan output.
 */
export function buildAlignmentAuditTrace(input: BuildAlignmentAuditInput): AlignmentAuditTrace {
  const meta = asPlanMeta(input.planJson);
  const baselineAlignment = meta.baseline_alignment ?? null;
  const fallbackUsedByGenerator = !!meta.constraint_flags?.fallback_used;

  const selectedAnchor = input.baselineSessionAnchor ?? null;
  const selectedPrimaryType = input.baselinePrimaryType ?? null;
  const intentSource = baselineAlignment?.intent_source ?? 'unknown';
  const realizedIntentAnchor = baselineAlignment?.first_session_intent_anchor ?? null;

  const alignmentMode = resolveAlignmentMode({
    analysisSourceMode: input.analysisSourceMode,
    isPublicResultTruthOwner: input.isPublicResultTruthOwner,
    selectedAnchor,
    realizedIntentAnchor,
    intentSource,
    fallbackUsedByGenerator,
  });

  const reasons = meta.constraint_engine?.reasons ?? [];
  const hasPhaseOrderViolation = reasons.some((reason) => reason?.code === 'phase_order_violation');
  const hasDegradeReason = reasons.some(
    (reason) =>
      reason?.code === 'degraded_due_to_low_inventory' ||
      reason?.code === 'degraded_due_to_main_count_shortage'
  );
  const replacementApplied = reasons.some(
    (reason) =>
      typeof reason?.beforeValue === 'string' &&
      typeof reason?.afterValue === 'string' &&
      reason.beforeValue !== reason.afterValue
  );

  const guardrail = resolveGuardrail({
    mainCount: countSegmentItems(input.planJson, 'Main'),
    prepCount: countSegmentItems(input.planJson, 'Prep'),
    hasPhaseOrderViolation,
    hasDegradeReason,
  });

  const alignmentStrength = resolveStrength({
    mode: alignmentMode,
    phaseSemanticGuardrail: guardrail.phaseSemanticGuardrail,
    fallbackUsedByGenerator,
  });

  return {
    selected_truth: {
      source_mode: input.analysisSourceMode,
      public_result_id: input.sourcePublicResultId,
      anchor_basis: selectedAnchor,
      primary_type: selectedPrimaryType,
      fallback_active: input.analysisSourceMode === 'legacy_paid_deep' || !!input.fallbackReason,
    },
    intended_alignment: {
      expected_anchor: selectedAnchor,
      expected_primary_type: selectedPrimaryType,
      expected_truth_owner_dominance: input.isPublicResultTruthOwner,
      pre_generation_fallback_active: input.analysisSourceMode === 'legacy_paid_deep' || !!input.fallbackReason,
    },
    realized_alignment: {
      alignment_mode: alignmentMode,
      alignment_strength: alignmentStrength,
      realized_intent_anchor: realizedIntentAnchor,
      gold_path_vector: baselineAlignment?.gold_path_vector ?? null,
      intent_source: intentSource,
      generator_fallback_used: fallbackUsedByGenerator,
    },
    guardrail_outcome: {
      phase_semantic_guardrail: guardrail.phaseSemanticGuardrail,
      prep_dominance_avoided: guardrail.prepDominanceAvoided,
      replacement_applied: replacementApplied,
      replacement_effect: resolveReplacementEffect({
        replacementApplied,
        alignmentMode,
      }),
      ...(guardrail.warningCodes.length > 0 && { warning_codes: guardrail.warningCodes }),
    },
  };
}
