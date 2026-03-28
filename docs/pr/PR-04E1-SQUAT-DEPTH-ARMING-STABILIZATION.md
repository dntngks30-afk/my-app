# PR-04E1 — Squat depth input stabilization for shallow arming

## 맥락 (e35ec45 / PR-04D1)

`e35ec45` 기준 **PR-04D1**은 **completion 이후** final progression에서 low-quality capture를 pass 차단에서 품질 경고로 분리했다. 실기기 얕은 스쿼트가 여전히 `completionBlocked: not_armed`에 걸리는 경우, **relativeDepthPeak: 0**·**arming 미개방**은 completion 이전 **입력 신호( depth proxy / 슬라이스 )** 문제다. 이번 PR은 **PR-04D1 contract를 유지**한 채, **pose-features → arming → evaluator 관측**만 보강한다.

## 왜 relativeDepthPeak 0 인가

`relativeDepthPeak` 등은 **knee 기반 `squatDepthProxy`(primary)** 파생이다. 얕은 ROM·부분 가림·모바일 노이즈에서 무릎 각도 기반 proxy가 **0 근처로 붕괴**하면 phase·arming 피크 탐색이 의미 있는 하강을 보지 못해 **not_armed**로 끝날 수 있다.

## primary / fallback / blended

| 구분 | 역할 |
|------|------|
| **primary** | 기존 `derived.squatDepthProxy` (스무딩된 knee-logistic) — **유지**, HMM·recovery·completion state depth 시계열은 그대로 |
| **fallback** | hip–knee 수직 분리·기하 기반 보조 깊이 (`squat-depth-signal.ts`) |
| **knee travel** | 무릎 전방 이동 증거 — **단독 pass truth 아님**, shallow motion evidence만 |
| **blended** | primary가 flat한데 하체 증거가 있을 때만 제한적으로 상향 — **standing jitter 가드** 포함 |

**Arming·squat phaseHint shallow 가드**는 `squatDepthProxyBlended`를 **우선** 읽는다 (`squatPhaseDepthRead`).

## 다음 PR

`no_reversal`, `recovery_hold_too_short` 등 **completion state 내부 임계**는 본 PR에서 변경하지 않는다. shallow arming 개선 이후에도 실패가 남으면 다음 PR에서 다룬다.

## 스모크

`npx tsx scripts/camera-pr-04e1-squat-depth-arming-stabilization-smoke.mjs`
