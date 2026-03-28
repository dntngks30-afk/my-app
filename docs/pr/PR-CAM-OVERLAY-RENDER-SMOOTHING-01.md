# PR-CAM-OVERLAY-RENDER-SMOOTHING-01 — Pose overlay render smoothing

**Status:** CURRENT_IMPLEMENTED (병합 후)  
**Scope:** 라이브 카메라 **디버그 스켈레톤 오버레이**만 — evaluator / completion truth / 캡처 입력 불변.

---

## 문제

`CameraPreview`는 `analyzer.analyze()`가 돌려준 **raw** `PoseFrame`을 `onPoseFrame`으로 그대로 넘기고, 동일 프레임을 `drawPoseFrameToCanvas`에 넣어 그렸다.  
평가 파이프라인 쪽 `pose-features` 스무딩과 무관하게, **오버레이만** 관절 튐이 크게 보이는 현상이 있었다.

---

## 목표

- **렌더 경로만** EMA + 짧은 missing carry-forward 로 스무딩한다.
- **`onPoseFrame`에 넘기는 객체는 raw 그대로** — 변형·복제로 대체하지 않는다.
- `ANALYSIS_INTERVAL_MS`·MediaPipe 설정·fatal 재생성 로직·`onPoseFrame` 호출 순서는 유지한다.
- PR-HOTFIX-07: fatal 프레임은 여전히 evaluator/오버레이로 전파하지 않으며, **오버레이 스무딩 상태도 즉시 리셋**하고 캔버스를 비운다.

---

## 구현 요약

### 1. `src/lib/motion/pose-overlay-smoothing.ts` (신규)

- 순수 함수 `smoothPoseOverlayLandmarks(raw, prevState, options?)`
- 랜드마크별 x/y(및 z)·visibility EMA
- 좌표가 잠깐 invalid 할 때 `maxMissingCarryFrames`(기본 2) 동안 직전 스무딩 값 유지
- `raw`가 null/빈 배열이면 `{ landmarks: null, nextState: null }` 로 **완전 리셋**
- 진단용 `meanLandmarkL1DeltaBetweenFrames` (smoke 전용)
- **camera evaluator 모듈 import 없음**

### 2. `src/components/public/CameraPreview.tsx`

- `overlaySmoothingStateRef`로 스무딩 상태만 보관
- 순서 유지: **fatal 인터셉트 → (정상 시) `onPoseFrame(frame)` raw → 스무딩 후 draw**
- fatal 분기: `overlaySmoothingStateRef = null` + `showPoseDebugOverlay` 시 `clearPoseOverlay`
- 랜드마크 없음: 상태 리셋 + `clearPoseOverlay`
- `showPoseDebugOverlay === false`: 상태 리셋 + `clearPoseOverlay`
- 분석 effect cleanup / `shouldAnalyze` false 분기: 상태 리셋

### 3. `src/lib/motion/mediapipe-pose.ts`

- `drawPoseFrameToCanvas(..., { landmarksOverride? })`  
  렌더 시 `landmarksOverride`가 있으면 그 배열로만 연결선/점을 그린다.  
  `visibility <= 0` 인 점/연결은 스킵 (carry 만료 후 placeholder 깜빡임 완화).

---

## 변경하지 않은 것

- Evaluator, guardrail, squat completion, owner 임계, `ANALYSIS_INTERVAL_MS`
- Raw `PoseFrame`을 `onPoseFrame` 이전에 변형하지 않음
- MediaPipe pass/fail, 라우트, 음성

---

## Acceptance Tests

| 항목 | 방법 |
|------|------|
| A–D 자동 | `npx tsx scripts/camera-pr-overlay-render-smoothing-smoke.mjs` (7 assertions) |
| 빌드 | `npm run build` |

---

## 수동 확인 권장

- 디버그 오버레이 켠 상태에서 정지 시 튐 감소
- 실제 스쿼트 시 과도한 러버밴드 느낌 없는지
- fatal 시 이전 스켈레톤이 오래 남지 않는지

---

## Risks / Follow-up

- `positionAlpha` / `maxMissingCarryFrames` 는 실기기에서 미세 조정 가능
- 오버레이만 스무딩하므로 **화면과 evaluator 피드백의 미세한 시각 차이**는 허용 범위로 문서화
