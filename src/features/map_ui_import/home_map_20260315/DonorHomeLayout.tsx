'use client'

/**
 * DonorHomeLayout — donor prototype Home 화면 전체 시각 구조 이식
 *
 * donor app/page.tsx 구조를 그대로 적용.
 * - presentation = donor
 * - behavior = production (SessionPanelV2 등은 별도 레이어에서 연결)
 */
import { motion } from 'framer-motion'
import { ResetMap } from './components/reset-map'

const DONOR_BG = 'oklch(0.22_0.03_245)'
const DONOR_CARD_BG = 'oklch(0.26_0.03_245)'
const DONOR_BORDER = 'border-white/10'

export interface DonorHomeLayoutProps {
  total: number
  completed: number
  /** 현재 세션 라벨 (map-data 기반) — 이후 real data 연결 */
  currentSessionLabel?: string
}

const SESSION_LABELS: Record<number, string> = {
  1: '점화', 2: '기초', 3: '흐름', 4: '확장', 5: '균형', 6: '밀어내기',
  7: '통합', 8: '심화', 9: '각성', 10: '조화', 11: '완성', 12: '재도약',
  13: '강화', 14: '정렬', 15: '유연', 16: '집중', 17: '해방', 18: '회복',
  19: '숙달', 20: '마스터',
}

export function DonorHomeLayout({
  total,
  completed,
  currentSessionLabel,
}: DonorHomeLayoutProps) {
  const nextNum = Math.min(completed + 1, total)
  const label = currentSessionLabel ?? SESSION_LABELS[nextNum] ?? '—'

  return (
    <main
      className="relative flex min-h-screen flex-col pb-20"
      style={{ background: DONOR_BG }}
    >
      {/* Top Card — donor 구조 */}
      <motion.div
        className={`mx-4 mt-5 flex flex-1 flex-col overflow-hidden rounded-3xl border ${DONOR_BORDER}`}
        style={{ backgroundColor: DONOR_CARD_BG }}
        initial={{ y: -16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        {/* Card Header — donor와 동일 */}
        <div className="flex items-start justify-between border-b border-white/10 px-5 pt-5 pb-4">
          <div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-white/60">
              리셋 지도
            </p>
            <h1 className="text-[26px] font-bold leading-tight tracking-tight text-white">
              {completed} / {total}{' '}
              <span className="ml-1 text-lg font-medium text-white/60">세션 완료</span>
            </h1>
          </div>
          <div className="pt-1 text-right">
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-white/60">
              현재 세션
            </p>
            <p className="text-base font-semibold text-orange-500">{label}</p>
          </div>
        </div>

        {/* Map Container — donor: flex-1 min-h-0 p-3, minHeight 480 */}
        <div
          className="min-h-0 flex-1 p-3"
          style={{ minHeight: 480 }}
        >
          <ResetMap />
        </div>
      </motion.div>

      {/* Bottom Card — donor 진행 요약 */}
      <motion.div
        className={`mx-4 mt-3 mb-6 rounded-2xl border ${DONOR_BORDER} p-4`}
        style={{ backgroundColor: DONOR_CARD_BG }}
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut', delay: 0.1 }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="mb-1 text-sm font-semibold text-white">진행 요약</h2>
            <p className="text-xs leading-relaxed text-white/60">
              {completed >= 4
                ? '최근 4세션 데이터를 기반으로 진행도를 확인할 수 있습니다.'
                : '아직 최근 4세션 데이터가 충분하지 않습니다.'}
            </p>
          </div>
          <div className="flex gap-1">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`h-2 w-2 rounded-full ${
                  i <= Math.min(completed, 4) ? 'bg-orange-500' : 'bg-white/20'
                }`}
              />
            ))}
          </div>
        </div>
      </motion.div>
    </main>
  )
}
