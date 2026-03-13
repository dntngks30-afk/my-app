/**
 * PR-19: Home Session Panel state boundary.
 *
 * Draft lifecycle rules:
 * - current + same session_number → restore draft on mount, save draft on logs/difficulty/pain change (300ms debounce)
 * - completed → use initialLogs, clear draft
 * - locked → no restore/save
 * - successful complete → clear draft
 * - session change → reset transient UI state (exerciseIndex, completed, completeResult, draftRestored)
 *
 * Does NOT touch storage.ts (sessionStorage, routine-tab draft). Uses draftStorage (localStorage, home session).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getSessionSafe } from '@/lib/supabase';
import { completeSession, saveSessionReflection, saveSessionProgress } from '@/lib/session/client';
import type { ExerciseLogItem, SessionPlan, ActivePlanSummary } from '@/lib/session/client';
import type { ExerciseItem } from './planJsonAdapter';
import { isExerciseLogCompleted } from './exercise-log-helpers';
import type { SessionPainArea } from '@/lib/session/feedback-types';
import { loadSessionDraft, saveSessionDraft, clearSessionDraft, draftToLogs } from '@/lib/session/draftStorage';
import type { ReflectionData } from './ReflectionModal';

type SessionStatus = 'current' | 'completed' | 'locked';

export type UseHomeSessionPanelStateProps = {
  sessionId: number;
  total: number;
  status: SessionStatus;
  exercises: ExerciseItem[] | undefined;
  activePlan: SessionPlan | ActivePlanSummary | null;
  initialLogs?: Record<string, ExerciseLogItem>;
  onSessionCompleted?: (completedSessions: number) => void;
};

export type FeedbackOverride = {
  difficultyFeedback?: 'too_easy' | 'ok' | 'too_hard';
  painAreas?: SessionPainArea[];
  bodyStateChange?: 'better' | 'same' | 'worse';
  discomfortArea?: string;
};

export function useHomeSessionPanelState({
  sessionId,
  total,
  status,
  exercises,
  activePlan,
  initialLogs,
  onSessionCompleted,
}: UseHomeSessionPanelStateProps) {
  // ─── EXECUTION_DRAFT_STATE ─────────────────────────────────────────────
  const [logs, setLogs] = useState<Record<string, ExerciseLogItem>>({});
  const [draftRestored, setDraftRestored] = useState(false);
  const [sessionPerceivedDifficulty, setSessionPerceivedDifficulty] = useState<'too_easy' | 'ok' | 'too_hard' | null>(null);
  const [sessionPainAreas, setSessionPainAreas] = useState<SessionPainArea[]>([]);

  // ─── UI_MODAL_STATE ────────────────────────────────────────────────────
  const [exerciseIndex, setExerciseIndex] = useState<number | null>(null);
  const [showReflectionModal, setShowReflectionModal] = useState(false);

  // ─── REQUEST_STATE ──────────────────────────────────────────────────────
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);

  // ─── COMPLETION_RESULT_STATE ────────────────────────────────────────────
  const [completed, setCompleted] = useState(false);
  const [completeResult, setCompleteResult] = useState<{
    progress: { completed_sessions: number; total_sessions: number };
    next_theme: string | null;
    duration_seconds: number;
    exercise_logs?: ExerciseLogItem[] | null;
  } | null>(null);
  const [lastReflectionDifficulty, setLastReflectionDifficulty] = useState<'too_easy' | 'ok' | 'too_hard' | null>(null);
  const [lastReflectionHadPainAreas, setLastReflectionHadPainAreas] = useState(false);

  // ─── PERF ───────────────────────────────────────────────────────────────
  const startedAtRef = useRef(Date.now());

  // Session change → reset transient state
  useEffect(() => {
    setExerciseIndex(null);
  }, [sessionId]);
  useEffect(() => {
    setCompleted(false);
    setCompleteResult(null);
    setLastReflectionDifficulty(null);
    setLastReflectionHadPainAreas(false);
    setDraftRestored(false);
  }, [sessionId]);

  // Draft restore / initialLogs (completed: initialLogs + clear draft; current: restore or initialLogs; locked: empty)
  useEffect(() => {
    if (status === 'completed') {
      setLogs(initialLogs && Object.keys(initialLogs).length > 0 ? initialLogs : {});
      clearSessionDraft(String(sessionId));
      return;
    }
    if (status === 'current') {
      const planId = String(sessionId);
      const draft = loadSessionDraft(planId);
      if (draft && draft.session_number === sessionId && Object.keys(draft.exercises).length > 0) {
        const nameByTemplateId: Record<string, string> = {};
        if (exercises) for (const e of exercises) nameByTemplateId[e.templateId] = e.name;
        setLogs(draftToLogs(draft, nameByTemplateId));
        setSessionPerceivedDifficulty(draft.sessionPerceivedDifficulty ?? null);
        setSessionPainAreas(draft.sessionPainAreas ?? []);
        setDraftRestored(true);
      } else if (initialLogs && Object.keys(initialLogs).length > 0) {
        setLogs(initialLogs);
      } else {
        setLogs({});
      }
    } else {
      setLogs({});
    }
  }, [sessionId, status, initialLogs, exercises]);

  // Draft save (current only, 300ms debounce)
  const saveDraftRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveDraft = useCallback(() => {
    if (status !== 'current' || !activePlan?.session_number || sessionId !== activePlan.session_number) return;
    const planId = String(sessionId);
    const holdSecondsByTemplateId: Record<string, number> = {};
    if (exercises) for (const e of exercises) if (e.holdSeconds) holdSecondsByTemplateId[e.templateId] = e.holdSeconds;
    saveSessionDraft(planId, {
      session_number: sessionId,
      plan_id: planId,
      logs,
      holdSecondsByTemplateId: Object.keys(holdSecondsByTemplateId).length ? holdSecondsByTemplateId : undefined,
      sessionPerceivedDifficulty,
      sessionPainAreas,
    });
  }, [sessionId, status, activePlan?.session_number, logs, sessionPerceivedDifficulty, sessionPainAreas, exercises]);
  useEffect(() => {
    if (status !== 'current' || sessionId !== activePlan?.session_number) return;
    if (saveDraftRef.current) clearTimeout(saveDraftRef.current);
    saveDraftRef.current = setTimeout(saveDraft, 300);
    return () => {
      if (saveDraftRef.current) clearTimeout(saveDraftRef.current);
    };
  }, [sessionId, status, activePlan?.session_number, logs, sessionPerceivedDifficulty, sessionPainAreas, exercises, saveDraft]);

  // Server progress save (500ms debounce)
  const saveProgressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (status !== 'current' || sessionId !== activePlan?.session_number) return;
    const tokenPromise = getSessionSafe().then((r) => r.session?.access_token ?? null);
    if (saveProgressRef.current) clearTimeout(saveProgressRef.current);
    saveProgressRef.current = setTimeout(async () => {
      const token = await tokenPromise;
      if (!token || Object.keys(logs).length === 0) return;
      const holdMap: Record<string, number> = {};
      if (exercises) for (const e of exercises) if (e.holdSeconds) holdMap[e.templateId] = e.holdSeconds;
      const items = Object.entries(logs).map(([templateId, log]) => {
        const sets = log.sets ?? 0;
        const reps = log.reps ?? 0;
        const isHold = holdMap[templateId] != null && holdMap[templateId] > 0;
        return {
          template_id: templateId,
          sets,
          reps: isHold ? 0 : reps,
          hold_seconds: isHold ? reps : 0,
          rpe: log.rpe ?? null,
          completed: sets > 0 || reps > 0,
          skipped: false,
        };
      });
      saveSessionProgress(token, sessionId, items);
    }, 500);
    return () => {
      if (saveProgressRef.current) clearTimeout(saveProgressRef.current);
    };
  }, [sessionId, status, activePlan?.session_number, logs, exercises]);

  // Draft restored toast: 4s auto-hide
  useEffect(() => {
    if (!draftRestored) return;
    const t = setTimeout(() => setDraftRestored(false), 4000);
    return () => clearTimeout(t);
  }, [draftRestored]);

  const handleLogComplete = useCallback((log: ExerciseLogItem) => {
    setLogs((prev) => ({ ...prev, [log.templateId]: log }));
  }, []);

  const handleNextOrEnd = useCallback(
    (log: ExerciseLogItem) => {
      setLogs((prev) => ({ ...prev, [log.templateId]: log }));
      if (!exercises || exercises.length === 0) return;
      let nextIdx: number | null = null;
      let showSheet = false;
      if (exerciseIndex != null) {
        if (exerciseIndex < exercises.length - 1) {
          nextIdx = exerciseIndex + 1;
        } else {
          showSheet = true;
        }
      }
      setExerciseIndex(nextIdx);
      if (showSheet) setShowReflectionModal(true);
    },
    [exercises, exerciseIndex]
  );

  const doSessionComplete = useCallback(
    async (feedbackOverride?: FeedbackOverride) => {
      if (completing || completed) return;
      const sessionNumber = activePlan?.session_number;
      if (!sessionNumber) return;

      setCompleting(true);
      setCompleteError(null);

      try {
        const { session } = await getSessionSafe();
        if (!session?.access_token) {
          setCompleteError('로그인이 필요합니다. 페이지를 새로고침해 주세요.');
          setCompleting(false);
          return;
        }

        const durationSec = Math.max(0, Math.floor((Date.now() - startedAtRef.current) / 1000));
        /** HOTFIX: plan order로 1:1 전달 — templateId 중복 시 Object.values가 덮어써서 undercount 방지 */
        const exerciseLogsArray = (exercises ?? [])
          .map((ex) => logs[ex.templateId])
          .filter((l): l is ExerciseLogItem => l != null);
        const allDone =
          exercises && exercises.length > 0 && exercises.every((e) => isExerciseLogCompleted(logs[e.templateId], e));
        const completionMode = allDone ? 'all_done' : exerciseLogsArray.length > 0 ? 'partial_done' : 'stop_early';

        const payload: Parameters<typeof completeSession>[1] = {
          session_number: sessionNumber,
          duration_seconds: durationSec,
          completion_mode: completionMode,
          exercise_logs: exerciseLogsArray,
        };
        const diff = feedbackOverride?.difficultyFeedback ?? sessionPerceivedDifficulty;
        const areas = feedbackOverride?.painAreas ?? sessionPainAreas;
        const hasSessionFeedback =
          diff != null ||
          (areas?.length ?? 0) > 0 ||
          !!feedbackOverride?.bodyStateChange ||
          !!feedbackOverride?.discomfortArea;
        if (hasSessionFeedback) {
          payload.feedback = {
            sessionFeedback: {
              difficultyFeedback: diff ?? undefined,
              painAreas: (areas?.length ?? 0) > 0 ? areas : undefined,
              bodyStateChange: feedbackOverride?.bodyStateChange,
              discomfortArea: feedbackOverride?.discomfortArea,
            },
          };
        }
        const result = await completeSession(session.access_token, payload);

        if (!result.ok) {
          setCompleteError(`저장 실패: ${result.error.message}. 다시 시도하거나 페이지를 새로고침해 주세요.`);
          setCompleting(false);
          return;
        }

        setCompleted(true);
        setCompleting(false);
        setCompleteResult({
          progress: result.data.progress ?? { completed_sessions: sessionNumber, total_sessions: total },
          next_theme: result.data.next_theme ?? null,
          duration_seconds: durationSec,
          exercise_logs: result.data.exercise_logs ?? exerciseLogsArray,
        });

        clearSessionDraft(String(sessionNumber));

        const newCompleted = result.data.progress?.completed_sessions ?? sessionNumber;
        onSessionCompleted?.(newCompleted);
      } catch (err) {
        setCompleteError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
        setCompleting(false);
      }
    },
    [
      completing,
      completed,
      activePlan?.session_number,
      logs,
      exercises,
      sessionPerceivedDifficulty,
      sessionPainAreas,
      total,
      onSessionCompleted,
    ]
  );

  const handleSessionCompleteClick = useCallback(() => {
    setShowReflectionModal(true);
  }, []);

  const handleReflectionSubmit = useCallback(
    async (data: ReflectionData) => {
      const sessionNumber = activePlan?.session_number;
      if (!sessionNumber) return;

      setCompleting(true);
      setCompleteError(null);

      try {
        const { session } = await getSessionSafe();
        if (!session?.access_token) {
          setCompleteError('로그인이 필요합니다. 페이지를 새로고침해 주세요.');
          setCompleting(false);
          return;
        }

        const refResult = await saveSessionReflection(session.access_token, {
          session_number: sessionNumber,
          difficulty: data.difficulty,
          body_state_change: data.body_state_change,
          discomfort_area: data.discomfort_area ?? undefined,
        });
        if (!refResult.ok) {
          setCompleteError(refResult.error.message);
          setCompleting(false);
          return;
        }

        setShowReflectionModal(false);
        const diff = data.difficulty <= 2 ? 'too_easy' : data.difficulty >= 4 ? 'too_hard' : 'ok';
        setLastReflectionDifficulty(diff);
        setLastReflectionHadPainAreas(!!data.discomfort_area);
        await doSessionComplete({
          difficultyFeedback: diff,
          painAreas: data.discomfort_area ? [data.discomfort_area as SessionPainArea] : undefined,
          bodyStateChange: data.body_state_change,
          discomfortArea: data.discomfort_area ?? undefined,
        });
      } catch (err) {
        setCompleteError(err instanceof Error ? err.message : '저장에 실패했습니다.');
        setCompleting(false);
      }
    },
    [activePlan?.session_number, doSessionComplete]
  );

  return {
    logs,
    draftRestored,
    sessionPerceivedDifficulty,
    sessionPainAreas,
    exerciseIndex,
    setExerciseIndex,
    showReflectionModal,
    completing,
    completeError,
    completed,
    completeResult,
    lastReflectionDifficulty,
    lastReflectionHadPainAreas,
    handleLogComplete,
    handleNextOrEnd,
    handleSessionCompleteClick,
    handleReflectionSubmit,
  };
}
