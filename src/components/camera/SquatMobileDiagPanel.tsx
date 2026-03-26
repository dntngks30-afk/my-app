'use client';

/**
 * CAM-OBS: 스쿼트 페이지 전용 모바일 진단 패널 (?diag=1 또는 숨은 제스처로만 노출).
 * localStorage 스냅샷을 읽어 표시·복사·공유만 담당(pass 로직 없음).
 */
import { useCallback, useMemo, useState } from 'react';
import {
  getSquatMobileDiagAttempts,
  type SquatFailedShallowSnapshot,
  type SquatMobileDiagEntry,
  type SquatSuccessSnapshot,
} from '@/lib/camera/camera-success-diagnostic';

function Row({ label, value }: { label: string; value: string | number | boolean | null | undefined }) {
  const v =
    value === null || value === undefined
      ? '—'
      : typeof value === 'boolean'
        ? String(value)
        : String(value);
  return (
    <div className="flex flex-col gap-0.5 border-b border-white/10 py-1.5 text-left last:border-0">
      <span className="text-[10px] uppercase tracking-wide text-slate-500">{label}</span>
      <span className="break-all text-xs text-slate-200">{v}</span>
    </div>
  );
}

function buildExportPayload(entry: SquatMobileDiagEntry | null) {
  if (!entry) return { error: 'no_snapshot' };
  const base = {
    kind: 'squat_mobile_diag',
    diagVersion: entry.payload.diagVersion,
    attemptType: entry.attemptType,
    ts: entry.ts,
  };
  if (entry.attemptType === 'success') {
    const p = entry.payload as SquatSuccessSnapshot;
    return {
      ...base,
      topLevel: {
        gateStatus: p.gateStatus,
        progressionState: p.progressionState,
        finalPassLatched: p.finalPassLatched,
        confidence: p.confidence,
        captureQuality: p.captureQuality,
        failureReasons: p.failureReasonsSnapshot,
        flags: p.flagsSnapshot,
        finalPassBlockedReason: p.finalPassBlockedReason,
        finalPassEligible: p.finalPassEligible,
      },
      squat: {
        relativeDepthPeak: p.relativeDepthPeak,
        depthBand: p.depthBand,
        romBand: p.romBand,
        evidenceLabel: p.evidenceLabel,
        completionSatisfied: p.autoProgressionCompletionSatisfied,
        completionBlockedReason: p.completionBlockedReason,
        completionPassReason: p.completionPassReason,
        completionPathUsed: p.completionPathUsed,
        cycleProofPassed: p.cycleProofPassed,
        descendConfirmed: p.descendConfirmed,
        reversalConfirmedAfterDescend: p.reversalConfirmedAfterDescend,
        recoveryConfirmedAfterReversal: p.recoveryConfirmedAfterReversal,
        standingRecoveryHoldMs: p.standingRecoveryHoldMs,
        squatDescentToPeakMs: p.squatDescentToPeakMs,
        squatReversalToStandingMs: p.squatReversalToStandingMs,
      },
      raw: p,
    };
  }
  const p = entry.payload as SquatFailedShallowSnapshot;
  return {
    ...base,
    topLevel: {
      gateStatus: p.gateStatus,
      progressionState: p.progressionState,
      finalPassLatched: p.finalPassLatched,
      confidence: p.confidence,
      captureQuality: p.captureQuality,
      failureReasons: p.failureReasons,
      flags: p.flags,
      finalPassBlockedReason: p.finalPassBlockedReason,
      finalPassEligible: p.finalPassEligible,
    },
    squat: {
      relativeDepthPeak: p.relativeDepthPeak,
      depthBand: p.depthBand,
      romBand: p.romBand,
      evidenceLabel: p.evidenceLabel,
      completionSatisfied: p.autoProgressionCompletionSatisfied,
      completionBlockedReason: p.completionBlockedReason,
      completionPassReason: p.completionPassReason,
      completionPathUsed: p.completionPathUsed,
      cycleProofPassed: p.cycleProofPassed,
      descendConfirmed: p.descendConfirmed,
      reversalConfirmedAfterDescend: p.reversalConfirmedAfterDescend,
      recoveryConfirmedAfterReversal: p.recoveryConfirmedAfterReversal,
      standingRecoveryHoldMs: p.standingRecoveryHoldMs,
      squatDescentToPeakMs: p.squatDescentToPeakMs,
      squatReversalToStandingMs: p.squatReversalToStandingMs,
    },
    raw: p,
  };
}

export function SquatMobileDiagPanel({ unlocked }: { unlocked: boolean }) {
  const [open, setOpen] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  const attempts = useMemo(() => {
    void refreshToken;
    return getSquatMobileDiagAttempts(8);
  }, [refreshToken]);

  const latest = attempts.length > 0 ? attempts[attempts.length - 1]! : null;
  const jsonText = useMemo(() => JSON.stringify(buildExportPayload(latest), null, 2), [latest]);

  const refresh = useCallback(() => setRefreshToken((t) => t + 1), []);

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(jsonText);
    } catch {
      /* ignore */
    }
  }, [jsonText]);

  const onShare = useCallback(async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'MOVE RE squat diag',
          text: jsonText.slice(0, 12000),
        });
      }
    } catch {
      /* 사용자 취소·미지원 */
    }
  }, [jsonText]);

  if (!unlocked) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          refresh();
          setOpen(true);
        }}
        className="fixed bottom-20 right-3 z-[60] rounded-full border border-amber-500/40 bg-black/70 px-3 py-2 text-[11px] text-amber-200 shadow-lg backdrop-blur-sm"
        aria-label="스쿼트 진단 열기"
      >
        관측
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] flex flex-col justify-end bg-black/60 p-0"
          role="dialog"
          aria-modal="true"
          aria-label="스쿼트 모바일 진단"
        >
          <div className="max-h-[85vh] overflow-hidden rounded-t-2xl border border-white/10 bg-[#0f1419] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <span className="text-sm font-medium text-slate-100">스쿼트 시도 관측</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={refresh}
                  className="rounded-lg px-2 py-1 text-xs text-slate-400 hover:bg-white/10"
                >
                  새로고침
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-2 py-1 text-xs text-slate-300 hover:bg-white/10"
                >
                  닫기
                </button>
              </div>
            </div>

            <div className="max-h-[42vh] overflow-y-auto px-4 py-2">
              {latest ? (
                <SquatDiagFields entry={latest} />
              ) : (
                <p className="text-xs text-slate-500">저장된 스냅샷이 없습니다. 캡처 후 retry/fail 또는 통과를 시도하세요.</p>
              )}
            </div>

            <div className="border-t border-white/10 px-4 py-2">
              <p className="mb-1 text-[10px] text-slate-500">최근 {attempts.length}건 (시간순, 링 버퍼)</p>
              <pre className="max-h-[22vh] overflow-auto rounded-lg bg-black/40 p-2 text-[10px] leading-snug text-slate-400">
                {jsonText}
              </pre>
            </div>

            <div className="flex gap-2 border-t border-white/10 p-4">
              <button
                type="button"
                onClick={onCopy}
                className="min-h-[44px] flex-1 rounded-xl bg-amber-600/90 text-sm font-medium text-white"
              >
                JSON 복사
              </button>
              <button
                type="button"
                onClick={onShare}
                className="min-h-[44px] flex-1 rounded-xl border border-white/20 text-sm text-slate-200"
              >
                공유
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SquatDiagFields({ entry }: { entry: SquatMobileDiagEntry }) {
  if (entry.attemptType === 'success') {
    const p = entry.payload;
    return (
      <div className="space-y-3">
        <p className="text-xs text-amber-200/90">시도 유형: 성공</p>
        <section>
          <p className="mb-1 text-[11px] font-semibold text-slate-400">상단</p>
          <Row label="timestamp" value={p.ts} />
          <Row label="gate.status" value={p.gateStatus} />
          <Row label="progressionState" value={p.progressionState} />
          <Row label="finalPassLatched" value={p.finalPassLatched} />
          <Row label="confidence" value={p.confidence} />
          <Row label="captureQuality" value={p.captureQuality} />
          <Row label="failureReasons" value={(p.failureReasonsSnapshot ?? []).join(', ') || '—'} />
          <Row label="flags" value={(p.flagsSnapshot ?? []).join(', ') || '—'} />
          <Row label="finalPassBlockedReason" value={p.finalPassBlockedReason} />
          <Row label="finalPassEligible" value={p.finalPassEligible} />
        </section>
        <section>
          <p className="mb-1 text-[11px] font-semibold text-slate-400">스쿼트</p>
          <Row label="relativeDepthPeak" value={p.relativeDepthPeak} />
          <Row label="depthBand" value={p.depthBand} />
          <Row label="romBand" value={p.romBand} />
          <Row label="evidenceLabel" value={p.evidenceLabel} />
          <Row label="completionSatisfied" value={p.autoProgressionCompletionSatisfied} />
          <Row label="completionBlockedReason" value={p.completionBlockedReason} />
          <Row label="completionPassReason" value={p.completionPassReason} />
          <Row label="completionPathUsed" value={p.completionPathUsed} />
          <Row label="cycleProofPassed" value={p.cycleProofPassed} />
          <Row label="descendConfirmed" value={p.descendConfirmed} />
          <Row label="reversalConfirmedAfterDescend" value={p.reversalConfirmedAfterDescend} />
          <Row label="recoveryConfirmedAfterReversal" value={p.recoveryConfirmedAfterReversal} />
          <Row label="standingRecoveryHoldMs" value={p.standingRecoveryHoldMs} />
          <Row label="squatDescentToPeakMs" value={p.squatDescentToPeakMs} />
          <Row label="squatReversalToStandingMs" value={p.squatReversalToStandingMs} />
        </section>
      </div>
    );
  }
  const p = entry.payload;
  return (
    <div className="space-y-3">
      <p className="text-xs text-amber-200/90">
        시도 유형: {entry.attemptType === 'retry' ? 'retry' : 'fail'}
      </p>
      <section>
        <p className="mb-1 text-[11px] font-semibold text-slate-400">상단</p>
        <Row label="timestamp" value={p.ts} />
        <Row label="gate.status" value={p.gateStatus} />
        <Row label="progressionState" value={p.progressionState} />
        <Row label="finalPassLatched" value={p.finalPassLatched} />
        <Row label="confidence" value={p.confidence} />
        <Row label="captureQuality" value={p.captureQuality} />
        <Row label="failureReasons" value={(p.failureReasons ?? []).join(', ') || '—'} />
        <Row label="flags" value={(p.flags ?? []).join(', ') || '—'} />
        <Row label="finalPassBlockedReason" value={p.finalPassBlockedReason} />
        <Row label="finalPassEligible" value={p.finalPassEligible} />
      </section>
      <section>
        <p className="mb-1 text-[11px] font-semibold text-slate-400">스쿼트</p>
        <Row label="relativeDepthPeak" value={p.relativeDepthPeak} />
        <Row label="depthBand" value={p.depthBand} />
        <Row label="romBand" value={p.romBand} />
        <Row label="evidenceLabel" value={p.evidenceLabel} />
        <Row label="completionSatisfied" value={p.autoProgressionCompletionSatisfied} />
        <Row label="completionBlockedReason" value={p.completionBlockedReason} />
        <Row label="completionPassReason" value={p.completionPassReason} />
        <Row label="completionPathUsed" value={p.completionPathUsed} />
        <Row label="cycleProofPassed" value={p.cycleProofPassed} />
        <Row label="descendConfirmed" value={p.descendConfirmed} />
        <Row label="reversalConfirmedAfterDescend" value={p.reversalConfirmedAfterDescend} />
        <Row label="recoveryConfirmedAfterReversal" value={p.recoveryConfirmedAfterReversal} />
        <Row label="standingRecoveryHoldMs" value={p.standingRecoveryHoldMs} />
        <Row label="squatDescentToPeakMs" value={p.squatDescentToPeakMs} />
        <Row label="squatReversalToStandingMs" value={p.squatReversalToStandingMs} />
      </section>
    </div>
  );
}
