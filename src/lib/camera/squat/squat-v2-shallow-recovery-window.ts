/**
 * PR-V2-INPUT-05: shallow squat — second V2 evaluation on `validRaw` sliding windows
 * when primary epoch input is none / tail-spike / unusable curve (trigger from primary V2 + owner only).
 * Replacement is allowed only when PR04B consumption guard passes (shared module).
 */
import type { PoseFeaturesFrame } from '@/lib/camera/pose-features';
import type { SquatMotionEvidenceDecisionV2 } from '@/lib/camera/squat/squat-motion-evidence-v2.types';
import {
  buildSquatV2OwnedInputFrames,
  type SquatV2InputOwnerResult,
} from '@/lib/camera/squat/squat-v2-input-owner';
import { evaluateSquatMotionEvidenceV2 } from '@/lib/camera/squat/squat-motion-evidence-v2';
import { evaluateSquatV2RuntimeOwnerSafetyConsumption } from '@/lib/camera/squat/squat-v2-pr04b-consumption-guard';

const MIN_VALID_RAW_FOR_SEARCH = 28;
const MIN_WINDOW_FRAMES = 36;
const MAX_WINDOW_FRAMES_CAP = 220;
const WINDOW_LEN_STEP = 6;
const WINDOW_START_STEP = 4;

export type SquatV2ShallowRecoveryDiagnostics = {
  attempted: boolean;
  applied: boolean;
  primaryBlockReason: string | null;
  blockedReason: string | null;
  reason: string | null;
  windowStartMs: number | null;
  windowEndMs: number | null;
  windowFrameCount: number | null;
  candidatesTried: number;
};

function peakAtTailStall(
  decision: SquatMotionEvidenceDecisionV2,
  v2EvalFrameCount: number
): boolean {
  const m = decision.metrics;
  if (!m) return false;
  const peakFrameIndex_v2 = m.peakFrameIndex ?? null;
  const inputFrameCount_v2 = m.inputFrameCount ?? v2EvalFrameCount;
  return (
    peakFrameIndex_v2 !== null &&
    (peakFrameIndex_v2 >= inputFrameCount_v2 - 1 ||
      (m.framesAfterPeak ?? 0) <= 0 ||
      (m.peakDistanceFromTailFrames ?? 0) <= 0)
  );
}

function readSelectedTailSpikeOnly(owned: SquatV2InputOwnerResult): boolean {
  const src = owned.selectedDepthSource;
  if (src === 'none') return true;
  const bag = owned.sourceStats?.[src];
  if (bag == null || typeof bag !== 'object') return false;
  return (bag as Record<string, unknown>).tailSpikeOnly === true;
}

/**
 * Trigger uses primary V2 decision + input owner + primary eval frame count only
 * (no dwell/slice or later pipeline fields).
 */
export function shouldAttemptShallowV2Recovery(p: {
  validRawLength: number;
  decision: SquatMotionEvidenceDecisionV2;
  owned: SquatV2InputOwnerResult;
  v2EvalFrameCount: number;
}): boolean {
  if (p.validRawLength < MIN_VALID_RAW_FOR_SEARCH) return false;
  if (p.decision.usableMotionEvidence) return false;
  if (!p.decision.metrics) return false;
  if (peakAtTailStall(p.decision, p.v2EvalFrameCount)) return false;

  if (p.owned.selectedDepthSource === 'none' || !p.owned.depthCurveUsable) return true;

  if (readSelectedTailSpikeOnly(p.owned)) return true;

  const kneeBag = p.owned.sourceStats?.['knee_flex_proxy'];
  if (p.owned.selectedDepthSource === 'knee_flex_proxy' && kneeBag && typeof kneeBag === 'object') {
    const fap = (kneeBag as Record<string, unknown>).framesAfterPeak;
    if (typeof fap === 'number' && fap <= 2) return true;
  }

  const legacy = p.owned.sourceStats?.['legacy_pr04d'];
  if (legacy && typeof legacy === 'object') {
    const lcs = (legacy as Record<string, unknown>).legacyCurveStats as
      | Record<string, unknown>
      | undefined;
    if (lcs?.tailSpikeOnly === true) return true;
  }

  return false;
}

function windowStartSetupContaminated(frames: PoseFeaturesFrame[]): boolean {
  const k = Math.max(1, Math.floor(frames.length * 0.35));
  let bad = 0;
  for (let i = 0; i < k; i++) {
    const ph = String(frames[i]!.phaseHint ?? '').toLowerCase();
    if (ph === 'setup' || ph === 'readiness' || ph === 'align' || ph === 'alignment') bad++;
  }
  return bad >= k * 0.7;
}

export function makeShallowRecoveryActiveEpoch(slice: PoseFeaturesFrame[]): {
  epochStartMs: number;
  epochSource: string;
  usedRollingFallback: boolean;
  activeAttemptEpochStartMs: number | null;
  activeAttemptEpochSource: string | null;
  epochResetReason: string | null;
} {
  const t0 = slice[0]!.timestampMs;
  return {
    epochStartMs: t0,
    epochSource: 'shallow_recovery_window',
    usedRollingFallback: false,
    activeAttemptEpochStartMs: t0,
    activeAttemptEpochSource: 'shallow_recovery_window',
    epochResetReason: null,
  };
}

function acceptShallowRecoveryCandidate(
  decision: SquatMotionEvidenceDecisionV2,
  owned: SquatV2InputOwnerResult
): { ok: boolean; reason: string | null } {
  if (!decision.usableMotionEvidence) {
    return { ok: false, reason: 'candidate_not_usable' };
  }
  if (owned.selectedDepthSource === 'none' || !owned.depthCurveUsable) {
    return { ok: false, reason: 'candidate_input_unusable' };
  }
  if (owned.finiteButUselessDepthRejected && owned.selectedDepthSource === 'knee_flex_proxy') {
    return { ok: false, reason: 'candidate_finite_rejected' };
  }
  if (readSelectedTailSpikeOnly(owned)) {
    return { ok: false, reason: 'candidate_tail_spike' };
  }

  const m = decision.metrics ?? {};
  if (decision.evidence.closureFreshAtTail !== true) {
    return { ok: false, reason: 'candidate_closure_not_fresh_at_tail' };
  }
  if ((m.framesAfterPeak ?? 0) < 6) {
    return { ok: false, reason: 'candidate_insufficient_frames_after_peak' };
  }

  const safety = evaluateSquatV2RuntimeOwnerSafetyConsumption(decision);
  if (!safety.consumptionAllowed) {
    return { ok: false, reason: safety.blockedReason ?? 'pr04b_consumption_blocked' };
  }

  return { ok: true, reason: null };
}

export type ShallowRecoverySearchHit = {
  decision: SquatMotionEvidenceDecisionV2;
  ownedInput: SquatV2InputOwnerResult;
  v2EvalFrames: PoseFeaturesFrame[];
  syntheticEpoch: ReturnType<typeof makeShallowRecoveryActiveEpoch>;
};

/**
 * Search sliding windows over `validRaw` only. First accepted candidate wins.
 */
export function tryFindShallowV2RecoveryWindow(p: {
  validRaw: PoseFeaturesFrame[];
  latestValidTs: number;
  primaryDecision: SquatMotionEvidenceDecisionV2;
}): { hit: ShallowRecoverySearchHit | null; diagnostics: SquatV2ShallowRecoveryDiagnostics } {
  void p.latestValidTs;
  const { validRaw, primaryDecision } = p;
  const diag: SquatV2ShallowRecoveryDiagnostics = {
    attempted: true,
    applied: false,
    primaryBlockReason: primaryDecision.blockReason,
    blockedReason: null,
    reason: null,
    windowStartMs: null,
    windowEndMs: null,
    windowFrameCount: null,
    candidatesTried: 0,
  };

  const n = validRaw.length;
  if (n < MIN_VALID_RAW_FOR_SEARCH) {
    diag.blockedReason = 'valid_raw_too_short';
    return { hit: null, diagnostics: diag };
  }

  const maxW = Math.min(n, MAX_WINDOW_FRAMES_CAP);
  let lastReason: string | null = 'no_shallow_candidate';

  for (let w = maxW; w >= MIN_WINDOW_FRAMES; w -= WINDOW_LEN_STEP) {
    for (let start = 0; start + w <= n; start += WINDOW_START_STEP) {
      const slice = validRaw.slice(start, start + w);
      if (slice.length < MIN_WINDOW_FRAMES) continue;
      if (windowStartSetupContaminated(slice)) continue;

      diag.candidatesTried++;
      const ownedInput = buildSquatV2OwnedInputFrames(slice);
      const decision = evaluateSquatMotionEvidenceV2(ownedInput.frames);
      const acc = acceptShallowRecoveryCandidate(decision, ownedInput);
      if (!acc.ok) {
        lastReason = acc.reason;
        continue;
      }

      diag.applied = true;
      diag.blockedReason = null;
      diag.reason = 'shallow_recovery_window_accepted';
      diag.windowStartMs = slice[0]!.timestampMs;
      diag.windowEndMs = slice[slice.length - 1]!.timestampMs;
      diag.windowFrameCount = slice.length;

      return {
        hit: {
          decision,
          ownedInput,
          v2EvalFrames: slice,
          syntheticEpoch: makeShallowRecoveryActiveEpoch(slice),
        },
        diagnostics: diag,
      };
    }
  }

  diag.blockedReason = lastReason;
  return { hit: null, diagnostics: diag };
}
