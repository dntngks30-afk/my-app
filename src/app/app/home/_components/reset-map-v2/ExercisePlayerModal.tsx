'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { X, CheckCircle2, RefreshCw } from 'lucide-react'
import { getSessionSafe } from '@/lib/supabase'
import { getSignedMediaPayloads, type MediaPayload } from '@/lib/media/client-media-cache'
import type { ExerciseItem } from './planJsonAdapter'
import type { ExerciseLogItem } from '@/lib/session/client'

interface ExercisePlayerModalProps {
  item: ExerciseItem | null
  initialLog?: ExerciseLogItem
  onClose: () => void
  onComplete: (log: ExerciseLogItem) => void
}

export function ExercisePlayerModal({ item, initialLog, onClose, onComplete }: ExercisePlayerModalProps) {
  if (!item) return null
  return (
    <ModalInner
      item={item}
      initialLog={initialLog}
      onClose={onClose}
      onComplete={onComplete}
    />
  )
}

/* ─── 내부 컴포넌트 (item이 확정된 상태) ─────────────────────── */

function ModalInner({
  item,
  initialLog,
  onClose,
  onComplete,
}: {
  item: ExerciseItem
  initialLog?: ExerciseLogItem
  onClose: () => void
  onComplete: (log: ExerciseLogItem) => void
}) {
  const [media, setMedia] = useState<MediaPayload | null>(null)
  const [mediaLoading, setMediaLoading] = useState(true)
  const [mediaError, setMediaError] = useState(false)
  const [sets, setSets] = useState(String(initialLog?.sets ?? item.targetSets ?? 3))
  const [reps, setReps] = useState(String(initialLog?.reps ?? item.targetReps ?? ''))
  const [difficulty, setDifficulty] = useState<number | null>(initialLog?.difficulty ?? null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<{ destroy: () => void } | null>(null)

  /* 미디어 로드 — 공용 캐시/inflight 사용 */
  const loadMedia = useCallback(async (force = false) => {
    setMediaLoading(true)
    setMediaError(false)
    try {
      const { session } = await getSessionSafe()
      if (!session?.access_token) {
        setMedia({ kind: 'placeholder' })
        return
      }
      const payloads = await getSignedMediaPayloads(
        session.access_token,
        [item.templateId],
        { force },
      )
      setMedia(payloads[item.templateId] ?? { kind: 'placeholder' })
    } catch {
      setMediaError(true)
      setMedia({ kind: 'placeholder' })
    } finally {
      setMediaLoading(false)
    }
  }, [item.templateId])

  useEffect(() => {
    let cancelled = false
    loadMedia().then(() => {
      if (cancelled) { setMedia(null); setMediaLoading(true) }
    })
    return () => { cancelled = true }
  }, [loadMedia])

  /* HLS 플레이어 연결 */
  useEffect(() => {
    if (!media || media.kind !== 'hls' || !media.streamUrl) return
    const video = videoRef.current
    if (!video) return
    let destroyed = false
    import('hls.js').then(({ default: HlsLib }) => {
      if (destroyed || !video) return
      if (HlsLib.isSupported()) {
        const hls = new HlsLib()
        hlsRef.current = hls
        hls.loadSource(media.streamUrl!)
        hls.attachMedia(video)
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = media.streamUrl!
      }
    })
    return () => {
      destroyed = true
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null }
      else if (video) { video.src = '' }
    }
  }, [media?.kind, media?.streamUrl])

  const handleComplete = () => {
    const setsNum = parseInt(sets, 10)
    const repsNum = parseInt(reps, 10)
    onComplete({
      templateId: item.templateId,
      name: item.name,
      sets: Number.isNaN(setsNum) ? null : Math.min(20, Math.max(0, setsNum)),
      reps: Number.isNaN(repsNum) ? null : Math.min(200, Math.max(0, repsNum)),
      difficulty,
    })
  }

  return (
    <>
      {/* Backdrop (z-[60] — SessionPanelV2의 z-50보다 높게) */}
      <div
        className="fixed inset-0 z-[60] bg-black/60 animate-in fade-in"
        style={{ animationDuration: '150ms' }}
        onClick={onClose}
        aria-hidden
      />

      {/* Sheet */}
      <div
        className="fixed inset-x-0 bottom-0 z-[70] animate-in slide-in-from-bottom-4"
        style={{ animationDuration: '250ms', animationTimingFunction: 'cubic-bezier(0.2,0,0,1)' }}
      >
        <div className="mx-auto max-w-[430px] overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl">
          {/* 헤더 */}
          <div className="flex items-start justify-between border-b border-slate-100 px-5 pt-4 pb-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                {item.segmentTitle}
              </p>
              <h3 className="text-base font-bold text-slate-800">{item.name}</h3>
              {(item.targetSets || item.targetReps || item.holdSeconds) && (
                <p className="mt-0.5 text-xs text-slate-500">
                  {item.targetSets && item.targetReps
                    ? `목표: ${item.targetSets}세트 × ${item.targetReps}회`
                    : item.holdSeconds
                      ? `목표: ${item.holdSeconds}초 유지`
                      : null}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              aria-label="모달 닫기"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* 영상 영역 */}
          <div className="bg-black">
            {mediaLoading ? (
              <div className="flex aspect-video items-center justify-center bg-slate-800">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-500 border-t-slate-300" />
              </div>
            ) : media?.kind === 'hls' && media.streamUrl ? (
              <div className="aspect-video">
                <video
                  ref={videoRef}
                  className="h-full w-full object-contain"
                  playsInline
                  controls
                  poster={media.posterUrl}
                />
              </div>
            ) : media?.kind === 'embed' && media.embedUrl ? (
              <div className="aspect-video">
                <iframe
                  src={media.embedUrl}
                  className="h-full w-full"
                  allowFullScreen
                  title={item.name}
                />
              </div>
            ) : (
              <div className="flex aspect-video flex-col items-center justify-center gap-3 bg-slate-800">
                <p className="text-sm text-slate-400">영상 준비 중</p>
                {mediaError ? (
                  <button
                    type="button"
                    onClick={() => loadMedia(true)}
                    className="flex items-center gap-1.5 rounded-lg bg-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-600 transition-colors"
                  >
                    <RefreshCw className="h-3 w-3" />
                    다시 시도
                  </button>
                ) : (
                  <p className="text-xs text-slate-500">텍스트 가이드를 참고해 주세요</p>
                )}
              </div>
            )}
          </div>

          {/* 입력 영역 */}
          <div className="space-y-4 px-5 py-4 pb-8">
            {/* sets × reps */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  세트 수
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  max="20"
                  value={sets}
                  onChange={e => setSets(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-center text-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  회 / 세트
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  max="200"
                  value={reps}
                  onChange={e => setReps(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-center text-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
              </div>
            </div>

            {/* 난이도 1-5 */}
            <div>
              <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                체감 난이도 (선택)
              </label>
              <div className="flex gap-2">
                {([1, 2, 3, 4, 5] as const).map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDifficulty(prev => prev === d ? null : d)}
                    className={[
                      'flex-1 rounded-xl py-2.5 text-sm font-semibold transition-colors',
                      difficulty === d
                        ? 'bg-orange-400 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                    ].join(' ')}
                    aria-pressed={difficulty === d}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* 완료 버튼 */}
            <button
              type="button"
              onClick={handleComplete}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 active:scale-[0.98]"
            >
              <CheckCircle2 className="h-4 w-4" />
              이 운동 완료
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
