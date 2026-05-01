# PR-WEB-PERF-01B — Public funnel image warmup

## assumptions

- Android Chrome에서 intro·baseline result step3 이미지가 라우트/스텝 진입 이후 `next/image` 요청으로 늦게 채워지는 것이 체감 지연의 주된 원인이다.
- `Image()` 선제 요청으로 HTTP 캐시를 채우면 동일 URL의 `next/image`가 더 빨리 안정화될 수 있다.
- 루트 `/` 첫 로드에 intro·result 이미지 전부를 붙이면 PR75 critical asset diet와 충돌하므로 금지한다.

## findings

- `/intro/welcome`에는 비교 이미지가 없어, examples 라우트 진입 전까지 해당 PNG는 요청되지 않았다.
- `IntroExamples1`은 첫 카드만 `priority`였고 두 번째는 lazy였다.
- Baseline result step3는 `step === 3`일 때만 `BaselineResultStep3ScrollScene`이 마운트되어 이미지 요청이 늦었다.

## root cause

- 공개 퍼널 이미지가 “사용자가 곧 볼 화면”보다 늦게 네트워크 스케줄되는 경우가 많아, 레이아웃·텍스트 대비 이미지가 뒤늦게 채워진다.

## what changed

- `src/lib/public/preload-images.ts`: 클라이언트 전용 `warmupImages` — 중복 방지, 실패 무시, `setTimeout` + `requestIdleCallback`(가능 시)으로 메인 스레드 부담 완화.
- `IntroWelcome.tsx`: welcome 진입 후 intro examples 4장 PNG warmup.
- `IntroExamples1.tsx`: 비교 카드 2장 모두 `priority`.
- `IntroExamples2.tsx`: 변경 없음 (welcome warmup + 과도한 priority 회피).
- `PublicResultRenderer.tsx`: 마운트 시 `primary_type` 기준 step3 자산 3장만 warmup (`getResultStep3Assets(pt)`), 전 타입 맵 순회 없음.

## why not root preload

- `RootLayout` / `/` landing에서 intro·result-step3 전부를 `link rel=preload` 하면 첫 페인트·필수 자산 대역폭과 경쟁한다.
- 이번 PR 범위는 “다음에 볼 가능성이 높은 소수 이미지”만 지연 스케줄하는 것이다.

## intro warmup policy

- 트리거: `/intro/welcome` 마운트 후 `delayMs` 250ms 경로에서 idle 쪽으로 warmup.
- 대상: `/intro/good-pattern-lift.png`, `/intro/compensation-lift.png`, `/intro/balanced-alignment.png`, `/intro/asymmetric-compensation.png` (4장 고정).

## baseline step3 warmup policy

- 트리거: `PublicResultRenderer` 마운트, `result.primary_type` 확정 직후.
- 대상: `getResultStep3Assets(pt)`가 반환하는 3개 경로만. `RESULT_STEP3_ASSETS_BY_PRIMARY` 전부를 순회하지 않음.
- `BaselineResultStep3ScrollScene`에는 `priority`를 추가하지 않음 (above-the-fold 아님, step1에서 네트워크 우선순위 과점유 방지).

## files changed

- `src/lib/public/preload-images.ts` (신규)
- `src/components/stitch/intro/IntroWelcome.tsx`
- `src/components/stitch/intro/IntroExamples1.tsx`
- `src/components/public-result/PublicResultRenderer.tsx`
- `scripts/public-image-warmup-smoke.mjs` (신규)
- `package.json`
- `docs/pr/PR-WEB-PERF-01B-PUBLIC-IMAGE-WARMUP.md` (본 문서)

## acceptance criteria

1. Android Chrome에서 intro examples 이미지 지연 체감이 줄어든다.
2. Baseline result step3 이미지가 step3 진입 시 뒤늦게 뜨는 체감이 줄어든다.
3. `/` landing first load에 intro/result 이미지 전역 preload가 추가되지 않는다.
4. result-step3 전 타입·전 이미지 일괄 preload가 없다.
5. public result scoring / contract 필드 변경 없음.
6. auth / onboarding / readiness / session 로직 변경 없음.
7. PR75 root critical asset diet를 되돌리지 않는다.

## manual smoke checklist

### Android Chrome

- `/` → `intro/welcome` → `examples/1` 이미지 지연 체감 확인
- `examples/2` 이미지 지연 체감 확인
- survey → baseline → step3 이미지 지연 체감 확인

### iOS Safari

- intro examples 이미지 깨짐 없음
- baseline step3 이미지 깨짐 없음

### Network sanity

- `/` landing first load에서 intro/result 이미지가 과도하게 먼저 요청되지 않음
- `/intro/welcome` 진입 후 intro examples 이미지 warmup 요청이 이어짐
- baseline result 렌더 후 해당 타입의 step3 이미지 3장만 추가 warmup

## non-goals

- scoring, `reason_codes`, result 계약 변경
- `layout.tsx`·landing·camera·결제·auth 핸들러 수정
- step3 이미지에 대한 `next/image` `priority` 추가
- 모든 primary type에 대한 result-step3 이미지 선로딩
