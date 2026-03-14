import previewModule from '../src/lib/session/next-session-preview.ts'

const {
  resolveBootstrapNextSessionPreview,
  resolvePostCompletionNextSessionPreview,
  resolveLockedNextSessionPreview,
} = previewModule

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
      { items: [{ name: '밴드 풀어파트' }, { name: '흉추 회전' }] },
    ],
  },
})

ok('today_completed=true 여도 bootstrap preview 유지', bootstrapPreview !== null)
ok('bootstrap preview에 exercise_count 포함', bootstrapPreview?.exercise_count === 3)
ok('bootstrap preview에 session_rationale 포함', typeof bootstrapPreview?.session_rationale === 'string')
ok('bootstrap preview에 exercises_preview 포함', bootstrapPreview?.exercises_preview.length === 3)

const postCompletionPreview = resolvePostCompletionNextSessionPreview({
  completedSessions: 3,
  total: 8,
  nextTheme: '가벼운 회복',
  nextSession: bootstrapPreview,
})

ok('post-completion은 서버 preview를 우선 사용', postCompletionPreview.exercise_count === 3)
ok('post-completion은 서버 rationale을 유지', postCompletionPreview.session_rationale === bootstrapPreview?.session_rationale)

const lockedPreview = resolveLockedNextSessionPreview({
  sessionId: 4,
  status: 'locked',
  isLockedNext: true,
  nextSession: bootstrapPreview,
})

ok('locked-next 패널도 동일 preview source 사용', lockedPreview?.session_number === bootstrapPreview?.session_number)
ok('locked-next 패널은 generic fallback으로 빠지지 않음', lockedPreview?.exercise_count === 3)

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
  nextSession: bootstrapPreview,
})

ok('locked preview는 session_number mismatch 시 비활성', mismatchedPreview === null)

console.log(`\nnext-session preview regression: ${passed} passed`)
