/**
 * PR-ALG-18: Candidate Competition Engine — types.
 */

import type { ExerciseTaxonomy } from '@/lib/session/taxonomy';

export interface CompetitionTemplateLike {
  id: string;
  focus_tags: string[];
  phase?: string | null;
  difficulty?: string | null;
  progression_level?: number | null;
  balance_demand?: string | null;
  complexity?: string | null;
  target_vector?: string[] | null;
  is_fallback?: boolean;
}

export interface ScoredCandidate<T = CompetitionTemplateLike> {
  template: T;
  score: number;
}

export interface CompetitionContext {
  sessionNumber: number;
  isFirstSession: boolean;
  painMode?: 'none' | 'caution' | 'protected' | null;
  priorityVector?: Record<string, number> | null;
  timeBudget?: 'short' | 'normal';
  conditionMood?: 'good' | 'ok' | 'bad';
  usedTemplateIds?: string[];
}

export interface CompetitionTraceEntry {
  templateId: string;
  baseScore: number;
  adjustedScore: number;
  factors: string[];
}

export interface CandidateCompetitionMeta {
  version: 'candidate_competition_v1';
  applied: boolean;
  strategy: 'score_plus_diversity_bias';
  candidate_count_before: number;
  candidate_count_after: number;
  rerank_applied_count: number;
  top_competition_factors: string[];
  summary: string;
  competition_trace?: CompetitionTraceEntry[];
}

export interface CandidateCompetitionResult<T> {
  ranked: ScoredCandidate<T>[];
  meta: CandidateCompetitionMeta;
}
