'use client';

/**
 * AuthShell - Auth 페이지 공통 레이아웃 (MAIN UI 토큰 적용)
 * Props: badgeText, title, description, children
 */
import { Badge } from '@/components/ui/badge';

interface AuthShellProps {
  badgeText: string;
  title: string;
  description: string;
  children: React.ReactNode;
}

export default function AuthShell({ badgeText, title, description, children }: AuthShellProps) {
  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-8">
              <Badge
                variant="outline"
                className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide mb-4"
              >
                {badgeText}
              </Badge>
              <h1
                className="text-lg lg:text-xl font-semibold text-[var(--text)] mb-2"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {title}
              </h1>
              <p className="text-sm lg:text-base leading-relaxed text-[var(--muted)]">
                {description}
              </p>
            </div>
            <div
              className="rounded-[var(--radius)] bg-[var(--surface)] border border-[color:var(--border)] shadow-[var(--shadow-0)] w-full p-6 md:p-8"
            >
              {children}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
