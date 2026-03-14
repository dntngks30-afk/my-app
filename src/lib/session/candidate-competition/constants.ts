/**
 * PR-ALG-18: Candidate Competition Engine — constants.
 */

/** Max absolute delta per candidate. Keeps competition from overwhelming base score. */
export const DELTA_CAP = 4;

/** Minimum candidate pool size to apply fallback penalty. Below this, fallbacks are not penalized. */
export const FALLBACK_PENALTY_THRESHOLD = 8;

/** Max trace entries to store (avoid heavy payload). */
export const MAX_TRACE_ENTRIES = 6;
