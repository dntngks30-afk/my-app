import bootstrapClientModule from '../src/lib/app/bootstrapClient.ts'
import cacheModule from '../src/lib/cache/tabDataCache.ts'

const {
  getAppBootstrapCacheSnapshot,
  invalidateAppBootstrapCache,
  revalidateAppBootstrap,
} = bootstrapClientModule

const { setCache, invalidateCache } = cacheModule

let passed = 0

function ok(name, condition) {
  if (!condition) throw new Error(name)
  passed += 1
  console.log(`  ✓ ${name}`)
}

function buildBootstrapPayload({
  completedSessions = 3,
  totalSessions = 8,
  todayCompleted = true,
  nextUnlockAt = '2026-03-15T00:00:00.000Z',
  nextSession = null,
} = {}) {
  return {
    user: {
      id: 'user-1',
      plan_status: 'active',
    },
    session: {
      active_session: null,
      completed_sessions: completedSessions,
      total_sessions: totalSessions,
      today_completed: todayCompleted,
      next_unlock_at: nextUnlockAt,
    },
    next_session: nextSession,
    adaptive_explanation: null,
    stats_preview: {
      completed_sessions: completedSessions,
      weekly_streak: 1,
    },
    reset_map: {
      active_flow: null,
      should_start: false,
    },
  }
}

function buildNextSessionPreview(sessionNumber = 4) {
  return {
    session_number: sessionNumber,
    focus_axes: ['upper_mobility'],
    estimated_time: 13,
    exercise_count: 3,
    session_rationale: '상체 가동성과 몸통 정렬을 이어가는 다음 세션입니다',
    exercises_preview: ['벽 슬라이드', '스탠딩 W 리트랙션', '흉추 회전'],
  }
}

function makeFetchResponse({ ok: isOk, status = 200, statusText = 'OK', body }) {
  return {
    ok: isOk,
    status,
    statusText,
    async json() {
      return body
    },
  }
}

function resetClientCaches() {
  invalidateAppBootstrapCache()
  invalidateCache('home.activeLite')
  invalidateCache('home.bootstrap')
}

const originalFetch = global.fetch

try {
  resetClientCaches()

  const cachedPayload = buildBootstrapPayload({
    nextSession: null,
  })
  const freshPreview = buildNextSessionPreview(4)
  const freshPayload = buildBootstrapPayload({
    nextSession: freshPreview,
  })

  setCache('app.bootstrap', cachedPayload)

  let fetchCalls = 0
  global.fetch = async () => {
    fetchCalls += 1
    return makeFetchResponse({
      ok: true,
      body: { ok: true, data: freshPayload },
    })
  }

  const cachedSnapshot = getAppBootstrapCacheSnapshot()
  ok('cache hit 시 snapshot을 즉시 읽을 수 있음', cachedSnapshot?.next_session === null)

  const revalidated = await revalidateAppBootstrap('token-123')
  ok('cache hit 이어도 fresh bootstrap fetch가 생략되지 않음', fetchCalls === 1)
  ok('fresh bootstrap fetch 성공', revalidated.ok === true)
  ok('fresh bootstrap의 valid nextSession이 반환됨', revalidated.ok && revalidated.data.next_session?.session_number === 4)

  const updatedSnapshot = getAppBootstrapCacheSnapshot()
  ok('fresh bootstrap 이후 cached nextSession이 최신값으로 갱신됨', updatedSnapshot?.next_session?.session_number === 4)
  ok('locked-next preview용 nextSession 번호가 실제 next와 일치', updatedSnapshot?.next_session?.session_number === updatedSnapshot?.session.completed_sessions + 1)

  resetClientCaches()

  const failureCachedPayload = buildBootstrapPayload({
    nextSession: null,
  })
  setCache('app.bootstrap', failureCachedPayload)

  fetchCalls = 0
  global.fetch = async () => {
    fetchCalls += 1
    return makeFetchResponse({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      body: { error: { code: 'INTERNAL_ERROR', message: 'boom' } },
    })
  }

  const failed = await revalidateAppBootstrap('token-123')
  ok('fresh bootstrap 실패도 promise는 안전하게 반환', failed.ok === false)
  ok('fresh bootstrap 실패 시에도 fetch는 시도됨', fetchCalls === 1)
  ok('fresh bootstrap 실패 시 cached snapshot 유지', getAppBootstrapCacheSnapshot()?.next_session === null)

  resetClientCaches()

  setCache('app.bootstrap', {
    version: 0,
    data: cachedPayload,
  })
  ok('version mismatch cache는 무시됨', getAppBootstrapCacheSnapshot() === null)

  console.log(`\nbootstrap cache revalidate regression: ${passed} passed`)
} finally {
  global.fetch = originalFetch
  resetClientCaches()
}
