# PR-04D1 — Squat pass vs low-quality capture decouple

## Findings (실기기)

`completionSatisfied === true`, `completionPassReason === 'standard_cycle'`, `standingRecoveryFinalizeReason` 등 **completion truth**는 통과했는데도 `failureReasons`에 `capture_quality_low`, `hard_partial`, `standard_cycle_signal_integrity`가 남고 **gate가 retry**로 떨어질 수 있었다. 병목은 **motion completion 실패**가 아니라 **final progression contract**가 저품질 신호를 pass 차단과 동일 선상에서 처리하던 점이다.

## 분리 이유

- **Completion truth**는 `squat-completion-state` 소유(본 PR에서 계산·시맨틱 변경 없음).
- **Capture quality**는 guardrail·신뢰도 해석 레이어 — 유효한 사이클이 관측되면 pass 후보로 인정하고, 저품질은 **해석·trace·failureReasons(디버그)** 로만 남긴다.

## Pass blocker → quality-only 로 내린 항목 (스쿼트·completed cycle·non-invalid·severe 아님·pass 확인 준비 시)

- `capture_quality_low` (pass gate에서 분리; `failureReasons`에는 남을 수 있음)
- `hard_partial` (retry 트리거에서 decouple 시 제외)
- `standard_cycle_signal_integrity:*` (`getSquatRawStandardCycleSignalIntegrityBlock` raw 값은 유지, **progression pass**에서는 `squatPassProgressionIntegrityBlock` 으로 무시)

## Severe invalid 는 여전히 blocker

`guardrail.captureQuality === 'invalid'` 이고 `insufficient_signal` / `valid_frames_too_few` / `framing_invalid` 중 하나면 `isSevereInvalid` — **decouple 비대상**. 기존 severe 차단·retry/fail 계약 유지.

## 하드 블로커 유지

`insufficient_signal`, `valid_frames_too_few`, `framing_invalid`, `left_side_missing`, `right_side_missing` 는 기존 `getHardBlockerReasons(squat)` 그대로 pass를 막는다.

## 코드 위치

- 계약 헬퍼: `src/lib/camera/squat/squat-progression-contract.ts`
- 게이트 조합: `src/lib/camera/auto-progression.ts` (`progressionPassed`, retry 분기, `isFinalPassLatched` 스쿼트 분기)
- Trace / 진단: `src/lib/camera/camera-trace.ts`, `src/lib/camera/camera-success-diagnostic.ts`
- Dev 패널: `src/app/movement-test/camera/squat/page.tsx` (debug 블록만)

## 다음 PR 제안

- Evidence tier / planning downgrade: `qualityOnlyWarnings`·`failureReasons`를 세션·플랜 쪽 **evidence 약함** 티어로 소비 (본 PR은 gate·trace 관측만).

## 스모크

`npx tsx scripts/camera-pr-04d1-squat-pass-quality-decouple-smoke.mjs`
