"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { upsertDirtyAnswers, DraftState } from "../utils/sync";

const STORAGE_KEY = "movementTest:draft:v1";

function loadDraft(): DraftState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { version: 1, answers: {}, dirty: [] };
    return JSON.parse(raw);
  } catch {
    return { version: 1, answers: {}, dirty: [] };
  }
}

function saveDraft(draft: DraftState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
}

export function useDraftSync() {
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [syncStatus, setSyncStatus] = useState<"idle" | "saving" | "saved" | "error" | "offline">("idle");

  const timerRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);

  // 1) 초기 로드
  useEffect(() => {
    const d = loadDraft();
    setDraft(d);
  }, []);

  // 2) 답변 변경: 로컬 즉시 저장 + dirty 표시
  const setAnswer = (question_id: string, answer: string) => {
    setDraft((prev) => {
      const base = prev ?? { version: 1, answers: {}, dirty: [] };
      const next: DraftState = {
        ...base,
        answers: {
          ...base.answers,
          [question_id]: { question_id, answer, updatedAt: Date.now() },
        },
        dirty: Array.from(new Set([...base.dirty, question_id])),
      };
      saveDraft(next);
      return next;
    });

    // 3) DB 저장은 debounce로
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      void flush();
    }, 800);
  };

  // 4) 실제 DB 동기화(배치 업서트)
  const flush = async () => {
    if (!draft) return;
    if (draft.dirty.length === 0) return;
    if (inFlightRef.current) return;

    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setSyncStatus("offline");
      return;
    }

    inFlightRef.current = true;
    setSyncStatus("saving");
    try {
      const { saved } = await upsertDirtyAnswers(draft);

      // dirty 제거 + lastSyncedAt 기록
      setDraft((prev) => {
        if (!prev) return prev;
        const next: DraftState = {
          ...prev,
          dirty: [], // 성공했으면 싹 비우기 (더 정교하게 하려면 saved된 qid만 제거)
          lastSyncedAt: Date.now(),
        };
        saveDraft(next);
        return next;
      });

      setSyncStatus(saved > 0 ? "saved" : "idle");
    } catch (e) {
      setSyncStatus("error");
    } finally {
      inFlightRef.current = false;
    }
  };

  // 5) 페이지 떠나기 직전에 한 번 더 시도(가능한 범위)
  useEffect(() => {
    const onBeforeUnload = () => {
      // beforeunload에서 await는 거의 의미 없어서 “시도”만
      void flush();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  return useMemo(
    () => ({
      draft,
      setAnswer,
      flush,
      syncStatus,
    }),
    [draft, syncStatus]
  );
}
