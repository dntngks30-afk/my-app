process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://example.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'test-anon-key'

const routeModule = await import('../src/app/api/session/bootstrap/route.ts')

const { shouldAllowTodayCompletedBootstrapPreview } = routeModule

let passed = 0

function ok(name, condition) {
  if (!condition) throw new Error(name)
  passed += 1
  console.log(`  ✓ ${name}`)
}

ok(
  'today_completed + explicit next session request는 preview-only bootstrap 허용',
  shouldAllowTodayCompletedBootstrapPreview({
    todayCompleted: true,
    requestedSessionNumber: 4,
    nextSessionNumber: 4,
  }) === true
)

ok(
  'today_completed + session_number 없음은 여전히 차단',
  shouldAllowTodayCompletedBootstrapPreview({
    todayCompleted: true,
    requestedSessionNumber: null,
    nextSessionNumber: 4,
  }) === false
)

ok(
  'today_completed + 다른 session_number 요청은 허용하지 않음',
  shouldAllowTodayCompletedBootstrapPreview({
    todayCompleted: true,
    requestedSessionNumber: 3,
    nextSessionNumber: 4,
  }) === false
)

ok(
  'today_completed=false면 preview-only 예외 없이 false',
  shouldAllowTodayCompletedBootstrapPreview({
    todayCompleted: false,
    requestedSessionNumber: 4,
    nextSessionNumber: 4,
  }) === false
)

console.log(`\nsession bootstrap preview allowance regression: ${passed} passed`)
