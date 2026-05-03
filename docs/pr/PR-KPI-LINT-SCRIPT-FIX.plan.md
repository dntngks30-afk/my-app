# PR-KPI-LINT-SCRIPT-FIX Plan

## 1. Summary

`npm run lint`가 `next lint`를 실행하는데, **현재 프로젝트의 Next.js 16.1.x CLI에는 `lint` 서브커맨드가 없다.** 그 결과 `next lint`는 **`lint`라는 이름의 프로젝트 디렉터리**를 찾으려 하며 Windows 등에서 `Invalid project directory ... \lint` 오류가 난다.

저장소에는 이미 **Flat Config 형태의 [`eslint.config.mjs`](eslint.config.mjs)** 가 있으나, **`package.json`의 `devDependencies`에 `eslint` / `eslint-config-next`가 선언되어 있지 않아** 재현 가능한 ESLint 실행 환경이 갖춰지지 않았다([`npm ls eslint`](package.json) 결과 비어 있음).

**추천 방향(구현 PR):** `lint` 스크립트를 **`eslint` CLI 직접 호출**로 바꾸고, Next 16과 맞는 버전으로 **`eslint` + `eslint-config-next`(및 peer로 필요한 패키지)** 를 `devDependencies`에 추가한다. [`next.config.ts`](next.config.ts) 주석대로 ESLint는 Next 설정에서 분리된 상태이므로 이 방향과 일치한다.

---

## 2. CURRENT_IMPLEMENTED

| 항목 | 상태 |
|------|------|
| [`package.json`](package.json) `"lint"` | `"next lint"` |
| Next | `^16.1.6` ([dependencies](package.json)) |
| [`next.config.ts`](next.config.ts) | `typescript.ignoreBuildErrors: true`; 주석 **「eslint 설정은 Next.js 16에서 제거됨」** |
| ESLint 설정 파일 | [`eslint.config.mjs`](eslint.config.mjs) 존재 (`eslint-config-next/core-web-vitals`, `typescript`, `globalIgnores`) |
| `.eslintrc*` | 없음 |
| `devDependencies` | **`eslint`, `eslint-config-next` 없음** (`typescript`, `@types/*`, `dotenv-cli`만) |
| CI | [`.github/workflows`](.github) 없음 |
| [`vercel.json`](vercel.json) | crons만; 빌드 시 lint 커스텀 명시 없음 |

---

## 3. Problem

1. **CLI 불일치**: `npx next --help`에 **`lint` command가 없음** → `next lint`는 실질적으로 지원되지 않는 호출 패턴이며, 증상과 부합하는 해석은 **`lint`가 디렉터리 인자로 처리되는 것**.
2. **의존성 공백**: `eslint.config.mjs`가 `eslint-config-next`를 import하지만 **`package.json`에 해당 패키지 및 `eslint` 본체가 없음** → 깨끗한 클론에서 ESLint 기반 검증이 불안정.
3. PR 검증 시 `npm run lint`가 반복 실패하여 smoke/tsc와 함께 쓰는 신뢰도가 떨어짐.

---

## 4. Goals

- `npm run lint`가 **`Invalid project directory ... \lint`류로 즉시 죽지 않는다.**
- 실제로 **ESLint가 실행**되고(또는 명시적으로 실패 이유를 출력), 재현 가능한 `devDependencies`를 갖춘다.
- **`dev` / `build` / `start` 스크립트는 변경하지 않는다.**
- 제품 런타임 코드(KPI, public funnel, session, camera 등)는 **이번 인프라 PR에서 대량 수정하지 않는다.**

---

## 5. Non-goals

- TypeScript 전역 `tsc` 오류 일괄 해결(별도 추적).
- Next/React 메이저 업/다운그레이드로 lint만 해결.
- KPI·public·claim·session 로직 변경.
- 대량 auto-fix로 코드 스타일 전부 정리(별도 PR).

---

## 6. Investigation Checklist

구현 PR 전에 담당자가 확인할 것:

| # | 확인 항목 |
|---|-----------|
| 1 | `npx next --help`에 `lint` 부재 재확인(버전 고정 시에도 동일한지). |
| 2 | `npm ls eslint eslint-config-next` 및 lockfile에 유무. |
| 3 | [`eslint.config.mjs`](eslint.config.mjs)가 ESLint 9 flat config + `eslint-config-next` 권장 패턴과 호환되는지(Next 16 문서/릴리즈 노트). |
| 4 | Windows/macOS/Linux에서 `eslint` 경로·인자 동일 동작. |
| 5 | Vercel 빌드가 implicit로 lint를 도는지(현재 [`vercel.json`](vercel.json)에는 없음; 빌드 로그 기준). |

---

## 7. Root Cause Hypotheses

### 후보 A — Next 16에서 `next lint` 비지원 (채택)

- **증거**: 로컬에서 `npx next --help` 출력에 **`lint`가 Commands 목록에 없음**.
- **증상 매칭**: `next lint` → `next [directory]`로 해석되어 **`lint` 폴더**를 찾음 → `Invalid project directory ... \lint`.

### 후보 B — 스크립트만 구식

- 부분적으로 맞음: **`next lint` 자체가 더 이상 유효한 진입점이 아님** → `eslint` 직접 호출로 교체 필요.

### 후보 C — ESLint config / dependencies 부재

- **부분 채택**: config 파일은 있으나 **`eslint` / `eslint-config-next` 미설치**로 ESLint 파이프라인이 repo 계약으로 완결되지 않음.

---

## 8. Fix Options

| 옵션 | 내용 | 장단점 |
|------|------|--------|
| **1** | `"lint": "eslint ..."` + 필요 시 devDeps 추가 | Next CLI 변화에 독립, 재현성 좋음. devDeps 추가 필요. |
| **2** | smoke placeholder로 대체 | 실패는 없어지나 **실질 lint 아님** — 비추천. |
| **3** | `next lint .` 등 유지 | **현재 CLI에 lint 없음** → 해결 기대 낮음. |
| **4** | `check` 스크립트로 lint+tsc 묶기 | 장기 유용하나 **전역 tsc 실패 시 항상 빨간색** — lint PR 범위 밖과 분리 권장. |

---

## 9. Recommended Implementation

**단일 구현 PR (PR-KPI-LINT-SCRIPT-FIX 또는 PR-LINT-01)**

1. **`devDependencies` 추가**(버전은 Next 16 / ESLint 9와 호환 조합으로 pin 또는 범위 명시):  
   - `eslint`  
   - `eslint-config-next`  
   - (`eslint-config-next`가 끌어오는 peer가 부족하면 `@eslint/eslintrc` 등 문서대로 보강)
2. **`package.json`의 `lint` 스크립트**를 `next lint` → **`eslint`** 호출로 변경.  
   - 초기에는 `eslint .` 또는 **`eslint src scripts`** 등 범위를 명시해 불필요한 디렉터리 스캔 최소화.
3. **[`eslint.config.mjs`](eslint.config.mjs)의 `globalIgnores`** 보강:  
   - `node_modules`, `.next`, `out`, `build`, `coverage`, `artifacts`, `supabase/migrations` 등 **SQL·생성물 제외**(정책은 팀 합의).
4. **대량 위반 처리**: 첫 PR에서는 **exit 0 강제보다 “명령 정상 실행 + 위반 목록”** 우선. 필요 시 후속 PR에서 규칙 완화 또는 단계적 fix.

---

## 10. Package Script Plan

| 현재 | 제안 |
|------|------|
| `"lint": "next lint"` | `"lint": "eslint ."` **또는** `"eslint src scripts --max-warnings=0"` 등 |

- **`build` / `dev` / `start` 변경 없음**(요구사항).
- PowerShell/Unix 공통 동작 확인.

---

## 11. ESLint Config / Dependency Plan

- **기존 [`eslint.config.mjs`](eslint.config.mjs) 보존**을 우선; import 경로(`eslint/config`, `eslint-config-next/core-web-vitals`)가 설치 후 동작하는지 검증.
- 설치 후 `npx eslint --print-config path/to/file.tsx` 등으로 설정 로드 확인.
- **`eslint-config-next`와 React 19 / TS 5.9** 조합 호환 여부는 구현 시 릴리즈 노트로 재확인.

---

## 12. Verification Plan

구현 PR에서 실행:

```bash
npm run lint
npm run test:analytics-kpi-run-attribution
npm run test:analytics-kpi-pilot-filter
npm run test:public-test-runs-claim-link
npm run test:public-test-runs-funnel-wiring
npm run test:public-test-runs-foundation
npx tsc --noEmit
```

- **`npm run lint`**: 더 이상 `Invalid project directory ... \lint` 없음(필수).
- **`tsc`**: 기존 전역 오류 가능 — **lint PR 변경과 무관하면 분리 보고**.
- 선택: **`npm run lint -- --max-warnings=0`** 별도 스크립트는 후속.

---

## 13. Risks & Mitigations

| 리스크 | 완화 |
|--------|------|
| 첫 `eslint` 실행 시 위반 다수 → exit 1 | 초기 `--max-warnings` 완화 또는 규칙 단계 도입; 별도 “lint-fix” PR. |
| devDeps 버전 충돌 | Next 공식 권장 버전 범위를 문서에 명시. |
| Windows 경로/긴 인자 | 스크립트 단순 유지, 필요 시 `eslint.config` ignores로 처리. |

---

## 14. Acceptance Tests

### Required

- `npm run lint`가 **`Invalid project directory ... \lint`로 실패하지 않는다.**
- lint가 **실제 ESLint 프로세스**를 실행한다(출력 또는 exit 코드로 확인 가능).
- `dev` / `build` / `start` 미변경.
- KPI/public/session/camera **런타임 코드 대량 수정 없음**(인프라 PR 한정).
- dependency 추가 시 **문서·PR 설명에 이유 명시**.
- lint 대상/ignore에 **`.next`, `node_modules`, 산출물** 등이 포함되지 않도록 설정.

### Optional

- `npm run lint`가 **exit 0**(기존 코드 위반으로 어려우면 문서에 현황·후속 계획).
- 나열 smoke 스크립트 **계속 통과**.

---

## 15. PR Split Recommendation

| 추천 | 내용 |
|------|------|
| **파일럿 전 단일 PR** | PR-KPI-LINT-SCRIPT-FIX: lint 스크립트 + devDeps + `globalIgnores` 보강 + 선택적 `scripts/lint-smoke.mjs`(예: `eslint --version` / 설정 로드 확인). |
| 후속 | PR-LINT-02: 규칙 완화 또는 자동 fix 배치; PR-LINT-03: CI에 `npm run lint` 명시(저장소에 워크플로 추가 시). |

---

## 16. Open Questions

1. **첫 merge 시 `lint`를 exit 0으로 강제할지**, 일단 **실행 가능 + 알려진 위반 목록**으로 둘지(팀 합의).
2. **Lint 범위**: `eslint .` vs `src`+`scripts`만 — 후자가 스캔 시간·노이즈에 유리할 수 있음.
3. **`eslint-config-next` 최소 버전**을 Next `16.1.6`에 고정할지 범위(`^`)로 둘지.

---

## 승인 필요로 명시할 수 있는 경우

- ESLint 관련 **신규 devDependency 대량 추가** 또는 **버전 핀**에 보안/라이선스 검토가 필요할 때.
- **수십 파일 규칙 위반**을 같은 PR에서 고쳐야만 CI를 녹일 때 → 별도 PR로 분리 권장.
- **Vercel/외부 CI**에서 빌드 단계에 숨은 lint가 있다면 해당 설정 변경 승인.

---

## 산출물

- 본 문서: [`docs/pr/PR-KPI-LINT-SCRIPT-FIX.plan.md`](docs/pr/PR-KPI-LINT-SCRIPT-FIX.plan.md)
