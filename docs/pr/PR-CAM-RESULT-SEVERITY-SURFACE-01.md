# PR-CAM-RESULT-SEVERITY-SURFACE-01

## Findings

**main에 이미 있는 것:** `squat-result-severity.ts`의 `buildSquatResultSeveritySummary` 규칙, `camera-trace-bundle.ts`의 `summary.resultSeverity` 연동.

**Surface gap:** 모바일 JSON에서 `successSnapshots[]` 항목과, 일부 소비 경로에서 attempt `diagnosisSummary.squatCycle`의 severity 필드가 **동일 helper·동일 입력 계약**으로 명시되지 않거나(success), 호출 인자가 diagnosis `captureQuality` 문자열 정규화와 `squatInternalQuality` 경로로 완전히 정렬되지 않은 부분이 있었다.

## What this PR does

- **엔진·산식 변경 없음.** severity logic은 이미 main에 구현된 helper만 재사용.
- **Attempt 표면:** `camera-trace.ts`에서 `buildSquatResultSeveritySummary` 호출을 `String(base.captureQuality ?? '')` 및 `base.squatCycle.squatInternalQuality`만 사용하도록 정렬(허용 source만).
- **Success 표면:** `camera-success-diagnostic.ts`의 `recordSquatSuccessSnapshot` payload에 `passSeverity`, `resultInterpretation`, `qualityWarningCount`, `limitationCount` 추가(동일 helper, 동일 source 제한).

## Scope

- `src/lib/camera/camera-trace.ts`
- `src/lib/camera/camera-success-diagnostic.ts` (success snapshot writer 1개)
- `scripts/camera-cam-result-severity-surface-01-smoke.mjs`
- 본 문서

## Non-goals

- `squat-result-severity.ts`, `camera-trace-bundle.ts` 수정 없음
- `squat-completion-state`, `auto-progression`, `pose-features`, evaluator 등 엔진 파일 수정 없음
- threshold·pass owner·completion 산식·event-cycle 변경 없음

## Files changed

위 Scope와 동일.

## Acceptance tests

- `npx tsx scripts/camera-cam-result-severity-surface-01-smoke.mjs`
- 기존 `camera-cam-squat-result-severity-01-smoke.mjs`, `camera-cam-snapshot-bundle-01-smoke.mjs` 회귀 권장

## Why this avoids prior regressions

- Severity는 **새로 계산하지 않고** 기존 helper만 호출한다.
- 입력은 **completionTruthPassed, captureQuality, qualityOnlyWarnings, squatInternalQuality.tier/limitations**로 고정되어 depthBand·romBand·observation history로 분류하지 않는다.
- Bundle 쪽 `resultSeverity` wiring은 그대로 두어 번들 소비자 회귀를 피한다.

## Explicit note

**Severity logic is already implemented in main; this PR only surfaces it consistently on attempts (diagnosis call shape) and success snapshots. Engine / passing rules are untouched.**
