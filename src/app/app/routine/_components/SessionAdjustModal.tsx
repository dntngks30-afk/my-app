'use client';

/**
 * SessionAdjustModal — 오늘 컨디션 조정 모달
 *
 * mood(3칩) + time_budget(2칩). 확정 버튼 "리셋 시작".
 * confirm handler는 외부에서 주입(onSubmit).
 */

import { useState } from 'react';
import { X } from 'lucide-react';
import { NeoButton } from '@/components/neobrutalism';

export type Mood = 'good' | 'ok' | 'bad';
export type Budget = 'short' | 'normal';

const MOOD_OPTIONS: { value: Mood; label: string; emoji: string }[] = [
  { value: 'good', label: '좋음', emoji: '😊' },
  { value: 'ok', label: '보통', emoji: '😐' },
  { value: 'bad', label: '나쁨', emoji: '😔' },
];

const BUDGET_OPTIONS: { value: Budget; label: string; sub: string }[] = [
  { value: 'short', label: '짧게', sub: '~15분' },
  { value: 'normal', label: '보통', sub: '~30분' },
];

type SessionAdjustModalProps = {
  defaultMood?: Mood;
  defaultBudget?: Budget;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (mood: Mood, budget: Budget) => void;
};

export default function SessionAdjustModal({
  defaultMood = 'ok',
  defaultBudget = 'short',
  loading = false,
  onClose,
  onSubmit,
}: SessionAdjustModalProps) {
  const [mood, setMood] = useState<Mood>(defaultMood);
  const [budget, setBudget] = useState<Budget>(defaultBudget);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-t-3xl border-2 border-slate-900 bg-white p-6 shadow-[0_-4px_0_0_rgba(15,23,42,1)]">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-slate-800">오늘 컨디션 조정</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full border border-stone-300 text-slate-500 hover:bg-stone-100"
            aria-label="닫기"
          >
            <X className="size-4" />
          </button>
        </div>

        <p className="text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">
          오늘 컨디션
        </p>
        <div className="flex gap-2 mb-5">
          {MOOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setMood(opt.value)}
              className={[
                'flex-1 flex flex-col items-center gap-1 rounded-2xl border-2 py-3 text-sm font-semibold transition',
                mood === opt.value
                  ? 'border-slate-900 bg-orange-100 text-slate-900 shadow-[2px_2px_0_0_rgba(15,23,42,1)]'
                  : 'border-stone-300 bg-white text-slate-600 hover:border-slate-400',
              ].join(' ')}
            >
              <span className="text-xl">{opt.emoji}</span>
              {opt.label}
            </button>
          ))}
        </div>

        <p className="text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">
          운동 시간
        </p>
        <div className="flex gap-2 mb-6">
          {BUDGET_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setBudget(opt.value)}
              className={[
                'flex-1 flex flex-col items-center gap-0.5 rounded-2xl border-2 py-3 text-sm font-semibold transition',
                budget === opt.value
                  ? 'border-slate-900 bg-orange-100 text-slate-900 shadow-[2px_2px_0_0_rgba(15,23,42,1)]'
                  : 'border-stone-300 bg-white text-slate-600 hover:border-slate-400',
              ].join(' ')}
            >
              {opt.label}
              <span className="text-xs font-normal text-slate-500">{opt.sub}</span>
            </button>
          ))}
        </div>

        <NeoButton
          variant="orange"
          fullWidth
          disabled={loading}
          onClick={() => onSubmit(mood, budget)}
          className="py-3 text-base"
        >
          {loading ? '생성 중...' : '리셋 시작'}
        </NeoButton>
      </div>
    </div>
  );
}
