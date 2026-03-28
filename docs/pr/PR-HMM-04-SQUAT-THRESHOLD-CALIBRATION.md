# PR-HMM-04 — Squat HMM assist threshold calibration

## 실기기 패턴에서 본 근거

shallow attempt에서 **타이밍만 `descent_span_too_short`로 막히는** 경우, Viterbi HMM은 종종 **confidence ≈ 0.44~0.46** 구간에 머문다. 구 단일 막대(0.45 / 0.02)에서는 동일 시퀀스가 assist 탈락해 **false negative**가 난다. 반면 **진짜 standing jitter**는 `completionCandidate === false` 또는 confidence·excursion이 동시에 낮아 reason별 문턱을 넘기 어렵다.

`no_reversal`은 rule·phase 불일치 시 **조기 오개방** 리스크가 있어, 동일 깊이 대비 **confidence·excursion을 약간 상향**해 방어한다.

## Old vs new threshold

| Reason | 이전 (전역 단일) | 이후 (reason별) |
|--------|------------------|-----------------|
| `descent_span_too_short` | conf ≥ 0.45, exc ≥ 0.02, d/a ≥ 2 | conf ≥ **0.42**, exc ≥ **0.018**, d/a ≥ 2 |
| `no_descend` | 위와 동일 | **변경 없음** (0.45 / 0.02 / 2 / 2) |
| `no_reversal` | 위와 동일 | conf ≥ **0.50**, exc ≥ **0.021**, d/a ≥ 2 |

`assistSuppressedByFinalize` 등 **관측용 “강한 HMM”** 막대는 PR-HMM-03A와 동일하게 **0.45 / 0.02 / 2 / 2**를 유지한다 (`hmmMeetsStrongAssistEvidence`).

## False negative 완화 의도

- `descent_span_too_short`: 이미 standing·finalize를 통과한 뒤 **descent duration 타이밍**만 막는 케이스에 한해, 약한 HMM confidence도 assist 후보로 인정.

## False positive 방어 근거

- **Jitter**: HMM이 후보가 아니거나(`completionCandidate` false), excursion·confidence가 동시에 낮아 **세 reason 중 어느 문턱도 통과하지 못함** (02B·04B 스모크).
- **Finalize 계열**: `NON_ASSIST_RECOVERY_OR_FINALIZE` 및 rule truth 불변 (02B D/E, 04C, cam27).
- **no_reversal**: 문턱 상향으로 “얕은 사이클 + 애매한 HMM”의 오개방 여지 축소; 기존 깊은 픽스처(02B C)는 여전히 통과.

## Calibration trace

`buildSquatCalibrationTraceCompact`에 **`t: { c, e, d, a }`** 추가 — 현재 `ruleCompletionBlockedReason`에 매핑된 **적용 임계 스냅샷** (짧은 키, payload 과대화 방지).

## 남은 리스크

- 실기기 노이즈·프레임레이트에 따라 borderline 구간은 여전히 존재; 다음 라운드는 **현장 로그의 `rb`/`hc`/`he`/`t`**를 묶어 미세 조정.
- `descent_span`만 완화했으므로 다른 blocked reason과의 **교차 오판**은 스모크·dogfooding으로 계속 감시.

## Acceptance

- 스모크: `camera-pr-hmm-03a`, `02b`, `01b`, `cam27`, `camera-pr-hmm-04` 전부 통과.
- completion / finalize / assist reason **범위** 불변; 변경은 `src/lib/camera/squat/squat-hmm-assist.ts`의 **임계 상수**와 calibration compact뿐.
