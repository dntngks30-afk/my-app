'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Plus, Minus, Trash2 } from 'lucide-react';
import {
  buildClientScopedDedupeKey,
  withPilotAnalyticsProps,
} from '@/lib/analytics/client-context';
import { trackEvent } from '@/lib/analytics/trackEvent';
import { getSessionSafe } from '@/lib/supabase';
import type { ExerciseItem } from './planJsonAdapter';
import type { ExerciseLogItem } from '@/lib/session/client';
import { getMediaPayload, setMediaPayload, type MediaPayload } from './media-cache';
import {
  closeButtonGhost,
  dashedSecondaryBtn,
  modalSectionBorder,
  modalSheetContainer,
  primaryCtaRestrained,
  setRowSurface,
  stepperBtn,
} from './homeExecutionTheme';

interface ExercisePlayerModalProps {
  item: ExerciseItem | null;
  sessionNumber?: number | null;
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

export function ExercisePlayerModal({ item, sessionNumber = null, exerciseIndex = 0, totalExercises = 0, initialLog, onClose, onComplete, onNextOrEnd, sessionGoalText, painModeMessage }: ExercisePlayerModalProps) {
  if (!item) return null;
  return (
    <ModalInner
      item={item}
      sessionNumber={sessionNumber ?? undefined}
      exerciseIndex={exerciseIndex ?? undefined}
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
  sessionNumber,
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
  sessionNumber?: number;
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
  const targetHold = item.holdSeconds ?? 30;
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
    trackEvent(
      'exercise_player_opened',
      withPilotAnalyticsProps({
        route_group: 'exercise_player',
        session_number: sessionNumber ?? null,
        exercise_index: exerciseIndex ?? null,
        template_id: item.templateId ?? null,
      }),
      {
        route_group: 'exercise_player',
        session_number: sessionNumber ?? undefined,
        dedupe_key: buildClientScopedDedupeKey([
          'exercise_player_opened',
          sessionNumber ?? 'none',
          exerciseIndex ?? 'none',
          item.templateId,
        ]),
      }
    );
  }, [exerciseIndex, item.templateId, sessionNumber]);

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

  const getHasValue = () => {
    const { sets, reps } = aggregateToLog();
    return sets > 0 && reps != null;
  };

  const handleClose = (closeSource: string) => {
    trackEvent('exercise_player_closed', {
      route_group: 'exercise_player',
      session_number: sessionNumber ?? null,
      exercise_index: exerciseIndex ?? null,
      template_id: item.templateId ?? null,
      had_log: getHasValue(),
      close_source: closeSource,
    });
    onClose();
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
      ...(item.plan_item_key && { plan_item_key: item.plan_item_key }),
      ...(typeof item.segment_index === 'number' && { segment_index: item.segment_index }),
      ...(typeof item.item_index === 'number' && { item_index: item.item_index }),
    };
    trackEvent('exercise_logged', {
      route_group: 'exercise_player',
      session_number: sessionNumber ?? null,
      exercise_index: exerciseIndex ?? null,
      template_id: item.templateId ?? null,
      segment_title: item.segmentTitle ?? null,
      has_value: sets > 0 && reps != null,
    });
    if (!isLast) {
      trackEvent('exercise_next_clicked', {
        route_group: 'exercise_player',
        session_number: sessionNumber ?? null,
        exercise_index: exerciseIndex ?? null,
        template_id: item.templateId ?? null,
      });
    }
    if (onNextOrEnd) {
      onNextOrEnd(log);
    } else {
      onComplete(log);
      handleClose(isLast ? 'session_complete' : 'next');
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-[2px] animate-in fade-in"
        style={{ animationDuration: '150ms' }}
        onClick={() => handleClose('backdrop')}
        aria-hidden
      />
      <div
        className="fixed inset-x-0 bottom-0 z-[70] animate-in slide-in-from-bottom-4 px-3"
        style={{
          animationDuration: '250ms',
          animationTimingFunction: 'cubic-bezier(0.2,0,0,1)',
          paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
        }}
      >
        <div className={modalSheetContainer}>
          {(sessionGoalText || painModeMessage) && (
            <div className={`space-y-0.5 px-4 py-2 ${modalSectionBorder}`}>
              {sessionGoalText && (
                <p className="text-[10px] font-semibold text-white/55">
                  오늘 목표 · {sessionGoalText}
                </p>
              )}
              {painModeMessage && (
                <p className="text-[10px] text-amber-200/90">{painModeMessage}</p>
              )}
            </div>
          )}
          {totalExercises > 0 && (
            <div className={`px-4 py-2 ${modalSectionBorder}`}>
              <p className="text-[10px] font-semibold text-white/55">
                운동 {exerciseIndex + 1} / {totalExercises}
              </p>
            </div>
          )}
          <div className={`flex items-start justify-between px-5 pb-3 pt-4 ${modalSectionBorder}`}>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/45">
                {item.segmentTitle}
              </p>
              <h3 className="text-base font-bold text-white/90">{item.name}</h3>
              {(item.targetSets || item.targetReps || item.holdSeconds) && (
                <p className="mt-0.5 text-xs text-white/55">
                  {item.targetSets && item.targetReps
                    ? `목표: ${item.targetSets}세트 × ${item.targetReps}회`
                    : item.holdSeconds
                      ? `목표: ${item.holdSeconds}초 유지`
                      : null}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => handleClose('button')}
              className={`mt-0.5 ${closeButtonGhost}`}
              aria-label="모달 닫기"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="bg-black">
            {mediaLoading ? (
              <div className="flex aspect-video items-center justify-center bg-black">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-orange-400/70" />
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
              <div className="flex aspect-video flex-col items-center justify-center gap-2 bg-neutral-950">
                <p className="text-sm text-white/55">영상 준비 중</p>
                <p className="text-xs text-white/45">텍스트 가이드를 참고해 주세요</p>
              </div>
            )}
          </div>

          <div className="space-y-4 px-5 py-4 pb-8">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
              세트별 기록 {isHold ? '(초)' : '(회)'}
            </p>
            <div className="space-y-2">
              {setEntries.map((entry, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="w-10 shrink-0 text-sm font-medium text-white/55">
                    Set {idx + 1}
                  </span>
                  <div className={setRowSurface}>
                    <button
                      type="button"
                      onClick={() => adjustSetEntry(idx, isHold ? 'holdSeconds' : 'reps', isHold ? -5 : -1)}
                      className={stepperBtn}
                      aria-label={isHold ? '5초 감소' : '감소'}
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    {isHold ? (
                      <span className="flex min-w-[3rem] flex-1 items-center justify-center gap-0.5">
                        <input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={600}
                          value={entry.holdSeconds}
                          onChange={(e) => handleHoldDirectInput(idx, e.target.value)}
                          className="w-12 border-0 bg-transparent text-center text-lg font-bold text-white/90 outline-none ring-0 focus:ring-2 focus:ring-orange-500/35 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          aria-label={`${idx + 1}세트 초 입력`}
                        />
                        <span className="text-white/55">초</span>
                      </span>
                    ) : (
                      <span className="min-w-[3rem] flex-1 text-center text-lg font-bold text-white/90">
                        {entry.reps}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => adjustSetEntry(idx, isHold ? 'holdSeconds' : 'reps', isHold ? 5 : 1)}
                      className={stepperBtn}
                      aria-label={isHold ? '5초 증가' : '증가'}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  {setEntries.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeSet(idx)}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/12 text-white/45 transition-colors hover:border-red-400/35 hover:bg-red-950/40 hover:text-red-300"
                      aria-label={`${idx + 1}세트 삭제`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button type="button" onClick={addSet} className={dashedSecondaryBtn}>
              <Plus className="h-5 w-5" />
              세트 추가
            </button>

            <button type="button" onClick={handleNextOrEndClick} className={primaryCtaRestrained}>
              {isLast ? '세션 종료' : '다음'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
