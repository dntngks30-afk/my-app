# PR-CAM-SUCCESS-UI-SETTLE-01 — Shallow squat success UI settle

**Scope:** `movement-test/camera/squat` 페이지만 — auto-progression·completion truth·음성·라우트 시퀀스 불변.

---

## 문제

`isFinalPassLatched` 가 참이 되는 순간(특히 `low_rom_event_cycle` / `ultra_low_rom_event_cycle`) 사용자는 아직 “동작 중”으로 느끼는데, UI·가이드가 곧바로 통과 톤으로 바뀌거나 성공이 빨리 열린 것처럼 느껴질 수 있었다.

---

## 접근

- **Truth 엔진**(`isFinalPassLatched`, 임계, owner)은 건드리지 않는다.
- **페이지 레이어**에서만 `latchPassEvent()` 호출을 shallow 경로에 대해 **320ms** 디바운스한다.
- `standard_cycle` 은 settle **0ms** → 기존과 동일하게 첫 `passReady` 틱에서 래치.
- 가이드/리드니스의 `success` 표시는 **`passLatched`(페이지 래치 이후)** 만 사용해, 엔진 passReady 와 UI 성공 표시를 분리한다.
- 교정 음성 차단 등은 기존대로 **`effectivePassLatched`**(= `finalPassLatched || passLatched`) 유지.

---

## 파일

| 파일 | 내용 |
|------|------|
| `src/lib/camera/success-ui-settle.ts` | 순수 `updateSuccessUiSettleCandidate`, 경로별 ms |
| `src/app/movement-test/camera/squat/page.tsx` | capturing effect 내 settle → `latchPassEvent(meta)`; auto-advance effect에서 중복 `latchPassEvent` 제거 |
| `src/lib/camera/camera-success-diagnostic.ts` | 스냅샷·옵션에 `successUi*` additive 필드 |

---

## 정책

- Shallow: `low_rom_event_cycle`, `low_rom_cycle`, `ultra_low_rom_event_cycle`, `ultra_low_rom_cycle` → **320ms** (280–380ms 권장 범위 내).
- `passReady` 가 끊기면 후보 타임스탬프 **리셋**.
- 재시도(`currentStepKey` / `handleRetry`) 시 settle ref 초기화.

---

## 검증

- `npx tsx scripts/camera-pr-success-ui-settle-smoke.mjs`
- `npm run build`

---

## Risks

- 실기기에서 320ms 가 짧거나 길면 `SUCCESS_UI_SETTLE_MS_SHALLOW` 만 조정하면 된다.
- `other` completion 경로는 settle **0ms**(즉시 래치) — 드문 경로에서만 해당.
