# PR-RESET-FE-02 — ResetStretchModal + 리셋 미디어 재생

## 목적 (CURRENT_IMPLEMENTED 대상)

FE-01에서 미연결되었던 리셋 카드 Play CTA를 [`POST /api/reset/media`](../../src/app/api/reset/media/route.ts) (`fetchResetMedia`) 및 전용 바텀시트 [`ResetStretchModal`](../../src/app/app/_components/nav-v2/ResetStretchModal.tsx)에 연결한다. `MediaPayload` 분기(HLS/embed/placeholder)별 재생 또는 가이드 UI, 권한·네트워크 에러 처리, 레이스/정리 규칙을 따른다.

## 변경 파일

| 파일 | 요약 |
|------|------|
| [ResetStretchModal.tsx](../../src/app/app/_components/nav-v2/ResetStretchModal.tsx) | `'use client'`, 분기 상태(loading/ready/error), HLS 동적 import·cleanup, 접근성·바텀시트 레이아웃 |
| [ResetTabViewV2.tsx](../../src/app/app/_components/nav-v2/ResetTabViewV2.tsx) | `mediaModal` 상태, `fetchResetMedia({ issue_key })`, `mediaRequestIdRef` 무효화, Play 버튼 |
| 본 문서 | 계약·Non-goals·수동 검증·수락 조건 |

`src/lib/reset/client.ts`는 변경 없음(BE-03 계약 충족 시).

## 권한·API 차이

- **`GET /api/reset/recommendations`**: Bearer 선택, 미인증 시 폴백 200 가능.
- **`POST /api/reset/media`**: `requireActivePlan` 등으로 **미인증/비플랜 시 401/403 가능** — recommendations와 동일 기대금지(`fetchResetMedia` 주석 참고).

## ResetStretchModal 책임

- 닫기(버튼·백드롭·Escape 선택), 표시: 제목·`display`/`media`·준비 상태.
- **`fetchResetMedia`는 부모(**ResetTabViewV2**)에서만 호출.**

## 미디어·상태 매핑

| 조건 | UI |
|------|-----|
| `fetchResetMedia` `ok:false` | error 모달(메시지·스냅샷 카드 문맥만, 탭 목록 탭 깨짐 금지) |
| `ok:true` · `media.kind === 'placeholder'` | **정상 가이드** — 특히 `meta.source === placeholder_unmapped`는 실패 카피(오류/실패/재생 불가 표현 금지) 금지, 부드러운 안내 문구 |
| `ok:true` · HLS / embed | `video` + hls.js(동적 import) 또는 `iframe` |

- **autoplay / `video.play()` 직접 호출 없음.** HLS 종료 시 `destroy`, `pause`, `removeAttribute('src')` 또는 `src=''` + 필요 시 `load()`.

## requestId 무효화

- Play 시작 시 `mediaRequestIdRef += 1` 후 로컬 id로 응답 매칭; 불일치 시 `setState` 생략.
- **모달 닫기 시에도 `mediaRequestIdRef += 1`** — 닫은 뒤 늦은 응답이 모달을 다시 열지 않도록.
- 컴포넌트 언마운트 시에도 ref 증가로 비행 요청 무효화.

## Play 버튼 동작

- `mediaModal.status === 'loading'`이면 **추가 클릭 무시**(전역 busy) 및 버튼 `disabled`.
- 현재 카드 이슈가 로딩 중 요청과 같을 때만 라벨 `영상 준비 중…`(다른 행 선택 시 레이블 꼬임 방지 검토안).

## Non-goals

- 세션 기록·RPE·완료·Reflection·home 리셋맵·[`ExercisePlayerModal`](../../src/app/app/(tabs)/home/_components/reset-map-v2/ExercisePlayerModal.tsx) / SessionPanel 수정.
- **`POST /api/reset/media`**, `reset-media*`, `media-payload.ts`, `package.json`/Tailwind/글로벌 CSS/새 API route 수정 없음.

## 접근성

- `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, 닫기 `aria-label="모달 닫기"`, iframe `title`, backdrop `aria-hidden`.
- **Focus trap은 후속 a11y polish에서 보강 가능.**

## 다음 PR

- **DATA-01**: 실제 `template_id` / Mux `media_ref` 매핑.
- **QA-01**: 회귀·스모크 잠금.

## 수락 조건 (체크리스트)

- [ ] `ResetStretchModal.tsx`는 `'use client'` 클라이언트 컴포넌트다.
- [ ] Play 클릭 시 `fetchResetMedia({ issue_key })`를 호출한다.
- [ ] Modal close 후 늦은 응답이 모달을 다시 열지 않는다.
- [ ] `placeholder_unmapped`는 error가 아니라 ready 가이드 모드로 표시한다.
- [ ] `ok:false`일 때만 error 모달 브랜치를 사용한다.
- [ ] HLS 재생 경로는 cleanup을 수행한다.
- [ ] autoplay / `video.play()` 직접 호출이 없다.
- [ ] `role="dialog"` / `aria-modal` / `aria-labelledby`가 있다.
- [ ] `ExercisePlayerModal`, SessionPanelV2, `/app/home/**` 변경 없음.

## 수동 검증 (12항목)

1. `/app/checkin`에서 FE-01 기능(목록·카드 추천) 유지.
2. Play 클릭 시 `ResetStretchModal` 오픈.
3. 네트워크에서 `/api/reset/media`가 `issue_key`로 호출되는지 확인.
4. `template_id` null일 때 placeholder(200)며 텍스트 가이드 확인.
5. 모달 닫기(닫기·백드롭) 동작.
6. 로딩 중 중복 Play 방지 확인.
7. 401/403/500/네트워크 시 error 카피·모달 상태 확인.
8. HLS 시 `controls` 재생 확인.
9. embed 시 iframe 표시 확인.
10. placeholder 시 “영상 준비 중”·방법 확인.
11. 세트/RPE·세션 종료 버튼 없음.
12. `/app/home` 실행 플로우 회귀 없음.
