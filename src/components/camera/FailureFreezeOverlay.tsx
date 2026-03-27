'use client';

/**
 * PR diagnostic: squat failed shallow attempt freeze overlay
 * diagnostic mode에서 capturing 4~5초 동안 pass 못 하면 표시.
 * low-ROM path 미개방 원인 진단용.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  getRecentFailedShallowSnapshots,
  setDiagnosticFreezeMode,
  type SquatFailedShallowSnapshot,
} from '@/lib/camera/camera-success-diagnostic';
import { getRecentSquatObservations, type SquatAttemptObservation } from '@/lib/camera/camera-trace';

interface FailureFreezeOverlayProps {
  /** overlay 닫기 시 호출 (Continue 누르면 onClose) */
  onClose: () => void;
}

function SquatObservationFallback({ o }: { o: SquatAttemptObservation }) {
  return (
    <div className="space-y-1 text-left text-slate-300">
      <p className="text-amber-400/90">No failed shallow snapshot — latest pre-attempt observation</p>
      <p>
        <span className="text-slate-500">eventType</span> {o.eventType}
      </p>
      <p>
        <span className="text-slate-500">shallowCandidate</span> {String(o.shallowCandidateObserved ?? false)}
      </p>
      <p>
        <span className="text-slate-500">attemptLike</span> {String(o.attemptLikeMotionObserved ?? false)}
      </p>
      <p>
        <span className="text-slate-500">evidenceLabel</span> {o.evidenceLabel ?? 'n/a'}
      </p>
      <p>
        <span className="text-slate-500">completionBlocked</span> {o.completionBlockedReason ?? 'n/a'}
      </p>
      <p>
        <span className="text-slate-500">relativeDepthPeak</span> {o.relativeDepthPeak ?? 'n/a'}
      </p>
      <p>
        <span className="text-slate-500">phaseHint</span> {o.phaseHint ?? 'n/a'}
      </p>
      <p>
        <span className="text-slate-500">completionMachinePhase</span> {o.completionMachinePhase ?? 'n/a'}
      </p>
      <p>
        <span className="text-slate-500">terminalKind</span> {o.captureTerminalKind ?? 'n/a'}
      </p>
      <p>
        <span className="text-slate-500">motion d/b/r</span>{' '}
        {String(o.motionDescendDetected ?? false)}/{String(o.motionBottomDetected ?? false)}/
        {String(o.motionRecoveryDetected ?? false)}
      </p>
      <p>
        <span className="text-slate-500">diag</span> {o.debugVersion}
      </p>
    </div>
  );
}

function SquatFailedFields({ s }: { s: SquatFailedShallowSnapshot }) {
  return (
    <div className="space-y-1 text-left">
      <p><span className="text-slate-500">rawDepthPeak</span> {s.rawDepthPeak ?? 'n/a'}</p>
      <p><span className="text-slate-500">baselineStandingDepth</span> {s.baselineStandingDepth ?? 'n/a'}</p>
      <p><span className="text-slate-500">relativeDepthPeak</span> {s.relativeDepthPeak ?? 'n/a'}</p>
      <p><span className="text-slate-500">attemptStarted</span> {String(s.attemptStarted ?? false)}</p>
      <p><span className="text-slate-500">currentSquatPhase</span> {s.currentSquatPhase ?? 'n/a'}</p>
      <p><span className="text-slate-500">descendConfirmed</span> {String(s.descendConfirmed ?? false)}</p>
      <p><span className="text-slate-500">downwardCommitmentReached</span> {String(s.downwardCommitmentReached ?? false)}</p>
      <p><span className="text-slate-500">committedAtMs</span> {s.committedAtMs ?? 'n/a'}</p>
      <p><span className="text-slate-500">ascendConfirmed</span> {String(s.ascendConfirmed ?? false)}</p>
      <p><span className="text-slate-500">failureOverlayArmed</span> {String(s.failureOverlayArmed ?? true)}</p>
      <p><span className="text-slate-500">failureOverlayBlockedReason</span> {s.failureOverlayBlockedReason ?? 'n/a'}</p>
      <p><span className="text-slate-500">guardrailCompletionStatus</span> {s.guardrailCompletionStatus}</p>
      <p><span className="text-slate-500">guardrailPartialReason</span> {s.guardrailPartialReason ?? 'n/a'}</p>
      <p><span className="text-slate-500">autoProgressionCompletionSatisfied</span> {String(s.autoProgressionCompletionSatisfied)}</p>
      <p><span className="text-slate-500">completionPathUsed</span> {s.completionPathUsed ?? 'n/a'}</p>
      <p><span className="text-slate-500">evidenceLabel</span> {s.evidenceLabel ?? 'n/a'}</p>
      <p><span className="text-slate-500">completionBlockedReason</span> {s.completionBlockedReason ?? 'n/a'}</p>
      <p><span className="text-slate-500">completionRejectedReason</span> {s.completionRejectedReason ?? 'n/a'}</p>
      <p><span className="text-slate-500">lowRomRecoveryConfirmed</span> {String(s.lowRomRecoveryConfirmed)}</p>
      <p><span className="text-slate-500">lowRomRecoveredReason</span> {s.lowRomRecoveredReason ?? 'n/a'}</p>
      <p><span className="text-slate-500">ultraLowRomRecoveryConfirmed</span> {String(s.ultraLowRomRecoveryConfirmed)}</p>
      <p><span className="text-slate-500">ultraLowRomRecoveredReason</span> {s.ultraLowRomRecoveredReason ?? 'n/a'}</p>
      <p><span className="text-slate-500">passConfirmationSatisfied</span> {String(s.passConfirmationSatisfied)}</p>
      <p><span className="text-slate-500">standingRecoveredAtMs</span> {s.standingRecoveredAtMs ?? 'n/a'}</p>
      <p><span className="text-slate-500">standingRecoveryHoldMs</span> {s.standingRecoveryHoldMs ?? 'n/a'}</p>
      <p><span className="text-slate-500">successPhaseAtOpen</span> {s.successPhaseAtOpen ?? 'n/a'}</p>
      <p><span className="text-slate-500">cycleDurationMs</span> {s.cycleDurationMs ?? 'n/a'}</p>
      <p><span className="text-slate-500">diagVersion</span> {s.diagVersion}</p>
    </div>
  );
}

export function FailureFreezeOverlay({ onClose }: FailureFreezeOverlayProps) {
  const [snapshot, setSnapshot] = useState<SquatFailedShallowSnapshot | null>(null);
  const [fallbackObs, setFallbackObs] = useState<SquatAttemptObservation | null>(null);

  useEffect(() => {
    const list = getRecentFailedShallowSnapshots();
    const latest = list.length > 0 ? list[list.length - 1]! : null;
    setSnapshot(latest);
    if (latest) {
      setFallbackObs(null);
      return;
    }
    const obsList = getRecentSquatObservations();
    const lastObs = obsList.length > 0 ? obsList[obsList.length - 1]! : null;
    setFallbackObs(lastObs);
  }, []);

  const handleCopyJson = useCallback(() => {
    const payload = snapshot ?? fallbackObs;
    if (!payload) return;
    const json = JSON.stringify(payload, null, 2);
    if (typeof navigator?.clipboard?.writeText === 'function') {
      navigator.clipboard.writeText(json).then(
        () => console.info('[camera:failure-freeze] copied to clipboard'),
        () => console.warn('[camera:failure-freeze] clipboard write failed')
      );
    }
  }, [snapshot, fallbackObs]);

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/90 p-4">
      <div className="w-full max-w-lg overflow-y-auto rounded-lg border border-rose-500/50 bg-slate-900 p-6 font-mono text-sm">
        <h2 className="mb-4 text-lg font-semibold text-rose-400">
          Squat Attempt Failed (Shallow) — Diagnostic
        </h2>
        <div className="max-h-[60vh] overflow-y-auto text-slate-200">
          {snapshot ? (
            <SquatFailedFields s={snapshot} />
          ) : fallbackObs ? (
            <SquatObservationFallback o={fallbackObs} />
          ) : (
            <p className="text-slate-400">No snapshot. Continue to retry.</p>
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-rose-600 px-4 py-2 font-medium text-white hover:bg-rose-500"
          >
            Continue
          </button>
          {(snapshot || fallbackObs) && (
            <button
              type="button"
              onClick={handleCopyJson}
              className="rounded border border-slate-500 px-4 py-2 text-slate-300 hover:bg-slate-700"
            >
              Copy JSON
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setDiagnosticFreezeMode(false);
              onClose();
            }}
            className="rounded border border-slate-600 px-4 py-2 text-slate-400 hover:bg-slate-800"
          >
            Disable freeze & Continue
          </button>
        </div>
      </div>
    </div>
  );
}
