# PR-CAM-PEAK-ANCHOR-INTEGRITY-01 / 02 — Squat peak anchor integrity (completion + event-cycle + trace)

## Findings from latest JSON

- `reversalAtMs < committedAtMs` — 역전 시각이 commitment 이전으로 기록됨 (앵커 불일치).
- `peakLatchedAtIndex = 0` — 관측용 피크 래치가 초기 인덱스에 고정된 채 진행.
- `perStepSummary.ascent.frameCount = 0` 인데 `completionPassReason === "standard_cycle"` 및 success — 상승 구간 관측과 통과 사유가 어긋남.
- 원인 요약: `evaluateSquatCompletionCore()`에서 `peakFrame`이 **전체** `depthFrames`의 최대 depth이고, `revConf.reversalConfirmed === true`이면 `reversalFrame`을 **그 `peakFrame`으로 즉시 승격**했다. commitment 이후에 “역전 앵커가 유효한지”를 검증하지 않아, **commitment 이전의 전역 피크**가 progression용 reversal 앵커가 될 수 있었다.
- **Phase 2 (PR-02):** `detectSquatEventCycle`이 동일 버퍼에서 **full-series max**를 다시 잡아 `peakIdx`를 정하면, completion-state가 이미 고른 commitment-safe 앵커와 **이벤트 사이클 피크 소유자**가 어긋날 수 있다. trace/debug에도 “어떤 피크가 앵커인지”가 드러나지 않았다.

## Why the issue is anchor integrity, not raw depth threshold

- 역전 **탐지**(`detectSquatReversalConfirmation`)와 drop 임계·primary 기하는 변경하지 않았다.
- 문제는 “역전이 감지됐다”는 신호에 **어떤 시각/인덱스를 reversal 앵커로 붙일지**였다. 전역 `peakFrame`은 디버그/관측용 최대 depth와 progression 앵커를 동일하게 취급하면, commitment 이후 궤적과 **시간 순서가 맞지 않는** 앵커가 될 수 있다.
- 이벤트 사이클은 **같은 앵커 인덱스**로 `peakDepth`/`relativePeak`를 계산해야 prefix spike가 이벤트 피크로 부활하지 않는다.

## Phases

### Phase 1 (INTEGRITY-01): completion-state reversal anchor

- `findCommittedOrPostCommitPeakFrame` — commitment 인덱스 **이후(포함)** 서브셋에서만 최대 depth 프레임 선택.
- `hasValidCommittedPeakAnchor` — 위 프레임이 commitment와 인덱스·시각상 일관된지 게이트.
- `reversalFrame` — `revConf.reversalConfirmed`는 그대로 두고, 앵커만 `committedOrPostCommitPeakFrame`으로 제한.
- HMM reversal assist·`getGuardedTrajectoryReversalRescue`는 **동일한 commitment-safe 앵커**를 쓰도록 정렬 (전역 `peakFrame` 승격 제거).

### Phase 2 (INTEGRITY-02): event-cycle + trace alignment

- `peakLatched` / `peakLatchedAtIndex` / `peakAnchorTruth`를 completion-state에서 **committed/post-commit 피크 앵커**와 정렬 (`peakAtMs`, `rawDepthPeak`, `relativeDepthPeak` 등 기존 관측 산식은 유지).
- `squat-event-cycle.ts`: full-series max 루프 제거; completion이 넘긴 **valid frame index**(`SquatEventCycleDepthSample.validIndex`와 동일)로 시리즈 내 샘플을 찾아 `peakDepth`를 고정. 앵커 누락/불일치 시 `peak_anchor_missing` / `peak_anchor_invalid_range`.
- `auto-progression` / `camera-trace`: `peakAnchorTruth: 'committed_or_post_commit_peak'` 관측 표면화 (pass 기준·게이트 변경 없음).

## Non-goals

- `squat-reversal-confirmation.ts`, `pose-features.ts`, `guardrails.ts`, `evaluators/squat.ts` 수정 없음.
- threshold / `STANDARD_OWNER_FLOOR` / `LOW_ROM_*` / `STANDARD_LABEL_FLOOR` / HMM 수치·정책 변경 없음.
- descent/reversal **디텍터** 완화·강화 없음.
- pass owner / finalize 정책 / `auto-progression` completion 만족 조건 변경 없음.

## Files changed

- `src/lib/camera/squat-completion-state.ts`
- `src/lib/camera/squat/squat-event-cycle.ts`
- `src/lib/camera/auto-progression.ts` (debug 필드만)
- `src/lib/camera/camera-trace.ts` (diagnosis 요약 필드만)
- `scripts/camera-peak-anchor-integrity-01-smoke.mjs`
- `docs/pr/PR-CAM-PEAK-ANCHOR-INTEGRITY-01.md`

## Acceptance tests

- **A.** Pre-commit 전역 피크 + 이후 commitment: `reversalAtMs`가 `committedAtMs`보다 이전이면 안 됨.
- **A' (PR-02).** 동일 픽스처에서 `peakLatchedAtIndex`가 prefix global max 인덱스가 아님; `peakAnchorTruth` 노출; event-cycle `peakDepth`가 global max가 아님.
- **B' (PR-02).** `peakLatchedAtIndex: null` → `peak_anchor_missing`, 비감지.
- **C' (PR-02).** 범위 밖 인덱스 → `peak_anchor_invalid_range`, 비감지.
- **B.** 얕은 의미 있는 하강·상승·복귀: completion 유지, 앵커 시각 일관성.
- **B-pres (PR-02).** 얕은 픽스처에서 latch 시 event-cycle 앵커 노트가 깨끗함.
- **C.** 서 있기만 함: `completionSatisfied === false`.
- **D.** 깊은 정상 스쿼트: `completionPassReason === 'standard_cycle'` 유지.
- **D-pres (PR-02).** 깊은 픽스처에서 latch 시 `peakAnchorTruth` 노출.
- **E.** 얕은 low-ROM 궤적: rule 또는 event 경로가 완전히 막히지 않음.
- **F.** 금지 엔진 파일 diff 0.

## Why this avoids prior regressions

- 통과 **이유**·owner·finalize·이벤트 승격 **조건**은 그대로이므로, 깊은 `standard_cycle`과 얕은 event/low-ROM 경로의 정책 분기를 바꾸지 않는다.
- 바뀌는 것은 progression·shallow event에 쓰이는 **피크 인덱스/깊이의 소유자**를 completion의 commitment-safe 앵커와 한 줄로 맞추는 것과, trace에 그 사실을 라벨로 노출하는 것뿐이다.
- `committedFrame == null`이면 helper가 `undefined`를 반환하므로 서 있는 상태에서 reversal 앵커가 열리지 않는 기존 방어가 유지된다.
