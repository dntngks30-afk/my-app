'use client';

import type { LucideIcon } from 'lucide-react';

/** zip(6) 스타일: 좌측 앰버 라인·아이콘·짧은 카피 (표시 전용) */
export type ResultInsightCardProps = {
  icon: LucideIcon;
  title: string;
  body: string;
  /** 첫 리셋 등 인용 톤 */
  quote?: boolean;
};

export function ResultInsightCard({ icon: Icon, title, body, quote }: ResultInsightCardProps) {
  return (
    <div className="rounded-xl border-l-2 border-[#ffb77d]/25 bg-[#23293c] p-5 text-left shadow-sm">
      <Icon className="mb-2 size-7 text-[#ffb77d]" strokeWidth={1.5} aria-hidden />
      <h3
        className="text-[15px] font-medium text-[#ffb77d]/90"
        style={{ fontFamily: 'var(--font-sans-noto)' }}
      >
        {title}
      </h3>
      {quote ? (
        <p
          className="mt-2 break-keep text-base italic leading-relaxed text-[#dce1fb] [font-family:var(--font-display)]"
        >
          &ldquo;{body}&rdquo;
        </p>
      ) : (
        <p
          className="mt-2 break-keep text-sm leading-relaxed text-[#c6c6cd]"
          style={{ fontFamily: 'var(--font-sans-noto)' }}
        >
          {body}
        </p>
      )}
    </div>
  );
}
