'use client';

/**
 * AuthShell - Auth 페이지 공통 레이아웃 (네오브루탈리즘)
 * Props: badgeText, title, description, children
 */
import { NeoCard, NeoPageLayout } from '@/components/neobrutalism';

interface AuthShellProps {
  badgeText: string;
  title: string;
  description: string;
  children: React.ReactNode;
}

export default function AuthShell({ badgeText, title, description, children }: AuthShellProps) {
  return (
    <div className="min-h-screen bg-[#F8F6F0]">
      <NeoPageLayout maxWidth="md">
        <section className="py-12 md:py-16">
          <div className="text-center mb-8">
            <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold text-orange-600 uppercase tracking-wide mb-4 border-2 border-slate-900 bg-orange-100 shadow-[2px_2px_0_0_rgba(15,23,42,1)]">
              {badgeText}
            </span>
            <h1 className="text-lg lg:text-xl font-semibold text-slate-800 mb-2">
              {title}
            </h1>
            <p className="text-sm lg:text-base leading-relaxed text-slate-600">
              {description}
            </p>
          </div>
          <NeoCard className="w-full p-6 md:p-8">
            {children}
          </NeoCard>
        </section>
      </NeoPageLayout>
    </div>
  );
}
