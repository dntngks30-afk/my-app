'use client'

import { Flame, Target, Zap, TrendingUp } from 'lucide-react'

interface StatsViewV2Props {
  completed: number
  currentSession: number
  totalSessions?: number
}

export function StatsViewV2({ completed, currentSession, totalSessions = 20 }: StatsViewV2Props) {
  const currentWeek = Math.min(4, Math.ceil(currentSession / 5))
  const streak = completed > 0 ? Math.min(completed, 7) : 0
  const pct = totalSessions > 0 ? Math.round((completed / totalSessions) * 100) : 0

  const stats = [
    { icon: Target, label: '완료 세션', value: `${completed}`, sub: `/ ${totalSessions}` },
    { icon: Flame, label: '연속 기록', value: `${streak}`, sub: '일' },
    { icon: Zap, label: '현재 주차', value: `${currentWeek}`, sub: '/ 4주' },
    { icon: TrendingUp, label: '달성률', value: `${pct}%`, sub: '진행중' },
  ]

  return (
    <div className="overflow-y-auto px-4 py-5">
      <h2 className="text-base font-semibold text-slate-800 mb-0.5">나의 진행 현황</h2>
      <p className="text-xs text-slate-500 mb-5">리셋 여정을 확인하세요</p>

      {/* 통계 카드 4개 */}
      <div className="grid grid-cols-2 gap-3 mb-8">
        {stats.map((stat, i) => {
          const Icon = stat.icon
          return (
            <div
              key={i}
              className="rounded-xl border border-slate-200 bg-slate-50 p-4"
            >
              <Icon className="h-4 w-4 text-orange-500 mb-3" />
              <p className="text-2xl font-bold text-slate-800">{stat.value}</p>
              <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mt-0.5">
                {stat.label}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">{stat.sub}</p>
            </div>
          )
        })}
      </div>

      {/* 주간 분석 */}
      <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-4">
        주간 분석
      </h3>
      <div className="space-y-3">
        {[1, 2, 3, 4].map(week => {
          const weekCompleted = Math.max(0, Math.min(5, completed - (week - 1) * 5))
          const barWidth = (weekCompleted / 5) * 100
          return (
            <div key={week} className="flex items-center gap-3">
              <span className="w-12 text-[10px] font-medium text-slate-500 tracking-wider">
                {`${week}주차`}
              </span>
              <div className="flex-1 h-2 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full rounded-full bg-orange-400 transition-all duration-500"
                  style={{ width: `${barWidth}%` }}
                />
              </div>
              <span className="w-8 text-right text-[10px] text-slate-400">
                {`${weekCompleted}/5`}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
