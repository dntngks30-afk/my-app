역할: Cursor/에이전트가 작업 전에 가장 먼저 읽어야 하는 **가드레일 문서**(문서 스택 2순위). 짧고 강하게 현재 truth·작업 금지선·보호 영역을 명시한다.

# AGENTS.md

---

## Documentation precedence (문서 7종)

충돌 시 **번호가 작을수록 우선**한다.

1. `docs/SSOT_PUBLIC_FIRST_2026_03.md` — canonical 제품 방향·구현 truth·남은 과제
2. `AGENTS.md` — 본 문서 (가드레일·보호 영역)
3. `ARCHITECTURE.md` — 계층·소유권·anti-drift
4. `SYSTEM_FLOW.md` — end-to-end 흐름·continuity 계약
5. `DEVELOPMENT_RULES.md` — PR·상태 분리·모델 선택
6. `docs/REGRESSION_MATRIX.md` — 병합 전 시나리오 검증
7. `docs/KNOWN_RISKS_AND_OPEN_ITEMS.md` — 열린 리스크·출구 기준

**운영 SSOT**(코드/배포/DB): `origin/main` + Vercel 프로덕션 + Supabase 운영 DB. 제품·퍼널 의사결정은 위 **문서 스택**이 우선한다.

---

## Must-read order before any task

작업 제안·적용 전 **아래 순서로 읽는다** (7문서 = SSOT 체계 전체).

1. `docs/SSOT_PUBLIC_FIRST_2026_03.md`
2. `AGENTS.md`
3. `ARCHITECTURE.md`
4. `SYSTEM_FLOW.md`
5. `DEVELOPMENT_RULES.md`
6. `docs/REGRESSION_MATRIX.md`
7. `docs/KNOWN_RISKS_AND_OPEN_ITEMS.md`

---

## Status labeling rule (필수)

제안·PR·설명 시 항상 분리한다.

- **CURRENT_IMPLEMENTED** — 배포·코드에 반영된 동작 또는 디버깅으로 확정된 사실
- **LOCKED_DIRECTION** — 아직 전부 구현되지 않았을 수 있으나 **제품 방향으로 고정**된 원칙
- **NOT_YET_IMPLEMENTED** — 명시적 남은 구현·정합화

이 세 가지를 **한 문단에서 섞어 “이미 다 된 것처럼” 쓰지 않는다.**

---

## Current product identity

MOVE RE는 운동 콘텐츠 앱이 아니다.  
MOVE RE는 **상태 기반 운동 실행 시스템**이다.

Core loop:

`analysis → interpretation → readiness → session creation → execution → logging → adaptation → next session`

---

## Current implemented truth (요약)

- public-first 전환 **골격**은 구조적으로 완료된 단계에 있음
- **Deep Result V2**가 단일 분석 truth
- 카메라는 설문 baseline 위 **optional refine evidence** (독립 canonical truth 아님)
- 세션 생성의 1차 source는 **claimed public result**; legacy paid deep는 **fallback only**
- **readiness**가 `next_action` 소유
- login / signup / signup-complete 구간 **next·intent continuity** 강화됨 (기본 복귀는 마케팅 루트 `/`가 아닌 계약된 경로 — SSOT §3-7)
- empty plan: `scoring_version`(분석 엔진 식별자)이 템플릿 풀 키로 새는 문제 **완화됨** (`deep_v3` → 풀 조회 시 `deep_v2` 정규화)
- segments 없는 empty draft **idempotent 재사용 금지** 경로

---

## Locked product direction (요약 — 상세는 SSOT)

- **단일 public entry** — 설문·카메라를 동등한 두 입구로 두지 않음
- **설문 = baseline**
- **카메라 = 최종 결과 직전 optional refine** (별도 동등 진입 아님)
- **결과 = 2~3 화면, 행동 중심** (내부 축·raw score 중심 공개 UX 금지)
- **결제 = 실행 unlock**, 분석 unlock 아님
- **auth/pay 후에도** 방금 본 결과·intent·bridge **연속성 유지**
- **결제 후 온보딩 최소**
- **짧고 믿을 수 있는 staged 세션 생성 UX**
- **세션 생성 직후 PWA 설치 안내**
- **첫 앱 경험 = 실행 우선**, 튜토리얼 최소

---

## Deprecated product narratives (문서·카피에서 되돌리지 말 것)

아래는 **과거 서술**로만 구분한다. 신규 설계의 기본 전제로 복귀하지 않는다.

| Deprecated | 대체 canonical |
|-------------|----------------|
| paid-first 퍼널 (`payment → in-app deep → …`) | public analysis → result → auth/pay → … → execution |
| “결제로 분석을 연다” | 분석은 public에서 끝; **결제는 실행을 연다** |
| 설문 vs 카메라 **동등한 두 public 진입** | **단일 입구**; 카메라는 결과 직전 optional refine |
| auth 성공 후 **의도 없이 `/`(마케팅 루트)로만 복귀** | `next`·bridge·`/app/home` 등 **계약된 경로** (SSOT SYSTEM_FLOW 참고) |

---

## Hard boundaries

- **paid-first**로 제품을 재정의하지 않는다.
- **결제를 분석 unlock**으로 서술·구현하지 않는다 (실행 unlock).
- 카메라만의 **별도 canonical truth 모델**을 만들지 않는다.
- public-result **호환 필드**를 템플릿 풀 선택 키처럼 **직접** 쓰지 않는다.
- **분석 엔진 식별자**와 **세션/템플릿 선택 식별자**를 같은 의미로 섞지 않는다.
- public-entry/handoff 수정 시 **`/app` 실행 코어**를 불필요하게 흔들지 않는다.
- **내부 raw scoring / priority 축**을 사용자 대면 UX의 중심에 두지 않는다 (디버그/어드민 예외는 별도).
- 기본 UX로 **두 개의 평행한 public entry**를 다시 만들지 않는다.

---

## Current highest priorities (SSOT와 정렬)

**P0:** 단일 public entry, 결과 직전 optional camera bridge, 결과 단순화, auth/pay/result continuity 봉인, regression lock  

**P1:** preview_ready semantics, bootstrap/public-result source alignment, post-pay onboarding 축소, staged generation UX, PWA install polish, 첫 튜토리얼 최소화  

**P2:** conversion preview, camera refine 카피, 과거 오염 empty draft 운영 정리  

---

## Required output format for implementation tasks

항상 포함:

1. assumptions  
2. findings  
3. files to change  
4. why this is safe relative to SSOT  
5. acceptance test checklist  
6. explicit non-goals  

---

## Protected areas (수정 시 매우 주의)

- `/app/home`, `/app/checkin`, `/app/profile`
- `AppShell`, persistent tab shell
- `SessionPanelV2`, `ExercisePlayerModal`
- execution / auth / completion / adaptive core

---

## Product identity lock

MOVE RE는 상태 기반 운동 실행 시스템이다. 콘텐츠 앱이나 **의학 진단 도구**가 아니다.

---

## Camera funnel lock (in-session capture UX)

**중요:** 아래 “카메라 퍼널/래치” 규칙은 **세션 내 캡처 UX**(설정·스쿼트·리치 등)에 대한 것이다. **두 번째 public 마케팅 입구**를 정당화하지 않는다. Public 입구는 SSOT대로 **단일**이며, 카메라는 **최종 결과 전 optional refine**이다.

Public camera funnel은 self-serve **usable-signal capture** 입력 채널이자 액션 브리지다.

Default funnel: `Setup → Squat → Overhead Reach → Result`

Locked camera laws:

- completion-first, execution-first  
- pass = progression gate, quality = interpretation signal  
- setup = reading phase, capture = listening phase  
- capture는 거의 텍스트 없이  
- red = not-ready, white = analyzable readiness, green = final success  
- voice = Korean-first, state-transition/latch-driven  
- internal/debug/English 문자열은 **발화 금지**

---

## Motion contract lock

모든 동작은 공통 progression contract를 따른다:  
`start pose → action event → completionSatisfied → passConfirmed → passLatched → auto progression`

동작별 감지는 다를 수 있으나 **최종 latch 의미**는 일관되어야 한다.

---

## Squat lock

스쿼트 완료는 full cycle: `descend → bottom → ascend → recovery`  
깊이는 quality이지 completion이 아니다.

---

## Overhead reach lock

핵심 이슈는 최종 progression 정렬: `passConfirmed → passLatched`  
raw detection만의 문제로 먼저 치부하지 않는다.

---

## Validation rule

카메라·실행 UX의 1차 검증은 **실제 기기 dogfooding**이다.

---

# Part 2 — Operational rules (에이전트 행동 규칙)

목적: MOVE RE 저장소에서 AI 코딩 에이전트의 실무 규칙을 정의한다. **그럴듯한 답변이 아니라 검증된 코드 수정**을 목표로 한다.

## 1. Role

실무 시니어 엔지니어처럼 행동한다. 직접적으로 소통하고, 실행을 설명보다 우선하며, **근거 없는 주장 금지**, 완료 주장 전 **검증**.

## 2. System overview (MOVE RE)

PWA 피트니스 플랫폼 — 움직임 테스트 기반 개인화 세션. **Core Stack:** Next.js App Router, Supabase (Auth + DB), Stripe, PWA, 세션 기반 운동.

## 3. SSOT (운영 상태)

공식 시스템 상태는 **GitHub origin/main**, **Vercel 프로덕션**, **Supabase 운영 DB**의 일치로 정의된다. 로컬 환경·마이그레이션 파일만으로는 SSOT가 아니다. 기능은 **세 가지가 맞을 때** 존재한다.

## 4. PR separation rules

관련 없는 변경을 한 PR에 섞지 않는다.

- **UI PR:** 컴포넌트·레이아웃·스타일·시각 구조만. API/DB/인증/결제 로직 금지.  
- **Backend PR:** API·DB·세션·인증 로직. UI 레이아웃·컴포넌트 디자인 금지.  
- **Payment/Auth PR:** Stripe·웹훅·plan_status·가입 플로우 등. 별도 PR로 관리.

## 5. Database rules

테이블 존재를 가정하지 말 것. 스키마 확인 후 쿼리. 파괴적 변경 지양, **가산적 마이그레이션** 선호. DROP/ALTER TYPE 등은 사용자 확인.

## 6. Authentication rules

세션 쿠키·Bearer·Supabase 등 **패턴이 혼재**할 수 있다. 사용 중인 방식을 감지하고 **조용히 바꾸지 말 것**. 상세: `docs/AUTH_CONTRACT.md`.

## 7. API safety rules

API 라우트 수정 전: 호출자 전부, 프론트 사용처, 인증 방식, 응답 형식 확인. 예: `/api/media/sign`은 재생·세션 플레이어·캐시·PWA에 광범위하게 영향.

## 8. File modification rules

파일 수정 전 **파일 전체** 읽기, 의존성·참조 검색. 부분만 보고 수정·무분별 리네이밍·대규모 구조 재작성 금지.

## 9. Coding rules

작은 변경, 최소 diff, 검증 가능한 동작. 대규모 리팩터·추측 최적화 지양.

## 10. Completeness contract

완료 = 요청 산출물 존재, TODO 없음, 핵심 로직 구현, **주장이 검증됨**.

## 11. Verification loop

마무리 전: 요구사항 충족? 형식 준수? 근거? 검증 수행? 불완전한데 완료라고 했는지?

## 12. Grounding rules

저장소 코드·도구 출력·사용자 제공 정보만. 모르면 추측하지 말고 질문.

## 13. Research behavior

디버깅은 질문 쪼개기 → 관련 파일 → 데이터 흐름 → 가정 검증.

## 14. Default close-out

완료 시: 무엇을 했는지, 변경 파일, 검증, 남은 리스크.

## 15. Critical MOVE RE risk areas

특히 주의: **미디어 서명**, **세션 레일**, **운동 로그**, **PWA 캐싱**, **인증 미들웨어**, **Stripe 결제 플로우**.

---

**Agent instruction:** 변경 전 본 문서와 SSOT를 따른다. SSOT·PR 분리·완전성 계약을 존중하고, 무관한 파일을 수정하지 않는다.

---

## Cursor Cloud specific instructions

### Dev environment essentials
- **Package manager:** `npm` (`package-lock.json` present). Run `npm install` to restore dependencies.
- **Dev server:** `npm run dev` → Next.js 16 Turbopack on `http://localhost:3000`.
- **Env vars:** Create `.env.local` with at minimum `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Placeholder values are sufficient for the dev server to start and serve client-side pages, but real Supabase credentials are needed for any auth/DB features.

### Lint
- `npm run lint` invokes `next lint`, which was **removed in Next.js 16**. ESLint is not in `package.json` dependencies. Lint currently does not function; this is a pre-existing repo state.

### Tests
- No Jest/Vitest/Playwright. All tests are custom smoke/regression scripts in `scripts/` run via `npx tsx`. See `package.json` `test:*` scripts (70+).
- Example: `npm run test:taxonomy`, `npm run test:session-constraints`, `npm run test:session-ordering`.
- These scripts are pure logic tests that run without Supabase or any external service.

### Build
- `npm run build` uses webpack (`next build --webpack`). Build may fail if `RESEND_API_KEY` is missing (the cron notification route imports Resend at module level). This is a pre-existing issue — dev server works without it.

### Key caveats
- `NEXT_PUBLIC_SKIP_CANONICAL_REDIRECT=1` should be set in `.env.local` to avoid redirect issues in local dev.
- Supabase client (`src/lib/supabase.ts`) throws at import time if `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` are empty — placeholder values prevent the crash.
- External services (Stripe, Mux, OpenAI, Resend) degrade gracefully with missing keys except for the Resend cron route at build time.
