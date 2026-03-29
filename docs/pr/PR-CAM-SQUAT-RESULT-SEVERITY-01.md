# PR-CAM-SQUAT-RESULT-SEVERITY-01

## Findings

통과(completion truth)와 캡처/내부 품질(quality truth)이 이미 스냅샷에 분리되어 있으나, 소비자가 raw 필드 조합으로만 “low-quality pass”를 읽어야 한다. 제품 방향(통과는 유지, 해석은 엄격)에 맞춰 **동일 입력**으로 명시적 severity·interpretation 레이어를 추가한다.

## Scope

- `src/lib/camera/squat-result-severity.ts` (신규)
- `src/lib/camera/camera-trace.ts` — `diagnosisSummary.squatCycle`에 4 필드 추가
- `src/lib/camera/camera-trace-bundle.ts` — `summary.resultSeverity`
- `scripts/camera-cam-squat-result-severity-01-smoke.mjs`
- 본 문서

## Non-goals

- `squat-completion-state`, `auto-progression`, `pose-features`, `squat-event-cycle`, `squat-reversal-confirmation`, `squat-completion-arming`, `evaluators/squat.ts` 변경 없음
- threshold·`completionPassReason`·owner·progression·event-cycle promotion 변경 없음

## Severity rules (고정)

입력: `completionTruthPassed`, `captureQuality`, `qualityOnlyWarnings`, `qualityTier`, `limitations` 만 사용.

1. `completionTruthPassed !== true` → `failed` / `movement_not_completed`
2. 그 외 `captureQuality === 'low'` OR `qualityTier === 'low'` OR `qualityOnlyWarnings.length >= 1` → `low_quality_pass` / `movement_completed_but_quality_limited`
3. 그 외 `limitations.length >= 1` → `warning_pass` / `movement_completed_with_warnings`
4. 그 외 → `clean_pass` / `movement_completed_clean`

## Acceptance tests

`npx tsx scripts/camera-cam-squat-result-severity-01-smoke.mjs`

## Rollback

헬퍼·필드 제거 시 이전 스냅샷 형태로 복귀(신규 필드만 제거).
