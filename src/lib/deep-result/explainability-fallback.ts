/**
 * Explainability fallback detection — dev/staging visibility for missing fields.
 * Production: no-op. Dev: console.warn when fallback is used.
 */

const VALID_RESULT_TYPES = [
  'NECK-SHOULDER',
  'LUMBO-PELVIS',
  'UPPER-LIMB',
  'LOWER-LIMB',
  'DECONDITIONED',
  'STABLE',
] as const;

function isDev(): boolean {
  return typeof process !== 'undefined' && process.env.NODE_ENV !== 'production';
}

/**
 * Warn when result UI will use fallback content due to missing explainability fields.
 * Call from client components only (uses console).
 */
export function warnExplainabilityFallback(
  missing: string[],
  context?: { resultType?: string | null; attemptId?: string | null }
): void {
  if (!isDev() || missing.length === 0) return;
  console.warn(
    '[MOVE RE] Result explainability fallback: missing fields',
    missing,
    context ? `(${context.resultType ?? 'unknown'}, attempt: ${context.attemptId ?? 'n/a'})` : ''
  );
}

/**
 * Detect missing explainability fields from UI props.
 * focus_tags empty = primaryFocus-derived tags missing (fallback to generic insights).
 * avoid_tags empty alone is often normal; we only flag when both are empty.
 */
export function detectMissingExplainabilityFields(props: {
  resultType: string | null;
  focusTags: string[];
  avoidTags: string[];
}): string[] {
  const { resultType, focusTags, avoidTags } = props;
  const missing: string[] = [];
  const hasValidResult =
    resultType &&
    typeof resultType === 'string' &&
    VALID_RESULT_TYPES.includes(resultType.trim() as (typeof VALID_RESULT_TYPES)[number]);
  if (!hasValidResult) return missing;

  if (focusTags.length === 0) missing.push('focus_tags');
  if (avoidTags.length === 0) missing.push('avoid_tags');
  return missing;
}
