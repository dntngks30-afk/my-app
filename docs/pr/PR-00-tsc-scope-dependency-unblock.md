# PR-00 TSC Scope & Dependency Unblock

## Purpose

- `npx tsc --noEmit`에서 **TS2307 / Cannot find module / 잘못된 모듈 식별자**로 인한 잡음을 도메인 타입 오류와 분리한다.
- 이후 **PR-01~PR-07**이 세션/플랜/카메라/외부 SDK 문제만 집중할 수 있도록 tsc 표면을 정리한다.

## Path verification (exclude 전)

- 실제 루트: `src/features/map_ui_import/**` (glob으로 68+ 파일 확인; 하위 `home_map_20260315/components/reset-map.tsx` 등).
- **Active import** (런타임, `src`에서만 `rg`):
  - `src/app/app/(tabs)/home/_components/HomePageClient.tsx` → `@/features/map_ui_import/.../components/reset-map`
  - `src/lib/auth/performAppLogout.ts` → `.../components/manual-node-overrides`
- `reset-map.tsx`는 `./session-node-layout`, `./manual-node-overrides`만 상대 import — **`components/ui` shadcn 덤프는 닫힌 그래프에 없음.**  
- TypeScript: `exclude`는 include로 **추가된 루트**에서만 제외; **import로 끌려오는** 파일(`reset-map`, `manual-node-overrides`, `session-node-layout`)은 여전히 타입체크된다 (공식 `exclude` 동작).

## CURRENT_IMPLEMENTED (이 PR 반영)

- `package.json` / `package-lock.json`: **`npm` 고정** — `sonner`, `@radix-ui/react-separator` 추가 (`npm install sonner @radix-ui/react-separator`만 사용).
- `tsconfig.json`: `exclude`에 **`src/features/map_ui_import/**`만** 추가.  
  - **변경 없음:** `strict`, `skipLibCheck` (true 유지), `moduleResolution`, `baseUrl`, `paths` — 손대지 않음.
- **유일한 소스 예외:** `src/components/ui/separator.tsx` — 잘못된 `"radix-ui"` import를 `@radix-ui/react-separator` 네임스페이스 import 한 줄로만 수정 (styles/props/export/cn/구조 변경 없음).
- `pnpm-lock.yaml` / `yarn.lock` **미생성** (확인됨).

### 수정 전/후 tsc (로컬 측정, 동일 명령 `npx tsc --noEmit`)

| 항목 | Before | After |
|------|--------|--------|
| **TS2307** | 52 | **0** |
| **총 `error TS` (대략)** | 184 | 113 |
| `tsc` exit | 실패 (non-zero) | 실패 (non-zero) |

**이 PR은 `tsc` 전체 green을 주장하지 않는다.** 성공 기준은 **TS2307·module not found 감소**와 **의존성/스코프와 도메인 오류의 분리**다.

## LOCKED_DIRECTION

- Active runtime이 쓰는 의존성(`sonner`, `separator`의 `@radix-ui/react-separator`)은 **package + lock**에 명시.
- `map_ui_import`의 비활성 shadcn 덤프는 **삭제가 아닌** `tsconfig` exclude로 tsc 루트에서 분리; 도메인 타입(세션/카메라 등)은 **후속 PR**에서만 다룬다.

## NOT_YET_IMPLEMENTED (후속 PR에 남는 대표 오류)

아래는 **이번 PR에서 수정하지 않음**; 남은 `tsc` 오류(일부) 분류.

| PR 후보 | 영역 / 예 (after 로그에서 확인) |
|--------|--------------------------------|
| PR-01 | `src/lib/routine-plan/day-plan-generator.ts` — Supabase `PostgrestFilterBuilder` vs `Promise` |
| PR-02 | `src/lib/session/.../plan-generator`·meta 등 (세션/플랜 합의) |
| PR-03 | `src/lib/session/**` — bootstrap, constraints, `active-lite-data` 등 계약 드리프트 |
| PR-04 | `src/app/api/session/complete/route.ts` — **TS2589** (type instantiation) |
| PR-05 | `src/lib/camera/**` — squat completion core, audio `Timeout` 타입, trace 등 |
| PR-06 | `src/lib/camera/evaluators/squat.ts`, `overhead-reach.ts`, fixtures, absurd-pass-registry 등 |
| PR-07 | `src/lib/media/media-payload.ts`, `src/lib/pdf-factory.ts`, Mux/외부/플랫폼 타입, 기타非-session |

**UI (non-TS2307) 잔여 예:** `src/components/ui/badge.tsx` / `button.tsx` **TS2339** (`Slot.Root` — @radix-ui/react-slot API 사용 방식, PR-00 비범위), `ThemePresetSwitcher` TS2322.

## Files Changed

- `package.json` — `sonner`, `@radix-ui/react-separator`
- `package-lock.json` — npm lock만 갱신
- `tsconfig.json` — `exclude` + 주석(프로토타입 덤프 이유; compilerOptions 비변경)
- `src/components/ui/separator.tsx` — import 한 줄
- `docs/pr/PR-00-tsc-scope-dependency-unblock.md` — 본 문서

## Why this is safe relative to SSOT

- public-first 흐름, auth/pay/claim/session create **런타임 동작**을 바꾸지 않음.
- `/app` execution 코어(구현) **수정 없음** — `src/app/app/**` 미터치(HomePageClient 등 import 경로 그대로).
- camera pass semantics, session create/complete/adaptive **로직** 미수정.
- `next.config` `typescript.ignoreBuildErrors` **미변경**.

## Verification (실행한 명령)

```bash
npx tsc --noEmit
# (선택) TS2307만:
#   ... 2>&1 | findstr /C:"TS2307"
```

- 전후: 위 표 참고. **TS2307 52 → 0.**
- `pnpm-lock.yaml` / `yarn.lock` 없음 확인.

## Explicit Non-goals

- `tsc` **전체** zero
- 세션/플랜/카메라/Stripe/Mux **도메인** 타입 일괄 수정
- `skipLibCheck` / `strict` / `noImplicitAny` / `moduleResolution` / `paths` 끄기·바꾸기
- `map_ui_import` 폴더 **삭제** 또는 import 끊기
- DB migration, 런타임 제품 흐름 변경

## Follow-up PRs (권장 순서 힌트)

1. **PR-04** — `session/complete` TS2589 (빌드/타입 깊이 이슈가 크면 먼저)
2. **PR-01** — `day-plan-generator` Supabase builder 제네릭
3. **PR-05/06** — camera evaluators & completion core (PR 프롬프트에 맞게 쪼개기)

---

**Assumptions (구현 기준):** package manager = **npm**; active dependency = `src`에 실제 `import`로 확인된 `sonner`·separator용 `@radix-ui/react-separator`; exclude = `reset-map` 닫힌 그래프에 없는 `map_ui` 루트 전부, 경로 `src/features/map_ui_import/**` 실측.
