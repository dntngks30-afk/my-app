'use client';

/**
 * CalendarPills
 *
 * 가로 스크롤 날짜 pill (MON 23 스타일).
 * history 스탬프 반영(완료일 작은 점 표시). 선택 날짜 highlight(오렌지).
 * 표시용(세션 생성과 무관).
 */
import type { SessionHistoryResponse } from '@/lib/session/client';

const DAY_NAMES_EN = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const CALENDAR_DAYS = 14;

function toLocalDateKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type CalendarPillsProps = {
  history: SessionHistoryResponse | null;
  selectedDateKey: string | null;
  onSelectDate?: (key: string) => void;
};

export default function CalendarPills({
  history,
  selectedDateKey,
  onSelectDate,
}: CalendarPillsProps) {
  const completedDateSet = new Set<string>();
  if (history?.items) {
    history.items.forEach((it) => {
      if (it.completed_at) completedDateSet.add(toLocalDateKey(it.completed_at));
    });
  }

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const activeKey = selectedDateKey ?? todayKey;

  const days: { date: Date; key: string }[] = [];
  for (let i = CALENDAR_DAYS - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push({
      date: d,
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    });
  }

  return (
    <div className="overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
      <div className="flex gap-2 min-w-max">
        {days.map(({ date, key }) => {
          const hasStamp = completedDateSet.has(key);
          const isSelected = activeKey === key;
          const dayName = DAY_NAMES_EN[date.getDay()];
          const dayNum = date.getDate();

          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectDate?.(key)}
              className={[
                'flex shrink-0 flex-col items-center justify-center rounded-xl px-4 py-2.5 min-w-[56px] transition',
                isSelected
                  ? 'bg-orange-500 text-white shadow-md'
                  : 'bg-white border-2 border-slate-200 text-slate-700 hover:border-slate-300',
              ].join(' ')}
            >
              <span className="text-xs font-semibold">{dayName}</span>
              <span className="text-base font-bold mt-0.5 relative">
                {dayNum}
                {hasStamp && (
                  <span
                    className={[
                      'absolute -bottom-0.5 left-1/2 -translate-x-1/2 size-1 rounded-full',
                      isSelected ? 'bg-white' : 'bg-emerald-500',
                    ].join(' ')}
                  />
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
