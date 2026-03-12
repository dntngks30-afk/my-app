'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Plus, CheckCircle2, Trash2 } from 'lucide-react';
import { getSessionSafe } from '@/lib/supabase';
import type { ExerciseItem } from './planJsonAdapter';
import type { ExerciseLogItem } from '@/lib/session/client';
import { getMediaPayload, setMediaPayload, type MediaPayload } from './media-cache';
import { ExerciseCompletionSheet } from './ExerciseCompletionSheet';
import type { ExercisePerceivedDifficulty, ExercisePostPain } from './ExerciseCompletionSheet';

interface ExercisePlayerModalProps {
  item: ExerciseItem | null;
  initialLog?: ExerciseLogItem;
  onClose: () => void;
  onComplete: (log: ExerciseLogItem) => void;
  /** PR-SESSION-EXPERIENCE-01: 세션 목표 reminder (예: "하체 안정 + 균형") */
  sessionGoalText?: string;
  /** PR-SESSION-EXPERIENCE-01: pain_mode caution/protected 시 안전 문구 */
  painModeMessage?: string;
}

export function ExercisePlayerModal({ item, initialLog, onClose, onComplete, sessionGoalText, painModeMessage }: ExercisePlayerModalProps) {
  if (!item) return null;
  return (
    <ModalInner
      item={item}
      initialLog={initialLog}
      onClose={onClose}
      onComplete={onComplete}
      sessionGoalText={sessionGoalText}
      painModeMessage={painModeMessage}
    />
  );
}

type SetEntry = { reps: string; holdSeconds: string };

function ModalInner({
  item,
  initialLog,
  onClose,
  onComplete,
}: {
  item: ExerciseItem;
  initialLog?: ExerciseLogItem;
  onClose: () => void;
  onComplete: (log: ExerciseLogItem) => void;
}) {
  const [media, setMedia] = useState<MediaPayload | null>(null);
  const [mediaLoading, setMediaLoading] = useState(true);
  const isHold = !!item.holdSeconds && !item.targetReps;
  const defaultReps = String(initialLog?.reps ?? item.targetReps ?? '');
  const defaultSets = initialLog?.sets ?? item.targetSets ?? 1;
  const [setEntries, setSetEntries] = useState<SetEntry[]>(() => {
    if (initialLog?.sets && initialLog?.reps != null) {
      const perSet = Math.floor(initialLog.reps / initialLog.sets);
      return Array.from({ length: initialLog.sets }, () => ({ reps: String(perSet), holdSeconds: '' }));
    }
    return Array.from({ length: Math.max(1, defaultSets) }, () =>
      isHold ? { reps: '', holdSeconds: String(item.holdSeconds ?? '') } : { reps: defaultReps, holdSeconds: '' }
    );
  });
  const [showCompletionSheet, setShowCompletionSheet] = useState(false);
  const [perceivedDifficulty, setPerceivedDifficulty] = useState<ExercisePerceivedDifficulty | null>(
    initialLog?.difficulty != null && initialLog.difficulty >= 1 && initialLog.difficulty <= 5
      ? (initialLog.difficulty as ExercisePerceivedDifficulty)
      : null
  );
  const [postPain, setPostPain] = useState<ExercisePostPain | null>(
    initialLog?.discomfort != null && [0, 2, 5, 8, 10].includes(initialLog.discomfort)
      ? (initialLog.discomfort as ExercisePostPain)
      : null
  );
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<{ destroy: () => void } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const cached = getMediaPayload(item.templateId);
    if (cached) {
      setMedia(cached);
      setMediaLoading(false);
      return;
    }
    (async () => {
      try {
        const { session } = await getSessionSafe();
        if (!session?.access_token) {
          if (!cancelled) {
            setMedia({ kind: 'placeholder' });
            setMediaLoading(false);
          }
          return;
        }
        const res = await fetch('/api/media/sign', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ templateIds: [item.templateId] }),
        });
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          const payload: MediaPayload = data.results?.[0]?.payload ?? { kind: 'placeholder' };
          setMediaPayload(item.templateId, payload);
          setMedia(payload);
        } else {
          setMedia({ kind: 'placeholder' });
        }
      } catch {
        if (!cancelled) setMedia({ kind: 'placeholder' });
      } finally {
        if (!cancelled) setMediaLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [item.templateId]);

  useEffect(() => {
    if (!media || media.kind !== 'hls' || !media.streamUrl) return;
    const video = videoRef.current;
    if (!video) return;
    let destroyed = false;
    import('hls.js').then(({ default: HlsLib }) => {
      if (destroyed || !video) return;
      if (HlsLib.isSupported()) {
        const hls = new HlsLib();
        hlsRef.current = hls;
        hls.loadSource(media.streamUrl!);
        hls.attachMedia(video);
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = media.streamUrl!;
      }
    });
    return () => {
      destroyed = true;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      } else if (video) {
        video.src = '';
      }
    };
  }, [media?.kind, media?.streamUrl]);

  const addSet = () => {
    setSetEntries((prev) => [
      ...prev,
      isHold ? { reps: '', holdSeconds: String(item.holdSeconds ?? '') } : { reps: '', holdSeconds: '' },
    ]);
  };

  const removeSet = (idx: number) => {
    if (setEntries.length <= 1) return;
    setSetEntries((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateSetEntry = (idx: number, field: 'reps' | 'holdSeconds', value: string) => {
    setSetEntries((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const aggregateToLog = (): { sets: number; reps: number | null } => {
    const filled = setEntries.filter((s) => {
      const r = parseInt(s.reps, 10);
      const h = parseInt(s.holdSeconds, 10);
      return (isHold ? !Number.isNaN(h) && h > 0 : !Number.isNaN(r) && r >= 0);
    });
    if (filled.length === 0) return { sets: 0, reps: null };
    if (isHold) {
      const totalSec = filled.reduce((sum, s) => sum + (parseInt(s.holdSeconds, 10) || 0), 0);
      return { sets: filled.length, reps: totalSec };
    }
    const totalReps = filled.reduce((sum, s) => sum + (parseInt(s.reps, 10) || 0), 0);
    return { sets: filled.length, reps: totalReps };
  };

  const handleCompleteClick = () => {
    setShowCompletionSheet(true);
  };

  const handleCompletionConfirm = () => {
    const { sets, reps } = aggregateToLog();
    onComplete({
      templateId: item.templateId,
      name: item.name,
      sets: sets > 0 ? Math.min(20, sets) : null,
      reps: reps != null ? Math.min(200, Math.max(0, reps)) : null,
      difficulty: perceivedDifficulty,
      rpe: null,
      discomfort: postPain,
    });
    onClose();
  };

  if (showCompletionSheet) {
    return (
      <>
        <div
          className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm animate-in fade-in"
          style={{ animationDuration: '150ms' }}
          aria-hidden
        />
        <div
          className="fixed inset-x-0 bottom-0 z-[70] animate-in slide-in-from-bottom-4"
          style={{ animationDuration: '250ms', animationTimingFunction: 'cubic-bezier(0.2,0,0,1)', paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        >
          <div className="mx-auto max-w-[430px] rounded-t-2xl border border-slate-200 bg-white px-5 py-5 pb-8 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                운동 완료 — 간단한 체크
              </p>
              <button
                type="button"
                onClick={() => setShowCompletionSheet(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="취소"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ExerciseCompletionSheet
              exerciseName={item.name}
              perceivedDifficulty={perceivedDifficulty}
              postPain={postPain}
              onPerceivedDifficultyChange={setPerceivedDifficulty}
              onPostPainChange={setPostPain}
              onConfirm={handleCompletionConfirm}
            />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div
        className="fixed inset-0 z-[60] bg-black/60 animate-in fade-in"
        style={{ animationDuration: '150ms' }}
        onClick={onClose}
        aria-hidden
      />
      <div
        className="fixed inset-x-0 bottom-0 z-[70] animate-in slide-in-from-bottom-4"
        style={{ animationDuration: '250ms', animationTimingFunction: 'cubic-bezier(0.2,0,0,1)' }}
      >
        <div className="mx-auto max-w-[430px] overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl">
          {(sessionGoalText || painModeMessage) && (
            <div className="border-b border-slate-100 px-4 py-2 space-y-0.5">
              {sessionGoalText && (
                <p className="text-[10px] font-semibold text-slate-500">오늘 목표 · {sessionGoalText}</p>
              )}
              {painModeMessage && (
                <p className="text-[10px] text-amber-600">{painModeMessage}</p>
              )}
            </div>
          )}
          <div className="flex items-start justify-between border-b border-slate-100 px-5 pt-4 pb-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                {item.segmentTitle}
              </p>
              <h3 className="text-base font-bold text-slate-800">{item.name}</h3>
              {(item.targetSets || item.targetReps || item.holdSeconds) && (
                <p className="mt-0.5 text-xs text-slate-500">
                  {item.targetSets && item.targetReps
                    ? `목표: ${item.targetSets}세트 × ${item.targetReps}회`
                    : item.holdSeconds
                      ? `목표: ${item.holdSeconds}초 유지`
                      : null}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              aria-label="모달 닫기"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="bg-black">
            {mediaLoading ? (
              <div className="flex aspect-video items-center justify-center bg-slate-800">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-500 border-t-slate-300" />
              </div>
            ) : media?.kind === 'hls' && media.streamUrl ? (
              <div className="aspect-video">
                <video
                  ref={videoRef}
                  className="h-full w-full object-contain"
                  playsInline
                  controls
                  poster={media.posterUrl}
                />
              </div>
            ) : media?.kind === 'embed' && media.embedUrl ? (
              <div className="aspect-video">
                <iframe
                  src={media.embedUrl}
                  className="h-full w-full"
                  allowFullScreen
                  title={item.name}
                />
              </div>
            ) : (
              <div className="flex aspect-video flex-col items-center justify-center gap-2 bg-slate-800">
                <p className="text-sm text-slate-400">영상 준비 중</p>
                <p className="text-xs text-slate-500">텍스트 가이드를 참고해 주세요</p>
              </div>
            )}
          </div>

          <div className="space-y-4 px-5 py-4 pb-8">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              세트별 기록 {isHold ? '(초)' : '(회)'}
            </p>
            <div className="space-y-2">
              {setEntries.map((entry, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="w-10 shrink-0 text-sm font-medium text-slate-600">{idx + 1}세트</span>
                  {isHold ? (
                    <input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      max="600"
                      placeholder="초"
                      value={entry.holdSeconds}
                      onChange={(e) => updateSetEntry(idx, 'holdSeconds', e.target.value)}
                      className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-center text-lg font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-300"
                    />
                  ) : (
                    <input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      max="200"
                      placeholder="회"
                      value={entry.reps}
                      onChange={(e) => updateSetEntry(idx, 'reps', e.target.value)}
                      className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-center text-lg font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-300"
                    />
                  )}
                  {setEntries.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeSet(idx)}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-400 hover:bg-red-50 hover:border-red-200 hover:text-red-500 transition-colors"
                      aria-label={`${idx + 1}세트 삭제`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addSet}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 py-3.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:border-slate-400 transition-colors"
            >
              <Plus className="h-5 w-5" />
              세트 추가
            </button>

            <button
              type="button"
              onClick={handleCompleteClick}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 active:scale-[0.98]"
            >
              <CheckCircle2 className="h-4 w-4" />
              이 운동 완료
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
