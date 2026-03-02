'use client';

/**
 * SessionHistoryPanel
 *
 * Path B 세션 히스토리 UI — 캘린더 스탬프 + 완료 리스트.
 * 7일 시스템/플레이어와 무관. /api/session/history 전용.
 */

import { CheckCircle2 } from 'lucide-react';
import { NeoCard } from '@/components/neobrutalism';
import type { SessionHistoryResponse } from '@/lib/session/client';

const CALENDAR_DAYS = 14;
const LIST_MAX = 20;

function toLocalDateKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatCompletedDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return '오늘';
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${d.getMonth() + 1}/${d.getDate()} (${days[d.getDay()]})`;
}

type SessionHistoryPanelProps = {
  history: SessionHistoryResponse | null;
  loading: boolean;
  error: boolean;
};

export default function SessionHistoryPanel({ history, loading, error }: SessionHistoryPanelProps) {
  if (error) return null;

  if (loading) {
    return (
      <NeoCard className="p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-3 w-32 rounded bg-stone-200" />
          <div className="flex gap-1">
            {Array.from({ length: 14 }).map((_, i) => (
              <div key={i} className="h-8 w-8 rounded-full bg-stone-200" />
            ))}
          </div>
          <div className="h-3 w-24 rounded bg-stone-200 mt-3" />
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 rounded bg-stone-200" />
            ))}
          </div>
        </div>
      </NeoCard>
    );
  }

  if (!history) return null;

  const { progress, items } = history;
  const completedDateSet = new Set<string>();
  items.forEach((it) => {
    if (it.completed_at) completedDateSet.add(toLocalDateKey(it.completed_at));
  });

  const today = new Date();
  const dayLabels: { date: Date; key: string }[] = [];
  for (let i = CALENDAR_DAYS - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dayLabels.push({
      date: d,
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    });
  }

  const listItems = items.slice(0, LIST_MAX);

  return (
    <NeoCard className="p-4">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
        세션 히스토리
      </h3>

      {/* 미니 캘린더/타임라인 (최근 14일) */}
      <div className="mb-4">
        <p className="text-xs text-slate-500 mb-2">
          최근 {CALENDAR_DAYS}일 · {progress.completed_sessions}/{progress.total_sessions} 완료
        </p>
        <div className="flex flex-wrap gap-1">
          {dayLabels.map(({ date, key }) => {
            const hasStamp = completedDateSet.has(key);
            const isToday = date.toDateString() === today.toDateString();
            return (
              <div
                key={key}
                className={[
                  'flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-medium transition',
                  hasStamp
                    ? 'bg-emerald-500 text-white ring-2 ring-emerald-600'
                    : isToday
                      ? 'border-2 border-slate-400 bg-white text-slate-600'
                      : 'bg-stone-100 text-slate-400',
                ].join(' ')}
                title={`${date.getMonth() + 1}/${date.getDate()}${hasStamp ? ' ✓' : ''}`}
              >
                {hasStamp ? <CheckCircle2 className="size-3.5 stroke-[2.5]" /> : date.getDate()}
              </div>
            );
          })}
        </div>
      </div>

      {/* 완료 리스트 (최대 20) */}
      <div>
        <p className="text-xs font-medium text-slate-600 mb-2">최근 완료 세션</p>
        {listItems.length === 0 ? (
          <p className="text-xs text-slate-400 py-2">아직 완료한 세션이 없어요.</p>
        ) : (
          <ul className="space-y-2">
            {listItems.map((it) => (
              <li
                key={`${it.session_number}-${it.completed_at}`}
                className="flex items-start gap-2 rounded-lg border border-stone-200 bg-stone-50/50 px-3 py-2"
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
                  {it.session_number}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800 truncate" title={it.theme}>
                    {it.theme}
                  </p>
                  <p className="text-xs text-slate-500">{formatCompletedDate(it.completed_at)}</p>
                  {it.duration_seconds != null && it.duration_seconds > 0 && (
                    <p className="text-xs text-slate-400">
                      {Math.floor(it.duration_seconds / 60)}분
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </NeoCard>
  );
}
