'use client';

/**
 * 운동 단위 종료 시 (이 운동 완료) — 체감 난이도 + 운동 후 통증만 수집.
 * RPE, 완료% 없음.
 */

import { CheckCircle2 } from 'lucide-react';

export type ExercisePerceivedDifficulty = 1 | 2 | 3 | 4 | 5;
export type ExercisePostPain = 0 | 2 | 5 | 8 | 10;

interface ExerciseCompletionSheetProps {
  exerciseName: string;
  perceivedDifficulty: ExercisePerceivedDifficulty | null;
  postPain: ExercisePostPain | null;
  onPerceivedDifficultyChange: (v: ExercisePerceivedDifficulty | null) => void;
  onPostPainChange: (v: ExercisePostPain | null) => void;
  onConfirm: () => void;
}

const DIFFICULTY_LABELS: Record<ExercisePerceivedDifficulty, string> = {
  1: '매우 쉬움',
  2: '쉬움',
  3: '적당함',
  4: '힘듦',
  5: '매우 힘듦',
};

const PAIN_OPTIONS: { value: ExercisePostPain; label: string }[] = [
  { value: 0, label: '없음' },
  { value: 2, label: '약함' },
  { value: 5, label: '보통' },
  { value: 8, label: '심함' },
  { value: 10, label: '매우 심함' },
];

export function ExerciseCompletionSheet({
  exerciseName,
  perceivedDifficulty,
  postPain,
  onPerceivedDifficultyChange,
  onPostPainChange,
  onConfirm,
}: ExerciseCompletionSheetProps) {
  return (
    <div className="space-y-5 px-1">
      <p className="text-sm font-medium text-slate-600">
        <span className="font-semibold text-slate-800">{exerciseName}</span> 완료
      </p>

      {/* 체감 난이도 */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          체감 난이도
        </p>
        <div className="flex flex-wrap gap-2">
          {([1, 2, 3, 4, 5] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => onPerceivedDifficultyChange(perceivedDifficulty === d ? null : d)}
              className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                perceivedDifficulty === d
                  ? 'bg-orange-400 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {DIFFICULTY_LABELS[d]}
            </button>
          ))}
        </div>
      </div>

      {/* 운동 후 통증 */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          운동 후 통증
        </p>
        <div className="flex flex-wrap gap-2">
          {PAIN_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => onPostPainChange(postPain === value ? null : value)}
              className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                postPain === value
                  ? 'bg-slate-800 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={onConfirm}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3.5 text-sm font-semibold text-white hover:bg-slate-800"
      >
        <CheckCircle2 className="h-4 w-4" />
        완료
      </button>
    </div>
  );
}
