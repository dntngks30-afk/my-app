# PR-07 External SDK / Platform / UI Primitive Type Cleanup

## Plan scope lock (approved iteration)

### Allowlist — 수정 가능한 파일만

| 파일 | 역할 |
|------|------|
| [badge.tsx](../../src/components/ui/badge.tsx) | UI Slot (A) |
| [button.tsx](../../src/components/ui/button.tsx) | UI Slot (A) |
| [media-payload.ts](../../src/lib/media/media-payload.ts) | Mux SDK (B) |
| [stripe.ts](../../src/lib/stripe.ts) | Stripe SDK (C) |
| [pdf-factory.ts](../../src/lib/pdf-factory.ts) | React-PDF (D) |
| [korean-audio-pack.ts](../../src/lib/camera/korean-audio-pack.ts) | browser timer + PlaybackObservability (E) |
| 본 문서 `docs/pr/PR-07-external-sdk-platform-ui-primitive-type-cleanup.md` | PR 기록 |

**이 7 경로만 수정한다.** (조건부 파일 추가 없음 = 본 PR 범위 밖 `live-readiness` / `voice-guidance` 미수정.)

### 금지 (이번 PR)

- `package.json` / `package-lock.json` / `tsconfig.json` / `next.config.*`
- `src/lib/session/**`, `src/app/api/session/**`, routine-plan, public funnel, app execution 핵심, DB/Supabase schema
- `src/lib/camera/evaluators/**`, squat core, `squat-completion-state` 등 **카메라 도메인 핵** (단, `korean-audio-pack.ts`는 E로 **명시적 예외**)
- `as any` / `@ts-ignore` / `@ts-expect-error`

---

## Item-by-item approval (구현 가드)

### A. UI Slot — **승인**

- `Slot.Root` → `Slot`만 변경:
  - `const Comp = asChild ? Slot : "span"` (badge)
  - `const Comp = asChild ? Slot : "button"` (button)
- **불변:** variant, `className`, `data-slot`, `data-variant`, `data-size`, props spread 위치, shadcn 대규모 리팩터.

### B. Mux — **조건부 승인 (타입은 반드시 근거)**

- `node_modules/@mux/mux-node` **정의를 직접 확인**한 뒤 `signPlaybackId(playbackId, …)` **옵션 shape만** 설치 surface에 맞춤.
- **추측 수정 금지.**
- **불변:** `SIGNING_ENABLED === false`, public fallback URL, `TOKEN_EXPIRY`, env 이름, Mux URL 형식, signing 정책 의도.
- `as any` 금지. (signing 경로가 평소 미실행이어도 **타입만** 정합; **정책을 바꾸는** 변경 금지.)

### C. Stripe — **강한 조건 (가장 주의)**

- `apiVersion` literal은 **추측으로 바꾸지 않는다.**
- **절차:** 설치된 `stripe` 패키지 타입이 허용하는 **literal(들)** 을 확인 → tsc가 요구하는 경우에만 그 **정확한** literal로 맞춤.
- **문서(Security / ops note):** `apiVersion` literal을 타입에 맞추는 변경이 들어가면, 본 PR 문서 **CURRENT** 또는 **LOCKED**에 다음을 명시:
  - *SDK 타입이 허용하는 api version literal에 맞춤. `getStripeServerClient` 등 **결제 로직 식은 미변경**이나, Stripe API version literal 변경은 **런타임 응답 shape 호환**을 배포/스테이징에서 한 번 확인할 것.*
- `Stripe.StripeError` 미수출: `isStripeError`는 **`unknown` 구조 가드** 유지; `type` / `message` / `code` 접근은 **가드 통과 후에만.**
- **불변:** `getStripeErrorMessage` **분기·문구**, customer / subscription / payment intent / **webhook** 로직.
- 가능하면 checkout/session 생성 **타입 경로**·스모크만 확인(코드 변경은 allowlist 내만).

### D. PDF — **조건부 승인**

- `renderToBuffer(element)` — **element 타입만** React-PDF 기대에 맞춤.
- `CTAConfig`는 `import type` 분리 **허용** (safe).
- **Document 래퍼:** `FreeReportPDF` / `PremiumReportPDF`가 **이미 `<Document>` 루트인지** 먼저 코드 확인. 루트가 이미 `Document`면 **새 래퍼 넣지 않는다** (PDF 구조 변경 방지). 루트가 아니면 **최소** 정렬(타입 assert는 `as any` 대신, 라이브러리가 받는 `ReactElement` 정합만).
- **불변:** PDF 문구, FREE/PAID 분기, `pageCount`, `filename`, PostureLab→Move Re 리브랜딩, 컴포넌트 **의미** 대개편.

### E. Korean audio — **승인**

- 브라우저 타이머: `number | null` + `window.clearTimeout` 정합 (또는 프로젝트 `setTimeout` 반환과 일치하는 단일 alias).
- `setPlaybackObs` — `clipPath: null` 등 **누락 필드** 보강 (shape only).
- **불변:** cue mapping, Korean 텍스트, `CLIP_LOAD_TIMEOUT_MS`, `CLIP_COMPLETION_*`, clip → TTS → beep 순서, `onEnd` / `onError` 호출 순서, cleanup 시맨틱.

---

## Conditional approval checklist (1–8)

1. **UI** — `Slot.Root` → `Slot` **만**; 나머지 UI 시그니처 불변.
2. **Stripe** — apiVersion = **설치 타입이 허용하는 literal만**; 문서에 **런타임 호환 확인** 문구.
3. **Mux** — `node_modules` 타입 확인 후 `signPlaybackId` 옵션만; `SIGNING_ENABLED`, fallback, env, `TOKEN_EXPIRY` 불변.
4. **PDF** — `renderToBuffer` 타입만; 내용·pageCount·filename·분기·리브랜딩 불변.
5. **korean-audio** — timer 타입 + `PlaybackObservability` shape만; mapping·order·상수 불변.
6. **live-readiness.ts** / **voice-guidance.ts** — Timer tsc **이번 PR 미수정** → **PR-07D** 후보로 본 문서 Follow-up에 기록.
7. `package.json` / lock / tsconfig **수정 금지.**
8. `as any` / `ts-ignore` / `ts-expect-error` **금지.**

---

## Purpose

`@radix-ui/react-slot`·Mux·Stripe·`@react-pdf/renderer`·브라우저 타이머/관측 shape만 **타입 정합**; 제품 정책·UX·결제·미디어·PDF·오디오 **의미**는 그대로.

## CURRENT_IMPLEMENTED

- **UI:** `asChild` 시 `Comp = Slot` (`Slot.Root` 제거; 패키지는 `Root`·`Slot` 동일 re-export).
- **Mux:** `signPlaybackId` 두 번째 인자를 `MuxJWTSignOptions`로 명시(동일 `type` / `expiration`); signing 비활성·fallback·`TOKEN_EXPIRY` 불변.
- **Stripe:** `apiVersion`을 `Stripe.LatestApiVersion`(`'2026-01-28.clover'`)에 맞춤(설치 `apiVersion.d.ts` 기준; 서브패스 `stripe/types/apiVersion` import는 package exports에 없어 **사용하지 않음**). `isStripeError`는 **구조 가드** 유지, predicate는 `Stripe.errors.StripeError`.
- **PDF:** `renderToBuffer`용 element를 `ReactElement<ComponentProps<typeof Document>>`로 좁힘; `CTAConfig`는 `import type` 분기.
- **korean-audio:** `clipCompletionSafetyId`를 `number | null`; TTS `clipMissing` 경로 `setPlaybackObs`에 `clipPath: null` 보강.
- **tsc (2026-04-27):** allowlist 6파일 **해당 경로 0 error**. **전체** `npx tsc --noEmit` 은 repo 기존 잔여 이슈로 green 아님(비범위: `ThemePresetSwitcher` DialogTrigger, `live-readiness`/`voice-guidance` Timer 등, SSOT “전체 tsc”는 PR-07 비목표).

## Root cause

- 설치 라이브러리 **타입 surface** vs 코드 사용 drift; browser `setTimeout` id vs `Timeout`; Slot `Root` API drift; Stripe `apiVersion` union 갱신.

## LOCKED_DIRECTION

- allowlist·금지·항목별 승인·체크리스트(1–8) 준수. 패키지/토글 **버전은 고정** — 코드가 타입에 맞춤.

## NOT_YET_IMPLEMENTED

- PR-07D: `live-readiness` / `voice-guidance` Timer (`number` vs `NodeJS.Timeout`).
- PR-06B structural-owner, evidence-gate alignment, camera smoke baseline, **전체 tsc green** 등.

## Files Changed

- `src/components/ui/badge.tsx`
- `src/components/ui/button.tsx`
- `src/lib/media/media-payload.ts`
- `src/lib/stripe.ts`
- `src/lib/pdf-factory.ts`
- `src/lib/camera/korean-audio-pack.ts`
- `docs/pr/PR-07-external-sdk-platform-ui-primitive-type-cleanup.md` (본 섹션)

## Why this is safe relative to SSOT

- public-first / session / camera core / payment **의도** — allowlist 밖; 본 PR은 **타입·API 사용**만.

## Verification

- `npx tsc --noEmit` — allowlist 6소스 0 error(필터 확인).
- `npm run test:session-snapshot` — **18 passed** (2026-04-27).
- `npm run test:session-gen-cache` — **11 passed** (2026-04-27).
- **전체 tsc green 비주장.**
- 배포/스테이징: Stripe `apiVersion` literal 변경 시 Dashboard 기본 API 버전·응답 호환 1회 확인(문서 C절).

## Explicit Non-goals

- 패키지 업그레이드, 결제/Mux **정책** 변경, PDF **콘텐츠** 변경, 오디오 **시퀀스** 변경, session/camera **핵** 수정.

## Follow-up PRs

- **PR-07D (후보):** [live-readiness.ts](../../src/lib/camera/live-readiness.ts), [voice-guidance.ts](../../src/lib/camera/voice-guidance.ts) — Timer 타입 정렬 (PR-07 allowlist **제외**).
- PR-06B, PR-EVG, 기타 잔여 tsc.

---

## Success criteria (recap)

- Allowlist **경로** tsc 이슈 **제거 또는 감소**; 금지 경로·패키지 파일 **0 건**; `as any`/지시어 **0**; 문서에 Stripe `apiVersion` **호환 확인** 문구(해당 시).
