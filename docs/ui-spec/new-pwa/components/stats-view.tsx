import { Flame, Target, Zap, TrendingUp } from 'lucide-react'

interface StatsViewProps {
  completed: number
  currentSession: number
}

export function StatsView({ completed, currentSession }: StatsViewProps) {
  const currentWeek = Math.min(4, Math.ceil(currentSession / 5))
  const streak = completed > 0 ? Math.min(completed, 7) : 0

  const stats = [
    { icon: Target, label: '완료 세션', value: `${completed}`, sub: '/ 20' },
    { icon: Flame, label: '연속 기록', value: `${streak}`, sub: '일' },
    { icon: Zap, label: '현재 주차', value: `${currentWeek}`, sub: '/ 4주' },
    { icon: TrendingUp, label: '달성률', value: `${Math.round((completed / 20) * 100)}%`, sub: '진행중' },
  ]

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6">
      <h2
        className="text-base font-semibold tracking-tight text-foreground mb-1"
        style={{ fontFamily: 'var(--font-heading)' }}
      >
        {'나의 진행 현황'}
      </h2>
      <p className="text-xs text-muted-foreground mb-6">{'리셋 여정을 확인하세요'}</p>

      <div className="grid grid-cols-2 gap-3">
        {stats.map((stat, i) => {
          const Icon = stat.icon
          return (
            <div
              key={i}
              className="rounded-xl border border-border/60 bg-secondary/30 p-4"
            >
              <Icon className="h-4 w-4 text-primary mb-3" />
              <p className="text-2xl font-bold tracking-tight text-foreground" style={{ fontFamily: 'var(--font-heading)' }}>
                {stat.value}
              </p>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mt-0.5">
                {stat.label}
              </p>
              <p className="text-[10px] text-muted-foreground/60 mt-0.5">{stat.sub}</p>
            </div>
          )
        })}
      </div>

      {/* Weekly breakdown */}
      <div className="mt-8">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">
          {'주간 분석'}
        </h3>
        {[1, 2, 3, 4].map(week => {
          const weekCompleted = Math.max(0, Math.min(5, completed - (week - 1) * 5))
          const barWidth = (weekCompleted / 5) * 100
          return (
            <div key={week} className="flex items-center gap-3 mb-3">
              <span className="w-12 text-[10px] font-medium text-muted-foreground tracking-wider">
                {`${week}주차`}
              </span>
              <div className="flex-1 h-2 rounded-full bg-border/50 overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${barWidth}%` }}
                />
              </div>
              <span className="w-8 text-right text-[10px] text-muted-foreground">
                {`${weekCompleted}/5`}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
