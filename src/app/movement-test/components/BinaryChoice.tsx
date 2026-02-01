/**
 * BinaryChoice 컴포넌트
 * 
 * 예/아니오 질문 선택 UI
 * - 예/아니오 버튼
 * - 명확한 시각적 구분
 * - 터치 친화적 크기
 */

interface BinaryChoiceProps {
  /** 질문 ID */
  questionId: number;
  
  /** 현재 선택된 답변 (true: 예, false: 아니오, undefined: 미선택) */
  selectedAnswer?: boolean;
  
  /** 선택 시 콜백 */
  onSelect: (answer: boolean) => void;
  
  /** 비활성화 여부 */
  disabled?: boolean;
  
  /** 도움말 텍스트 (선택) */
  helpText?: string;
}

export default function BinaryChoice({
  questionId,
  selectedAnswer,
  onSelect,
  disabled = false,
  helpText
}: BinaryChoiceProps) {
  const handleKeyDown = (event: React.KeyboardEvent, answer: boolean) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!disabled) {
        onSelect(answer);
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* 버튼 그룹 */}
      <div className="grid grid-cols-2 gap-4">
        {/* 예 버튼 */}
        <button
          type="button"
          onClick={() => !disabled && onSelect(true)}
          onKeyDown={(e) => handleKeyDown(e, true)}
          disabled={disabled}
          className={`
            py-6 px-8 rounded-xl font-semibold text-lg
            transition-all duration-200 transform
            border-2
            ${selectedAnswer === true
              ? 'border-green-500 bg-green-500/20 text-white shadow-lg shadow-green-500/20'
              : 'border-slate-700 bg-slate-800/50 text-slate-300 hover:border-slate-600 hover:bg-slate-800'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]'}
            focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-slate-900
          `}
          aria-pressed={selectedAnswer === true}
          aria-label="예"
        >
          <div className="flex flex-col items-center gap-2">
            <span className="text-3xl">✓</span>
            <span>예</span>
          </div>
        </button>

        {/* 아니오 버튼 */}
        <button
          type="button"
          onClick={() => !disabled && onSelect(false)}
          onKeyDown={(e) => handleKeyDown(e, false)}
          disabled={disabled}
          className={`
            py-6 px-8 rounded-xl font-semibold text-lg
            transition-all duration-200 transform
            border-2
            ${selectedAnswer === false
              ? 'border-red-500 bg-red-500/20 text-white shadow-lg shadow-red-500/20'
              : 'border-slate-700 bg-slate-800/50 text-slate-300 hover:border-slate-600 hover:bg-slate-800'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]'}
            focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-slate-900
          `}
          aria-pressed={selectedAnswer === false}
          aria-label="아니오"
        >
          <div className="flex flex-col items-center gap-2">
            <span className="text-3xl">✗</span>
            <span>아니오</span>
          </div>
        </button>
      </div>

      {/* 도움말 텍스트 */}
      {helpText && (
        <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4">
          <p className="text-sm text-slate-400 leading-relaxed">
            💡 {helpText}
          </p>
        </div>
      )}
    </div>
  );
}
