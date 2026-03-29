# PR-CAM-SHALLOW-REVERSAL-SIGNAL-01

## Findings from latest JSON

- 반복 실패 구간: `completionBlockedReason: "no_reversal"`, `attemptStarted: true`, `descendConfirmed: true`.
- 같은 캡처 맥락에서 `relativeDepthPeak: 0.21`인 low-ROM event cycle은 통과 가능 → **깊이 한계가 아니라 얕은 구간에서 reversal 확인이 막히는 병목**으로 해석하는 것이 데이터와 맞음.

## Why the bottleneck is reversal, not depth

`relativeDepthPeak`가 더 깊은 시도는 동일 엔진에서 통과할 수 있으므로, 차단은 주로 `detectSquatReversalConfirmation`의 shallow 분기에서 strict hit만 허용되던 정책에 기인한다.

## Current main strict-only shallow policy (before this PR)

`relativeDepthPeak < MODERATE_ROM_REL_PEAK_FLOOR (0.12)` 전체를 `shallowOnly`로 묶어, strict primary/reversal 이후 **window / ascent / HMM 완화를 전부 차단**했다. 그 결과 0.08~0.12 근처에서 실제 상승 신호가 있어도 `no_reversal`에 걸리기 쉬웠다.

## Scope

- **오직** `src/lib/camera/squat/squat-reversal-confirmation.ts` 수정.
- `MODERATE_ROM_REL_PEAK_FLOOR = 0.12` **값 변경 없음**.
- 기존 `strictPrimaryHit` / `strictReversalHit` / `windowReversalRelax` / `ascentStreakRelax` / `hmmBridgeConfirm` **본문 변경 없음**.

## What this PR adds

1. **밴드 분리**
   - `relativeDepthPeak < 0.08`: 기존과 동일 ultra-shallow strict-only (`ultra_shallow_strict_only_no_hit`).
   - `0.08 <= relativeDepthPeak < 0.12`: strict 후 **`shallowWindowReversalRelax`만** 추가 (4프레임, reversal depth 유효 ≥2, `drop >= required * 0.88`).
   - `>= 0.12`: 기존 moderate 흐름 (window → ascent → HMM) 유지.

2. **[0.08, 0.12)에서 금지**: `ascentStreakRelax`, `hmmBridgeConfirm`, 기존 `windowReversalRelax` (0.92 계수 경로).

3. **source contract**: 새 relax 성공 시에도 `reversalSource: 'rule'`, enum 추가 없음.

## Non-goals

- `squat-completion-state`, `auto-progression`, `pose-features`, `squat-event-cycle`, `squat-completion-arming`, `evaluators/squat.ts` 변경 없음.
- completion/pass/owner/finalize/event-cycle promotion 변경 없음.
- `MODERATE_ROM_REL_PEAK_FLOOR` 직접 변경 없음.
- shallow 전역에 HMM bridge 개방 없음.

## Files changed

- `src/lib/camera/squat/squat-reversal-confirmation.ts`
- `scripts/camera-shallow-reversal-signal-01-smoke.mjs`
- `docs/pr/PR-CAM-SHALLOW-REVERSAL-SIGNAL-01.md`

## Acceptance tests

- `npx tsx scripts/camera-shallow-reversal-signal-01-smoke.mjs`
- 회귀: `npx tsx scripts/camera-pr-04e2-squat-reversal-confirmation-stabilization-smoke.mjs`

## Why this avoids prior regressions

- **Ultra-shallow (<0.08)** 는 이전과 동일하게 완화 없음 → standing/미세 노이즈 FP 경로를 넓히지 않음.
- **0.08~0.12** 는 단일 보조(`shallowWindowReversalRelax`, 0.88 계수)만 허용 → HMM/ascent/window(0.92) 남용 방지.
- **≥0.12** 분기와 기존 헬퍼 구현은 그대로 → moderate/deep 계약 유지.

## Required doc lines

- Latest JSON shows repeated `no_reversal` with `attemptStarted=true` and `descendConfirmed=true`.
- Current main shallow branch disabled all relax paths below 0.12.
- This PR adds only a narrow **0.08~0.12** shallow relax band.
- **No completion/pass/owner logic changes** (변경 파일이 reversal-confirmation 한정).
