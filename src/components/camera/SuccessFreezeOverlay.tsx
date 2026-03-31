'use client';

/**
 * PR success-diagnostic: full-screen success freeze overlay
 * diagnostic freeze mode에서 success 직후 자동 전환 대신 표시.
 * getRecentSuccessSnapshots()의 최신 snapshot을 source로 사용.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  getRecentSuccessSnapshots,
  setDiagnosticFreezeMode,
  type OverheadSuccessSnapshot,
  type SquatSuccessSnapshot,
  type SuccessSnapshot,
} from '@/lib/camera/camera-success-diagnostic';

const SUCCESS_SNAPSHOT_STALE_MS = 15000;

function isFreshSuccessSnapshot(snapshot: SuccessSnapshot): boolean {
  const ts = snapshot.passLatchedAtMs;
  return Number.isFinite(ts) && Date.now() - ts <= SUCCESS_SNAPSHOT_STALE_MS;
}

interface SuccessFreezeOverlayProps {
  /** overlay 닫기 시 호출 (Continue 누르면 onContinue → overlay 닫힘) */
  onContinue: () => void;
  /** motion type — overlay 표시 필드 결정 */
  motionType: 'squat' | 'overhead_reach';
}

function OverheadFields({ s }: { s: OverheadSuccessSnapshot }) {
  return (
    <div className="space-y-1 text-left">
      <p><span className="text-slate-500">successOpenedBy</span> {s.successOpenedBy}</p>
      <p><span className="text-slate-500">evaluatorHoldDurationMs</span> {s.evaluatorHoldDurationMs}</p>
      <p><span className="text-slate-500">guardrailCompletionStatus</span> {s.guardrailCompletionStatus}</p>
      <p><span className="text-slate-500">autoProgressionCompletionSatisfied</span> {String(s.autoProgressionCompletionSatisfied)}</p>
      <p><span className="text-slate-500">passConfirmationSatisfied</span> {String(s.passConfirmationSatisfied)}</p>
      <p><span className="text-slate-500">pagePassReady</span> {String(s.pagePassReady)}</p>
      <p><span className="text-slate-500">effectivePassLatched</span> {String(s.effectivePassLatched)}</p>
      <p><span className="text-slate-500">competingSuccessPathsDetected</span> {s.competingSuccessPathsDetected.join(', ') || 'none'}</p>
      <p><span className="text-slate-500">diagVersion</span> {s.diagVersion}</p>
    </div>
  );
}

function SquatFields({ s }: { s: SquatSuccessSnapshot }) {
  return (
    <div className="space-y-1 text-left">
      <p><span className="text-slate-500">successOpenedBy</span> {s.successOpenedBy}</p>
      <p><span className="text-slate-500">evaluatorDepthPeak</span> {s.evaluatorDepthPeak ?? 'n/a'}</p>
      <p><span className="text-slate-500">baselineStandingDepth</span> {s.baselineStandingDepth ?? 'n/a'}</p>
      <p><span className="text-slate-500">rawDepthPeak</span> {s.rawDepthPeak ?? 'n/a'}</p>
      <p><span className="text-slate-500">relativeDepthPeak</span> {s.relativeDepthPeak ?? 'n/a'}</p>
      <p><span className="text-slate-500">guardrailCompletionStatus</span> {s.guardrailCompletionStatus}</p>
      <p><span className="text-slate-500">autoProgressionCompletionSatisfied</span> {String(s.autoProgressionCompletionSatisfied)}</p>
      <p><span className="text-slate-500">currentSquatPhase</span> {s.currentSquatPhase ?? 'n/a'}</p>
      <p><span className="text-slate-500">completionPathUsed</span> {s.completionPathUsed ?? 'n/a'}</p>
      <p><span className="text-slate-500">evidenceLabel</span> {s.evidenceLabel ?? 'n/a'}</p>
      <p><span className="text-slate-500">successPhaseAtOpen</span> {s.successPhaseAtOpen ?? 'n/a'}</p>
      <p><span className="text-slate-500">passConfirmationSatisfied</span> {String(s.passConfirmationSatisfied)}</p>
      <p><span className="text-slate-500">effectivePassLatched</span> {String(s.effectivePassLatched)}</p>
      <p><span className="text-slate-500">standingRecoveredAtMs</span> {s.standingRecoveredAtMs ?? 'n/a'}</p>
      <p><span className="text-slate-500">standingRecoveryHoldMs</span> {s.standingRecoveryHoldMs ?? 'n/a'}</p>
      <p><span className="text-slate-500">cycleDurationMs</span> {s.cycleDurationMs ?? 'n/a'}</p>
      <p><span className="text-slate-500">diagVersion</span> {s.diagVersion}</p>
    </div>
  );
}

export function SuccessFreezeOverlay({ onContinue, motionType }: SuccessFreezeOverlayProps) {
  const [snapshot, setSnapshot] = useState<SuccessSnapshot | null>(null);

  useEffect(() => {
    const list = getRecentSuccessSnapshots();
    const latest = [...list]
      .reverse()
      .find((entry) => entry.motionType === motionType && isFreshSuccessSnapshot(entry)) ?? null;
    setSnapshot(latest);
  }, [motionType]);

  const handleCopyJson = useCallback(() => {
    if (!snapshot) return;
    const json = JSON.stringify(snapshot, null, 2);
    if (typeof navigator?.clipboard?.writeText === 'function') {
      navigator.clipboard.writeText(json).then(
        () => console.info('[camera:success-freeze] copied to clipboard'),
        () => console.warn('[camera:success-freeze] clipboard write failed')
      );
    }
  }, [snapshot]);

  if (!snapshot) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80">
        <div className="rounded-lg border border-amber-500/50 bg-slate-900 p-6 text-amber-400">
          <p className="text-lg font-medium">Success Freeze Overlay</p>
          <p className="mt-2 text-sm text-slate-400">No snapshot for {motionType}. Continue to proceed.</p>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={onContinue}
              className="rounded bg-amber-600 px-4 py-2 text-white hover:bg-amber-500"
            >
              Continue
            </button>
            <button
              type="button"
              onClick={() => {
                setDiagnosticFreezeMode(false);
                onContinue();
              }}
              className="rounded border border-slate-500 px-4 py-2 text-slate-300 hover:bg-slate-700"
            >
              Disable freeze & Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/90 p-4">
      <div className="w-full max-w-lg overflow-y-auto rounded-lg border border-amber-500/50 bg-slate-900 p-6 font-mono text-sm">
        <h2 className="mb-4 text-lg font-semibold text-amber-400">
          Success Freeze — {motionType === 'squat' ? 'Squat' : 'Overhead Reach'}
        </h2>
        <div className="max-h-[60vh] overflow-y-auto text-slate-200">
          {snapshot.motionType === 'overhead_reach' && <OverheadFields s={snapshot} />}
          {snapshot.motionType === 'squat' && <SquatFields s={snapshot} />}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onContinue}
            className="rounded bg-amber-600 px-4 py-2 font-medium text-white hover:bg-amber-500"
          >
            Continue
          </button>
          <button
            type="button"
            onClick={handleCopyJson}
            className="rounded border border-slate-500 px-4 py-2 text-slate-300 hover:bg-slate-700"
          >
            Copy JSON
          </button>
          <button
            type="button"
            onClick={() => {
              setDiagnosticFreezeMode(false);
              onContinue();
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
