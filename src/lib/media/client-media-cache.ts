/**
 * client-media-cache.ts
 *
 * 클라이언트 공용 /api/media/sign 캐시 & inflight dedupe.
 *
 * 계약(SSOT, 서버 라우트와 동기화):
 *   Request : POST /api/media/sign
 *             Authorization: Bearer <token>
 *             body: { templateIds: string[] }   (max 50)
 *   Response: { results: Array<{ templateId: string; payload: MediaPayload; cache_ttl_sec: number }> }
 *
 * 캐시 정책:
 *   - per-template TTL 캐시 (서버 응답의 cache_ttl_sec 사용, 기본 60초)
 *   - placeholder 응답은 캐시하지 않음 → 재시도 시 항상 재호출
 *   - inflight dedupe: sorted templateIds key 기준 Promise 재사용
 *   - force=true 시 개별 캐시 제거 후 재호출 (inflight는 여전히 dedupe)
 */

export type MediaPayload = {
  kind: 'hls' | 'embed' | 'placeholder'
  streamUrl?: string
  embedUrl?: string
  posterUrl?: string
  durationSec?: number
  autoplayAllowed?: boolean
  notes?: string[]
}

const DEFAULT_TTL_MS = 60_000
const PLACEHOLDER_TTL_MS = 0 // placeholder는 캐시하지 않음

/** templateId → { payload, expiresAt } */
const _cache = new Map<string, { payload: MediaPayload; expiresAt: number }>()

/** sorted-ids-key → Promise<Record<string, MediaPayload>> */
const _inflight = new Map<string, Promise<Record<string, MediaPayload>>>()

function _makeKey(ids: string[]): string {
  return [...ids].sort().join(',')
}

function _isFresh(entry: { expiresAt: number }): boolean {
  return Date.now() < entry.expiresAt
}

/**
 * 배치로 /api/media/sign을 호출해 templateId → MediaPayload 맵을 반환한다.
 *
 * @param accessToken  Bearer 토큰
 * @param templateIds  요청할 templateId 목록 (빈 배열이면 즉시 {} 반환)
 * @param opts.force   true면 개별 캐시를 무효화하고 재호출
 */
export async function getSignedMediaPayloads(
  accessToken: string,
  templateIds: string[],
  opts?: { force?: boolean },
): Promise<Record<string, MediaPayload>> {
  const force = opts?.force ?? false

  // 1. 정규화: trim, 빈값 제거, 중복 제거
  const ids = [...new Set(templateIds.map(id => id.trim()).filter(Boolean))]
  if (ids.length === 0) return {}

  // 2. force 시 해당 templateId들의 캐시 무효화
  if (force) {
    for (const id of ids) _cache.delete(id)
  }

  // 3. 캐시 분류
  const result: Record<string, MediaPayload> = {}
  const needsFetch: string[] = []

  for (const id of ids) {
    const cached = _cache.get(id)
    if (cached && _isFresh(cached)) {
      result[id] = cached.payload
    } else {
      needsFetch.push(id)
    }
  }

  if (needsFetch.length === 0) return result

  // 4. inflight dedupe: 동일 key가 이미 날아가고 있으면 Promise 재사용
  const key = _makeKey(needsFetch)
  let promise = _inflight.get(key)

  if (!promise) {
    promise = (async (): Promise<Record<string, MediaPayload>> => {
      const res = await fetch('/api/media/sign', {
        method: 'POST',
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ templateIds: needsFetch }),
      })

      if (!res.ok) {
        // 캐시 오염 방지: 실패 시 inflight 제거 후 throw
        _inflight.delete(key)
        throw new Error(`[media/sign] HTTP ${res.status}`)
      }

      const data = (await res.json().catch(() => ({}))) as {
        results?: Array<{ templateId: string; payload: MediaPayload; cache_ttl_sec?: number }>
      }

      const now = Date.now()
      const fetched: Record<string, MediaPayload> = {}

      for (const r of data?.results ?? []) {
        if (!r?.templateId || !r?.payload) continue
        const payload = r.payload

        // placeholder는 캐시하지 않음 (재시도 가능하게)
        if (payload.kind !== 'placeholder') {
          const ttlMs = (r.cache_ttl_sec ?? DEFAULT_TTL_MS / 1000) * 1000
          _cache.set(r.templateId, { payload, expiresAt: now + ttlMs })
        } else {
          // placeholder TTL=0 → 캐시 저장하지 않아 다음 호출 시 재요청
          void PLACEHOLDER_TTL_MS // explicit no-op to document intent
        }

        fetched[r.templateId] = payload
      }

      _inflight.delete(key)
      return fetched
    })()

    _inflight.set(key, promise)
  }

  let fetched: Record<string, MediaPayload>
  try {
    fetched = await promise
  } catch (err) {
    _inflight.delete(key)
    throw err
  }

  return { ...result, ...fetched }
}

/** 특정 templateId의 캐시를 즉시 무효화한다 (어드민/재시도 등에서 사용) */
export function invalidateMediaCache(templateId: string): void {
  _cache.delete(templateId)
}
