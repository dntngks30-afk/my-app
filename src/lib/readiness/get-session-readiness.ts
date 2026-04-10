/**
 * PR-FLOW-06 — Canonical Session Readiness (SSOT, server-side READ ONLY)
 *
 * **공개 소비자 API** — 신규 코드는 여기서 아래만 import한다.
 *
 * - `getSessionReadiness` — 단일 진입 조회
 * - `UNAUTHENTICATED_SESSION_READINESS_V1` — 미인증 기본값
 *
 * 판정 순서 (한 가지 next_action만):
 * 1) 인증 2) 결제/실행 unlock 3) 분석 입력 4) 온보딩 최소 완료
 * 5) 활성 세션 6) 프로그램/일일 제한 7) 세션 생성 가능
 *
 * 구현(`loadReadinessContext`, `buildSessionReadinessV1`, `ReadinessContext`)은
 * 동일 모듈의 내부 파일에만 두어 export 표면을 좁힌다. 계산 규칙 변경 없음.
 *
 * @see src/lib/readiness/session-readiness-owner.internal.ts
 * @see src/lib/public-results/getLatestClaimedPublicResultForUser.ts
 */

export {
  getSessionReadiness,
  UNAUTHENTICATED_SESSION_READINESS_V1,
} from './session-readiness-owner.internal';
