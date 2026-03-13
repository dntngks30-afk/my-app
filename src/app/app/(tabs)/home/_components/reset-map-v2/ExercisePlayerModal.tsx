'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Plus, Minus, Trash2 } from 'lucide-react';
import { getSessionSafe } from '@/lib/supabase';
import type { ExerciseItem } from './planJsonAdapter';
import type { ExerciseLogItem } from '@/lib/session/client';
import { getMediaPayload, setMediaPayload, type MediaPayload } from './media-cache';

interface ExercisePlayerModalProps {
  item: ExerciseItem | null;
  exerciseIndex?: number | null;
  totalExercises?: number;
  initialLog?: ExerciseLogItem;
  onClose: () => void;
  onComplete: (log: ExerciseLogItem) => void;
  /** PR-SESSION-UX-02: 다음/세션 종료 연속 흐름 */
  onNextOrEnd?: (log: ExerciseLogItem) => void;
  /** PR-SESSION-EXPERIENCE-01: 세션 목표 reminder (예: "하체 안정 + 균형") */
  sessionGoalText?: string;
  /** PR-SESSION-EXPERIENCE-01: pain_mode caution/protected 시 안전 문구 */
  painModeMessage?: string;
}

export function ExercisePlayerModal({ item, exerciseIndex = 0, totalExercises = 0, initialLog, onClose, onComplete, onNextOrEnd, sessionGoalText, painModeMessage }: ExercisePlayerModalProps) {
  if (!item) return null;
  return (
    <ModalInner
      item={item}
      exerciseIndex={exerciseIndex}
      totalExercises={totalExercises}
      initialLog={initialLog}
      onClose={onClose}
      onComplete={onComplete}
      onNextOrEnd={onNextOrEnd}
      sessionGoalText={sessionGoalText}
      painModeMessage={painModeMessage}
    />
  );
}

type SetEntry = { reps: number; holdSeconds: number };

function ModalInner({
  item,
  exerciseIndex = 0,
  totalExercises = 0,
  initialLog,
  onClose,
  onComplete,
  onNextOrEnd,
  sessionGoalText,
  painModeMessage,
}: {
  item: ExerciseItem;
  exerciseIndex?: number;
  totalExercises?: number;
  initialLog?: ExerciseLogItem;
  onClose: () => void;
  onComplete: (log: ExerciseLogItem) => void;
  onNextOrEnd?: (log: ExerciseLogItem) => void;
  sessionGoalText?: string;
  painModeMessage?: string;
}) {
  const [media, setMedia] = useState<MediaPayload | null>(null);
  const [mediaLoading, setMediaLoading] = useState(true);
  const isHold = !!item.holdSeconds && !item.targetReps;
  const targetReps = item.targetReps ?? 8;
  /** PR-RISK-03: hold 기본값 우선순위 — initialLog 복원 > prescribed > 30초 fallback */
  const getInitialHoldPerSet = (): number => {
    if (initialLog?.sets && initialLog?.reps != null && initialLog.sets > 0) {
      const perSet = Math.floor(initialLog.reps / initialLog.sets);
      return Math.min(600, Math.max(0, perSet));
    }
    const prescribed = item.holdSeconds ?? 30;
    return Math.min(600, Math.max(0, prescribed));
  };
  const defaultSets = initialLog?.sets ?? item.targetSets ?? 1;
  const [setEntries, setSetEntries] = useState<SetEntry[]>(() => {
    if (initialLog?.sets && initialLog?.reps != null) {
      const perSet = Math.floor(initialLog.reps / initialLog.sets);
      return Array.from({ length: initialLog.sets }, () => (isHold ? { reps: 0, holdSeconds: Math.min(600, Math.max(0, perSet)) } : { reps: perSet, holdSeconds: 0 }));
    }
    const holdDefault = getInitialHoldPerSet();
    return Array.from({ length: Math.max(1, defaultSets) }, () =>
      isHold ? { reps: 0, holdSeconds: holdDefault } : { reps: targetReps, holdSeconds: 0 }
    );
  });
  const isLast = totalExercises > 0 && exerciseIndex >= totalExercises - 1;
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
      isHold ? { reps: 0, holdSeconds: targetHold } : { reps: targetReps, holdSeconds: 0 },
    ]);
  };

  const removeSet = (idx: number) => {
    if (setEntries.length <= 1) return;
    setSetEntries((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleHoldDirectInput = (idx: number, raw: string) => {
    const parsed = parseInt(raw, 10);
    if (Number.isNaN(parsed)) return;
    const clamped = Math.min(600, Math.max(0, parsed));
    setSetEntries((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], holdSeconds: clamped };
      return next;
    });
  };

  /** PR-RISK-03: hold는 ±step, 0–600 clamp. reps는 기존 ±1 유지 */
  const adjustSetEntry = (idx: number, field: 'reps' | 'holdSeconds', delta: number) => {
    setSetEntries((prev) => {
      const next = [...prev];
      const curr = next[idx][field];
      const nextVal = curr + delta;
      const clamped = field === 'holdSeconds' ? Math.min(600, Math.max(0, nextVal)) : Math.max(0, nextVal);
      next[idx] = { ...next[idx], [field]: clamped };
      return next;
    });
  };

  const aggregateToLog = (): { sets: number; reps: number | null } => {
    const filled = setEntries.filter((s) => (isHold ? s.holdSeconds > 0 : s.reps >= 0));
    if (filled.length === 0) return { sets: 0, reps: null };
    if (isHold) {
      const totalSec = filled.reduce((sum, s) => sum + s.holdSeconds, 0);
      return { sets: filled.length, reps: totalSec };
    }
    const totalReps = filled.reduce((sum, s) => sum + s.reps, 0);
    return { sets: filled.length, reps: totalReps };
  };

  const handleNextOrEndClick = () => {
    const { sets, reps } = aggregateToLog();
    const log: ExerciseLogItem = {
      templateId: item.templateId,
      name: item.name,
      sets: sets > 0 ? Math.min(20, sets) : null,
      reps: reps != null ? Math.min(200, Math.max(0, reps)) : null,
      difficulty: null,
      rpe: null,
      discomfort: null,
    };
    if (onNextOrEnd) {
      onNextOrEnd(log);
    } else {
      onComplete(log);
      onClose();
    }
  };

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
          {totalExercises > 0 && (
            <div className="border-b border-slate-100 px-4 py-2">
              <p className="text-[10px] font-semibold text-slate-500">운동 {exerciseIndex + 1} / {totalExercises}</p>
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
                  <span className="w-10 shrink-0 text-sm font-medium text-slate-600">Set {idx + 1}</span>
                  <div className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5">
                    <button
                      type="button"
                      onClick={() => adjustSetEntry(idx, isHold ? 'holdSeconds' : 'reps', isHold ? -5 : -1)}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300 active:scale-95"
                      aria-label={isHold ? '5초 감소' : '감소'}
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    {isHold ? (
                      <span className="min-w-[3rem] flex-1 flex items-center justify-center gap-0.5">
                        <input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={600}
                          value={entry.holdSeconds}
                          onChange={(e) => handleHoldDirectInput(idx, e.target.value)}
                          className="w-12 text-center text-lg font-bold text-slate-800 bg-transparent border-0 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          aria-label={`${idx + 1}세트 초 입력`}
                        />
                        <span className="text-slate-600">초</span>
                      </span>
                    ) : (
                      <span className="min-w-[3rem] flex-1 text-center text-lg font-bold text-slate-800">
                        {entry.reps}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => adjustSetEntry(idx, isHold ? 'holdSeconds' : 'reps', isHold ? 5 : 1)}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300 active:scale-95"
                      aria-label={isHold ? '5초 증가' : '증가'}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
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
              onClick={handleNextOrEndClick}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-400 py-3.5 text-sm font-bold text-white transition hover:bg-orange-500 active:scale-[0.98]"
            >
              {isLast ? '세션 종료' : '다음'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
