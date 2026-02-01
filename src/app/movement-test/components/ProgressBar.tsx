/**
 * ProgressBar 컴포넌트
 * 
 * 테스트 진행률을 시각적으로 표시
 * - 현재 진행률 % 표시
 * - 현재 페이지 / 전체 페이지 표시
 * - 부드러운 transition 애니메이션
 */

interface ProgressBarProps {
  /** 현재 페이지 번호 (1부터 시작) */
  currentPage: number;
  
  /** 전체 페이지 수 */
  totalPages: number;
  
  /** 진행률 바 색상 (선택) */
  color?: string;
  
  /** 높이 (선택) */
  height?: string;
}

export default function ProgressBar({
  currentPage,
  totalPages,
  color = 'bg-[#f97316]',
  height = 'h-2'
}: ProgressBarProps) {
  // 진행률 계산 (0-100)
  const progress = Math.round((currentPage / totalPages) * 100);

  return (
    <div className="w-full">
      {/* 진행 상태 텍스트 */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-slate-300">
          질문 {currentPage} / {totalPages}
        </span>
        <span className="text-sm font-semibold text-white">
          {progress}%
        </span>
      </div>

      {/* 진행률 바 */}
      <div className={`w-full ${height} bg-slate-700 rounded-full overflow-hidden`}>
        <div
          className={`${height} ${color} rounded-full transition-all duration-500 ease-out`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* 마일스톤 표시 (25%, 50%, 75%) */}
      <div className="flex justify-between mt-2 px-1">
        {[25, 50, 75, 100].map((milestone) => (
          <div
            key={milestone}
            className={`text-xs transition-colors duration-300 ${
              progress >= milestone 
                ? 'text-[#f97316] font-semibold' 
                : 'text-slate-500'
            }`}
          >
            {milestone === 100 ? '완료' : `${milestone}%`}
          </div>
        ))}
      </div>
    </div>
  );
}
