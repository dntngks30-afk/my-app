# PR-COMP-01 — 스쿼트 completion pass: cycle truth 명시화·레거시 정렬

## Findings (요약)

- **최종 pass / `completionSatisfied`**: `evaluateExerciseAutoProgress`의 스쿼트 분기는 이미 `getSquatProgressionCompletionSatisfied`만 사용하며, 여기서 **`evaluator.debug`의 `standing_recovered` + `completionBlockedReason`**(즉 `squat-completion-state`)에 의존한다.
- **Guardrail squat complete**: `highlightedMetrics.completionSatisfied` 동일 소스 — 깊이 “통과 점수”가 아니라 **사이클 완료**와 이미 정렬됨.
- **레거시 병렬 truth**: `evaluateSquatCompletion`(phase count + bottom 필수 + `ascentRecovered`)는 `getCompletionSatisfied`의 스쿼트 분기에만 연결되어 있었고, **메인 게이트 경로에서는 호출되지 않음**. 혼란·드리프트 방지를 위해 **evaluator `completionSatisfied`로 단일화**했다.
- **confidence 보너스**: `getStableSignalBonus`가 스쿼트에서 descent/bottom/ascent **프레임 카운트**로 보너스를 줬는데, 이는 **completion과 불일치**할 수 있어 **cycle 완료 여부**로 통일했다.

## 유지한 것

- `squat-completion-state.ts` 내 하강·역전·상승·복귀·저ROM·PR-CAM-02 타이밍 가드 등 **실제 사이클 판정 로직**.
- Evaluator metrics / depthBand / quality 해석, `getSquatProgressionCompletionSatisfied`의 evidence 캡(PR-CAM-02), pass latch / audio / readiness / 페이지 구조.

## 바꾼 것

- 명시적 **completion 상태기계 라벨** + **pass reason** (`standard_cycle` 등) 파생·노출.
- 레거시 `evaluateSquatCompletion`·`getStableSignalBonus`(squat)를 **completion 단일 truth**에 맞춤.

## 리스크

- `getStableSignalBonus` 변경으로 동일 클립에서 confidence 소수 변동 가능(통과 임계 근처).
- 새 문자열 필드는 additive; 스키마 계약 변경 없음.

## Plan → Implementation (파일)

| 파일 | 변경 |
|------|------|
| `src/lib/camera/squat-completion-machine.ts` | 신규: `deriveSquatCompletionMachinePhase`, `deriveSquatCompletionPassReason` |
| `src/lib/camera/squat-completion-state.ts` | 상태에 `completionMachinePhase`, `completionPassReason` 부착 |
| `src/lib/camera/evaluators/squat.ts` | `highlightedMetrics` 노출 |
| `src/lib/camera/auto-progression.ts` | `SquatCycleDebug` 필드, 레거시 completion/bonus 정렬 |
| `src/lib/camera/camera-trace.ts` | 스냅샷에 필드 전달 |
| `docs/pr/PR-COMP-01.md` | 본 문서 |

## Acceptance

- 저ROM이라도 사이클 명확 시 통과: 기존 `squat-completion-state` 유지로 충족.
- 하강만/노이즈: 기존 게이트 유지.
- capture invalid: guardrail·`progressionPassed` 불변.
- 오버헤드·retry·result schema: 미수정.

## 다음 PR-COMP-02 포인트

- Retry 정책·복구 UX는 별도 PR.
- 필요 시 `completionMachinePhase` 기반 라이브 cue 세분화.
