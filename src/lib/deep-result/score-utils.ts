/**
 * algorithm_scores → RadarScores 변환
 * derived.algorithm_scores가 없으면 null 반환
 */

export interface RadarScores {
  mobility: number;
  stability: number;
  painRisk: number;
}

interface AlgorithmScores {
  upper_score?: number;
  lower_score?: number;
  core_score?: number;
  balance_score?: number;
  pain_risk?: number;
}

export function toRadarScores(
  algorithmScores: AlgorithmScores | null | undefined
): RadarScores | null {
  if (!algorithmScores || typeof algorithmScores !== 'object') return null;

  const upper = algorithmScores.upper_score ?? 0;
  const lower = algorithmScores.lower_score ?? 0;
  const core = algorithmScores.core_score ?? 0;
  const balance = algorithmScores.balance_score ?? 0;
  const pain = algorithmScores.pain_risk ?? 0;

  return {
    mobility: (upper + lower) / 2,
    stability: (core + balance) / 2,
    painRisk: pain,
  };
}
