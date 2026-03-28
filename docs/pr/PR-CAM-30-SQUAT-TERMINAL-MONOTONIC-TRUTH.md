# PR-CAM-30 — Squat terminal monotonic truth

## 왜 threshold PR이 아닌가

같은 시도(프레임 시퀀스) 안에서 `completionBlockedReason`이 단계적으로 진행된 뒤(역전·상승·스탠딩 복귀 등) 다시 `no_reversal` 같은 **이전 단계 사유로 보이도록 역행**하는 것은, 임계가 아니라 **표시되는 blocked reason의 일관성(truth stability)** 문제다. 본 PR은 `squat-completion-state`에서 최종 `completionBlockedReason`만 단계별 허용 집합으로 정규화해 **역행만 제거**하며, `completionSatisfied`·finalize·홀드·타이밍·HMM 입력 산식·임계 상수·owner 라우팅·UI/음성은 건드리지 않는다.

## 무엇이 바뀌었는가

- `src/lib/camera/squat-completion-state.ts`에만 `normalizeCompletionBlockedReasonForTerminalStage`를 두고, HMM assist 이후·최종 반환 직전에 한 번 적용한다.
- 규칙 순서: 통과 시 `null` → 스탠딩 복귀 시각이 잡힌 뒤에는 finalize/홀드 계열만 허용(그 외는 `recovery_hold_too_short`) → 역전 확정 후에는 `not_standing_recovered` 및 finalize 계열만 허용(그 외는 `not_standing_recovered`) → 시도+하강 커밋 후에는 `no_reversal` → 그 앞 단계는 기존 사유 유지.
- `postAssistCompletionBlockedReason`은 정규화 **전** raw를 그대로 유지해 추적 의미를 보존한다.

## 의도적으로 바꾸지 않은 것

- 임계·hold-ms·confidence·래치 프레임·primary/blended 라우팅·`completionPassReason` 산출 로직(정규화된 blocked가 null일 때의 기존 분기).
- `auto-progression`, squat 페이지, `components/camera`, `lib/motion`, trace/diagnostic, 기타 카메라 모듈.

## 수락 테스트 (스모크)

스크립트 `scripts/camera-cam30-squat-terminal-monotonic-truth-smoke.mjs` 다섯 그룹:

1. **A** — 얕은 사이클 프리픽스: 역전이 확정된 프리픽스에서 `completionBlockedReason === 'no_reversal'` 금지, 전체 시퀀스 통과.
2. **B** — 깊은 사이클 프리픽스: 동일 단조 조건, 전체 통과.
3. **C** — 통과한 얕은/깊은 시퀀스에 스탠딩 20프레임 확장: `completionSatisfied` 및 gate pass 유지.
4. **D** — micro-bend: 여전히 실패(오탐 없음).
5. **E** — 계약 문자열: 얕은(초저 ROM) 픽스처는 `ultra_low_rom_event_cycle`, 깊은 픽스처는 `standard_cycle` 유지.

검증 명령:

- `npx tsx scripts/camera-cam30-squat-terminal-monotonic-truth-smoke.mjs`
- `npx tsx scripts/camera-cam29-shallow-phase-completion-truth-smoke.mjs`
- `npx tsx scripts/camera-cam25-squat-easy-final-pass-smoke.mjs`
