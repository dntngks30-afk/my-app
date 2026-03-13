/**
 * PR-ALG-16B: Minimum viable taxonomy types.
 * Shared by constraint, ordering, scoring layers.
 */

/** Normalized taxonomy derived from raw template metadata */
export interface ExerciseTaxonomy {
  /** Primary pattern/focus family (from focus_tags[0] or mapping) */
  pattern_family: string;
  /** Body region: lower | upper | trunk | full */
  body_region: string;
  /** Load type: mobility | stability | strength | recovery */
  load_type: string;
  /** Training intent: prep | main | accessory | cooldown */
  training_intent: string;
  /** Risk group for pain/protected: low | medium | high */
  risk_group: string;
}

/** Raw template shape for taxonomy derivation */
export interface TaxonomySource {
  focus_tags: readonly string[];
  phase?: string | null;
  difficulty?: string | null;
  progression_level?: number | null;
  avoid_if_pain_mode?: readonly string[] | null;
  balance_demand?: string | null;
  complexity?: string | null;
}
