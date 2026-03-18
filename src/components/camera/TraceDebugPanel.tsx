'use client';

/**
 * PR-4: dev-only trace 관측 패널
 * - 최근 attempt 수, export, clear
 */
import { useCallback, useEffect, useState } from 'react';
import {
  getRecentAttempts,
  clearAttempts,
  getQuickStats,
  type AttemptSnapshot,
} from '@/lib/camera/camera-trace';
import { getCorrectiveCueObservability } from '@/lib/camera/voice-guidance';
import { getLastPlaybackObservability } from '@/lib/camera/korean-audio-pack';

interface TraceDebugPanelProps {
  liveReadiness?: {
    state: string;
    rawState?: string;
    blocker?: string | null;
    framingHint?: string | null;
    smoothingApplied?: boolean;
    finalPassLatched?: boolean;
    validFrameCount?: number;
    visibleJointsRatio?: number;
    criticalJointsAvailability?: number;
  };
  /** dev-only: live cueing 활성화 여부 (bottom-stall / overhead cue 진단용) */
  liveCueingEnabled?: boolean;
}

export function TraceDebugPanel({ liveReadiness, liveCueingEnabled }: TraceDebugPanelProps) {
  const [attempts, setAttempts] = useState<AttemptSnapshot[]>([]);
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null);

  const refresh = useCallback(() => {
    const list = getRecentAttempts();
    setAttempts(list);
    setRefreshedAt(new Date().toISOString());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleExport = useCallback(() => {
    const list = getRecentAttempts();
    const stats = getQuickStats(list);
    const payload = { attempts: list, quickStats: stats, exportedAt: new Date().toISOString() };
    const json = JSON.stringify(payload, null, 2);
    if (typeof navigator?.clipboard?.writeText === 'function') {
      navigator.clipboard.writeText(json).then(
        () => console.info('[camera-trace] exported to clipboard'),
        () => console.warn('[camera-trace] clipboard write failed')
      );
    }
    console.table(
      list.map((a) => ({
        ts: a.ts.slice(11, 19),
        movement: a.movementType,
        outcome: a.outcome,
        quality: a.captureQuality,
        conf: a.confidence.toFixed(2),
        readiness: a.readinessSummary?.state ?? 'n/a',
        blocker: a.readinessSummary?.blocker ?? 'none',
      }))
    );
    refresh();
  }, [refresh]);

  const handleClear = useCallback(() => {
    clearAttempts();
    setAttempts([]);
    setRefreshedAt(null);
  }, []);

  const stats = attempts.length > 0 ? getQuickStats(attempts) : null;
  const okCount = stats?.byOutcome?.ok ?? 0;
  const lowCount =
    (stats?.byOutcome?.low ?? 0) +
    (stats?.byOutcome?.retry_required ?? 0) +
    (stats?.byOutcome?.retry_optional ?? 0);
  const invalidCount = (stats?.byOutcome?.invalid ?? 0) + (stats?.byOutcome?.failed ?? 0);

  return (
    <div className="mt-3 rounded-lg border border-slate-600/50 bg-slate-900/50 p-3">
      <p className="text-[11px] text-slate-400" style={{ fontFamily: 'var(--font-sans-noto)' }}>
        PR-4 trace ({attempts.length} attempts)
        {refreshedAt && ` · refreshed ${refreshedAt.slice(11, 19)}`}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={refresh}
          className="rounded border border-slate-500/50 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-700/50"
          style={{ fontFamily: 'var(--font-sans-noto)' }}
        >
          새로고침
        </button>
        <button
          type="button"
          onClick={handleExport}
          className="rounded border border-slate-500/50 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-700/50"
          style={{ fontFamily: 'var(--font-sans-noto)' }}
        >
          Export JSON
        </button>
        <button
          type="button"
          onClick={handleClear}
          className="rounded border border-slate-500/50 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-700/50"
          style={{ fontFamily: 'var(--font-sans-noto)' }}
        >
          Clear
        </button>
      </div>
      {liveReadiness && (
        <div className="mt-2 text-[10px] text-slate-400">
          <p>
            readiness={liveReadiness.state}
            {liveReadiness.rawState ? ` raw=${liveReadiness.rawState}` : ''}
            {typeof liveReadiness.smoothingApplied === 'boolean'
              ? ` smoothing=${liveReadiness.smoothingApplied}`
              : ''}
            {typeof liveReadiness.finalPassLatched === 'boolean'
              ? ` finalPass=${liveReadiness.finalPassLatched}`
              : ''}
          </p>
          <p>blocker={liveReadiness.blocker ?? 'none'}</p>
          <p>framingHint={liveReadiness.framingHint ?? 'none'}</p>
          <p>
            frames={liveReadiness.validFrameCount ?? 'n/a'} visible=
            {typeof liveReadiness.visibleJointsRatio === 'number'
              ? liveReadiness.visibleJointsRatio.toFixed(2)
              : 'n/a'}{' '}
            critical=
            {typeof liveReadiness.criticalJointsAvailability === 'number'
              ? liveReadiness.criticalJointsAvailability.toFixed(2)
              : 'n/a'}
          </p>
        </div>
      )}
      {(() => {
        const cueObs = getCorrectiveCueObservability();
        return (
          <div className="mt-2 text-[10px] text-slate-500">
            <p>liveCueingEnabled={String(liveCueingEnabled ?? false)}</p>
            {cueObs && (
              <>
                <p>cue={cueObs.cueCandidate ?? 'none'} latched={cueObs.latchedKey ?? 'none'}</p>
                <p>suppressed={cueObs.suppressedReason ?? 'none'} played={String(cueObs.played)}</p>
                <p>lastReadiness={cueObs.lastReadiness ?? 'n/a'}</p>
              </>
            )}
          </div>
        );
      })()}
      {(() => {
        const pb = getLastPlaybackObservability();
        if (!pb) return null;
        return (
          <div className="mt-2 text-[10px] text-slate-500">
            <p>playback: mode={pb.mode} cueKey={pb.cueKey}</p>
            <p>
              clipPath={pb.clipPath ?? 'none'} clipKey={pb.clipKey ?? 'none'}{' '}
              {pb.clipMissing ? 'clipMissing' : ''}
              {pb.clipFailed ? ' clipFailed' : ''} success={String(pb.success)}
            </p>
          </div>
        );
      })()}
      {attempts.length > 0 && (
        <div className="mt-2 max-h-24 overflow-y-auto text-[10px] text-slate-500">
          <p>
            ok={okCount} low={lowCount} invalid={invalidCount}
          </p>
          {(() => {
            const latest = attempts[attempts.length - 1];
            const d = latest?.diagnosisSummary;
            if (!d) return null;
            return (
              <div className="mt-1 border-t border-slate-600/50 pt-1">
                <p className="font-medium text-slate-400">Latest diagnosis</p>
                <p>comp={d.completionSatisfied} passConf={d.passConfirmed} latched={d.passLatched}</p>
                {d.squatCycle && (
                  <>
                    <p>peakDepth={d.squatCycle.peakDepth ?? 'n/a'} bottom={d.squatCycle.bottomDetected} recovery={d.squatCycle.recoveryDetected} startBeforeBottom={d.squatCycle.startBeforeBottom}</p>
                    <p className="text-slate-500">PR-A4: path={d.squatCycle.completionPathUsed ?? 'n/a'} rejected={d.squatCycle.completionRejectedReason ?? 'n/a'} cycleMs={d.squatCycle.cycleDurationMs ?? 'n/a'}</p>
                    <p className="text-slate-500">PR-A5: ultraCand={d.squatCycle.ultraLowRomCandidate ?? 'n/a'} ultraPass={d.squatCycle.ultraLowRomGuardPassed ?? 'n/a'} ultraRej={d.squatCycle.ultraLowRomRejectReason ?? 'n/a'} commitDelta={d.squatCycle.downwardCommitmentDelta ?? 'n/a'}</p>
                    <p className="text-slate-500">PR-A6: standingRej={d.squatCycle.standingStillRejected ?? 'n/a'} fpBlock={d.squatCycle.falsePositiveBlockReason ?? 'n/a'} ultraDisabled={d.squatCycle.ultraLowRomPathDisabledOrGuarded ?? 'n/a'}</p>
                    <p className="text-slate-500">PR evidence: level={d.squatCycle.squatEvidenceLevel ?? 'n/a'} cycleProof={d.squatCycle.cycleProofPassed ?? 'n/a'} romBand={d.squatCycle.romBand ?? 'n/a'} downgrade={d.squatCycle.confidenceDowngradeReason ?? 'n/a'} insufficient={d.squatCycle.insufficientSignalReason ?? 'n/a'}</p>
                  </>
                )}
                {d.overhead && (
                  <>
                    <p>peakElev={d.overhead.peakElevation ?? 'n/a'} peakCnt={d.overhead.peakCount} holdMs={d.overhead.holdDurationMs} holdTooShort={d.overhead.holdTooShort}</p>
                    <p className="text-slate-500">topEntry={d.overhead.topEntryAtMs ?? 'n/a'} stableTop={d.overhead.stableTopEntryAtMs ?? 'n/a'} holdAcc={d.overhead.holdAccumulationMs ?? 'n/a'} holdSat={d.overhead.holdSatisfiedAtMs ?? 'n/a'} holdRem={d.overhead.holdRemainingMsAtCue ?? 'n/a'}</p>
                    <p className="text-slate-500">holdCuePlayed={d.overhead.holdCuePlayed ?? 'n/a'} holdSupp={d.overhead.holdCueSuppressedReason ?? 'n/a'} successTrig={d.overhead.successTriggeredAtMs ?? 'n/a'} successBlocked={d.overhead.successBlockedReason ?? 'n/a'}</p>
                  </>
                )}
                {d.cue && (
                  <p>cue={d.cue.chosenCueKey ?? 'none'} clip={d.cue.chosenClipKey ?? 'none'} liveCue={d.cue.liveCueingEnabled}</p>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
