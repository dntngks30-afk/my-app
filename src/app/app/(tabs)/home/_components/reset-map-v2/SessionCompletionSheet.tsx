'use client';

/**
 * 세션 종료 시 (세션 종료하기) — 전체 체감 난이도 + 부위별 통증만 수집.
 * RPE, 완료% 없음.
 * PR-SESSION-EXPERIENCE-01: 운동 후 몸 상태 reflection 추가.
 */

import { CheckCircle2 } from 'lucide-react';
import type { SessionPainArea } from '@/lib/session/feedback-types';

export type SessionPerceivedDifficulty = 'too_easy' | 'ok' | 'too_hard';

/** PR-SESSION-EXPERIENCE-01: 운동 후 몸 상태 (UI 수준, adaptive 연결 가능) */
export type BodyStateAfter = 'better' | 'same' | 'slightly_worse';

const PAIN_AREA_LABELS: Record<SessionPainArea, string> = {
  neck: '목',
  lower_back: '허리',
  knee: '무릎',
  wrist: '손목',
  shoulder: '어깨',
};

const PAIN_AREAS: SessionPainArea[] = ['neck', 'lower_back', 'knee', 'wrist', 'shoulder'];

interface SessionCompletionSheetProps {
  perceivedDifficulty: SessionPerceivedDifficulty | null;
  painAreas: SessionPainArea[];
  onPerceivedDifficultyChange: (v: SessionPerceivedDifficulty | null) => void;
  onPainAreasChange: (areas: SessionPainArea[]) => void;
  onConfirm: () => void;
  completing?: boolean;
  /** PR-SESSION-EXPERIENCE-01: 운동 후 몸 상태 (UI only) */
  bodyStateAfter?: BodyStateAfter | null;
  onBodyStateAfterChange?: (v: BodyStateAfter | null) => void;
}

export function SessionCompletionSheet({
  perceivedDifficulty,
  painAreas,
  onPerceivedDifficultyChange,
  onPainAreasChange,
  onConfirm,
  completing = false,
  bodyStateAfter = null,
  onBodyStateAfterChange,
}: SessionCompletionSheetProps) {
  const togglePainArea = (area: SessionPainArea) => {
    if (painAreas.includes(area)) {
      onPainAreasChange(painAreas.filter((a) => a !== area));
    } else {
      onPainAreasChange([...painAreas, area]);
    }
  };

  return (
    <div className="space-y-5 px-1">
      <p className="text-sm font-medium text-slate-600">오늘 세션은 어땠나요?</p>

      {/* 전체 체감 난이도 */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          전체 체감 난이도
        </p>
        <div className="flex flex-wrap gap-2">
          {[
            { value: 'too_easy' as const, label: '쉬웠어요' },
            { value: 'ok' as const, label: '적당해요' },
            { value: 'too_hard' as const, label: '힘들었어요' },
          ].map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => onPerceivedDifficultyChange(perceivedDifficulty === value ? null : value)}
              className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                perceivedDifficulty === value
                  ? 'bg-orange-400 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* PR-SESSION-EXPERIENCE-01: 운동 후 몸 상태 reflection */}
      {onBodyStateAfterChange && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            운동 후 몸 상태는 어떤가요?
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              { value: 'better' as const, label: '더 편해짐' },
              { value: 'same' as const, label: '비슷함' },
              { value: 'slightly_worse' as const, label: '약간 불편' },
            ].map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => onBodyStateAfterChange(bodyStateAfter === value ? null : value)}
                className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                  bodyStateAfter === value
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 부위별 통증 */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          운동 중 특정 부위에 통증이 있었나요? (복수 선택 가능)
        </p>
        <div className="flex flex-wrap gap-2">
          {PAIN_AREAS.map((area) => (
            <button
              key={area}
              type="button"
              onClick={() => togglePainArea(area)}
              className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                painAreas.includes(area)
                  ? 'bg-slate-800 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {PAIN_AREA_LABELS[area]}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={onConfirm}
        disabled={completing}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-400 py-3.5 text-sm font-bold text-white hover:bg-orange-500 disabled:opacity-60"
      >
        <CheckCircle2 className="h-4 w-4" />
        {completing ? '저장 중...' : '세션 종료하기'}
      </button>
    </div>
  );
}
