export type SquatOwnerTruthSource = 'rule_completion' | 'event_promotion' | 'none';
export type SquatOwnerTruthStage = 'admission' | 'reversal' | 'recovery' | 'closed' | 'blocked';

export type SquatOwnerTraceInput = {
  completionSatisfied?: boolean;
  completionBlockedReason?: string | null;
  eventCyclePromoted?: boolean;
  attemptStarted?: boolean;
  reversalConfirmedAfterDescend?: boolean;
  recoveryConfirmedAfterReversal?: boolean;
};

export type SquatOwnerTrace = {
  ownerTruthSource: SquatOwnerTruthSource;
  ownerTruthStage: SquatOwnerTruthStage;
  ownerTruthBlockedBy: string | null;
};

export function deriveSquatOwnerTruthTrace(input: SquatOwnerTraceInput): SquatOwnerTrace {
  const ownerTruthSource: SquatOwnerTruthSource =
    input.eventCyclePromoted === true
      ? 'event_promotion'
      : input.completionSatisfied === true
        ? 'rule_completion'
        : 'none';

  const ownerTruthStage: SquatOwnerTruthStage =
    input.completionSatisfied === true
      ? 'closed'
      : input.attemptStarted !== true
        ? 'admission'
        : input.reversalConfirmedAfterDescend !== true
          ? 'reversal'
          : input.recoveryConfirmedAfterReversal !== true
            ? 'recovery'
            : 'blocked';

  const ownerTruthBlockedBy =
    input.completionSatisfied === true
      ? null
      : input.completionBlockedReason ?? 'owner_not_closed';

  return {
    ownerTruthSource,
    ownerTruthStage,
    ownerTruthBlockedBy,
  };
}
