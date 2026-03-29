# PR-CAM-ULTRA-LOW-ROM-EVENT-GATE-01 — Ultra-low-rom event promotion ascent integrity

## Findings from latest JSON

- `completionPassReason === "ultra_low_rom_event_cycle"` while seated / bottom dwell 위주.
- `relativeDepthPeak = 0.02`, `eventCycleSource = "rule_plus_hmm"`.
- `reversalConfirmedAfterDescend = false`, `recoveryConfirmedAfterReversal = false`.
- `bottom.frameCount` 큼, `ascent.frameCount` 매우 작음 — **실제 상승 completion truth**와 이벤트 승격이 어긋남.

## Why seated false positive comes from ultra-low-rom event path

- Rule 체인이 `not_confirmed`인데도 `evaluateSquatCompletionState` 하단 **event promotion**이 `squatEventCycle.detected`·finalize·서 있기 복귀 등만 맞으면 `ultra_low_rom_event_cycle`로 승격할 수 있었다.
- HMM 보조(`rule_plus_hmm`)로 이벤트 사이클이 열리면, completion 코어의 **명시 역전(progressive reversal)** 없이도 승격이 가능한 틈이 있었다.

## Why shallow `no_reversal` remains a separate issue

- 본 PR은 **ultra-low-rom 이벤트 승격**만 좁힌다. rule 단계의 `no_reversal`·reversal 디텍터·임계값은 변경하지 않는다.
- 얕은 궤적에서 rule이 막히는 문제는 별도 트랙(예: shallow motion/window truth, PR #20/#21 스코프)으로 남는다.

## Scope

- `ultraLowRomEventPromotionMeetsAscentIntegrity` 헬퍼 추가(스펙대로 180ms 고정).
- `canEventPromote`에 `ultraLowRomEventPromotionAllowed` 결합:
  - `squatEventCycle.band === 'ultra_low_rom'` 일 때만 추가 조건이 의미 있음.
  - **completion `evidenceLabel !== 'ultra_low_rom'`** 이면 승격을 막지 않음 — 이벤트 윈도(locked primary)는 ultra 밴드여도 completion 쪽이 이미 low_rom/standard이면 JSON 클래스(ultra evidence + 앉은 자세 FP)가 아니므로, 블렌드 얕은 사이클 회귀를 피한다.
- `reversalConfirmedAfterDescend` / `recoveryConfirmedAfterReversal`를 코어 반환·타입에 노출(트레이스·게이트 입력, 제거 금지 요구와 정렬).

## Non-goals

- `squat-event-cycle.ts`, `squat-reversal-confirmation.ts`, `auto-progression.ts`, `pose-features.ts`, `squat-completion-arming.ts`, `evaluators/squat.ts` 수정 없음.
- threshold / `STANDARD_OWNER_FLOOR` / `LOW_ROM_LABEL_FLOOR` / finalize 수치 변경 없음.
- `PR_04E3B_NO_EVENT_PROMOTION_BLOCKS` 변경 없음.
- `completionPassReason` 코어 산식(standard/low/ultra rule path) 변경 없음.

## Files changed

- `src/lib/camera/squat-completion-state.ts`
- `scripts/camera-ultra-low-rom-event-gate-01-smoke.mjs`
- `docs/pr/PR-CAM-ULTRA-LOW-ROM-EVENT-GATE-01.md`

## Acceptance tests

- A: ultra evidence + 무역전·무 180ms tail → helper `false` (승격 게이트에서 차단).
- B: progression reversal 또는 `squatReversalToStandingMs >= 180` → helper `true`.
- C: 서 있기만 → 미통과.
- D: PR-7식 얕은 사이클 → `low_rom` 유지·통과.
- E: 깊은 standard → `standard_cycle`.
- F: 금지 엔진 파일 diff 0.

## Why this avoids prior regressions

- low_rom 이벤트 밴드는 `ultraLowRomEventCandidate === false` 로 게이트가 적용되지 않는다.
- completion evidence가 ultra가 아닌 경우 승격을 추가로 막지 않아, primary/blended 불일치로 생기는 **의미 있는 얕은 통과**를 보존한다.
- ultra evidence + ultra 이벤트 후보만 상승/역전 무결성을 요구해, JSON에 가까운 **앉은 채 ultra 이벤트 승격**만 제거한다.

## Must-mention (요약)

- Latest JSON: `ultra_low_rom_event_cycle` with `reversalConfirmedAfterDescend=false`, `eventCycleSource=rule_plus_hmm`.
- This PR does not change thresholds or deep/standard path.
- This PR only narrows ultra-low-rom **event promotion** (plus evidence bypass for non-ultra completion label).
