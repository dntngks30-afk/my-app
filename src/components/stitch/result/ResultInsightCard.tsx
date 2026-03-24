'use client';

import type { LucideIcon } from 'lucide-react';

/** zip(6) 스타일: 좌측 앰버 라인·아이콘·짧은 카피 (표시 전용) */
export type ResultInsightCardProps = {
  icon: LucideIcon;
  title: string;
  body: string;
  /** 첫 리셋 등 인용 톤 */
  quote?: boolean;
  /** Step2 등 짧은 카드용 — 패딩·아이콘 소폭 축소 */
  compact?: boolean;
};

export function ResultInsightCard({ icon: Icon, title, body, quote, compact }: ResultInsightCardProps) {
  const pad = compact ? 'px-4 py-3.5' : 'p-5';
  const iconCls = compact ? 'mb-1.5 size-6' : 'mb-2 size-7';
  const titleCls = compact
    ? 'text-sm font-medium text-[#ffb77d]/90'
    : 'text-[15px] font-medium text-[#ffb77d]/90';
  const bodyCls = compact ? 'mt-1.5 text-[13px] leading-relaxed' : 'mt-2 text-sm leading-relaxed';

  return (
    <div className={`rounded-xl border-l-2 border-[#ffb77d]/25 bg-[#23293c] text-left shadow-sm ${pad}`}>
      <Icon className={`${iconCls} text-[#ffb77d]`} strokeWidth={1.5} aria-hidden />
      <h3 className={titleCls} style={{ fontFamily: 'var(--font-sans-noto)' }}>
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
          className={`${bodyCls} break-keep text-[#c6c6cd]`}
          style={{ fontFamily: 'var(--font-sans-noto)' }}
        >
          {body}
        </p>
      )}
    </div>
  );
}
