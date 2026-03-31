# PR-SQUAT-ULTRA-LOW-NO-EARLY-PASS-02

## 목적

**trajectory rescue alone**(committed peak 앵커 + `reversalConfirmedAfterDescend`)이 shallow return proof(기존 stream bundle / primary-drop closure fallback / stream bridge) 없이도 `ultra_low_rom_cycle` 등으로 닫히던 false positive를 막는다.

## CURRENT_IMPLEMENTED (본 PR)

1. **`shallowRomClosureProofSignals`** (`squat-completion-state.ts`)  
   - `officialShallowPrimaryDropClosureFallback`를 closure 증거 OR에 포함(기존 `shallowReturnProofSatisfied` 산식과 정합).  
   - `trajectoryRescue.trajectoryReversalConfirmedBy === 'trajectory' && !shallowReturnProofSatisfied` 인 경우, progression 앵커 존재만으로는 closure 증거로 치지 않음.

2. **`resolveSquatCompletionPath`**  
   - 공식 shallow 후보·승인·owner-얕은 대역인데 `shallowRomClosureProofSignals === false`이면, evidence 라벨만으로 `low_rom_cycle` / `ultra_low_rom_cycle` 폴백을 열지 않고 `not_confirmed`.

## LOCKED_DIRECTION

- 얕은 스쿼트 legitimate pass 유지(explicit ascent 또는 기존 세 가지 return proof 중 하나).  
- standard / deep 경로·이벤트 승격 정책·전역 threshold 변경 없음.

## NOT_YET_IMPLEMENTED

- `auto-progression.ts` ultra-targeted guard: 본 PR에서 completion-state만으로 게이트 스모크 통과 → **미적용**.

## 검증

- `npx tsx scripts/camera-squat-ultra-shallow-live-regression-01-smoke.mjs`  
- `npx tsx scripts/camera-squat-ultra-shallow-no-early-pass-guarantee-01-smoke.mjs` (D1/D2/D3)  
- `npx tsx scripts/camera-pr-ascent-integrity-rescue-01-smoke.mjs`
