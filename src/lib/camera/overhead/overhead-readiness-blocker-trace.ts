/**
 * PR-OH-OBS-BLOCKER-TRACE-02C: overhead readiness blocker / motion timing trace payload (pure, diagnostic).
 * No product behavior — consumed only by overhead page + attempt snapshots.
 */
import type { LiveReadinessSummary } from '@/lib/camera/live-readiness';

export type DisplayedPrimaryBlockerSource =
  | 'success_state'
  | 'readiness_uncertain'
  | 'framing_hint_evaluation_window'
  | 'framing_hint_recent_tail_fallback'
  | 'non_framing_readiness';

export interface OverheadMotionSignalsSnapshot {
  meaningfulRiseSatisfied: boolean;
  topDetected: boolean;
  stableTopEntered: boolean;
  holdStarted: boolean;
  holdSatisfied: boolean;
  completionMachinePhase: string | null;
}

/** Page refs 누적 + 마지막 관측 스냅샷 */
export interface OverheadReadinessBlockerMotionLatch {
  seenDuringActiveMotion: boolean;
  seenAfterMotionWindow: boolean;
  lastSignals: OverheadMotionSignalsSnapshot | null;
}

export interface OverheadReadinessBlockerTracePayload {
  /** UI/스냅샷과 동일한 primary blocker 문자열 */
  displayedPrimaryBlocker: string | null;
  displayedPrimaryBlockerSource: DisplayedPrimaryBlockerSource;
  evaluationWindowFramingHint: string | null;
  evaluationWindowPrimaryBlocker: string | null;
  recentTailFramingHint: string | null;
  recentTailPrimaryBlocker: string | null;
  /** eval primary 와 tail primary 가 다름 (contract / tail 분리 진단) */
  blockerSourceMismatch: boolean;
  displayedMatchesEvaluationPrimary: boolean;
  displayedMatchesTailPrimary: boolean;
  blockerFirstSeenAtMs: number | null;
  blockerLastSeenAtMs: number | null;
  blockerSeenDuringActiveMotion: boolean;
  blockerSeenAfterMotionWindow: boolean;
  /** 터미널 스냅샷 시점에 blocker 가 최근에 관측됨(옵션 플래그 기반) */
  blockerSeenNearTerminal: boolean;
  motionSignalsAtLastBlocker: OverheadMotionSignalsSnapshot | null;
  selectedWindowStartMs: number | null;
  selectedWindowEndMs: number | null;
  traceWallClockMs: number;
}

export function deriveDisplayedPrimaryBlockerSource(params: {
  success: boolean;
  rawReadinessState: LiveReadinessSummary['state'];
  activeBlockers: string[];
  severeFramingInvalid: boolean;
  framingHintSource: 'evaluation_window' | 'recent_tail_fallback';
}): DisplayedPrimaryBlockerSource {
  if (params.success) return 'success_state';
  if (params.rawReadinessState === 'not_ready' && params.activeBlockers.includes('readiness_uncertain')) {
    return 'readiness_uncertain';
  }
  if (params.severeFramingInvalid) {
    return params.framingHintSource === 'evaluation_window'
      ? 'framing_hint_evaluation_window'
      : 'framing_hint_recent_tail_fallback';
  }
  return 'non_framing_readiness';
}

export function buildOverheadReadinessBlockerTracePayload(input: {
  displayedPrimaryBlocker: string | null;
  displayedPrimaryBlockerSource: DisplayedPrimaryBlockerSource;
  evaluationWindowFramingHint: string | null;
  evaluationWindowPrimaryBlocker: string | null;
  recentTailFramingHint: string | null;
  recentTailPrimaryBlocker: string | null;
  blockerFirstSeenAtMs: number | null;
  blockerLastSeenAtMs: number | null;
  motionLatch: OverheadReadinessBlockerMotionLatch;
  blockerSeenNearTerminal: boolean;
  motionSignalsAtLastBlocker: OverheadMotionSignalsSnapshot | null;
  selectedWindowStartMs: number | null;
  selectedWindowEndMs: number | null;
  traceWallClockMs: number;
}): OverheadReadinessBlockerTracePayload {
  const ev = input.evaluationWindowPrimaryBlocker;
  const tail = input.recentTailPrimaryBlocker;
  const disp = input.displayedPrimaryBlocker;

  const blockerSourceMismatch = ev !== tail;
  const displayedMatchesEvaluationPrimary = disp === ev;
  const displayedMatchesTailPrimary = disp === tail;

  return {
    displayedPrimaryBlocker: input.displayedPrimaryBlocker,
    displayedPrimaryBlockerSource: input.displayedPrimaryBlockerSource,
    evaluationWindowFramingHint: input.evaluationWindowFramingHint,
    evaluationWindowPrimaryBlocker: ev,
    recentTailFramingHint: input.recentTailFramingHint,
    recentTailPrimaryBlocker: tail,
    blockerSourceMismatch,
    displayedMatchesEvaluationPrimary,
    displayedMatchesTailPrimary,
    blockerFirstSeenAtMs: input.blockerFirstSeenAtMs,
    blockerLastSeenAtMs: input.blockerLastSeenAtMs,
    blockerSeenDuringActiveMotion: input.motionLatch.seenDuringActiveMotion,
    blockerSeenAfterMotionWindow: input.motionLatch.seenAfterMotionWindow,
    blockerSeenNearTerminal: input.blockerSeenNearTerminal,
    motionSignalsAtLastBlocker: input.motionSignalsAtLastBlocker,
    selectedWindowStartMs: input.selectedWindowStartMs,
    selectedWindowEndMs: input.selectedWindowEndMs,
    traceWallClockMs: input.traceWallClockMs,
  };
}
