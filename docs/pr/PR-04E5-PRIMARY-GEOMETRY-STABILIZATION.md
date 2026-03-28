# PR-04E5 — Primary Geometry Stabilization

**Branch:** `feat/pr-04e5-primary-geometry-stabilization`
**Status:** CURRENT_IMPLEMENTED (이 PR 병합 후)

---

## 목적

PR-04E3C 이후 실기기 shallow squat 관측에서:
- `rawDepthPeakPrimary ~ 0` (primary 신호 붕괴)
- `rawDepthPeakBlended ~ 0.35` (blended 가 사실상 단독 carry)

이 패턴은 knee visibility 손실로 인한 **단발 프레임 logistic 붕괴**가 EMA(α=0.46)를 통해
3–4 프레임에 걸쳐 퍼지며 `rawDepthPeakPrimary` 를 near-zero 로 끌어내리는 현상이다.

이 PR은:
1. `suppressOneFrameDrops` 헬퍼를 통해 **pre-EMA 단계에서 단발 붕괴를 차단**
2. 억제된 raw 시리즈에 EMA 를 재실행해 `squatDepthPrimaryStable` 을 생성
3. completion state 에서 `rawDepthPeakPrimary` 를 안정화된 primary 로 라우팅

blended 를 primary 대체로 만들지 않고, primary 자체를 복구하는 것이 이 PR의 방향이다.

---

## 왜 pre-EMA 에서 억제해야 하는가

EMA-smoothed 값에서 억제할 경우: 단발 0 붕괴가 EMA 를 통해 이미 3–4 프레임에 걸쳐
퍼져 있어 single-frame detector 로는 잡히지 않는다.

Pre-EMA raw logistic 값은 single-frame 붕괴가 직접적으로 보이므로 억제 후 EMA 재실행 시
그 에너지가 downstream 으로 전파되지 않는다.

---

## 설계

### 1. `suppressOneFrameDrops` (stability.ts)

순수 수치 헬퍼. 입력 배열에서:
- `curr < neighborMin * collapseThreshold(0.35)` 이고 `neighborMin > minNeighborValue(0.008)` → 단발 붕괴로 판정, `(prev+next)/2` 로 대체
- `curr > neighborMax * spikeThreshold(1.7)` 이고 `curr > 0.04` → 단발 스파이크로 판정, 동일 대체
- 이웃 중 하나라도 null → 건드리지 않음
- 정상 점진 하강/상승에서는 조건 미충족 → 오탐 없음

### 2. `applySquatPrimaryStabilization` (pose-features.ts, squat 전용)

`stabilizeDerivedSignals` 뒤, `applySquatDepthBlendPass` 앞에서 실행.

1. `squatDepthProxyRaw` (pre-EMA logistic) 시리즈 추출
2. `suppressOneFrameDrops` 적용 → 억제된 시리즈
3. EMA(α=0.46) 재실행 → `squatDepthPrimaryStable`
4. 억제 여부 → `squatDepthPrimaryJumpSuppressed`

`squatDepthProxy` (기존 EMA primary) 는 **변경 없음** — additive field 추가만.

### 3. `buildSquatCompletionDepthRows` (squat-completion-state.ts)

`depthPrimary` 를 `squatDepthPrimaryStable`이 있으면 우선 사용.
없으면 기존 `squatDepthProxy` 로 폴백 → 기존 테스트 픽스처 회귀 없음.

효과: `rawDepthPeakPrimary` 가 near-zero 에서 복구되어
`COMPLETION_PRIMARY_DOMINANT_REL_PEAK (0.12)` 게이트를 통과할 확률 증가.
더 많은 shallow rep 이 blended fallback 없이 primary truth 로 평가됨.

### 4. Additive observability (evaluators/squat.ts)

`highlightedMetrics` 에 추가 (기존 필드 유지):
- `squatPrimaryStablePeak` — stable primary 피크(% 스케일)
- `squatPrimaryJumpSuppressedCount` — 버퍼 내 억제된 프레임 수

---

## 이전 PR 과의 관계

| PR | 역할 |
|----|------|
| PR-04E1 | arming 안정화 + blended depth 보조 입력 도입 |
| PR-04E2 | deep cycle no_reversal false negative 감소 |
| PR-04E3A | relativeDepthPeak truth blended-aware 정렬 |
| PR-04E3B | baseline freeze + peak latch + shallow event-cycle owner |
| PR-04E3C | reversal-lite / recovery-lite 로 shallow owner 강화 |
| **PR-04E5** | **primary geometry 안정화 — blended 의존 줄이기** |

---

## 변경 안 된 것 (hard boundary)

- `STANDARD_OWNER_FLOOR`, `MIN_REVERSAL_*_LITE`, `MIN_RECOVERY_*_LITE` 임계 불변
- `low_rom_event_cycle` / `ultra_low_rom_event_cycle` 명명 불변
- pass-vs-quality decouple 계약 불변
- blended depth 가 primary 를 대체하는 구조 미도입
- page/overlay/voice/auto-advance timing 미변경

---

## Acceptance Tests

| 케이스 | 결과 |
|--------|------|
| A. suppressOneFrameDrops 단발 붕괴 차단 | PASS (18/18) |
| B. 단발 스파이크 fake peak 방지 | PASS |
| C. deep standard_cycle 유지 | PASS |
| D. standing/micro dip 차단 | PASS |
| E. 관측 필드 형상 | PASS |
| PR-04E3C regression | 14/14 PASS |
| PR-3 motion stability (12 AT) | 12/12 PASS |
| PR-CAM-22 owner cutoff | 11/11 PASS |
| PR-04E3B regression | 13/13 PASS |
| PR-04E3A regression | 11/11 PASS |
| PR-04E2 regression | 13/13 PASS |
| PR-04E1 regression | 13/13 PASS |
| PR-04D1 regression | 17/17 PASS |
| PR-HMM-04C regression | 11/11 PASS |
| PR-HMM-04 regression | 29/29 PASS |
| PR-HMM-03A regression | 33/33 PASS |
| PR-HMM-02B regression | 24/24 PASS |
| PR-HMM-01B regression | 21/21 PASS |
| PR-CAM-27 regression | 16/16 PASS |

---

## 다음 PR 추천

- **PR-04E6**: 실기기 dogfooding 후 `suppressOneFrameDrops` 파라미터 조정
  (collapseThreshold / minNeighborValue) — calibration 기반 튜닝
- **Primary geometry confidence** 필드 추가 (frame-level confidence for primary depth signal)
