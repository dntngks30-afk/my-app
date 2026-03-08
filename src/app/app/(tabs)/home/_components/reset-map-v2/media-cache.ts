/**
 * 지도 세션 패널용 미디어 캐시 — prefetch + 모달 hit
 * /api/media/sign 배치 호출로 패널 open 시 1회 prefetch, 모달은 캐시 hit.
 */

export interface MediaPayload {
  kind: 'hls' | 'embed' | 'placeholder'
  streamUrl?: string
  embedUrl?: string
  posterUrl?: string
}

const cache = new Map<string, MediaPayload>()

export function getMediaPayload(templateId: string): MediaPayload | undefined {
  return cache.get(templateId)
}

export function setMediaPayload(templateId: string, payload: MediaPayload): void {
  cache.set(templateId, payload)
}

/** templateIds 배치 prefetch — 패널 open 시 1회 호출 */
export async function prefetchMediaSign(
  templateIds: string[],
  token: string
): Promise<void> {
  const needs = templateIds.filter(id => !cache.has(id))
  if (needs.length === 0) return
  try {
    const res = await fetch('/api/media/sign', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ templateIds: needs }),
    })
    if (res.ok) {
      const data = await res.json()
      for (const r of data.results ?? []) {
        if (r?.templateId && r?.payload) {
          cache.set(r.templateId, r.payload)
        }
      }
    }
  } catch {
    // prefetch 실패 시 모달에서 개별 fetch
  }
}
