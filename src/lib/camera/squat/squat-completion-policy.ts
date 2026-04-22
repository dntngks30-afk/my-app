import type { SquatCompletionState } from '../squat-completion-state';
import type { ShallowNormalizedBlockerFamily } from './squat-completion-debug-types';
import { resolveProvisionalShallowTerminalAuthority } from './squat-completion-canonical';
import { STANDARD_OWNER_FLOOR } from './squat-completion-core';

type ApplyUltraLowPolicyLockDeps = {
  mapCompletionBlockedReasonToShallowNormalizedBlockerFamily: (
    completionBlockedReason: string | null,
    completionSatisfied: boolean
  ) => ShallowNormalizedBlockerFamily;
};

function isUltraLowPolicyScope(state: SquatCompletionState): boolean {
  return state.evidenceLabel === 'ultra_low_rom' && state.officialShallowPathCandidate === true;
}

function isUltraLowPolicyFinalizeTruthSatisfied(state: SquatCompletionState): boolean {
  const r = state.standingRecoveryFinalizeReason;
  return (
    r === 'standing_hold_met' ||
    r === 'low_rom_guarded_finalize' ||
    r === 'ultra_low_rom_guarded_finalize'
  );
}

function isUltraLowPolicyDecisionReady(
  state: SquatCompletionState,
  deps: ApplyUltraLowPolicyLockDeps
): boolean {
  if (!isUltraLowPolicyScope(state)) return false;
  if (state.officialShallowPathCandidate !== true) return false;
  if (state.officialShallowPathAdmitted !== true) return false;
  if (state.reversalConfirmedAfterDescend !== true) return false;
  if (state.recoveryConfirmedAfterReversal !== true) return false;
  if (!isUltraLowPolicyFinalizeTruthSatisfied(state)) return false;

  const fam = deps.mapCompletionBlockedReasonToShallowNormalizedBlockerFamily(
    state.completionBlockedReason ?? null,
    state.completionSatisfied === true
  );
  if (fam === 'admission' || fam === 'reversal') return false;

  return true;
}

function isUltraLowCycleLegitimateByCanonicalProof(state: SquatCompletionState): boolean {
  if (state.completionSatisfied !== true) return false;
  if (state.officialShallowPathClosed !== true) return false;
  if (state.officialShallowClosureProofSatisfied !== true) return false;
  if (state.canonicalShallowContractSatisfied !== true) return false;
  return true;
}

export function applyUltraLowPolicyLock(
  state: SquatCompletionState,
  deps: ApplyUltraLowPolicyLockDeps
): SquatCompletionState {
  const ultraLowPolicyScope = isUltraLowPolicyScope(state);
  const ultraLowPolicyDecisionReady = isUltraLowPolicyDecisionReady(state, deps);
  const ultraLowLegitimateByCanonical =
    ultraLowPolicyDecisionReady && isUltraLowCycleLegitimateByCanonicalProof(state);
  const provisionalShallowTerminalAuthority = ultraLowPolicyDecisionReady
    ? resolveProvisionalShallowTerminalAuthority(state, {
        standardOwnerFloor: STANDARD_OWNER_FLOOR,
        setupMotionBlocked: state.setupMotionBlocked,
        requireCanonicalAntiFalsePassClear: true,
      })
    : { satisfied: false, blockedReason: null };
  const ultraLowLegitimateByProvisional =
    ultraLowPolicyDecisionReady && provisionalShallowTerminalAuthority.satisfied === true;
  const ultraLowPolicyTraceBase = [
    `scope=${ultraLowPolicyScope ? '1' : '0'}`,
    `ready=${ultraLowPolicyDecisionReady ? '1' : '0'}`,
    `legitimate_canonical=${ultraLowLegitimateByCanonical ? '1' : '0'}`,
    `legitimate_provisional=${ultraLowLegitimateByProvisional ? '1' : '0'}`,
    `provisional_blocked=${provisionalShallowTerminalAuthority.blockedReason ?? 'none'}`,
  ].join('|');

  if (!ultraLowPolicyDecisionReady) {
    return {
      ...state,
      ultraLowPolicyScope,
      ultraLowPolicyDecisionReady: false,
      ultraLowPolicyBlocked: false,
      ultraLowPolicyTrace: ultraLowPolicyTraceBase,
    };
  }

  if (ultraLowLegitimateByCanonical || ultraLowLegitimateByProvisional) {
    return {
      ...state,
      ultraLowPolicyScope: true,
      ultraLowPolicyDecisionReady: true,
      ultraLowPolicyBlocked: false,
      ultraLowPolicyTrace: `${ultraLowPolicyTraceBase}|blocked=0_${
        ultraLowLegitimateByCanonical ? 'legitimate_canonical' : 'legitimate_provisional'
      }`,
    };
  }

  return {
    ...state,
    ultraLowPolicyScope: true,
    ultraLowPolicyDecisionReady: true,
    ultraLowPolicyBlocked: true,
    ultraLowPolicyTrace: `${ultraLowPolicyTraceBase}|blocked=policy_illegitimate_annotation_only`,
  };
}
