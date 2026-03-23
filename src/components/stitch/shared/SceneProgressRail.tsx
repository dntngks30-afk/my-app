'use client';

export type StitchSceneProgressRailProps = {
  current: number;
  total: number;
  className?: string;
};

/** 얇은 copper fill — survey / result step 공통 */
export function StitchSceneProgressRail({ current, total, className = '' }: StitchSceneProgressRailProps) {
  const pct = Math.min(100, (current / total) * 100);
  return (
    <div className={`w-full px-1 ${className}`}>
      <div className="h-0.5 w-full overflow-hidden rounded-full bg-[#2e3447]/40">
        <div
          className="h-full bg-[#ffb77d] transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
