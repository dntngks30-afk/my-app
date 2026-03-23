'use client';

/**
 * 단일 문항 + 0~4 원형 스케일 (stitch code.html 레일·중앙 강조)
 * 질문 본문은 부모가 전달하는 truth 문자열만 표시한다.
 */
import { ANSWER_CHOICES_V2 } from '@/features/movement-test/v2';
import type { TestAnswerValue } from '@/features/movement-test/v2';

export type StitchSurveyQuestionProps = {
  /** 0-based — 표시용 Question 라벨에만 사용 */
  stepIndex: number;
  questionText: string;
  currentAnswer: TestAnswerValue | undefined;
  onSelect: (value: TestAnswerValue) => void;
};

export default function StitchSurveyQuestion({
  stepIndex,
  questionText,
  currentAnswer,
  onSelect,
}: StitchSurveyQuestionProps) {
  const qLabel = String(stepIndex + 1).padStart(2, '0');

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto overflow-x-hidden px-6 pb-10">
      <div
        key={stepIndex}
        className="public-survey-question-swap w-full max-w-2xl space-y-12 py-4 text-center"
      >
        <div className="space-y-6">
          <span className="block text-lg italic text-[#ffb77d]/60 [font-family:var(--font-display)]">
            Question {qLabel}
          </span>
          <h1 className="break-keep px-2 text-3xl font-semibold leading-snug tracking-tight text-[#dce1fb] md:text-4xl [font-family:var(--font-display)]">
            {questionText}
          </h1>
        </div>

        <div className="relative py-10 md:py-12">
          <div
            aria-hidden
            className="absolute left-0 top-1/2 z-0 h-px w-full -translate-y-1/2 bg-[#46464c]/20"
          />

          <div
            className="relative z-10 flex w-full items-center justify-between gap-0.5 sm:gap-2"
            role="group"
            aria-label="응답 선택"
          >
            {ANSWER_CHOICES_V2.map((choice) => {
              const isCenter = choice.value === 2;
              const selected = currentAnswer === choice.value;
              return (
                <button
                  key={choice.value}
                  type="button"
                  aria-label={choice.label}
                  aria-pressed={selected}
                  onClick={() => onSelect(choice.value)}
                  className="group flex min-w-0 flex-1 flex-col items-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ffb77d]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c1324]"
                >
                  <div
                    className={[
                      'flex items-center justify-center rounded-full border transition-all duration-500',
                      isCenter ? 'h-16 w-16 shadow-[0_20px_40px_rgba(2,6,23,0.06)]' : 'h-14 w-14',
                      selected
                        ? 'border-[#ffb77d]/65 bg-[#ffb77d]/18 text-[#fce9dc]'
                        : 'border-[#46464c]/30 bg-[#151b2d] text-slate-400 hover:border-[#ffb77d]/45 hover:text-[#ffb77d]',
                    ].join(' ')}
                  >
                    <span
                      className={isCenter ? 'text-lg font-medium tabular-nums' : 'text-sm font-light tabular-nums'}
                      style={{ fontFamily: 'var(--font-sans-noto)' }}
                    >
                      {choice.value}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-10 flex justify-between px-1">
            <span
              className="text-xs font-light uppercase tracking-widest text-slate-500"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              전혀 아니다
            </span>
            <span
              className="text-xs font-light uppercase tracking-widest text-slate-500"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              거의 항상
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
