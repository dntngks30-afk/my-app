'use client';

interface AuthShellProps {
  children: React.ReactNode;
  compactHeader?: boolean;
  badgeText?: string;
  title?: string;
  description?: string;
}

/**
 * INTRO 챕터 카드 표면과 유사한 glass 표면(auth 전용 클래스).
 */
export default function AuthShell({
  children,
  compactHeader = false,
  badgeText,
  title,
  description,
}: AuthShellProps) {
  const showInnerHeader =
    !compactHeader && (badgeText || title || description);

  return (
    <div className="rounded-[28px] border border-white/[0.08] bg-[#151b2d]/70 p-5 shadow-none backdrop-blur-md sm:p-6">
      {showInnerHeader ? (
        <div className="mb-6 text-center">
          {badgeText ? (
            <span className="mb-4 inline-block rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#ffb77d]">
              {badgeText}
            </span>
          ) : null}
          {title ? (
            <h2 className="mb-2 text-lg font-semibold text-[#dce1fb] lg:text-xl">{title}</h2>
          ) : null}
          {description ? (
            <p className="text-sm leading-relaxed text-[#dce1fb]/75 lg:text-[0.9375rem]">{description}</p>
          ) : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}
