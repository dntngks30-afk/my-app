# PR-SHALLOW-SQUAT-FINALIZE-BAND-01

## Findings

### Confirmed Root Cause (최신 JSON + main 코드 일치)

최신 관측 JSON에서 아래 패턴이 반복적으로 확인됨:

```
relativeDepthPeak: 0.09~0.38
completionBlockedReason: "recovery_hold_too_short"
```

main 코드 분석:

| 상수 | 값 | 역할 |
|---|---|---|
| `STANDARD_LABEL_FLOOR` | 0.10 | `evidenceLabel='standard'` 시작점 (quality/interpretation) |
| `STANDARD_OWNER_FLOOR` | 0.40 | `completionPassReason='standard_cycle'` owner 임계 |
| `MIN_STANDING_RECOVERY_HOLD_MS` | 160ms | standard finalize 홀드 요구량 |
| `LOW_ROM_STANDING_RECOVERY_MIN_HOLD_MS` | 60ms | low_rom finalize 홀드 요구량 |

**구조적 불일치:**
- `relativeDepthPeak=0.15`: `evidenceLabel='standard'` (0.15 ≥ STANDARD_LABEL_FLOOR=0.10)
- `getStandingRecoveryFinalizeGate(evidenceLabel='standard', ...)` → 160ms hold 요구
- 그런데 owner 기준: `completionPassReason`은 `low_rom_event_cycle` (0.40 미만이므로 절대 standard_cycle 아님)

→ **0.10~0.39 구간**: quality 라벨은 'standard'이지만 owner는 절대 standard_cycle이 아닌 구간이, standard finalize hold(160ms)를 강요받는 미스매치.

### Why This Is Not a Threshold PR

이 PR은 threshold 값을 하나도 변경하지 않는다.

- `STANDARD_OWNER_FLOOR = 0.40` — 불변
- `STANDARD_LABEL_FLOOR = 0.10` — 불변
- `MIN_STANDING_RECOVERY_HOLD_MS = 160` — 불변
- `LOW_ROM_STANDING_RECOVERY_MIN_HOLD_MS = 60` — 불변
- `detectSquatReversalConfirmation` threshold — 불변

변경한 것은 **standing recovery finalize 게이트에 어떤 band를 넣느냐의 선택**이다. 기존에는 quality label(`evidenceLabel`)을 그대로 전달했고, 이번에는 owner 기준과 정렬된 별도 `standingRecoveryFinalizeBand`를 전달한다.

---

## Scope

**변경 파일:** `src/lib/camera/squat-completion-state.ts` 단독

**변경 내용:**
1. `getStandingRecoveryFinalizeBand(relativeDepthPeak, attemptAdmissionSatisfied)` 헬퍼 추가
2. `evaluateSquatCompletionCore` 내 `standingRecoveryFinalizeBand` 별도 계산
3. `getStandingRecoveryFinalizeGate(evidenceLabel → standingRecoveryFinalizeBand, ...)` 호출 전환
4. `computeBlockedAfterCommitment` blocked reason 분기: `evidenceLabel → standingRecoveryFinalizeBand`
5. 반환값 `standingRecoveryBand: evidenceLabel → standingRecoveryBand: standingRecoveryFinalizeBand`

**새 band 정의:**
```
relativeDepthPeak >= STANDARD_OWNER_FLOOR (0.40) → 'standard'
relativeDepthPeak >= LOW_ROM_LABEL_FLOOR (0.07) && < 0.40 → 'low_rom'
relativeDepthPeak < 0.07 && attemptAdmissionSatisfied → 'ultra_low_rom'
그 외 → 'insufficient_signal'
```

---

## Non-goals

- `evidenceLabel` 변경 금지 — quality/interpretation 라벨은 그대로
- `STANDARD_OWNER_FLOOR`, `STANDARD_LABEL_FLOOR` 등 임계값 변경 금지
- `completionPassReason` 결정 로직 변경 금지
- `eventCyclePromoted` / `PR_04E3B_NO_EVENT_PROMOTION_BLOCKS` 변경 금지
- `auto-progression.ts`, `pose-features.ts`, `squat-event-cycle.ts` 등 외부 파일 변경 금지
- `standingRecoveryBand` 이외 기존 필드 의미 변경 금지

---

## Files Changed

```
src/lib/camera/squat-completion-state.ts
  + getStandingRecoveryFinalizeBand() helper (L378 근처)
  ~ evaluateSquatCompletionCore(): standingRecoveryFinalizeBand 도입
  ~ computeBlockedAfterCommitment(): finalizeBand 기준 blocked reason
  ~ return: standingRecoveryBand = standingRecoveryFinalizeBand

scripts/camera-shallow-squat-finalize-band-01-smoke.mjs (신규)
docs/pr/PR-SHALLOW-SQUAT-FINALIZE-BAND-01.md (본 문서)
```

---

## Acceptance Tests

### A. shallow finalize mismatch 회귀 방지

```
✓ A1: depth ~0.15 → standingRecoveryBand=low_rom (PR 핵심 변경)
✓ A2: depth ~0.15 → evidenceLabel=standard (quality label 불변)
✓ A3: depth ~0.30 → standingRecoveryBand=low_rom (0.40 미만)
✓ A4: depth ~0.30 → evidenceLabel=standard (0.10 이상)
✓ A5: depth peak ~0.40 (relative ~0.39) → standingRecoveryBand=low_rom
✓ B1: 얕은 스쿼트 finalize 차단 시 low_rom 문맥 사용 (recovery_hold_too_short 아님)
✓ B2: 얕은 스쿼트 finalize 차단 시 recovery_hold_too_short 아님
```

### B. standing still false positive 방지

```
✓ D1: 제자리 → completionSatisfied=false
```

### C. no_reversal 케이스 보존

```
✓ C1: 역전 없는 하강 → completionSatisfied=false
✓ C2: 역전 없는 하강 → completionBlockedReason=no_reversal
```

### D. deep standard success 회귀 없음

```
✓ E1: 깊은 스쿼트 → standingRecoveryBand=standard
✓ E2: 깊은 스쿼트 → evidenceLabel=standard
✓ E3: 깊은 스쿼트 성공 → completionPassReason=standard_cycle
✓ E4: 깊은 스쿼트 auto-progression gate 구조 정상
```

### E. 기존 PR-7 smoke 전체 통과 (회귀 없음)

```
18 passed, 0 failed
```

### F. 타입/린트 오류 없음

```
ReadLints → No linter errors found
```

---

## Rollback

`getStandingRecoveryFinalizeGate` 호출 시 `standingRecoveryFinalizeBand` → `evidenceLabel`으로 되돌리고,
`computeBlockedAfterCommitment` blocked reason 분기를 동일하게 되돌리면 즉시 revert 가능.
모든 변경이 `squat-completion-state.ts` 한 파일 안에 국한된다.

---

## Why This Avoids Prior Regressions

### event cycle 승격 차단 유지

`PR_04E3B_NO_EVENT_PROMOTION_BLOCKS` 목록에 `low_rom_standing_finalize_not_satisfied`가 포함되어 있으므로,
finalize 차단 시 event cycle 승격이 여전히 방지된다.

### standing still / no_reversal 차단 유지

`computeBlockedAfterCommitment`는 `reversalFrame == null → 'no_reversal'` 분기가 finalize 체크보다 먼저이므로
역전 없는 케이스는 변경 영향을 받지 않는다.

### deep squat unaffected

`relativeDepthPeak >= STANDARD_OWNER_FLOOR (0.40)` → `standingRecoveryFinalizeBand='standard'` → 기존과 동일한 standard finalize gate.

### evidenceLabel unaffected

`getSquatEvidenceLabel`은 그대로이므로 quality/interpretation 라벨, `completionPassReason` 결정, evaluator의 `depthBand/romBand` 출력에 영향 없음.

---

## Device Observation Workflow

PR 적용 후 실기기 번들을 확인할 때:

1. `standingRecoveryBand` 필드를 확인한다.
   - `relativeDepthPeak < 0.40`이면 `low_rom` 또는 `ultra_low_rom`이어야 한다.
   - `standard`이면 PR 변경이 반영되지 않은 것.
2. `completionBlockedReason` 필드를 확인한다.
   - `relativeDepthPeak 0.10~0.39` 구간에서 `recovery_hold_too_short`가 여전히 나오면 — 배포 캐시 확인.
   - `low_rom_standing_finalize_not_satisfied`가 나오면 — PR 적용 + finalize 기준 미충족(정상).
3. `completionPassReason`은 owner 소유권이므로, depth 0.10~0.39 구간 성공은 여전히 `low_rom_event_cycle`.
