import previewModule from '../src/lib/session/next-session-preview.ts'
import recoveryModule from '../src/lib/session/locked-preview-recovery.ts'

const {
  resolveBootstrapNextSessionPreview,
  resolvePostCompletionNextSessionPreview,
  resolveLockedNextSessionPreview,
  buildLockedNextPreviewFromBootstrapResponse,
  buildNextSessionPreviewFromPlanJson,
  normalizeNextSessionPreviewForDisplay,
  getNextSessionFocusLabel,
  isUsableNextSessionPreview,
  isDisplayReadyNextSessionPreview,
  getLockedNextPreviewRecoveryReason,
} = previewModule

const {
  getSessionBootstrapFetchStrategy,
  shouldShowLockedPreviewLoadingState,
} = recoveryModule

let passed = 0

function ok(name, condition) {
  if (!condition) throw new Error(name)
  passed += 1
  console.log(`  ✓ ${name}`)
}

const bootstrapPreview = resolveBootstrapNextSessionPreview({
  completedSessions: 3,
  totalSessions: 8,
  todayCompleted: true,
  bootstrapSummary: {
    focus_axes: ['upper_mobility', 'trunk_control'],
    estimated_duration: 780,
    segments: [
      { items: [{ name: '벽 슬라이드' }] },
      { items: [{ name: '스탠딩 W 리트랙션' }, { name: '흉추 회전' }] },
    ],
  },
})

ok('today_completed=true 여도 bootstrap preview 유지', bootstrapPreview !== null)
ok('today_completed=true preview는 실제 next session 번호 사용', bootstrapPreview?.session_number === 4)
ok('bootstrap preview에 exercise_count 포함', bootstrapPreview?.exercise_count === 3)
ok('bootstrap preview에 session_rationale 포함', typeof bootstrapPreview?.session_rationale === 'string')
ok('bootstrap preview에 exercises_preview 포함', bootstrapPreview?.exercises_preview.length === 3)

const staleActiveAfterCompletion = resolveBootstrapNextSessionPreview({
  completedSessions: 3,
  totalSessions: 8,
  todayCompleted: true,
  activeSessionPlan: {
    session_number: 3,
    estimatedTime: 99,
    planJson: {
      meta: {
        session_focus_axes: ['deconditioned'],
        session_rationale: 'stale active preview',
      },
      segments: [{ items: [{ name: '이전 세션 운동' }] }],
    },
  },
  bootstrapSummary: {
    focus_axes: ['upper_mobility', 'trunk_control'],
    estimated_duration: 780,
    segments: [
      { items: [{ name: '벽 슬라이드' }] },
      { items: [{ name: '스탠딩 W 리트랙션' }, { name: '흉추 회전' }] },
    ],
  },
})

ok('completion 직후 stale active session은 next preview source로 사용하지 않음', staleActiveAfterCompletion?.session_number === 4)
ok('stale active 대신 next summary exercise count 사용', staleActiveAfterCompletion?.exercise_count === 3)

const staleActiveWithoutTodayCompleted = resolveBootstrapNextSessionPreview({
  completedSessions: 3,
  totalSessions: 8,
  todayCompleted: false,
  activeSessionPlan: {
    session_number: 3,
    estimatedTime: 99,
    planJson: {
      meta: {
        session_focus_axes: ['deconditioned'],
        session_rationale: 'stale active preview',
      },
      segments: [{ items: [{ name: '이전 세션 운동' }] }],
    },
  },
  bootstrapSummary: {
    focus_axes: ['upper_mobility'],
    estimated_duration: 600,
    segments: [{ items: [{ name: '다음 세션 운동' }, { name: '호흡 정렬' }] }],
  },
})

ok('activeSession.session_number <= completed_sessions 이면 stale active로 처리', staleActiveWithoutTodayCompleted?.session_number === 4)
ok('stale active는 summary preview로 대체', staleActiveWithoutTodayCompleted?.exercise_count === 2)

const postCompletionPreview = resolvePostCompletionNextSessionPreview({
  completedSessions: 3,
  total: 8,
  nextTheme: '가벼운 회복',
  nextSession: staleActiveAfterCompletion,
})

ok('post-completion은 서버 preview를 우선 사용', postCompletionPreview.exercise_count === 3)
ok('post-completion은 실제 next session 번호 기준 preview를 사용', postCompletionPreview.session_number === 4)
ok('post-completion은 서버 rationale을 유지', postCompletionPreview.session_rationale === staleActiveAfterCompletion?.session_rationale)

const lockedPreview = resolveLockedNextSessionPreview({
  sessionId: 4,
  status: 'locked',
  isLockedNext: true,
  nextSession: staleActiveAfterCompletion,
})

ok('locked-next 패널도 동일 preview source 사용', lockedPreview?.session_number === staleActiveAfterCompletion?.session_number)
ok('locked-next 패널은 generic fallback으로 빠지지 않음', lockedPreview?.exercise_count === 3)

const activeInProgressPreview = resolveBootstrapNextSessionPreview({
  completedSessions: 3,
  totalSessions: 8,
  todayCompleted: false,
  activeSessionPlan: {
    session_number: 4,
    estimatedTime: 14,
    planJson: {
      meta: {
        session_focus_axes: ['trunk_control'],
        session_rationale: '진행 중 active preview',
      },
      segments: [{ items: [{ name: '데드버그' }, { name: '버드독' }] }],
    },
  },
  bootstrapSummary: {
    focus_axes: ['upper_mobility'],
    estimated_duration: 600,
    segments: [{ items: [{ name: '다른 요약 운동' }] }],
  },
})

ok('진짜 active session 진행 중에는 active preview 유지', activeInProgressPreview?.session_number === 4)
ok('진짜 active session 진행 중에는 active plan 데이터 사용', activeInProgressPreview?.exercise_count === 2)

const fallbackPreview = resolvePostCompletionNextSessionPreview({
  completedSessions: 3,
  total: 8,
  nextTheme: '회복 흐름',
  nextSession: null,
})

ok('서버 preview가 없을 때만 fallback 사용', fallbackPreview.exercise_count === 0)
ok('fallback은 nextTheme 라벨을 유지', fallbackPreview.focus_label === '회복 흐름')

const mismatchedPreview = resolveLockedNextSessionPreview({
  sessionId: 5,
  status: 'locked',
  isLockedNext: true,
  nextSession: staleActiveAfterCompletion,
})

ok('locked preview는 session_number mismatch 시 비활성', mismatchedPreview === null)
ok(
  'current 세션 패널에서는 locked preview를 렌더하지 않음',
  resolveLockedNextSessionPreview({
    sessionId: 4,
    status: 'current',
    isLockedNext: true,
    nextSession: staleActiveAfterCompletion,
  }) === null
)
ok(
  'completed 세션 패널에서는 locked preview를 렌더하지 않음',
  resolveLockedNextSessionPreview({
    sessionId: 4,
    status: 'completed',
    isLockedNext: true,
    nextSession: staleActiveAfterCompletion,
  }) === null
)
ok(
  'locked-next가 아닌 locked 패널에서는 locked preview를 렌더하지 않음',
  resolveLockedNextSessionPreview({
    sessionId: 4,
    status: 'locked',
    isLockedNext: false,
    nextSession: staleActiveAfterCompletion,
  }) === null
)

ok('유효한 locked preview payload는 usable=true', isUsableNextSessionPreview(staleActiveAfterCompletion, 4) === true)

const unusableThinPreview = {
  session_number: 4,
  focus_axes: [],
  estimated_time: 11,
  exercise_count: 0,
  session_rationale: null,
  exercises_preview: [],
}
ok('thin preview payload는 unusable로 처리', isUsableNextSessionPreview(unusableThinPreview, 4) === false)
ok('thin preview payload는 display-ready=false', isDisplayReadyNextSessionPreview(unusableThinPreview, 4) === false)
ok(
  'null prop preview는 missing_prop_preview reason 반환',
  getLockedNextPreviewRecoveryReason({
    sessionId: 4,
    status: 'locked',
    isLockedNext: true,
    nextSession: null,
  }) === 'missing_prop_preview'
)
ok(
  'mismatch preview는 mismatched_session_number reason 반환',
  getLockedNextPreviewRecoveryReason({
    sessionId: 5,
    status: 'locked',
    isLockedNext: true,
    nextSession: staleActiveAfterCompletion,
  }) === 'mismatched_session_number'
)
ok(
  'thin preview는 unusable_preview_payload reason 반환',
  getLockedNextPreviewRecoveryReason({
    sessionId: 4,
    status: 'locked',
    isLockedNext: true,
    nextSession: unusableThinPreview,
  }) === 'unusable_preview_payload'
)

// PR-NEXT-04: locked-next fallback fetch 시나리오
const lockedNullProp = resolveLockedNextSessionPreview({
  sessionId: 4,
  status: 'locked',
  isLockedNext: true,
  nextSession: null,
})
ok('locked-next nextSession null이면 prop preview 없음 → fallback fetch 필요', lockedNullProp === null)

const lockedFromBootstrap = buildLockedNextPreviewFromBootstrapResponse({
  session_number: 4,
  focus_axes: ['trunk_control', 'upper_mobility'],
  estimated_duration: 720,
  segments: [
    { items: [{ name: '벽 슬라이드' }] },
    { items: [{ name: '스탠딩 W 리트랙션' }, { name: '흉추 회전' }] },
  ],
})
ok('buildLockedNextPreviewFromBootstrapResponse는 유효 payload 반환', lockedFromBootstrap.session_number === 4)
ok('bootstrap response → preview payload 변환 성공', lockedFromBootstrap.exercise_count === 3)
ok('bootstrap response → focus_axes 유지', lockedFromBootstrap.focus_axes?.length === 2)
ok('bootstrap response payload는 usable=true', isUsableNextSessionPreview(lockedFromBootstrap, 4) === true)

const lockedFromPlanJson = buildNextSessionPreviewFromPlanJson({
  sessionNumber: 5,
  planJson: {
    meta: {
      session_focus_axes: ['lower_stability'],
      session_rationale: '하체 안정 중심',
    },
    segments: [{ items: [{ name: '스쿼트' }, { name: '런지' }] }],
  },
  estimatedTime: 14,
})
ok('buildNextSessionPreviewFromPlanJson fallback path 유효', lockedFromPlanJson.session_number === 5)
ok('planJson fallback exercise_count', lockedFromPlanJson.exercise_count === 2)
ok('planJson fallback payload는 usable=true', isUsableNextSessionPreview(lockedFromPlanJson, 5) === true)

const focusOnlyPreview = normalizeNextSessionPreviewForDisplay({
  session_number: 6,
  focus_axes: ['upper_mobility'],
  estimated_time: 0,
  exercise_count: 0,
  session_rationale: null,
  exercises_preview: [],
})
ok('focus_axes만 있으면 focus label 자동 생성', focusOnlyPreview?.focus_label === '상체 가동성')
ok('focus_axes만 있으면 rationale 자동 생성', typeof focusOnlyPreview?.session_rationale === 'string' && focusOnlyPreview.session_rationale.length > 0)
ok('focus_axes 기반 payload는 정규화 후 display-ready', isDisplayReadyNextSessionPreview(focusOnlyPreview, 6) === true)

const countOnlyPreview = normalizeNextSessionPreviewForDisplay({
  session_number: 7,
  focus_axes: [],
  estimated_time: 0,
  exercise_count: 3,
  session_rationale: null,
  exercises_preview: [],
})
ok('exercise_count만 있으면 안전 요약 문구 생성', countOnlyPreview?.exercises_preview?.[0] === '운동 3개 구성')
ok('exercise_count 기반 payload는 정규화 후 estimated_time 기본값 보강', countOnlyPreview?.estimated_time === 12)
ok('exercise_count 기반 payload는 정규화 후 display-ready', isDisplayReadyNextSessionPreview(countOnlyPreview, 7) === true)

const fallbackThinPreview = normalizeNextSessionPreviewForDisplay({
  session_number: 8,
  focus_axes: ['trunk_control'],
  estimated_time: 0,
  exercise_count: 2,
  session_rationale: null,
  exercises_preview: [],
})
ok('fallback success 후 thin payload도 label/rationale 보강', fallbackThinPreview?.focus_label === '몸통 제어')
ok('fallback success 후 thin payload도 blank-looking card가 아님', isDisplayReadyNextSessionPreview(fallbackThinPreview, 8) === true)

const propThinPreview = normalizeNextSessionPreviewForDisplay({
  session_number: 9,
  focus_axes: [],
  estimated_time: 15,
  exercise_count: 4,
  session_rationale: '하체 중심 흐름을 이어갑니다',
  exercises_preview: [],
})
ok('prop preview도 동일 normalization 경로 사용', propThinPreview?.exercises_preview?.[0] === '운동 4개 구성')
ok('prop preview thin payload도 display contract 충족', isDisplayReadyNextSessionPreview(propThinPreview, 9) === true)

ok('복수 focus_axes는 한글 라벨 요약 가능', getNextSessionFocusLabel(['upper_mobility', 'trunk_control']) === '상체 가동성 · 몸통 제어')

ok('forceRefresh=true면 network-first 전략 사용', getSessionBootstrapFetchStrategy({ forceRefresh: true }) === 'network-first')
ok('forceRefresh 없으면 cache-first 전략 사용', getSessionBootstrapFetchStrategy() === 'cache-first')

ok(
  'fallback fetch 진행 중에는 loading state를 유지',
  shouldShowLockedPreviewLoadingState({
    status: 'locked',
    isLockedNext: true,
    sessionId: 4,
    effectiveLockedPreview: null,
    recoveryReason: 'missing_prop_preview',
    fallbackFetchState: 'loading',
  }) === true
)
ok(
  'fallback fetch 실패 전 idle 상태에서도 generic fallback 즉시 노출하지 않음',
  shouldShowLockedPreviewLoadingState({
    status: 'locked',
    isLockedNext: true,
    sessionId: 4,
    effectiveLockedPreview: null,
    recoveryReason: 'unusable_preview_payload',
    fallbackFetchState: 'idle',
  }) === true
)
ok(
  'fallback fetch 실패 후에만 loading state가 꺼짐',
  shouldShowLockedPreviewLoadingState({
    status: 'locked',
    isLockedNext: true,
    sessionId: 4,
    effectiveLockedPreview: null,
    recoveryReason: 'missing_prop_preview',
    fallbackFetchState: 'failed',
  }) === false
)

console.log(`\nnext-session preview regression: ${passed} passed`)
