'use client';

/**
 * SessionExerciseLogModal — 운동 종료 시 세트/횟수/난이도 입력 모달
 *
 * activePlan.plan_json.segments[].items 기반으로 운동 리스트 구성.
 * "저장 후 종료" 클릭 시 exercise_logs + feedback을 onSave 호출.
 */

import { useState, useMemo } from 'react';
import { X } from 'lucide-react';
import type { SessionPlan } from '@/lib/session/client';
import type { ExerciseLogItem } from '@/lib/session/client';
import { buildPlanItemKey } from '@/lib/session/exercise-log-identity';
import { normalizeSessionSegmentsForUI } from '@/lib/session/session-segments-ui';
import { SessionFeedbackQuickForm } from '@/app/app/_components/SessionFeedbackQuickForm';
import type { FeedbackPayload } from '@/lib/session/feedback-types';
import {
  choiceChipActiveOrange,
  choiceChipInactive,
  closeButtonGhost,
  darkFormLabel,
  darkNestedCard,
  darkInputField,
  modalSheetContainer,
  primaryCtaRestrained,
} from '@/app/app/(tabs)/home/_components/reset-map-v2/homeExecutionTheme';

type ExerciseRow = {
  templateId: string;
  name: string;
  suggestedSets: number | null;
  suggestedReps: number | null;
  /** plan_item_key for identity — templateId-only is legacy fallback */
  plan_item_key: string;
  segment_index: number;
  item_index: number;
};

function flattenPlanItems(plan: SessionPlan): ExerciseRow[] {
  const segments = normalizeSessionSegmentsForUI(plan.plan_json?.segments);
  const rows: ExerciseRow[] = [];
  for (const seg of segments) {
    for (const it of seg.items) {
      const tid = it.templateId ?? `item_${it.order}`;
      rows.push({
        templateId: tid,
        name: it.name ?? '운동',
        suggestedSets: it.sets ?? null,
        suggestedReps: it.reps ?? null,
        plan_item_key: buildPlanItemKey(it._originalSegIdx, it._originalItemIdx, tid),
        segment_index: it._originalSegIdx,
        item_index: it._originalItemIdx,
      });
    }
  }
  return rows;
}

type Props = {
  plan: SessionPlan;
  onClose: () => void;
  onSave: (exerciseLogs: ExerciseLogItem[], feedback?: FeedbackPayload | null) => Promise<void>;
  isSubmitting?: boolean;
};

const DIFFICULTY_LABELS = ['1', '2', '3', '4', '5'];

export default function SessionExerciseLogModal({
  plan,
  onClose,
  onSave,
  isSubmitting = false,
}: Props) {
  const rows = useMemo(() => flattenPlanItems(plan), [plan]);

  const [feedback, setFeedback] = useState<FeedbackPayload | null>(null);
  const [values, setValues] = useState<Record<string, { sets: number | null; reps: number | null; difficulty: number | null; rpe: number | null; discomfort: number | null }>>(() => {
    const init: Record<string, { sets: number | null; reps: number | null; difficulty: number | null; rpe: number | null; discomfort: number | null }> = {};
    for (const r of rows) {
      const key = r.plan_item_key;
      init[key] = {
        sets: r.suggestedSets ?? 1,
        reps: r.suggestedReps ?? null,
        difficulty: null,
        rpe: null,
        discomfort: null,
      };
    }
    return init;
  });

  const updateValue = (key: string, field: 'sets' | 'reps' | 'difficulty' | 'rpe' | 'discomfort', val: number | null) => {
    setValues((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: val },
    }));
  };

  const handleSave = async () => {
    const exerciseLogs: ExerciseLogItem[] = rows.map((r) => {
      const v = values[r.plan_item_key] ?? { sets: 1, reps: null, difficulty: null, rpe: null, discomfort: null };
      return {
        templateId: r.templateId,
        name: r.name,
        sets: v.sets,
        reps: v.reps,
        difficulty: v.difficulty,
        rpe: v.rpe ?? undefined,
        discomfort: v.discomfort ?? undefined,
        plan_item_key: r.plan_item_key,
        segment_index: r.segment_index,
        item_index: r.item_index,
      };
    });
    await onSave(exerciseLogs, feedback?.sessionFeedback && Object.keys(feedback.sessionFeedback).length > 0 ? feedback : undefined);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isSubmitting) onClose();
  };

  const compactChip = (active: boolean) =>
    `${active ? choiceChipActiveOrange : choiceChipInactive} px-2 py-1 text-xs font-medium min-h-[2rem]`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-md p-4"
      onClick={handleBackdropClick}
    >
      <div
        className={`flex max-h-[85vh] w-full max-w-[430px] flex-col overflow-hidden ${modalSheetContainer}`}
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: 'max(0px, env(safe-area-inset-bottom))' }}
      >
        <div className={`flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-4`}>
          <h2 className="text-base font-bold text-white/90">오늘 운동 기록</h2>
          <button
            type="button"
            onClick={() => !isSubmitting && onClose()}
            disabled={isSubmitting}
            className={`${closeButtonGhost} disabled:opacity-50`}
            aria-label="닫기"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {rows.map((r) => {
            const v = values[r.plan_item_key] ?? { sets: 1, reps: null, difficulty: null, rpe: null, discomfort: null };
            const key = r.plan_item_key;
            return (
              <div key={key} className={darkNestedCard}>
                <p className="text-sm font-semibold text-white/90">{r.name}</p>
                {(r.suggestedSets != null || r.suggestedReps != null) && (
                  <p className="text-xs text-white/45">
                    추천: {r.suggestedSets ?? '-'}×{r.suggestedReps ?? '-'}
                  </p>
                )}
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className={darkFormLabel}>세트</label>
                    <input
                      type="number"
                      min={0}
                      max={99}
                      value={v.sets ?? ''}
                      onChange={(e) => {
                        const n = e.target.value === '' ? null : parseInt(e.target.value, 10);
                        updateValue(key, 'sets', n != null && !isNaN(n) ? n : null);
                      }}
                      className={darkInputField}
                      placeholder="1"
                    />
                  </div>
                  <div className="flex-1">
                    <label className={darkFormLabel}>횟수</label>
                    <input
                      type="number"
                      min={0}
                      max={999}
                      value={v.reps ?? ''}
                      onChange={(e) => {
                        const n = e.target.value === '' ? null : parseInt(e.target.value, 10);
                        updateValue(key, 'reps', n != null && !isNaN(n) ? n : null);
                      }}
                      className={darkInputField}
                      placeholder="-"
                    />
                  </div>
                </div>
                <div>
                  <label className={`${darkFormLabel} mb-2 block`}>난이도 (1~5)</label>
                  <div className="flex gap-2">
                    {DIFFICULTY_LABELS.map((_, i) => {
                      const d = i + 1;
                      const active = v.difficulty === d;
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => updateValue(key, 'difficulty', active ? null : d)}
                          className={`flex-1 py-2.5 text-sm font-semibold transition ${active ? choiceChipActiveOrange : choiceChipInactive}`}
                        >
                          {d}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={darkFormLabel}>RPE (선택)</label>
                    <div className="flex flex-wrap gap-1">
                      {([1, 3, 5, 7, 10] as const).map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => updateValue(key, 'rpe', v.rpe === val ? null : val)}
                          className={compactChip(v.rpe === val)}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className={darkFormLabel}>불편감 (선택)</label>
                    <div className="flex flex-wrap gap-1">
                      {([0, 2, 5, 7, 10] as const).map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => updateValue(key, 'discomfort', v.discomfort === val ? null : val)}
                          className={compactChip(v.discomfort === val)}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          <SessionFeedbackQuickForm
            variant="dark"
            value={feedback}
            onChange={setFeedback}
            derivedCompletionRatio={
              rows.length > 0
                ? rows.filter((r) => (values[r.plan_item_key]?.sets ?? 0) > 0).length / rows.length
                : undefined
            }
          />
        </div>

        <div className={`shrink-0 border-t border-white/10 px-4 py-4`}>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => void handleSave()}
            className={primaryCtaRestrained}
          >
            {isSubmitting ? '저장 중...' : '저장 후 종료'}
          </button>
        </div>
      </div>
    </div>
  );
}
