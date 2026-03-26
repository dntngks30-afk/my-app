'use client';

/**
 * PR-DBG-01: 스쿼트 통과 직후 열리는 dev-only 디버그 모달.
 *
 * 오픈 조건 (page.tsx 에서 보장):
 * - NODE_ENV !== 'production' 이고
 * - isFinalPassLatched === true (passLatched state)가 된 시점에만 열림
 *
 * 이 컴포넌트 자체는 판정 로직에 전혀 관여하지 않는다.
 * 통과 시점의 gate 스냅샷을 읽어 표시할 뿐이다.
 */

import { useState, useCallback } from 'react';
import { X, ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';
import type { ExerciseGateResult } from '@/lib/camera/auto-progression';

interface Props {
  gate: ExerciseGateResult;
  finalPassLatched: boolean;
  onClose: () => void;
}

// ──────────────────────────────────────────────────────────────────────────────
// Section helpers
// ──────────────────────────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-2 py-[2px]">
      <span className="shrink-0 text-slate-500 w-[210px]">{label}</span>
      <span className="text-slate-200 break-all">{String(value ?? '—')}</span>
    </div>
  );
}

function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-700 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700/80 transition-colors text-left"
      >
        {open ? (
          <ChevronDown className="size-3 text-slate-400 shrink-0" />
        ) : (
          <ChevronRight className="size-3 text-slate-400 shrink-0" />
        )}
        <span className="text-xs font-semibold text-amber-300 uppercase tracking-wide">
          {title}
        </span>
      </button>
      {open && <div className="px-3 py-2 space-y-0 text-[11px] font-mono">{children}</div>}
    </div>
  );
}

function JsonPreview({ label, value }: { label: string; value: unknown }) {
  const [open, setOpen] = useState(false);
  const json = JSON.stringify(value, null, 2);
  if (value === null || value === undefined) {
    return <Row label={label} value="—" />;
  }
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 py-[2px] text-slate-400 hover:text-slate-200 transition-colors"
      >
        {open ? (
          <ChevronDown className="size-3 shrink-0" />
        ) : (
          <ChevronRight className="size-3 shrink-0" />
        )}
        <span className="text-slate-500">{label}</span>
        <span className="ml-1 text-slate-600 text-[10px]">{open ? '' : '(접힘)'}</span>
      </button>
      {open && (
        <pre className="mt-1 p-2 bg-slate-900 rounded text-[10px] text-slate-300 overflow-x-auto max-h-60 overflow-y-auto">
          {json}
        </pre>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Build copy payload
// ──────────────────────────────────────────────────────────────────────────────

function buildCopyPayload(gate: ExerciseGateResult, finalPassLatched: boolean) {
  const sc = gate.squatCycleDebug;
  return {
    stepId: 'squat',
    finalStatus: gate.status,
    finalPassLatched,
    completionSatisfied: gate.completionSatisfied,
    passConfirmationSatisfied: gate.passConfirmationSatisfied,
    passConfirmationFrameCount: gate.passConfirmationFrameCount,
    confidence: gate.confidence,
    captureQuality: gate.guardrail.captureQuality,
    autoAdvanceDelayMs: gate.autoAdvanceDelayMs,
    squatCycleDebug: sc ?? null,
    guardrail: {
      captureQuality: gate.guardrail.captureQuality,
      completionStatus: gate.guardrail.completionStatus,
      flags: gate.guardrail.flags,
      retryRecommended: gate.guardrail.retryRecommended,
      debug: gate.guardrail.debug,
    },
    evaluatorDebug: {
      qualityHints: gate.evaluatorResult.qualityHints ?? [],
      completionHints: gate.evaluatorResult.completionHints ?? [],
      interpretedSignals: gate.evaluatorResult.interpretedSignals ?? [],
      highlightedMetrics: gate.evaluatorResult.debug?.highlightedMetrics ?? null,
      squatCompletionState: gate.evaluatorResult.debug?.squatCompletionState ?? null,
      squatInternalQuality: gate.evaluatorResult.debug?.squatInternalQuality ?? null,
    },
    reasons: gate.reasons,
    failureReasons: gate.failureReasons,
    userGuidance: gate.userGuidance,
    flags: gate.flags,
    ts: new Date().toISOString(),
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Main modal
// ──────────────────────────────────────────────────────────────────────────────

export function SquatPostPassDebugModal({ gate, finalPassLatched, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    const payload = buildCopyPayload(gate, finalPassLatched);
    void navigator.clipboard.writeText(JSON.stringify(payload, null, 2)).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  }, [gate, finalPassLatched]);

  const sc = gate.squatCycleDebug;
  const ev = gate.evaluatorResult;
  const gr = gate.guardrail;

  return (
    /* 외부 클릭 또는 배경 클릭으로 닫기 차단 — 반드시 Close 버튼 사용 */
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/85 backdrop-blur-sm overflow-y-auto py-6 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Squat Post-Pass Debug"
    >
      <div className="w-full max-w-2xl bg-[#0f1117] rounded-2xl shadow-2xl border border-slate-700/60 flex flex-col text-[11px] font-mono">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-900 rounded-t-2xl">
          <div>
            <span className="text-amber-400 font-bold text-sm">Squat Post-Pass Debug</span>
            <span className="ml-2 text-slate-500 text-[10px]">dev-only · 판정 로직 외부</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700 transition-colors text-[11px]"
            >
              {copied ? (
                <Check className="size-3 text-green-400" />
              ) : (
                <Copy className="size-3" />
              )}
              {copied ? '복사됨' : '디버그 JSON 복사'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex items-center justify-center size-8 rounded-full hover:bg-slate-700 transition-colors text-slate-400 hover:text-slate-100"
              aria-label="닫기"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-3 p-4 overflow-y-auto">

          {/* A. Overview */}
          <Section title="A. Overview">
            <Row label="finalStatus" value={gate.status} />
            <Row label="finalPassLatched" value={finalPassLatched} />
            <Row label="completionSatisfied" value={gate.completionSatisfied} />
            <Row label="passConfirmationSatisfied" value={gate.passConfirmationSatisfied} />
            <Row label="passConfirmationFrameCount" value={gate.passConfirmationFrameCount} />
            <Row label="passConfirmationWindowCount" value={gate.passConfirmationWindowCount} />
            <Row label="confidence" value={gate.confidence} />
            <Row label="guardrail.captureQuality" value={gr.captureQuality} />
            <Row label="autoAdvanceDelayMs" value={gate.autoAdvanceDelayMs} />
            <Row label="nextAllowed" value={gate.nextAllowed} />
            <Row label="retryRecommended" value={gate.retryRecommended} />
          </Section>

          {/* B. Squat Cycle Debug */}
          <Section title="B. Squat Cycle Debug">
            {!sc ? (
              <span className="text-slate-500">squatCycleDebug: null</span>
            ) : (
              <>
                <Row label="armingSatisfied" value={sc.armingSatisfied} />
                <Row label="currentSquatPhase" value={sc.currentSquatPhase} />
                <Row label="attemptStarted" value={sc.attemptStarted} />
                <Row label="startPoseSatisfied" value={sc.startPoseSatisfied} />
                <Row label="startBeforeBottom" value={sc.startBeforeBottom} />
                <Row label="descendDetected" value={sc.descendDetected} />
                <Row label="bottomDetected" value={sc.bottomDetected} />
                <Row label="bottomTurningPointDetected" value={sc.bottomTurningPointDetected} />
                <Row label="ascendDetected" value={sc.ascendDetected} />
                <Row label="recoveryDetected" value={sc.recoveryDetected} />
                <Row label="cycleComplete" value={sc.cycleComplete} />
                <Row label="completionStatus" value={sc.completionStatus} />
                <Row label="depthBand" value={sc.depthBand} />
                <Row label="passBlockedReason" value={sc.passBlockedReason} />
                <Row label="qualityInterpretationReason" value={sc.qualityInterpretationReason} />
                <Row label="passTriggeredAtPhase" value={sc.passTriggeredAtPhase} />
                <Row label="completionPathUsed" value={sc.completionPathUsed} />
                <Row label="completionRejectedReason" value={sc.completionRejectedReason} />
                <Row label="completionBlockedReason" value={sc.completionBlockedReason} />
                <Row label="evidenceLabel" value={sc.evidenceLabel} />
                <Row label="ultraLowRomCandidate" value={sc.ultraLowRomCandidate} />
                <Row label="ultraLowRomGuardPassed" value={sc.ultraLowRomGuardPassed} />
                <Row label="ultraLowRomRejectReason" value={sc.ultraLowRomRejectReason} />
                <Row label="standingStillRejected" value={sc.standingStillRejected} />
                <Row label="falsePositiveBlockReason" value={sc.falsePositiveBlockReason} />
                <Row label="descendConfirmed" value={sc.descendConfirmed} />
                <Row label="ascendConfirmed" value={sc.ascendConfirmed} />
                <Row label="reversalConfirmedAfterDescend" value={sc.reversalConfirmedAfterDescend} />
                <Row label="recoveryConfirmedAfterReversal" value={sc.recoveryConfirmedAfterReversal} />
                <Row label="minimumCycleDurationSatisfied" value={sc.minimumCycleDurationSatisfied} />
                <Row label="standardPathBlockedReason" value={sc.standardPathBlockedReason} />
                <Row label="ultraLowRomPathDisabledOrGuarded" value={sc.ultraLowRomPathDisabledOrGuarded} />
                <div className="h-px bg-slate-700 my-1" />
                <Row label="descendStartAtMs" value={sc.descendStartAtMs} />
                <Row label="downwardCommitmentAtMs" value={sc.downwardCommitmentAtMs} />
                <Row label="committedAtMs" value={sc.committedAtMs} />
                <Row label="reversalAtMs" value={sc.reversalAtMs} />
                <Row label="ascendStartAtMs" value={sc.ascendStartAtMs} />
                <Row label="recoveryAtMs" value={sc.recoveryAtMs} />
                <Row label="standingRecoveredAtMs" value={sc.standingRecoveredAtMs} />
                <Row label="standingRecoveryHoldMs" value={sc.standingRecoveryHoldMs} />
                <Row label="successPhaseAtOpen" value={sc.successPhaseAtOpen} />
                <Row label="cycleDurationMs" value={sc.cycleDurationMs} />
                <Row label="downwardCommitmentDelta" value={sc.downwardCommitmentDelta} />
                <div className="h-px bg-slate-700 my-1" />
                <Row label="squatEvidenceLevel" value={sc.squatEvidenceLevel} />
                <Row label="squatEvidenceReasons" value={sc.squatEvidenceReasons?.join(', ')} />
                <Row label="cycleProofPassed" value={sc.cycleProofPassed} />
                <Row label="romBand" value={sc.romBand} />
                <Row label="confidenceDowngradeReason" value={sc.confidenceDowngradeReason} />
                <Row label="insufficientSignalReason" value={sc.insufficientSignalReason} />
                <Row label="lowRomRejectionReason" value={sc.lowRomRejectionReason} />
                <Row label="ultraLowRomRejectionReason" value={sc.ultraLowRomRejectionReason} />
                <Row label="recoveryReturnContinuityFrames" value={sc.recoveryReturnContinuityFrames} />
                <Row label="recoveryTrailingDepthCount" value={sc.recoveryTrailingDepthCount} />
                <Row label="recoveryDropRatio" value={sc.recoveryDropRatio} />
                <Row label="guardrailPartialReason" value={sc.guardrailPartialReason} />
                <Row label="guardrailCompletePath" value={sc.guardrailCompletePath} />
                <Row label="completionMachinePhase" value={sc.completionMachinePhase} />
                <Row label="completionPassReason" value={sc.completionPassReason} />
                {sc.squatInternalQuality && (
                  <>
                    <div className="h-px bg-slate-700 my-1" />
                    <Row label="internalQuality.qualityTier" value={sc.squatInternalQuality.qualityTier} />
                    <Row label="internalQuality.depthScore" value={sc.squatInternalQuality.depthScore?.toFixed(3)} />
                    <Row label="internalQuality.controlScore" value={sc.squatInternalQuality.controlScore?.toFixed(3)} />
                    <Row label="internalQuality.symmetryScore" value={sc.squatInternalQuality.symmetryScore?.toFixed(3)} />
                    <Row label="internalQuality.recoveryScore" value={sc.squatInternalQuality.recoveryScore?.toFixed(3)} />
                    <Row label="internalQuality.confidence" value={sc.squatInternalQuality.confidence?.toFixed(3)} />
                    <Row label="internalQuality.limitations" value={sc.squatInternalQuality.limitations?.join(', ') || 'none'} />
                  </>
                )}
                {sc.squatRetryContractObservation && (
                  <JsonPreview label="squatRetryContractObservation" value={sc.squatRetryContractObservation} />
                )}
              </>
            )}
          </Section>

          {/* C. Guardrail Summary */}
          <Section title="C. Guardrail Summary" defaultOpen={false}>
            <Row label="captureQuality" value={gr.captureQuality} />
            <Row label="completionStatus" value={gr.completionStatus} />
            <Row label="flags" value={gr.flags?.join(', ') || 'none'} />
            <Row label="retryRecommended" value={gr.retryRecommended} />
            <Row label="debug.guardrailPartialReason" value={gr.debug?.guardrailPartialReason} />
            <Row label="debug.guardrailCompletePath" value={gr.debug?.guardrailCompletePath} />
            <JsonPreview label="guardrail.debug (full)" value={gr.debug} />
          </Section>

          {/* D. Evaluator Debug */}
          <Section title="D. Evaluator Debug" defaultOpen={false}>
            <Row label="qualityHints" value={ev.qualityHints?.join(', ') || 'none'} />
            <Row label="completionHints" value={ev.completionHints?.join(', ') || 'none'} />
            <Row label="interpretedSignals" value={ev.interpretedSignals?.join(', ') || 'none'} />
            <JsonPreview label="highlightedMetrics" value={ev.debug?.highlightedMetrics} />
            <JsonPreview label="squatCompletionState" value={ev.debug?.squatCompletionState} />
            <JsonPreview label="squatInternalQuality" value={ev.debug?.squatInternalQuality} />
          </Section>

          {/* E. Failure / Reason Context */}
          <Section title="E. Failure / Reason Context" defaultOpen={false}>
            <Row label="reasons" value={gate.reasons.join(', ') || 'none'} />
            <Row label="failureReasons" value={gate.failureReasons.join(', ') || 'none'} />
            <Row label="flags" value={gate.flags.join(', ') || 'none'} />
            <Row label="userGuidance" value={gate.userGuidance.join(' / ') || 'none'} />
          </Section>

          {/* Close */}
          <button
            type="button"
            onClick={onClose}
            className="mt-1 w-full py-2.5 rounded-xl border border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors text-sm font-sans"
          >
            닫고 다음으로 이동
          </button>
        </div>
      </div>
    </div>
  );
}
