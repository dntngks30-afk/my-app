'use client';

/**
 * SessionExerciseLogModal — 운동 종료 시 세트/횟수/난이도 입력 모달
 *
 * activePlan.plan_json.segments[].items 기반으로 운동 리스트 구성.
 * "저장 후 종료" 클릭 시 exercise_logs + feedback을 onSave 호출.
 */

import { useState, useMemo } from 'react';
import { X } from 'lucide-react';
import { NeoButton } from '@/components/neobrutalism';
import type { SessionPlan } from '@/lib/session/client';
import type { ExerciseLogItem } from '@/lib/session/client';
import { buildPlanItemKey } from '@/lib/session/exercise-log-identity';
import { SessionFeedbackQuickForm } from '@/app/app/_components/SessionFeedbackQuickForm';
import type { FeedbackPayload } from '@/lib/session/feedback-types';

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
  const segments = plan.plan_json?.segments ?? [];
  const rows: ExerciseRow[] = [];
  for (let segIdx = 0; segIdx < segments.length; segIdx++) {
    const seg = segments[segIdx]!;
    for (let itemIdx = 0; itemIdx < (seg.items ?? []).length; itemIdx++) {
      const it = seg.items![itemIdx]!;
      const tid = it.templateId ?? `item_${it.order}`;
      rows.push({
        templateId: tid,
        name: it.name ?? '운동',
        suggestedSets: it.sets ?? null,
        suggestedReps: it.reps ?? null,
        plan_item_key: buildPlanItemKey(segIdx, itemIdx, tid),
        segment_index: segIdx,
        item_index: itemIdx,
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
      };
    });
    await onSave(exerciseLogs, feedback?.sessionFeedback && Object.keys(feedback.sessionFeedback).length > 0 ? feedback : undefined);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isSubmitting) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4"
      onClick={handleBackdropClick}
    >
      <div
        className="w-full max-w-md max-h-[85vh] rounded-t-3xl border-2 border-slate-900 bg-white shadow-[0_-4px_0_0_rgba(15,23,42,1)] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-stone-200 shrink-0">
          <h2 className="text-base font-bold text-slate-800">오늘 운동 기록</h2>
          <button
            type="button"
            onClick={() => !isSubmitting && onClose()}
            disabled={isSubmitting}
            className="flex size-8 items-center justify-center rounded-full border border-stone-300 text-slate-500 hover:bg-stone-100 disabled:opacity-50"
            aria-label="닫기"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-4">
          {rows.map((r) => {
            const v = values[r.plan_item_key] ?? { sets: 1, reps: null, difficulty: null, rpe: null, discomfort: null };
            const key = r.plan_item_key;
            return (
              <div
                key={key}
                className="rounded-xl border-2 border-stone-200 bg-stone-50 p-4 space-y-3"
              >
                <p className="text-sm font-semibold text-slate-800">{r.name}</p>
                {(r.suggestedSets != null || r.suggestedReps != null) && (
                  <p className="text-xs text-slate-500">
                    추천: {r.suggestedSets ?? '-'}×{r.suggestedReps ?? '-'}
                  </p>
                )}
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-xs text-slate-600 mb-1">세트</label>
                    <input
                      type="number"
                      min={0}
                      max={99}
                      value={v.sets ?? ''}
                      onChange={(e) => {
                        const n = e.target.value === '' ? null : parseInt(e.target.value, 10);
                        updateValue(key, 'sets', n != null && !isNaN(n) ? n : null);
                      }}
                      className="w-full rounded-lg border-2 border-stone-300 px-3 py-2 text-sm"
                      placeholder="1"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-slate-600 mb-1">횟수</label>
                    <input
                      type="number"
                      min={0}
                      max={999}
                      value={v.reps ?? ''}
                      onChange={(e) => {
                        const n = e.target.value === '' ? null : parseInt(e.target.value, 10);
                        updateValue(key, 'reps', n != null && !isNaN(n) ? n : null);
                      }}
                      className="w-full rounded-lg border-2 border-stone-300 px-3 py-2 text-sm"
                      placeholder="-"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-2">난이도 (1~5)</label>
                  <div className="flex gap-2">
                    {DIFFICULTY_LABELS.map((_, i) => {
                      const d = i + 1;
                      const active = v.difficulty === d;
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => updateValue(key, 'difficulty', active ? null : d)}
                          className={[
                            'flex-1 rounded-lg border-2 py-2 text-sm font-semibold transition',
                            active
                              ? 'border-slate-900 bg-orange-100 text-slate-900 shadow-[2px_2px_0_0_rgba(15,23,42,1)]'
                              : 'border-stone-300 bg-white text-slate-600 hover:border-slate-400',
                          ].join(' ')}
                        >
                          {d}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">RPE (선택)</label>
                    <div className="flex flex-wrap gap-1">
                      {([1, 3, 5, 7, 10] as const).map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => updateValue(key, 'rpe', v.rpe === val ? null : val)}
                          className={[
                            'rounded px-2 py-1 text-xs font-medium transition',
                            v.rpe === val ? 'border-2 border-slate-900 bg-orange-100' : 'border-2 border-stone-300 bg-white',
                          ].join(' ')}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">불편감 (선택)</label>
                    <div className="flex flex-wrap gap-1">
                      {([0, 2, 5, 7, 10] as const).map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => updateValue(key, 'discomfort', v.discomfort === val ? null : val)}
                          className={[
                            'rounded px-2 py-1 text-xs font-medium transition',
                            v.discomfort === val ? 'border-2 border-slate-900 bg-orange-100' : 'border-2 border-stone-300 bg-white',
                          ].join(' ')}
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
            value={feedback}
            onChange={setFeedback}
            derivedCompletionRatio={
              rows.length > 0
                ? rows.filter((r) => (values[r.plan_item_key]?.sets ?? 0) > 0).length / rows.length
                : undefined
            }
          />
        </div>

        <div className="p-4 border-t border-stone-200 shrink-0">
          <NeoButton
            variant="orange"
            fullWidth
            disabled={isSubmitting}
            onClick={handleSave}
            className="py-3 text-base"
          >
            {isSubmitting ? '저장 중...' : '저장 후 종료'}
          </NeoButton>
        </div>
      </div>
    </div>
  );
}
