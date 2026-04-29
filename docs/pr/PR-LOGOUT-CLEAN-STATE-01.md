# PR-LOGOUT-CLEAN-STATE-01 — 로그아웃 시 클라이언트 상태 정리 후 public landing 복귀

## 목적

여정 탭(및 프로필 등)에서 로그아웃 시 **이 브라우저에 남은 MOVE RE 클라이언트 상태**를 정리한 뒤 **`/`(public landing)** 으로 이동하여, 신규 방문자처럼 public-first 퍼널을 다시 시작할 수 있게 한다.

## 변경 파일

| 파일 | 변경 요약 |
|------|------------|
| `src/lib/auth/performAppLogout.ts` | 리다이렉트 기본값 `/`, 필요 시 `redirectTo` 옵션. `clearMoveReClientStateForLogout` 강화(파일럿·prefix 스캔). `signOut` 실패 시에도 `finally`에서 `/` 이동 |

## 정리 대상 (이 PR)

- 기존 유지: Tab/Bootstrap/Active 캐시 invalidate, bridge/handoff, session draft, reset-map, camera trace, readiness 플래그, 타깃 스토리지 키 목록
- **추가:** `clearPilotContext()`, `removeMoveReLocalStorageByScan()` (`moveRe*` / `movementTest*` / `movere` / `movement-test-result` 등 패턴, 테마·폰트 프리셋 키 제외)
- **sessionStorage:** `move-re-readiness-*`, `moveRe*` 등 MOVE RE 관련 키 추가 정리 (전체 `clear` 없음)

## 정리하지 않는 대상

- 서버 DB의 public_results, session_plans, profile, plan_status 등
- **Google/Kakao 제공자 쿠키** — 이 PR 범위가 아니다. Supabase `signOut`으로 세션 쿠키는 기존 패턴에 따른다.
- `localStorage.clear()` / `sessionStorage.clear()` / IndexedDB 전체 삭제 — 사용하지 않음
- Cache Storage — PWA/정적 에셋 영향 가능성으로 **이번 PR에서는 미처리**. namespace 확정 후 후속에서 검토 가능
- 테마·디자인 프리셋·개발 폰트 스위처 키 (`theme-preset`, `designPreset:v1`, `ui:themePreset:v3` 등) — **보존 목록**에 명시

## 검증 (권장 수동)

1. 로그인 → 여정 탭 → 로그아웃 → URL이 `/`인지, `/app/auth` 아닌지
2. 로그아웃 후 `/`에서 “내 리셋맵으로 돌아가기” CTA 미노출(세션 없음)
3. 동일 브라우저에서 신규 사용자 흐름(1분 체크) 재진입 가능
4. 동일 계정 재로그인 시 서버 데이터·앱 플로 복구(이 PR이 DB를 지우지 않음)

## 남은 후속

- **PR-OAUTH-ACCOUNT-SELECT-01** (가칭): 제공자 계정 선택·`prompt=select_account` 등은 별 PR
