# PR-CAM-OBS-NORMALIZE-01 — Squat observation truth normalization (mobile debugging)

## Findings

- **CURRENT_IMPLEMENTED**: 스쿼트 attempt/success 스냅샷에 `passOwner`, `finalSuccessOwner`, `relativeDepthPeak`, `peakDepth`, `depthBand`, `completionPathUsed` 등이 이미 기록된다.
- **문제**: 위 필드들이 **서로 다른 계층**(evaluator depth metric vs completion relative depth vs completion_state owner)에서 왔는데, JSON 한 표면에 **라벨 없이** 나란히 있어 실기기 로그에서 “deep인데 low_rom?” 같은 **가짜 모순**으로 읽힌다.
- **이번 PR**: 값·산식은 그대로 두고, **해석용 라벨·정규화 블록·짧은 힌트**만 추가한다.

## Current contradiction examples

- `completionPassReason = "low_rom_event_cycle"`, `finalSuccessOwner = "completion_truth_event"`, `eventCycleDetected = true` 인데 동시에 `peakDepth = 91`, `depthBand = "deep"`, `relativeDepthPeak = 0.38`, `completionPathUsed = "low_rom"` 가 공존할 수 있다.
- 이는 **버그가 아니라** evaluator 쪽 depth 표현과 completion/owner 결정에 쓰인 relative·event 계층이 **다른 truth**이기 때문이다.

## Why values are not “wrong” but “mixed truth surfaces”

- `peakDepth` / `depthBand` / `romBand` 는 주로 **evaluator highlighted metrics·squatCycleDebug** 계열.
- `relativeDepthPeak`, `relativeDepthPeakSource`, event-cycle owner 필드는 **completion / event-cycle** 계열.
- 한 줄 요약: **같은 키 옆에 두지 말고, 블록 이름으로 구분**해야 한다.

## Scope

- `AttemptSnapshot.diagnosisSummary.squatCycle`에 고정 문자열 해석 라벨 3개 추가.
- `CaptureSessionBundleSummary`에 `normalized`, `interpretationHints` 추가(기존 flat 필드 유지).
- `SquatSuccessSnapshot`에 owner·truth 라벨 필드 정렬.

## Non-goals

- `squat-completion-state`, `auto-progression`, pose/arming/event-cycle **산식·임계** 변경.
- 기존 필드 삭제, 값 덮어쓰기·숨기기.
- raw frame / landmark / video 저장.

## Files changed

- `src/lib/camera/camera-trace.ts` — `buildDiagnosisSummary` 스쿼트 블록에 라벨 필드.
- `src/lib/camera/camera-trace-bundle.ts` — `SquatNormalizedTruthSummary`, `extract`·힌트.
- `src/lib/camera/camera-success-diagnostic.ts` — success 스냅샷 payload.
- `scripts/camera-cam-obs-normalize-01-smoke.mjs`, `scripts/camera-cam-snapshot-bundle-01-smoke.mjs` 보강.
- `docs/pr/PR-CAM-OBS-NORMALIZE-01.md`.

## Acceptance tests

- 타입·lint 통과(변경 파일 기준).
- pass/gate/completion **산식 diff 없음**(지정 금지 파일 미수정).
- 번들 `summary.normalized`·`interpretationHints` 존재.
- success 스냅샷에 `finalSuccessOwner`·`standardOwnerEligible`·`shadowEventOwnerEligible`·truth 라벨.
- 기존 flat 필드 유지.
- `npx tsx scripts/camera-cam-obs-normalize-01-smoke.mjs`
- `npx tsx scripts/camera-cam-snapshot-bundle-01-smoke.mjs`

## Why this is safe

- **추가 필드만**: JSON 소비자가 키를 모르면 무시 가능.
- **재계산 없음**: 이미 스냅샷에 있던 값을 블록으로 옮겨 담기만 함.
- **제품 판정 경로 미변경**: trace/diagnostic/bundle 레이어만.

## How to read normalized summary on device

1. **`summary.normalized.ownerTruth`**: 통과 사유·경로·owner (completion/event 계층).
2. **`summary.normalized.evaluatorDepthTruth`**: `peakDepthMetric` ↔ 기존 flat `peakDepth`/`depthBand`와 대응.
3. **`summary.normalized.completionDepthTruth`**: `relativeDepthPeak` 등 completion relative 계층.
4. **`summary.normalized.cycleTruth`**: 위상·블록 사유.
5. **`summary.interpretationHints`**: 위 조합으로 생성된 2~5줄 설명(로직 계산 없음).
6. **`squatCycle.displayDepthTruth` / `ownerDepthTruth` / `cycleDecisionTruth`**: 스냅샷 단위 고정 라벨.
