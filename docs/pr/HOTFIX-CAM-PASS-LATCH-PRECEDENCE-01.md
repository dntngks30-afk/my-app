# HOTFIX-CAM-PASS-LATCH-PRECEDENCE-01

## 상태

- **CURRENT_IMPLEMENTED**: 스쿼트 캡처 effect에서 `settledRef` 단락과 `isFinalPassLatched` 기반 성공 래치의 선행 순서.
- **LOCKED_DIRECTION**: 성공은 여전히 `latchPassEvent()` 경로만 사용; raw `gate.status === 'pass'` 단독 강제 없음.

## 문제

`retry`/`fail` 분기에서 `settledRef.current = true`가 설정된 뒤, 동일 캡처 세션에서 엔진이 `isFinalPassLatched` 조건을 충족해도, effect 초입의 `settledRef` early-return 때문에 **`effectivePassLatched` 분기(래치·settle)에 도달하지 못하는** 순서 버그가 있을 수 있음.

## 변경

1. **`squat/page.tsx`**  
   - `permissionDenied || !cameraReady`만 먼저 반환.  
   - `squatCaptureShouldClearSettledForPassLatch({ settled, finalPassLatched, passLatched })`로, **`finalPassLatched && !passLatched`일 때만** `settledRef`를 해제.  
   - 해제 시 `recordPassLatchOrderingDiag`로 additive 진단 기록(스로틀은 모듈 내).

2. **`camera-success-diagnostic.ts`**  
   - `squatCaptureShouldClearSettledForPassLatch`  
   - `PassLatchOrderingDiagEntry`, `recordPassLatchOrderingDiag`, `getRecentPassLatchOrderingDiags`  
   - 키: `moveReCameraPassLatchOrderDiag:v1`

## 비목표

- 스쿼트 모션 임계·owner·finalize·CameraPreview·음성·settle 시간 상수 변경 없음.

## 검증

```bash
npx tsx scripts/camera-hotfix-pass-latch-precedence-smoke.mjs
npx tsx scripts/camera-pass-latch-diag-recovery-smoke.mjs
```
