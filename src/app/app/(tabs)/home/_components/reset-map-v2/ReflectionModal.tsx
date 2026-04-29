'use client';

/**
 * PR-UX-03: Session reflection modal
 * Blocks exit until answered. Collects difficulty 1-5, body_state, discomfort_area.
 */

import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { SessionPainArea } from '@/lib/session/feedback-types';
import {
  choiceChipActiveBetter,
  choiceChipActiveOrange,
  choiceChipActiveWorse,
  choiceChipInactive,
  modalSheetContainer,
  primaryCtaRestrained,
  sessionGoalLabel,
} from './homeExecutionTheme';

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
        className="fixed inset-0 z-[85] bg-black/70 backdrop-blur-md animate-in fade-in"
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
        <div className={`${modalSheetContainer} px-5 py-5 pb-8`}>
          <p className={`mb-4 ${sessionGoalLabel}`}>세션 리플렉션</p>
          <p className="mb-4 text-sm leading-relaxed text-white/55">
            오늘 세션은 어땠나요? 다음 세션 조정에 활용됩니다.
          </p>

          {/* Difficulty 1-5 */}
          <div className="mb-5">
            <p className={`mb-2 ${sessionGoalLabel}`}>
              전체 난이도 (1=매우 쉬움, 5=매우 힘듦)
            </p>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setDifficulty(n)}
                  className={`flex-1 py-2.5 text-sm font-semibold transition ${
                    difficulty === n ? choiceChipActiveOrange : choiceChipInactive
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Body state */}
          <div className="mb-5">
            <p className={`mb-2 ${sessionGoalLabel}`}>운동 후 몸 상태는?</p>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'better' as const, label: '더 편해짐', activeClass: choiceChipActiveBetter },
                { value: 'same' as const, label: '비슷함', activeClass: choiceChipActiveOrange },
                { value: 'worse' as const, label: '불편해짐', activeClass: choiceChipActiveWorse },
              ].map(({ value, label, activeClass }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setBodyState(value)}
                  className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                    bodyState === value ? activeClass : choiceChipInactive
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Discomfort area */}
          <div className="mb-6">
            <p className={`mb-2 ${sessionGoalLabel}`}>불편했던 부위가 있나요? (선택)</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setDiscomfortArea(null)}
                className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                  discomfortArea === null ? choiceChipActiveOrange : choiceChipInactive
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
                    discomfortArea === area ? choiceChipActiveOrange : choiceChipInactive
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
            className={primaryCtaRestrained}
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {submitting ? '저장 중...' : '완료하고 다음 세션 보기'}
          </button>
        </div>
      </div>
    </>
  );
}
