'use client';

/**
 * 단일 문항 + 0~4 원형 스케일 (stitch code.html 레일·중앙 강조)
 * 질문 본문은 부모가 전달하는 truth 문자열만 표시한다.
 */
import { Fragment, type ReactNode } from 'react';
import { ANSWER_CHOICES_V2 } from '@/features/movement-test/v2';
import type { TestAnswerValue } from '@/features/movement-test/v2';

/** `(...)` 전체(괄호 포함) 본문 대비 4px 작게 (24px → 20px) */
function renderLineWithParenSized(line: string): ReactNode {
  const re = /\([^)]+\)/g;
  const nodes: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(line)) !== null) {
    if (m.index > last) nodes.push(line.slice(last, m.index));
    nodes.push(
      <span key={`p-${k++}`} className="text-[20px] align-baseline">
        {m[0]}
      </span>,
    );
    last = m.index + m[0].length;
  }
  if (last < line.length) nodes.push(line.slice(last));
  return nodes.length ? nodes : line;
}

function renderSurveyQuestionBody(text: string): ReactNode {
  const lines = text.split('\n');
  return lines.map((line, i) => (
    <Fragment key={i}>
      {i > 0 ? '\n' : null}
      {renderLineWithParenSized(line)}
    </Fragment>
  ));
}

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
          <h1 className="mr-public-brand-serif whitespace-pre-line break-keep px-2 text-[24px] font-semibold leading-[34px] tracking-[-0.8px] text-[#dce1fb]">
            {renderSurveyQuestionBody(questionText)}
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
