'use client';

/**
 * PR-OH-GUIDE-NONBLOCKING-05C: 다줄 촬영 가이드는 라이브 프리뷰 밖에서만 표시해 몸·손·실루엣 가림을 막는다.
 * motion/readiness/게이트와 무관한 순수 UI.
 */
export function ExternalCameraGuidePanel(props: {
  lines: string[];
  title?: string;
  /** 스모크·식별용 data attribute */
  variant?: 'overhead-reach' | 'squat' | 'wall-angel' | 'single-leg-balance' | 'generic';
  className?: string;
}) {
  const { lines, title = '촬영 가이드', variant = 'generic', className = '' } = props;
  if (lines.length === 0) return null;
  return (
    <div
      className={`rounded-xl border border-white/10 bg-black/30 px-3 py-2 ${className}`}
      data-external-camera-guide={variant}
      style={{ fontFamily: 'var(--font-sans-noto)' }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
        {title}
      </p>
      <ul className="space-y-1 text-xs text-slate-300 break-keep list-none">
        {lines.map((line) => (
          <li key={line} className="flex gap-2">
            <span className="text-slate-500 shrink-0">·</span>
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
