/**
 * PR-ALG-19: Plan Quality Audit Helper v1.
 * Evaluates final plan after ordering. Does not modify generation.
 */

import type { PlanItem, PlanJsonOutput, PlanSegment } from '@/lib/session/plan-generator';
import { resolveFirstSessionIntent } from '@/lib/session/priority-layer';
import { normalizeExerciseTaxonomy } from '@/lib/session/taxonomy';
import type { AuditBand, AuditContext, AuditIssue, PlanQualityAuditMeta } from './types';
import {
  AUDIT_VERSION,
  BASE_SCORE,
  PENALTY_HIGH,
  PENALTY_WARN,
  PENALTY_INFO,
  BONUS_STRENGTH,
  FIRST_SESSION_MAX_MAIN_ITEMS,
  PATTERN_OVERLOAD_THRESHOLD,
  BODY_OVERLOAD_THRESHOLD,
  FALLBACK_HEAVY_THRESHOLD,
} from './constants';

interface AuditTemplateLike {
  id: string;
  focus_tags: string[];
  phase?: string | null;
  difficulty?: string | null;
  balance_demand?: string | null;
  complexity?: string | null;
  avoid_if_pain_mode?: readonly string[] | null;
  is_fallback?: boolean;
}

function getSegment(plan: PlanJsonOutput, title: string): PlanSegment | undefined {
  return plan.segments.find((s) => s.title === title);
}

function getAllItems(plan: PlanJsonOutput): Array<{ item: PlanItem; segmentTitle: string }> {
  const out: Array<{ item: PlanItem; segmentTitle: string }> = [];
  for (const seg of plan.segments) {
    for (const item of seg.items) {
      out.push({ item, segmentTitle: seg.title });
    }
  }
  return out;
}

function hasRelevantItem(
  allItemsWithSeg: Array<{ item: PlanItem; segmentTitle: string }>,
  templateById: Map<string, AuditTemplateLike>,
  requiredTags: string[]
): boolean {
  if (requiredTags.length === 0) return true;
  const tagSet = new Set(requiredTags);
  return allItemsWithSeg.some(({ item }) => {
    const template = templateById.get(item.templateId);
    return template?.focus_tags?.some((tag) => tagSet.has(tag));
  });
}

export function auditPlanQuality(
  plan: PlanJsonOutput,
  templates: AuditTemplateLike[],
  context: AuditContext
): PlanQualityAuditMeta {
  const issues: AuditIssue[] = [];
  const strengths: string[] = [];
  let score = BASE_SCORE;

  const templateById = new Map(templates.map((t) => [t.id, t]));

  const allItemsWithSeg = getAllItems(plan);
  const mainSeg = getSegment(plan, 'Main');
  const prepSeg = getSegment(plan, 'Prep');
  const cooldownSeg = getSegment(plan, 'Cooldown');

  const sessionFocusAxes = (plan.meta?.session_focus_axes ?? []).slice(0, 2);
  const priorityVector = context.priorityVector ?? plan.meta?.priority_vector ?? {};
  const firstSessionIntent = resolveFirstSessionIntent({
    resultType: context.resultType ?? plan.meta?.result_type ?? null,
    primaryType: context.primaryType ?? plan.meta?.primary_type ?? null,
    secondaryType: context.secondaryType ?? plan.meta?.secondary_type ?? null,
    priorityVector,
    painMode: context.painMode ?? plan.meta?.pain_mode ?? null,
    sessionNumber: context.sessionNumber ?? plan.meta?.session_number ?? 0,
    safetyMode: (context.safetyMode ?? plan.meta?.safety_mode) ?? undefined,
    redFlags: (context.redFlags ?? plan.meta?.red_flags) ?? undefined,
  });

  if (context.isFirstSession) {
    const mainCount = mainSeg?.items.length ?? 0;
    if (mainCount > FIRST_SESSION_MAX_MAIN_ITEMS) {
      issues.push({
        code: 'FIRST_SESSION_TOO_MANY_MAIN_ITEMS',
        severity: 'warn',
        message: `First session has ${mainCount} main items (max ${FIRST_SESSION_MAX_MAIN_ITEMS})`,
      });
      score -= PENALTY_WARN;
    } else if (mainCount <= FIRST_SESSION_MAX_MAIN_ITEMS && mainCount > 0) {
      strengths.push('FIRST_SESSION_CONSERVATIVE');
      score += BONUS_STRENGTH;
    }

    for (const { item, segmentTitle } of allItemsWithSeg) {
      const template = templateById.get(item.templateId);
      if (!template) continue;
      const tax = normalizeExerciseTaxonomy(template);
      if (tax.risk_group === 'high' && (segmentTitle === 'Main' || segmentTitle === 'Accessory')) {
        issues.push({
          code: 'FIRST_SESSION_HIGH_RISK_ITEM',
          severity: 'high',
          message: `First session contains high-risk item: ${item.templateId}`,
        });
        score -= PENALTY_HIGH;
      }
    }

    const painMode = context.painMode ?? plan.meta?.pain_mode;
    if (painMode === 'protected' || painMode === 'caution') {
      for (const { item } of allItemsWithSeg) {
        const template = templateById.get(item.templateId);
        if (!template) continue;
        const avoid = template.avoid_if_pain_mode ?? [];
        if (avoid.includes(painMode)) {
          issues.push({
            code: 'PAIN_MODE_UNSAFE_ITEM',
            severity: 'high',
            message: `pain_mode=${painMode} but plan contains avoid item: ${item.templateId}`,
          });
          score -= PENALTY_HIGH;
        }
      }
    }

    /** PR-SSOT-01: session 1 audit consumes first-session intent SSOT expectations. */
    const resultType = firstSessionIntent?.anchorType ?? context.resultType ?? plan.meta?.result_type;
    const expectations = firstSessionIntent?.auditExpectations;
    if (resultType === 'UPPER-LIMB') {
      const focusAxes = plan.meta?.session_focus_axes ?? [];
      const isTrunkOnly =
        focusAxes.length > 0 &&
        expectations?.forbiddenDominantAxes?.length &&
        focusAxes.every((a) => expectations.forbiddenDominantAxes.includes(a));
      if (isTrunkOnly) {
        issues.push({
          code: 'UPPER_LIMB_CORE_ONLY_MISMATCH',
          severity: 'warn',
          message: 'UPPER-LIMB first session has session_focus_axes=trunk_control only (expected upper-related)',
        });
        score -= PENALTY_WARN;
      }
      const rationale = plan.meta?.session_rationale ?? '';
      const isCoreOnlyRationale =
        rationale &&
        (expectations?.rationaleMustAvoidOnly ?? []).some((token) => rationale.includes(token)) &&
        !(expectations?.rationaleMustInclude ?? []).some((token) => rationale.includes(token));
      if (isCoreOnlyRationale) {
        issues.push({
          code: 'UPPER_LIMB_RATIONALE_MISMATCH',
          severity: 'warn',
          message: 'UPPER-LIMB first session rationale is core-only (expected upper-limb direction)',
        });
        score -= PENALTY_WARN;
      }
      const hasUpperItem = hasRelevantItem(
        allItemsWithSeg,
        templateById,
        expectations?.requiredTags ?? []
      );
      if (!hasUpperItem && allItemsWithSeg.length > 0) {
        issues.push({
          code: 'UPPER_LIMB_NO_RELEVANT_ITEM',
          severity: 'warn',
          message: 'UPPER-LIMB first session has no upper-limb relevant exercise (shoulder/thoracic/upper_back)',
        });
        score -= PENALTY_WARN;
      }
    }

    /** PR-ALIGN-03: LOWER-LIMB / NECK-SHOULDER / LUMBO-PELVIS minimal alignment checks */
    if (resultType === 'LOWER-LIMB') {
      const focusAxes = plan.meta?.session_focus_axes ?? [];
      const isUpperOnly =
        focusAxes.length > 0 &&
        expectations?.forbiddenDominantAxes?.length &&
        focusAxes.every((a) => expectations.forbiddenDominantAxes.includes(a));
      if (isUpperOnly) {
        issues.push({
          code: 'LOWER_LIMB_FOCUS_MISMATCH',
          severity: 'warn',
          message: 'LOWER-LIMB first session has session_focus_axes=upper_mobility only (expected lower-related)',
        });
        score -= PENALTY_WARN;
      }
      const hasLowerItem = hasRelevantItem(
        allItemsWithSeg,
        templateById,
        expectations?.requiredTags ?? []
      );
      if (!hasLowerItem && allItemsWithSeg.length > 0) {
        issues.push({
          code: 'LOWER_LIMB_NO_RELEVANT_ITEM',
          severity: 'warn',
          message: 'LOWER-LIMB first session has no lower-limb relevant exercise',
        });
        score -= PENALTY_WARN;
      }
    }
    if (resultType === 'NECK-SHOULDER') {
      const focusAxes = plan.meta?.session_focus_axes ?? [];
      const isTrunkOnly =
        focusAxes.length > 0 &&
        expectations?.forbiddenDominantAxes?.length &&
        focusAxes.every((a) => expectations.forbiddenDominantAxes.includes(a));
      if (isTrunkOnly) {
        issues.push({
          code: 'NECK_SHOULDER_FOCUS_MISMATCH',
          severity: 'warn',
          message: 'NECK-SHOULDER first session has session_focus_axes=trunk_control only (expected upper-related)',
        });
        score -= PENALTY_WARN;
      }
      const hasNeckItem = hasRelevantItem(
        allItemsWithSeg,
        templateById,
        expectations?.requiredTags ?? []
      );
      if (!hasNeckItem && allItemsWithSeg.length > 0) {
        issues.push({
          code: 'NECK_SHOULDER_NO_RELEVANT_ITEM',
          severity: 'warn',
          message: 'NECK-SHOULDER first session has no neck/shoulder relevant exercise',
        });
        score -= PENALTY_WARN;
      }
    }
    if (resultType === 'LUMBO-PELVIS') {
      const focusAxes = plan.meta?.session_focus_axes ?? [];
      const hasTrunk = (expectations?.requiredFocusAxes ?? []).every((axis) => focusAxes.includes(axis));
      if (focusAxes.length > 0 && !hasTrunk) {
        issues.push({
          code: 'LUMBO_PELVIS_FOCUS_MISMATCH',
          severity: 'warn',
          message: 'LUMBO-PELVIS first session session_focus_axes should include trunk_control',
        });
        score -= PENALTY_WARN;
      }
      const hasLumboItem = hasRelevantItem(
        allItemsWithSeg,
        templateById,
        expectations?.requiredTags ?? []
      );
      if (!hasLumboItem && allItemsWithSeg.length > 0) {
        issues.push({
          code: 'LUMBO_PELVIS_NO_RELEVANT_ITEM',
          severity: 'warn',
          message: 'LUMBO-PELVIS first session has no lumbo-pelvis relevant exercise',
        });
        score -= PENALTY_WARN;
      }
    }
  }

  const segmentTitles = plan.segments.map((s) => s.title);
  const hasPrep = segmentTitles.includes('Prep');
  const hasMain = segmentTitles.includes('Main');
  const hasCooldown = segmentTitles.includes('Cooldown');

  if (!hasPrep && allItemsWithSeg.length > 0) {
    issues.push({ code: 'MISSING_PREP_FLOW', severity: 'warn', message: 'No Prep segment' });
    score -= PENALTY_WARN;
  }
  if (!hasCooldown && allItemsWithSeg.length > 1) {
    issues.push({ code: 'MISSING_COOLDOWN_FLOW', severity: 'warn', message: 'No Cooldown segment' });
    score -= PENALTY_WARN;
  }

  if (prepSeg && prepSeg.items.length > 0) {
    let prepMobilityCount = 0;
    for (const item of prepSeg.items) {
      const template = templateById.get(item.templateId);
      if (template) {
        const tax = normalizeExerciseTaxonomy(template);
        if (tax.load_type === 'mobility' || tax.load_type === 'recovery') prepMobilityCount++;
      }
    }
    if (prepMobilityCount === 0) {
      issues.push({
        code: 'MISSING_PREP_FLOW',
        severity: 'info',
        message: 'Prep segment lacks mobility/recovery items',
      });
      score -= PENALTY_INFO;
    } else {
      strengths.push('HAS_BALANCED_PHASE_FLOW');
      score += BONUS_STRENGTH;
    }
  }

  if (cooldownSeg && cooldownSeg.items.length > 0) {
    let coolMobilityCount = 0;
    for (const item of cooldownSeg.items) {
      const template = templateById.get(item.templateId);
      if (template) {
        const tax = normalizeExerciseTaxonomy(template);
        if (tax.load_type === 'mobility' || tax.load_type === 'recovery') coolMobilityCount++;
      }
    }
    if (coolMobilityCount === 0) {
      issues.push({
        code: 'MISSING_COOLDOWN_FLOW',
        severity: 'info',
        message: 'Cooldown segment lacks mobility/recovery items',
      });
      score -= PENALTY_INFO;
    }
  }

  if (hasMain && mainSeg && sessionFocusAxes.length > 0) {
    let matchCount = 0;
    for (const item of mainSeg.items) {
      const focusTag = item.focus_tag ?? templateById.get(item.templateId)?.focus_tags?.[0];
      if (focusTag && sessionFocusAxes.includes(focusTag)) matchCount++;
    }
    if (mainSeg.items.length > 0 && matchCount === 0) {
      issues.push({
        code: 'MAIN_TARGET_MISMATCH',
        severity: 'warn',
        message: 'Main items do not align with session_focus_axes',
      });
      score -= PENALTY_WARN;
    } else if (matchCount > 0) {
      strengths.push('GOOD_TARGET_ALIGNMENT');
      score += BONUS_STRENGTH;
    }
  }

  const patternCounts = new Map<string, number>();
  const bodyCounts = new Map<string, number>();
  let fallbackCount = 0;
  for (const { item } of allItemsWithSeg) {
    const template = templateById.get(item.templateId);
    if (template?.is_fallback) fallbackCount++;
    if (template) {
      const tax = normalizeExerciseTaxonomy(template);
      patternCounts.set(tax.pattern_family, (patternCounts.get(tax.pattern_family) ?? 0) + 1);
      bodyCounts.set(tax.body_region, (bodyCounts.get(tax.body_region) ?? 0) + 1);
    }
  }

  const total = allItemsWithSeg.length;
  if (total > 0) {
    for (const [, count] of patternCounts) {
      if (count / total > PATTERN_OVERLOAD_THRESHOLD) {
        issues.push({
          code: 'PATTERN_OVERLOAD',
          severity: 'warn',
          message: `Pattern family overload: ${Math.round((count / total) * 100)}% same pattern`,
        });
        score -= PENALTY_WARN;
        break;
      }
    }
    for (const [, count] of bodyCounts) {
      if (count / total > BODY_OVERLOAD_THRESHOLD) {
        issues.push({
          code: 'BODY_REGION_OVERLOAD',
          severity: 'info',
          message: `Body region overload: ${Math.round((count / total) * 100)}% same region`,
        });
        score -= PENALTY_INFO;
        break;
      }
    }
    if (fallbackCount / total >= FALLBACK_HEAVY_THRESHOLD) {
      issues.push({
        code: 'FALLBACK_HEAVY_PLAN',
        severity: 'warn',
        message: `${Math.round((fallbackCount / total) * 100)}% fallback templates`,
      });
      score -= PENALTY_WARN;
    }
  }

  if (!plan.meta?.policy_registry) {
    issues.push({
      code: 'MISSING_POLICY_TRACE',
      severity: 'info',
      message: 'policy_registry meta missing',
    });
    score -= PENALTY_INFO;
  }
  if (!plan.meta?.candidate_competition) {
    issues.push({
      code: 'MISSING_COMPETITION_TRACE',
      severity: 'info',
      message: 'candidate_competition meta missing',
    });
    score -= PENALTY_INFO;
  }
  if (!plan.meta?.constraint_engine) {
    issues.push({
      code: 'MISSING_CONSTRAINT_TRACE',
      severity: 'info',
      message: 'constraint_engine meta missing',
    });
    score -= PENALTY_INFO;
  }
  if (!plan.meta?.ordering_engine) {
    issues.push({
      code: 'MISSING_ORDERING_TRACE',
      severity: 'info',
      message: 'ordering_engine meta missing',
    });
    score -= PENALTY_INFO;
  }

  if (
    plan.meta?.policy_registry &&
    plan.meta?.candidate_competition &&
    plan.meta?.constraint_engine &&
    plan.meta?.ordering_engine
  ) {
    strengths.push('HAS_EXPLAINABILITY_TRACE');
    score += BONUS_STRENGTH;
  }

  score = Math.max(0, Math.min(100, score));

  let band: AuditBand = 'good';
  if (score < 60 || issues.some((i) => i.severity === 'high')) band = 'risky';
  else if (score < 80 || issues.some((i) => i.severity === 'warn')) band = 'acceptable';

  const summary =
    issues.length === 0
      ? `Plan quality: ${band} (score ${score})`
      : `Plan quality: ${band} (score ${score}), ${issues.length} issue(s)`;

  return {
    version: AUDIT_VERSION,
    score,
    band,
    strengths,
    issues,
    summary,
  };
}
