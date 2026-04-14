/**
 * PR-C — Owner naming normalization: single read boundary for squat final-pass **semantics**.
 *
 * Does not change gate truth. Selects one authoritative boolean per PR-C rules:
 *   1. `finalPassEligible` when it is a boolean (wins on disagreement).
 *   2. Else `squatFinalPassTruth.finalPassGranted` when it is a boolean.
 *   3. Else `undefined` / source `none`.
 *
 * No OR-merge: if both are boolean and differ, `mismatchDetected` is true and value is gate's.
 */

export type SquatFinalPassSemanticsSource =
  | 'gate_final_pass_eligible'
  | 'squat_final_pass_truth'
  | 'none';

export interface SquatFinalPassSemanticsRead {
  /** Authoritative pass-semantics value for consumers (undefined = no upstream truth). */
  finalPassGranted: boolean | undefined;
  source: SquatFinalPassSemanticsSource;
  /** True when both gate and truth surfaces are boolean and disagree. */
  mismatchDetected: boolean;
}

export type SquatFinalPassTruthLike = {
  finalPassGranted?: boolean;
} | null | undefined;

/**
 * Single canonical read for squat final-pass semantics across diagnosis / snapshot / bundle.
 */
export function readSquatFinalPassSemanticsTruth(input: {
  finalPassEligible?: boolean;
  squatFinalPassTruth?: SquatFinalPassTruthLike;
}): SquatFinalPassSemanticsRead {
  const gateEl = input.finalPassEligible;
  const truthGranted = input.squatFinalPassTruth?.finalPassGranted;

  const gateIsBool = typeof gateEl === 'boolean';
  const truthIsBool = typeof truthGranted === 'boolean';

  if (gateIsBool && truthIsBool && gateEl !== truthGranted) {
    return {
      finalPassGranted: gateEl,
      source: 'gate_final_pass_eligible',
      mismatchDetected: true,
    };
  }

  if (gateIsBool) {
    return {
      finalPassGranted: gateEl,
      source: 'gate_final_pass_eligible',
      mismatchDetected: false,
    };
  }

  if (truthIsBool) {
    return {
      finalPassGranted: truthGranted,
      source: 'squat_final_pass_truth',
      mismatchDetected: false,
    };
  }

  return {
    finalPassGranted: undefined,
    source: 'none',
    mismatchDetected: false,
  };
}
