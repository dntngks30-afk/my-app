# PR-E1B-PEAK-ANCHOR-CONTAMINATION-01

## Root-cause note

### 문제 현상
Shallow squat 시도에서 canonical shallow closure 가 영구적으로 불가능한 false-negative 발생.
로그 패턴: `peakLatchedAtIndex = 0`, `peak_anchor_at_series_start`, `anti_false_pass_blocked`, `canonicalShallowContractAntiFalsePassClear = false`.

### 원인 경로

```
evaluateSquatCompletionCore()
  └─ committedOrPostCommitPeakFrame?.index → peakLatchedAtIndex = 0
       (시리즈 시작 오염: 기기 초기화 스파이크, baseline 확립 전 높은 신호 등)

buildCanonicalShallowContractInputFromState(state)
  └─ peakLatchedAtIndex: state.peakLatchedAtIndex ?? null   ← 원래 코드: raw값 그대로 전달

deriveCanonicalShallowCompletionContract(input)
  └─ antiFalsePassFromInput(input)
       └─ input.peakLatchedAtIndex !== 0   ← 항상 false → anti_false_pass_blocked → satisfied=false
```

`getGuardedShallowLocalPeakAnchor()` 가 이미 시리즈 시작 오염을 제거한 유효 local peak(index > 0)를
찾아낼 수 있음에도, 그 결과가 canonical contract 입력에 반영되지 않아 canonical 경로가 영구 차단됨.

### 핵심 구조 사실
1. `getGuardedShallowLocalPeakAnchor()` → windowStart = max(1, committedFrame.index) 로 시리즈 시작 오염 명시적 제외.
2. 결과(`guardedShallowLocalPeakFound`, `guardedShallowLocalPeakIndex`)는 이미 canonical derive 이전(line 4720) 에 state에 stamped 됨.
3. `buildCanonicalShallowContractInputFromState()` 는 raw `state.peakLatchedAtIndex` 만 사용 — guarded local peak를 활용하지 않음.

---

## 수정 내용

### 변경 파일
- `src/lib/camera/squat-completion-state.ts` — `buildCanonicalShallowContractInputFromState()` 내부에 canonical 전용 peak index 보정 로직 추가.

### 핵심 변경

```typescript
// PR-E1B: canonical anti-false-pass 입력 peak index 보정
const rawPeakLatchedAtIndex = s.peakLatchedAtIndex ?? null;
const localPeakIdx = s.guardedShallowLocalPeakIndex ?? null;
const canonicalPeakLatchedAtIndex =
  rawPeakLatchedAtIndex === 0 &&
  s.officialShallowPathAdmitted === true &&
  s.guardedShallowLocalPeakFound === true &&
  localPeakIdx != null &&
  localPeakIdx > 0
    ? localPeakIdx
    : rawPeakLatchedAtIndex;
```

그 다음 `peakLatchedAtIndex: canonicalPeakLatchedAtIndex` 으로 canonical contract 에 전달.

### 적용 조건 (AND)
| 조건 | 의미 |
|---|---|
| `rawPeakLatchedAtIndex === 0` | 실제 오염 케이스만 |
| `officialShallowPathAdmitted === true` | shallow 입장된 시도에서만 |
| `guardedShallowLocalPeakFound === true` | 유효 local peak 가 존재할 때만 |
| `localPeakIdx > 0` | 시리즈 시작 오염이 아닌 인덱스 |

---

## 보존된 동작

### 1. False-pass protection 보존
`antiFalsePassFromInput()` 로직 자체는 변경하지 않음. canonical 입력으로 들어오는 `peakLatchedAtIndex` 값만 보정.
- 유효 guarded local peak 가 없으면(guardedShallowLocalPeakFound = false) 보정 미발동 → 원래 raw값(0) 그대로 전달 → anti-false-pass 여전히 실패.
- setupMotionBlocked, evidenceLabel='insufficient_signal' 체크도 그대로 유지.

### 2. 글로벌 peakLatchedAtIndex 보존
`state.peakLatchedAtIndex` 원본 값 변경 없음. 보정은 canonical derive 입력 형성 시점에만 국한됨.
debug/trace/other consumers 는 여전히 raw 값 관찰 가능.

### 3. Deep standard squat 보존
`relativeDepthPeak >= STANDARD_OWNER_FLOOR(0.4)` 케이스는 `officialShallowPathCandidate = false` 이므로
`officialShallowPathAdmitted = false` → 보정 조건 미충족 → 완전히 무관.

### 4. Event-owner downgrade 보존
E1B 픽스는 canonical closer(`applyCanonicalShallowClosureFromContract`)가 성공하는 경우에만 관여.
`eventCyclePromoted`, event rescue pass reason 생성 로직 변경 없음.

### 5. Trajectory rescue provenance 보존
trajectory rescue(`trajectoryReversalRescueApplied`)는 여전히 provenance-only.
canonical contract의 `reversalEvidenceFromInput()` 에는 기여하나, success owner 로 직접 승격되지 않음.

### 6. PR-E1 alignment 보존
`applyCanonicalShallowClosureFromContract()` 내부 `currentSquatPhase: 'standing_recovered'` / `completionMachinePhase: 'completed'` 스탬프(PR-E1) 변경 없음.

---

## 스모크 테스트

새 파일: `scripts/camera-e1b-peak-anchor-contamination-smoke.mjs`

| 섹션 | 시나리오 | 기대 결과 |
|---|---|---|
| A | 하강 후 바닥 정체(no standing return) → guardedShallowLocalPeakFound=false | completion 실패 |
| A2 | 오염 시작 + 하강 있으나 standing 복귀 없음 | completion 실패 |
| B | 정상 얕은 down-up | completionSatisfied, officialShallowPathClosed, canonicalAntiFalsePassClear |
| B2 | 글로벌 peakLatchedAtIndex 불변 확인 | state.peakLatchedAtIndex 원본 보존 |
| C | trajectory rescue provenance 전용 | success owner 아님 |
| D | deep standard_cycle | standard_cycle, officialShallowPathClosed=false |
| E | event-owner downgrade | eventCyclePromoted=false |

결과: 23/23 통과. 기존 스모크(PR-03: 17, PR-E1: 25) 전체 통과.

---

## Non-goals

- `shallow-completion-contract.ts` 변경 없음
- `antiFalsePassFromInput()` 직접 수정 없음
- `state.peakLatchedAtIndex` 전역 교체 없음
- trajectory rescue → direct success owner 전환 없음
- event-cycle 재활성화 없음
- deep squat threshold 변경 없음
- `page.tsx` 변경 없음
