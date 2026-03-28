# CAM-PASS-LATCH-DIAG-RECOVERY-01

## 상태 라벨

- **CURRENT_IMPLEMENTED**: 스쿼트 페이지·`camera-trace`·`TraceDebugPanel`·성공 진단 스냅에 반영된 진단 전용 변경.
- **NOT_YET_IMPLEMENTED**: PASS 대비 래치 실패의 근본 원인 수정(본 PR 범위 밖).

## 목적

엔진 `gate.status === 'pass'`와 페이지 `effectivePassLatched` / `latchPassEvent` 사이 간극이 있을 때 **관측·localStorage·export가 조용히 비는 문제**를 완화한다. **모션 임계·finalize·owner·CameraPreview·음성·settle 타이밍은 변경하지 않는다.**

## 변경 요약

1. **`camera-trace.ts`**
   - `buildSquatAttemptObservation`에 누락돼 있던 `csFull`(squatCompletionState) 바인딩 — 기존 코드가 `ReferenceError`로 관측 전체가 try/catch에서 무시될 수 있던 결함 수정.
   - 진단 전용 관측 이벤트: `diag_pass_visible_not_latched`(개발 환경만), `diag_stepid_mismatch`, `diag_no_debug_attach` — 세션키 기준 스로틀(~1.3s).
   - `observationDedupSkip`: `diag_*`는 140ms 중복 스킵 대상에서 제외.

2. **`squat/page.tsx`**
   - 캡처 중 `gate.status === 'pass'`이고 `effectivePassLatched === false`일 때 dev 전용 `recordSquatPassVisibleNotLatchedObservation` + `passGapObservedRef`로 이후 성공 스냅에 전달 가능.
   - 관측 effect: `stepId !== 'squat'` / `!sc && !hm` 시 위 fallback 마커 기록 후 return.
   - `latchPassEvent`: `getRecentSuccessSnapshots()`로 스쿼트 성공 스냅 유무를 반영한 `passVisibleWithoutSuccessSnapshotPrior`, `passVisibleButNotLatchedPrior` 전달.

3. **`TraceDebugPanel.tsx`**
   - Export에 `failedShallowSnapshots`, `exportSummary`(각 배열 length) 포함.
   - 헤더에 failed_shallow 개수 표시.

4. **`camera-success-diagnostic.ts`**
   - `SquatSuccessSnapshot` / `RecordSquatSuccessOptions`에 additive 필드: `passVisibleButNotLatched`, `passVisibleWithoutSuccessSnapshot`(및 Prior 옵션).

## 검증

```bash
npx tsx scripts/camera-pass-latch-diag-recovery-smoke.mjs
```

## 수동 확인

- 스쿼트 캡처에서 디버그에 PASS가 보이나 래치가 안 되는 상황 → export에 `diag_pass_visible_not_latched` 또는 `diagPassLatchGap` 확인.
- Retry 1회 → `attempts` 또는 관측에 최소 1건 이상.
- Export JSON에 `failedShallowSnapshots`·`exportSummary` 존재.
- localStorage 항목 수가 비정상 증가하지 않는지(스로틀).

## 비목표

- 통과 임계 완화, 강제 래치, public/결제/실행 코어 변경.
