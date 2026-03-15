'use client'

/**
 * ImportedHomeMap — 프로토타입 맵 UI 어댑터
 *
 * donor: home-map-20260315 ResetMap을 앱 구조에 맞게 래핑.
 * - donor 앱 셸·bottom nav 의존 없음
 * - 이후 real session data 연결을 위한 props 인터페이스 준비
 */
import { ResetMap } from './components/reset-map'

export interface ImportedHomeMapProps {
  /** 이후 total/completed 세션 연결용 (현재 미사용) */
  total?: number
  completed?: number
}

export function ImportedHomeMap({ total, completed }: ImportedHomeMapProps = {}) {
  // 현재는 시각적 프로토타입만 렌더. total/completed는 나중에 ResetMap에 전달
  return (
    <div
      className="flex flex-col overflow-hidden rounded-2xl border-2 border-slate-900 bg-white shadow-[4px_4px_0_0_rgba(15,23,42,1)]"
      style={{ height: '70vh', maxHeight: 560 }}
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-orange-500">리셋 지도</p>
          <p className="mt-0.5 text-sm font-bold text-slate-800">프로토타입 지도 UI</p>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden p-4">
        <ResetMap />
      </div>
    </div>
  )
}
