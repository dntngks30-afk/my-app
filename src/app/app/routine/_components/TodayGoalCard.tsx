'use client';

/**
 * TodayGoalCard
 *
 * Phase 기반 사용자별 목표 요약 카드.
 * goal prop만 받아서 렌더. 나중에 서버 goal_summary로 교체 가능.
 */

import { Clock, Flame, User } from 'lucide-react';
import type { GoalSummary } from '@/lib/session/goal-summary';

export type TodayGoalCardProps = {
  goal: GoalSummary;
  timeLabel?: string;
  kcalLabel?: string;
};

export default function TodayGoalCard({
  goal,
  timeLabel = '15분 소요',
  kcalLabel = '예상 120 kcal',
}: TodayGoalCardProps) {
  return (
    <div className="rounded-2xl border-2 border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
            TODAY&apos;S GOAL
          </span>
          {goal.weekLabel && (
            <span className="text-xs text-slate-500">({goal.weekLabel})</span>
          )}
        </div>
        <button
          type="button"
          className="flex size-8 shrink-0 items-center justify-center rounded-full border border-stone-300 text-slate-500 hover:bg-stone-100"
          aria-label="목표 정보"
        >
          <User className="size-4" />
        </button>
      </div>

      <h3 className="text-base font-bold text-slate-800">{goal.title}</h3>
      <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">{goal.description}</p>

      {goal.chips.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {goal.chips.map((chip) => (
            <span
              key={chip}
              className="inline-flex rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-slate-700"
            >
              {chip}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <Clock className="size-3.5" />
          {timeLabel}
        </span>
        <span className="flex items-center gap-1">
          <Flame className="size-3.5" />
          {kcalLabel}
        </span>
      </div>
    </div>
  );
}
