# PR-TSC-HIGH-DIFFICULTY-RECOVERY — 높은 난이도 TypeScript 오류 진단·해결 설계서

**문서 성격:** 설계·진단 전용. **본 문서는 코드 구현을 수행하지 않는다.**  
**진단 시점:** 로컬에서 `npx tsc --noEmit` 기준 (exit ≠ 0). 경로·행 번호는 리포지토리 상태에 따라 변할 수 있음.

---

## 1. 목적

- “높은 난이도”로 분류된 **도메인 영향이 큰** 타입 오류의 **원인**을 코드·컴파일러 메시지에 근거해 고정한다.
- **해결 방안**을 PR 단위로 쪼갤 수 있게 설계한다.
- **제품 체감:** 대부분은 *빌드/IDE 신뢰도*와 *향후 회귀 방지*에 기여한다. 일부는 런타임과 무관한 타입만의 문제이나, 잘못된 `as` 남용으로 **실제 버그를 가릴 수 있어** 정리 가치가 있다.

---

## 2. 상태 라벨 (AGENTS.md)

| 라벨 | 본 문서에서의 의미 |
|------|-------------------|
| **CURRENT_IMPLEMENTED** | `tsc`가 보고한 오류, 또는 코드/타입 정의를 읽어 확인한 사실 |
| **LOCKED_DIRECTION** | 병합 전 제품·아키텍처와 충돌 없이 권장되는 수정 방향 |
| **NOT_YET_IMPLEMENTED** | 본 설계서 범위에서 코드 변경 없음 |

---

## 3. 전체 `tsc` 부채의 구조 (CURRENT_IMPLEMENTED)

저장소 전체 오류는 **한 덩어리가 아니라 최소 4갈래**로 나뉜다.

| 갈래 | 특징 | 대표 |
|------|------|------|
| **A. 의존성·스코프** | 모듈 미해결(`TS2307`), import 경로 불일치 | `sonner`, `@radix-ui/*`, `features/map_ui_import/...` 대량 |
| **B. 세션·플랜·적응 레일** | 도메인 타입과 구현/스키마 불일치 | `evidence-gate`, `next-session-preview`, `plan-generator`, `exercise-log-identity`, `session/complete` |
| **C. 카메라·스쿼트** | 상태 레코드 vs 실제 대입 유니온, `highlightedMetrics` 규칙 | `squat-completion-core`, `squat.ts`, `overhead-reach`, fixture |
| **D. 외부 SDK·플랫폼** | Stripe API 버전, Mux JWT 옵션, `Timeout` vs `number`, worker 타입 | `stripe.ts`, `media-payload.ts`, `korean-audio-pack.ts` 등 |

**높은 난이도(대화에서 지칭한 묶음)**는 주로 **B + C의 일부**이며, A는 “난이도는 낮아 보이나 개수가 매우 많음”으로 **별도 트랙**(의존성 정리 또는 `tsconfig` exclude)이 합리적이다.

---

## 4. 버킷 A — 세션·API·플랜 (도메인 핵심)

### 4.1 `src/app/api/session/complete/route.ts` — `TS2589` (Type instantiation is excessively deep)

**증상 (CURRENT_IMPLEMENTED):**  
`runEvaluatorAndUpsert(supabase, …)` 호출 부근에서 `TS2589` 발생.

**원인 가설 (LOCKED_DIRECTION):**

1. **Supabase 클라이언트 제네릭** (`Database` 스키마 기반)이 매우 깊게 전개되고,  
2. `runEvaluatorAndUpsert`의 `supabase` 파라미터가 **수동 구조 타입**(`from` → `select` → `eq` → `PromiseLike<…>`)으로 선언되어 있어,  
3. 실제 인자(`getServerSupabaseAdmin()` 등)와 **구조적 호환을 증명하는 과정**에서 타입 인스턴스화 깊이가 한계를 넘는다.

즉, **런타임 버그라기보다 타입 추론 한계**에 가깝다.

**해결 방안 (LOCKED_DIRECTION, 택일 또는 병행):**

| 방안 | 내용 | 트레이드오프 |
|------|------|----------------|
| **A1** | `runEvaluatorAndUpsert`의 첫 인자를 `SupabaseClient` 최상위 타입 또는 **의도적으로 얕은** 어댑터 인터페이스로 바꾸고, 구현 내부에서만 좁힌다. | API 시그니처 변경 최소화 가능 |
| **A2** | 호출부에서 `supabase as AdaptiveEvaluatorSupabase` 등 **단일 지점 단언** + 어댑터 모듈에 주석으로 근거 고정 | 단언 남용 금지 — **한 줄 집중**이 핵심 |
| **A3** | `runEvaluatorAndUpsert` 반환 타입을 더 단순한 **명시적 별칭**으로 고정해 호출부 추론 깊이 감소 | `adaptive-evaluator.ts` 쪽 정리 필요 |

**비목표:** 세션 완료 비즈니스 규칙(멱등, 로그, evidence gate) 변경.

---

### 4.2 `src/lib/session/evidence-gate.ts` — 관측 통계 타입 누락

**증상 (CURRENT_IMPLEMENTED):**  
- 객체 리터럴에 `cooldownItemsCount`, `cooldownCompleted` 포함  
- 이후 소비 코드가 동일 필드를 기대  
- 그러나 **선언된 반환/중간 타입**에는 해당 필드가 없어 `TS2353` / `TS2339` 발생.

**원인 (CURRENT_IMPLEMENTED):**  
구현이 쿨다운 항목 집계를 **추가**했으나, 타입 정의(또는 인라인 타입)가 **갱신되지 않음** — 전형적인 **스키마 드리프트**.

**해결 방안 (LOCKED_DIRECTION):**

1. `computePlanCompletionStats` (또는 동일 역할 함수)의 반환 타입에  
   `cooldownItemsCount: number`, `cooldownCompleted: number` **추가**.  
2. evidence score·관측 로그 소비부가 동일 단일 타입을 import하도록 정리.

**제품 체감:** 없음(순 타입·관측 정합). 잘못된 필드명만 바꾸면 관측 숫자 의미가 어긋날 수 있으므로 **필드명은 구현과 1:1 유지**.

---

### 4.3 `src/lib/session/next-session-preview.ts` — `NextSessionPreviewPayload` vs `focus_label`

**증상 (CURRENT_IMPLEMENTED):**  
`NextSessionPreviewPayload`에는 `focus_label`이 없고, `NextSessionPreviewData`만 확장에 포함.  
그런데 `normalizeNextSessionPreviewForDisplay` 등에서 `payload.focus_label`에 접근 → 유니온에 대해 `TS2339`.

**원인 (CURRENT_IMPLEMENTED):**  
**API 페이로드 타입**과 **표시용 확장 타입**의 경계가 코드상 분리되어 있으나, **함수 시그니처가 둘을 혼합**해 접근.

**해결 방안 (LOCKED_DIRECTION, 택일):**

| 방안 | 내용 |
|------|------|
| **N1** | `NextSessionPreviewPayload`에 `focus_label?: string | null` **옵션 추가** (서버가 항상 보내지 않아도 됨). |
| **N2** | 접근 전 `'focus_label' in payload` 가드 또는 사용자 정의 type guard로 **narrow**. |

**부가 (CURRENT_IMPLEMENTED):**  
`resolveLockedNextSessionPreview` 반환 타입이 `NextSessionPreviewPayload | null`인데, 표현식이 `undefined`를 포함할 수 있어 `TS2322` — **`?? null` 또는 early return**으로 `undefined` 차단.

**제품 체감:** 타입만 수정 시 없음. 잘못된 narrow는 “다음 세션 카드” 카피가 비는 등 **UI 결손**으로 이어질 수 있어 **N1이 데이터 계약 명확화에 유리**.

---

### 4.4 `src/lib/session/exercise-log-identity.ts` — `difficulty` 옵셔널 vs 필수

**증상 (CURRENT_IMPLEMENTED):**  
`ExerciseLogItem`은 `difficulty: number | null` 형태를 기대하는데, 스프레드 소스는 `difficulty?: number | null` → `undefined` 가능 → `TS2345`.

**원인 (CURRENT_IMPLEMENTED):**  
**“없음”의 표현이 코드베이스에서 `null`과 `undefined`로 이중화**.

**해결 방안 (LOCKED_DIRECTION):**  
푸시 시점에 `difficulty: log.difficulty ?? null` (동일 패턴을 `rpe`, `discomfort`에 적용할지는 해당 타입 정의와 대조).

**제품 체감:** 없음. DB/집계가 `null`만 기대하면 `undefined` 제거가 **일관성 향상**.

---

### 4.5 `src/lib/session/plan-generator.ts` — `GoldPathSegmentRule` readonly 튜플 vs 가변 배열

**증상 (CURRENT_IMPLEMENTED):**  
`as const` 또는 `readonly` 튜플 리터럴을 `preferredVectors: GoldPathVector[]`에 넣을 때 `readonly` → mutable 불가 `TS2322`.  
`bootstrap-summary.ts`에 동형 오류.

**원인 (CURRENT_IMPLEMENTED):**  
타입이 **가변 배열**을 요구하는데 데이터가 **불변 튜플**로 추론됨.

**해결 방안 (LOCKED_DIRECTION, 택일):**

| 방안 | 내용 |
|------|------|
| **G1** | `GoldPathSegmentRule`의 `preferredPhases` / `preferredVectors` / `fallbackVectors` / `preferredProgression`을 `readonly GoldPathVector[]` 등으로 완화. |
| **G2** | 상수 정의부에서 `[...tuple] as GoldPathVector[]`로 **명시적 복사** (런타임 비용 무시 가능한 작은 배열). |

**제품 체감:** 없음.

---

### 4.6 `src/lib/session/plan-generator.ts` — `meta.confidence` 문자열 vs 숫자 (`TS2322`)

**증상 (CURRENT_IMPLEMENTED):**  
`PlanJsonOutput['meta']` 등에서 `confidence`가 **숫자**로 정의되어 있는데, 구현은 `'high' | 'mid' | 'low'` 문자열을 대입.

**원인 (LOCKED_DIRECTION):**  
**JSON 스키마(또는 타입)**와 **실제 저장 값**이 어느 시점에서든 어긋남 — 의미적으로는 “신뢰도 티어 문자열” vs “0–1 스칼라” 혼선.

**해결 방안 (LOCKED_DIRECTION):**

1. **진실 원천 확인:** DB·클라이언트 소비처가 무엇을 읽는지 추적.  
2. 타입을 **실제 저장 형태**에 맞추거나, 필드명을 분리 (`confidence_score` vs `confidence_tier`).  
3. **한 PR에서는 타입 또는 값 중 하나만** 바꾸지 말고, 소비처 grep으로 동기화.

**제품 체감:** 잘못 고치면 **세션 메타 표시·필터**에 영향 가능 — **데이터 계약 확인 필수**.

---

### 4.7 `src/lib/routine-plan/day-plan-generator.ts` — `Promise.all`에 Builder 전달

**증상 (CURRENT_IMPLEMENTED):**  
`PostgrestFilterBuilder`를 `Promise<unknown>` 자리에 넣음 → `TS2739` / `TS2345`.

**원인 (CURRENT_IMPLEMENTED):**  
Supabase `.insert()` 체인은 **즉시 Promise가 아니라 Builder**인 경우가 있음. **`.then()` 또는 `await` 가능한 Promise로 변환** 누락.

**해결 방안 (LOCKED_DIRECTION):**  
각 호출을 `await supabase.from(...).insert(...)` 형태로 통일하거나, 공식 타입 시그니처에 맞게 **최종 쿼리 빌더를 Promise로 변환**하는 패턴으로 수정.

**제품 체감:** 런타임에서 실제로 await되지 않으면 **플랜 저장 실패** 가능 — 타입 수정이 **버그 수정**과 동일한 케이스일 수 있음.

---

## 5. 버킷 B — 스쿼트 completion / 카메라 (고난이도 논리 타입)

### 5.1 `src/lib/camera/squat/squat-completion-core.ts` — epoch `source` 유니온 불일치

**증상 (CURRENT_IMPLEMENTED):**  
`canonicalTemporalEpochLedger.peak?.source` 등이  
`DescentTimingEpochSource | 'rule_or_hmm_reversal_epoch' | …` 넓은 유니온인데,  
`SquatCompletionState`(예: `squat-completion-state.ts`)의  
`selectedCanonicalPeakEpochSource` 등은 **`'completion_core_peak' | null`**처럼 지나치게 좁게 선언됨.  
→ `'pre_arming_kinematic_descent_epoch'` 등이 대입 불가 `TS2322`.

**원인 (LOCKED_DIRECTION):**  
**시간축 epoch 소스**가 제품 진화 과정에서 늘었으나, **상위 상태 타입이 “피크만” 가정**한 채 freeze.

**해결 방안 (LOCKED_DIRECTION, 택일):**

| 방안 | 내용 | 비고 |
|------|------|------|
| **E1** | `SquatCompletionState`의 해당 필드를 **실제 `CanonicalTemporalEpoch` source 유니온**과 동기화 (또는 공통 별칭 타입 export). | 관측·디버그 정합 |
| **E2** | 상태 필드는 좁게 유지하고, 코어에서 **매핑 레이어**로 “피크 슬롯에 올 수 있는 소스만” 기록, 나머지는 `temporalEpochOrderTrace` 등 부가 필드로만 노출. | SSOT상 “사용자 대면 필드 최소화”와 충돌 시 검토 |

**제품 체감:** 타입만 E1로 맞추면 체감 없음. **E2 매핑 실수**는 진단·회귀 해석을 흐릴 수 있음.

---

### 5.2 `src/lib/camera/evaluators/squat.ts` — 기타 정합

**CURRENT_IMPLEMENTED 샘플:**

- `validFrameCountAfterReadinessDwell` — `EvaluatorDebugSummary`에 없음 `TS2353`.  
  → **타입에 옵션 필드 추가** 또는 **highlightedMetrics로 이동** 결정 필요.
- `reversalConfirmedBy`에 `'trajectory'` 포함 vs 상태 타입은 `'rule' | 'rule_plus_hmm' | null` — **유니온 확장 또는 매핑**.
- `highlightedMetrics.completionBlockedReason`의 `undefined` — **스쿼트 얕은 복구 PR에서 meaningful-shallow 패턴과 동일하게 `?? null`**.

**LOCKED_DIRECTION:** “디버그 전용 필드 추가”는 **게이트 입력 금지** 주석과 함께 `EvaluatorDebugSummary`에 **additive optional**로 두는 것이 SSOT 카메라 락과 충돌 적음.

---

### 5.3 `src/lib/camera/evaluators/overhead-reach.ts` — `null` vs `undefined`, `highlightedMetrics`

**증상 (CURRENT_IMPLEMENTED):**  
`number | null` ↔ `number | undefined` 혼선, `highlightedMetrics` 값에 `undefined` 대입.

**해결 방안 (LOCKED_DIRECTION):**  
스쿼트에서 확정한 패턴과 동일 — **대면/저장 계약이 `null`이면 `?? null`**, 메트릭 맵은 **`undefined` 금지**.

---

### 5.4 `src/lib/camera/squat/squat-absurd-pass-registry.ts` — `{}` 추론

**증상 (CURRENT_IMPLEMENTED):**  
객체를 `{}`로 좁혀진 채 프로퍼티 접근 `TS2339`.

**원인 (LOCKED_DIRECTION):**  
`JSON.parse` 결과 또는 빈 초기값에 **타입 단언/가드 없음**.

**해결 방안 (LOCKED_DIRECTION):**  
`unknown` → **런타임 가드** 또는 **명시적 인터페이스** + 단계적 narrow.

---

## 6. 버킷 C — 인프라·의존성 (별도 트랙)

**CURRENT_IMPLEMENTED:**  
`sonner`, 다수 `@radix-ui/*`, `embla-carousel-react`, `recharts`, `features/map_ui_import/**` 등 **수십 건 `TS2307`**.

**LOCKED_DIRECTION:**

1. **의존성 설치/버전 정렬**으로 한 번에 줄이거나,  
2. `tsconfig.json`에서 **맵 임포트 폴더를 `exclude`**하고 제품 번들에서 실제 참조 여부를 확인 (죽은 코드면 삭제가 최선).

**비목표:** 본 설계서에서 패키지 목록 전체를 고정하지 않음 — **LOCKED_DIRECTION: 별도 “프론트 의존성 정리” PR**.

---

## 7. 권장 실행 순서 (LOCKED_DIRECTION)

| 순위 | 대상 | 이유 |
|------|------|------|
| P0 | `day-plan-generator` Builder/Promise | 런타임 저장 실패 가능성 |
| P0 | `plan-generator` meta `confidence` 계약 | 데이터 의미 혼선 |
| P1 | `evidence-gate` 통계 타입 | 세션 완료 evidence 흐름 정합 |
| P1 | `next-session-preview` / `exercise-log-identity` | 완료 후 UX·로그 정합 |
| P1 | `session/complete` TS2589 | 개발자 경험·CI 안정 |
| P2 | `squat-completion-core` epoch 유니온 | 카메라 진단·회귀 해석 |
| P2 | `squat.ts` / overhead / absurd-registry | 카메라 서브시스템 정리 |
| P3 | 의존성·map_ui_import 대량 오류 | 스코프 큰 별도 PR |

---

## 8. 검증 체크리스트 (구현 시 — 본 문서 범위 밖)

- [ ] 수정 후 `npx tsc --noEmit` 해당 파일 관련 진단 소거 확인  
- [ ] `docs/REGRESSION_MATRIX.md`에 해당하는 세션 완료·카메라 스모크 스크립트 실행 (해당 PR에서 정의)  
- [ ] SSOT: public-first·카메라 **게이트 의미 변경이 없음**을 PR 설명에 명시

---

## 9. 명시적 비목표

- 본 설계서에 **코드 패치** 포함 없음.  
- UI 리디자인, 새 evidence 정책, 카메라 pass semantics 변경 **포함 안 함**.  
- `tsc` 전체 제로를 단일 PR로 강제하지 않음 — **갈래별 PR 분리** 원칙 유지 (`AGENTS.md` PR 분리).

---

## 10. 요약

**높은 난이도**는 “한 줄 수정”이 아니라 **(1) 제네릭 깊이**, **(2) 도메인 타입 스키마 드리프트**, **(3) epoch·메타 같은 장기 진화 필드의 유니온 불일치**가 겹친 결과다.  
구현 단계에서는 **의존성 트랙**과 **세션/카메라 도메인 트랙**을 분리하고, **데이터 계약이 불명확한 항목(`confidence` 등)**은 타입만 고치기 전에 **소비처·DB JSON**을 확인해야 한다.
