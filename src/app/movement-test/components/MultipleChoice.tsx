/**
 * MultipleChoice 컴포넌트
 *
 * 4지선다 질문 선택 UI (✅ 최대 2개 선택 지원)
 * - 4개 선택지 버튼(체크박스처럼 동작)
 * - 최대 2개까지 선택 가능
 * - 선택 순서 유지: [1순위, 2순위]
 * - 2개 선택 시 다른 미선택 옵션은 비활성화 + 시각적 힌트
 * - 키보드 네비게이션 지원 (Enter/Space)
 * - 모바일 터치 최적화
 */

import type { Option } from '@/types/movement-test';


interface MultipleChoiceProps {
  /** 질문 ID */
  questionId: number;

  /** 선택지 배열 */
  options: Option[];

  /** ✅ 현재 선택된 옵션 ID들 (순서 중요: [1순위, 2순위]) */
  selectedOptionIds?: string[];

  /**
   * ✅ 선택 변경 콜백
   * - nextSelectedOptionIds는 선택 순서를 유지해야 함
   */
  onSelect: (nextSelectedOptionIds: string[]) => void;

  /** 비활성화 여부 */
  disabled?: boolean;
}

export default function MultipleChoice({
  questionId,
  options,
  selectedOptionIds = [],
  onSelect,
  disabled = false,
}: MultipleChoiceProps) {
  const MAX = 2;

  const toggleOption = (optionId: string) => {
    if (disabled) return;

    const isSelected = selectedOptionIds.includes(optionId);

    // ✅ 이미 선택된 항목이면 제거(토글 off)
    if (isSelected) {
      const next = selectedOptionIds.filter((id) => id !== optionId);
      onSelect(next);
      return;
    }

    // ✅ 새로 선택하려는데 이미 2개면 막기
    if (selectedOptionIds.length >= MAX) return;

    // ✅ 선택 추가(순서 유지)
    const next = [...selectedOptionIds, optionId];
    onSelect(next);
  };

  const handleKeyDown = (event: React.KeyboardEvent, optionId: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleOption(optionId);
    }
  };

  const isMaxSelected = selectedOptionIds.length >= MAX;

  return (
    <div className="space-y-3">
      {/* 안내 문구 */}
      <div className="text-xs text-slate-400">
        최대 2개까지 선택 가능 (1순위 100%, 2순위 50% 반영)
      </div>

      {options.map((option, index) => {
        const isSelected = selectedOptionIds.includes(option.id);
        const isBlocked = !isSelected && isMaxSelected; // 2개 이미 선택된 상태에서 미선택 옵션
        const letter = String.fromCharCode(65 + index); // A, B, C, D

        // ✅ 1순위/2순위 뱃지 계산
        const rankIndex = selectedOptionIds.indexOf(option.id); // -1, 0, 1
        const rankLabel = rankIndex === 0 ? '1순위' : rankIndex === 1 ? '2순위' : null;

        return (
          <button
            key={option.id}
            type="button"
            onClick={() => toggleOption(option.id)}
            onKeyDown={(e) => handleKeyDown(e, option.id)}
            disabled={disabled || isBlocked}
            className={`
              w-full p-4 rounded-xl text-left transition-all duration-200
              border-2
              ${isSelected
                ? 'border-[#f97316] bg-[#f97316]/10 shadow-lg shadow-[#f97316]/20'
                : 'border-slate-700 bg-slate-800/50 hover:border-slate-600 hover:bg-slate-800'
              }
              ${(disabled || isBlocked) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              focus:outline-none focus:ring-2 focus:ring-[#f97316] focus:ring-offset-2 focus:ring-offset-slate-900
              transform hover:scale-[1.01] active:scale-[0.99]
            `}
            aria-pressed={isSelected}
            aria-label={`선택지 ${letter}: ${option.text}`}
            data-question-id={questionId}
          >
            <div className="flex items-start gap-4">
              {/* 선택 표시 (체크박스처럼 동작) */}
              <div
                className={`
                  flex-shrink-0 w-6 h-6 rounded-full border-2 mt-0.5
                  flex items-center justify-center transition-all duration-200
                  ${isSelected
                    ? 'border-[#f97316] bg-[#f97316]'
                    : 'border-slate-600 bg-transparent'
                  }
                `}
              >
                {isSelected && (
                  <svg
                    className="w-4 h-4 text-white"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="3"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>

              {/* 선택지 텍스트 */}
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  <span
                    className={`
                      text-sm font-semibold
                      ${isSelected ? 'text-[#f97316]' : 'text-slate-400'}
                    `}
                  >
                    {letter}.
                  </span>

                  <span
                    className={`
                      text-base leading-relaxed
                      ${isSelected ? 'text-white font-medium' : 'text-slate-300'}
                    `}
                  >
                    {option.text}
                  </span>

                  {/* ✅ 1순위/2순위 배지 */}
                  {rankLabel && (
                    <span
                      className="
                        ml-2 inline-flex items-center
                        rounded-full border border-[#f97316]/40
                        bg-[#f97316]/10 px-2 py-0.5
                        text-[11px] font-semibold text-[#f97316]
                      "
                    >
                      {rankLabel}
                    </span>
                  )}
                </div>

                {/* ✅ 2개 선택 완료 시, 미선택 항목에 대한 힌트 */}
                {isBlocked && (
                  <div className="mt-1 text-xs text-slate-500">
                    이미 2개를 선택했어요. 선택을 해제하면 다른 항목을 고를 수 있어요.
                  </div>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
