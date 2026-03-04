'use client'

import { Map, BarChart3, User } from 'lucide-react'

type Tab = 'map' | 'stats' | 'my'

interface BottomNavProps {
  active: Tab
  onTabChange: (tab: Tab) => void
}

const tabs: { id: Tab; label: string; icon: typeof Map }[] = [
  { id: 'map', label: '지도', icon: Map },
  { id: 'stats', label: '통계', icon: BarChart3 },
  { id: 'my', label: '내 정보', icon: User },
]

export function BottomNav({ active, onTabChange }: BottomNavProps) {
  return (
    <nav
      className="relative z-10 shrink-0 border-t border-border/60 bg-card/90 backdrop-blur-xl"
      role="tablist"
      aria-label="메인 내비게이션"
    >
      <div className="flex items-center justify-around px-6 py-2.5 pb-5">
        {tabs.map((tab) => {
          const isActive = active === tab.id
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center gap-1 px-4 py-1 transition-colors ${
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-secondary-foreground'
              }`}
            >
              <Icon className="h-5 w-5" strokeWidth={isActive ? 2 : 1.5} />
              <span className={`text-[10px] tracking-wide ${isActive ? 'font-semibold' : 'font-medium'}`}>
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
