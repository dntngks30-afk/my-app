'use client';

/**
 * Auth inner surface — glass / midnight (presentation). Neo surface 제거.
 */
interface AuthShellProps {
  badgeText: string;
  title: string;
  description: string;
  children: React.ReactNode;
  /** 상단 badge/title/description 숨김 (MoveReAuthScreen이 바깥 헤드라인 담당) */
  compactHeader?: boolean;
}

export default function AuthShell({
  badgeText,
  title,
  description,
  children,
  compactHeader = false,
}: AuthShellProps) {
  return (
    <div
      className="rounded-2xl border border-white/[0.08] p-6 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.55)] md:p-8"
      style={{
        background: 'rgba(46, 52, 71, 0.4)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}
    >
      {!compactHeader && (
        <div className="mb-8 text-center">
          <span className="mb-4 inline-block rounded-full border border-[#ffb77d]/35 bg-[#070d1f]/60 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#ffb77d]">
            {badgeText}
          </span>
          <h2 className="mb-2 text-lg font-semibold text-[#dce1fb] lg:text-xl">{title}</h2>
          <p className="text-sm leading-relaxed text-[#dce1fb]/75 lg:text-[0.9375rem]">{description}</p>
        </div>
      )}
      {children}
    </div>
  );
}
