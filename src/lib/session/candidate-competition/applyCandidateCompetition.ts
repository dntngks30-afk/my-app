/**
 * PR-ALG-18: Candidate Competition Engine v1.
 * Reranks scored candidates with diversity, first-session, shape, fallback awareness.
 * Additive delta only. Does not replace selection/constraint/ordering.
 */

import { normalizeExerciseTaxonomy } from '@/lib/session/taxonomy';
import type {
  CandidateCompetitionMeta,
  CompetitionContext,
  CompetitionTemplateLike,
  CompetitionTraceEntry,
  ScoredCandidate,
} from './types';
import { DELTA_CAP, FALLBACK_PENALTY_THRESHOLD, MAX_TRACE_ENTRIES } from './constants';

const PREP_LOAD_TYPES = new Set(['mobility', 'recovery']);
const COOLDOWN_LOAD_TYPES = new Set(['mobility', 'recovery']);

function clampDelta(delta: number): number {
  return Math.max(-DELTA_CAP, Math.min(DELTA_CAP, delta));
}

/**
 * Apply candidate competition. Returns reranked list and additive meta.
 */
export function applyCandidateCompetition<T extends CompetitionTemplateLike>(
  scoredCandidates: ScoredCandidate<T>[],
  context: CompetitionContext
): { ranked: ScoredCandidate<T>[]; meta: CandidateCompetitionMeta } {
  const countBefore = scoredCandidates.length;
  if (countBefore === 0) {
    return {
      ranked: [],
      meta: {
        version: 'candidate_competition_v1',
        applied: false,
        strategy: 'score_plus_diversity_bias',
        candidate_count_before: 0,
        candidate_count_after: 0,
        rerank_applied_count: 0,
        top_competition_factors: [],
        summary: 'No candidates to compete',
      },
    };
  }

  const taxonomies = new Map<string, ReturnType<typeof normalizeExerciseTaxonomy>>();
  for (const { template } of scoredCandidates) {
    taxonomies.set(template.id, normalizeExerciseTaxonomy(template));
  }

  const patternCounts = new Map<string, number>();
  const bodyCounts = new Map<string, number>();
  for (const { template } of scoredCandidates) {
    const tax = taxonomies.get(template.id);
    if (tax) {
      patternCounts.set(tax.pattern_family, (patternCounts.get(tax.pattern_family) ?? 0) + 1);
      bodyCounts.set(tax.body_region, (bodyCounts.get(tax.body_region) ?? 0) + 1);
    }
  }

  const factorsUsed = new Set<string>();
  const trace: CompetitionTraceEntry[] = [];
  let rerankCount = 0;

  const withDelta = scoredCandidates.map(({ template, score }) => {
    const tax = taxonomies.get(template.id);
    let delta = 0;
    const factors: string[] = [];

    if (!tax) return { template, score, adjustedScore: score, delta: 0, factors };

    const patternCount = patternCounts.get(tax.pattern_family) ?? 1;
    const bodyCount = bodyCounts.get(tax.body_region) ?? 1;
    const total = countBefore;

    if (total > 1) {
      const patternRarity = 1 - patternCount / total;
      if (patternRarity > 0.3) {
        delta += 1;
        factors.push('diversity_pattern');
        factorsUsed.add('diversity_pattern');
      } else if (patternCount > total / 2) {
        delta -= 1;
        factors.push('diversity_pattern_overload');
        factorsUsed.add('diversity_pattern_overload');
      }
      const bodyRarity = 1 - bodyCount / total;
      if (bodyRarity > 0.3) {
        delta += 1;
        factors.push('diversity_body');
        factorsUsed.add('diversity_body');
      }
    }

    if (context.isFirstSession) {
      if (tax.risk_group === 'low') {
        delta += 2;
        factors.push('first_session_low_risk');
        factorsUsed.add('first_session_low_risk');
      } else if (tax.risk_group === 'medium') {
        delta += 1;
        factors.push('first_session_medium_risk');
        factorsUsed.add('first_session_medium_risk');
      } else if (tax.risk_group === 'high') {
        delta -= 2;
        factors.push('first_session_high_risk');
        factorsUsed.add('first_session_high_risk');
      }
      const diff = template.difficulty ?? '';
      if (diff === 'low') {
        delta += 1;
        factors.push('first_session_low_difficulty');
      } else if (diff === 'high') {
        delta -= 1;
        factors.push('first_session_high_difficulty');
      }
      if (template.complexity === 'low') {
        delta += 1;
        factors.push('first_session_low_complexity');
      } else if (template.complexity === 'high') {
        delta -= 1;
        factors.push('first_session_high_complexity');
      }
    }

    if (PREP_LOAD_TYPES.has(tax.load_type) && (template.phase === 'prep' || tax.training_intent === 'prep')) {
      delta += 1;
      factors.push('shape_prep_suitable');
      factorsUsed.add('shape_prep_suitable');
    }
    if (COOLDOWN_LOAD_TYPES.has(tax.load_type) && (template.phase === 'cooldown' || template.phase === 'accessory')) {
      delta += 1;
      factors.push('shape_cooldown_suitable');
      factorsUsed.add('shape_cooldown_suitable');
    }
    if (template.phase === 'main' && context.priorityVector && template.target_vector?.length) {
      const match = template.target_vector.some((v) => v in context.priorityVector!);
      if (match) {
        delta += 1;
        factors.push('shape_main_target_match');
        factorsUsed.add('shape_main_target_match');
      }
    }

    if (countBefore >= FALLBACK_PENALTY_THRESHOLD && template.is_fallback) {
      delta -= 2;
      factors.push('fallback_penalty');
      factorsUsed.add('fallback_penalty');
    }

    const clamped = clampDelta(delta);
    if (clamped !== 0) rerankCount++;
    const adjustedScore = score + clamped;

    if (trace.length < MAX_TRACE_ENTRIES && factors.length > 0) {
      trace.push({ templateId: template.id, baseScore: score, adjustedScore, factors });
    }

    return { template, score, adjustedScore, delta: clamped, factors };
  });

  const ranked = withDelta
    .sort((a, b) => {
      if (b.adjustedScore !== a.adjustedScore) return b.adjustedScore - a.adjustedScore;
      return a.template.id.localeCompare(b.template.id);
    })
    .map(({ template, adjustedScore }) => ({ template, score: adjustedScore }));

  const summary =
    rerankCount > 0
      ? `Reranked ${rerankCount}/${countBefore} candidates with diversity/first-session/shape bias`
      : 'No rerank applied (scores unchanged)';

  return {
    ranked,
    meta: {
      version: 'candidate_competition_v1',
      applied: rerankCount > 0,
      strategy: 'score_plus_diversity_bias',
      candidate_count_before: countBefore,
      candidate_count_after: ranked.length,
      rerank_applied_count: rerankCount,
      top_competition_factors: Array.from(factorsUsed).slice(0, 8),
      summary,
      competition_trace: trace.length > 0 ? trace : undefined,
    },
  };
}
