'use client';

/**
 * PR-UX-03: Session reflection modal
 * Blocks exit until answered. Collects difficulty 1-5, body_state, discomfort_area.
 */

import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { SessionPainArea } from '@/lib/session/feedback-types';

const PAIN_LABELS: Record<SessionPainArea, string> = {
  neck: '목',
  lower_back: '허리',
  knee: '무릎',
  wrist: '손목',
  shoulder: '어깨',
};

const PAIN_AREAS: SessionPainArea[] = ['neck', 'lower_back', 'knee', 'wrist', 'shoulder'];

export type ReflectionData = {
  difficulty: number;
  body_state_change: 'better' | 'same' | 'worse';
  discomfort_area: string | null;
};

interface ReflectionModalProps {
  onSubmit: (data: ReflectionData) => void;
  submitting?: boolean;
}

export function ReflectionModal({ onSubmit, submitting = false }: ReflectionModalProps) {
  const [difficulty, setDifficulty] = useState<number>(0);
  const [bodyState, setBodyState] = useState<'better' | 'same' | 'worse' | null>(null);
  const [discomfortArea, setDiscomfortArea] = useState<string | null>(null);

  const canSubmit = difficulty >= 1 && difficulty <= 5 && bodyState != null;

  const handleSubmit = () => {
    if (!canSubmit || submitting) return;
    onSubmit({
      difficulty,
      body_state_change: bodyState!,
      discomfort_area: discomfortArea,
    });
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[85] bg-black/60 backdrop-blur-sm animate-in fade-in"
        style={{ animationDuration: '150ms' }}
        aria-hidden
      />
      <div
        className="fixed inset-x-0 bottom-0 z-[90] animate-in slide-in-from-bottom-4"
        style={{
          animationDuration: '250ms',
          animationTimingFunction: 'cubic-bezier(0.2,0,0,1)',
          paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
        }}
      >
        <div className="mx-auto max-w-[430px] rounded-t-2xl border border-slate-200 bg-white px-5 py-5 pb-8 shadow-2xl">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
            세션 리플렉션
          </p>
          <p className="mb-4 text-sm text-slate-600">
            오늘 세션은 어땠나요? 다음 세션 조정에 활용됩니다.
          </p>

          {/* Difficulty 1-5 */}
          <div className="mb-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              전체 난이도 (1=매우 쉬움, 5=매우 힘듦)
            </p>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setDifficulty(n)}
                  className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition ${
                    difficulty === n
                      ? 'bg-orange-400 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Body state */}
          <div className="mb-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              운동 후 몸 상태는?
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'better' as const, label: '더 편해짐' },
                { value: 'same' as const, label: '비슷함' },
                { value: 'worse' as const, label: '불편해짐' },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setBodyState(value)}
                  className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                    bodyState === value
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Discomfort area */}
          <div className="mb-6">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              불편했던 부위가 있나요? (선택)
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setDiscomfortArea(null)}
                className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                  discomfortArea === null
                    ? 'bg-slate-800 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                없음
              </button>
              {PAIN_AREAS.map((area) => (
                <button
                  key={area}
                  type="button"
                  onClick={() => setDiscomfortArea(area)}
                  className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                    discomfortArea === area
                      ? 'bg-slate-800 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {PAIN_LABELS[area]}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-400 py-3.5 text-sm font-bold text-white hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckCircle2 className="h-4 w-4" />
            {submitting ? '저장 중...' : '완료하고 다음 세션 보기'}
          </button>
        </div>
      </div>
    </>
  );
}
