/**
 * MultipleChoice 컴포넌트
 * 
 * 4지선다 질문 선택 UI
 * - 4개 선택지 라디오 버튼
 * - 선택 시 시각적 피드백
 * - 키보드 네비게이션 지원
 * - 모바일 터치 최적화
 */

import type { Option } from '../../../types/movement-test';

interface MultipleChoiceProps {
  /** 질문 ID */
  questionId: number;
  
  /** 선택지 배열 */
  options: Option[];
  
  /** 현재 선택된 옵션 ID */
  selectedOptionId?: string;
  
  /** 선택 시 콜백 */
  onSelect: (optionId: string) => void;
  
  /** 비활성화 여부 */
  disabled?: boolean;
}

export default function MultipleChoice({
  questionId,
  options,
  selectedOptionId,
  onSelect,
  disabled = false
}: MultipleChoiceProps) {
  const handleKeyDown = (event: React.KeyboardEvent, optionId: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!disabled) {
        onSelect(optionId);
      }
    }
  };

  return (
    <div className="space-y-3">
      {options.map((option, index) => {
        const isSelected = selectedOptionId === option.id;
        const letter = String.fromCharCode(65 + index); // A, B, C, D

        return (
          <button
            key={option.id}
            type="button"
            onClick={() => !disabled && onSelect(option.id)}
            onKeyDown={(e) => handleKeyDown(e, option.id)}
            disabled={disabled}
            className={`
              w-full p-4 rounded-xl text-left transition-all duration-200
              border-2 
              ${isSelected
                ? 'border-[#f97316] bg-[#f97316]/10 shadow-lg shadow-[#f97316]/20'
                : 'border-slate-700 bg-slate-800/50 hover:border-slate-600 hover:bg-slate-800'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              focus:outline-none focus:ring-2 focus:ring-[#f97316] focus:ring-offset-2 focus:ring-offset-slate-900
              transform hover:scale-[1.01] active:scale-[0.99]
            `}
            aria-pressed={isSelected}
            aria-label={`선택지 ${letter}: ${option.text}`}
          >
            <div className="flex items-start gap-4">
              {/* 선택 표시 */}
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
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
