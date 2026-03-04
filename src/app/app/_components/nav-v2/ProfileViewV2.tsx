'use client'

import { Settings, ChevronRight } from 'lucide-react'

interface ProfileViewV2Props {
  completed: number
}

export function ProfileViewV2({ completed }: ProfileViewV2Props) {
  const level = completed >= 15 ? '고급' : completed >= 8 ? '중급' : '초급'

  const menuItems = [
    { label: '훈련 설정', sub: '난이도 및 목표 조정' },
    { label: '알림', sub: '리마인더 및 알림 설정' },
    { label: '진행 초기화', sub: '여정을 처음부터 시작' },
    { label: 'Move Re 소개', sub: '버전 1.0' },
  ]

  return (
    <div className="overflow-y-auto px-4 py-5">
      {/* 프로필 카드 */}
      <div className="flex items-center gap-4 mb-8">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-900 text-white text-lg font-bold">
          M
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-800">무버</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {`레벨: ${level}`}
            <span className="mx-1 text-slate-300">|</span>
            {`${completed}세션 완료`}
          </p>
        </div>
        <button
          className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          aria-label="설정"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>

      {/* 메뉴 */}
      <div className="space-y-1">
        {menuItems.map((item, i) => (
          <button
            key={i}
            className="flex w-full items-center justify-between rounded-xl px-4 py-3.5 text-left transition-colors hover:bg-slate-50 group"
          >
            <div>
              <p className="text-sm text-slate-800">{item.label}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{item.sub}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-0.5" />
          </button>
        ))}
      </div>
    </div>
  )
}
