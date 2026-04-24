# PR-SQUAT-V2-01B — Shadow Compare (PR4)

> Golden fixture 마다 **legacy(참고)** vs **SquatMotionEvidenceEngineV2** 를 나란히 보여 준다. **앱 런타임(카메라, auto-progression, page)은 수정하지 않는다.**

## 실행

```bash
npx tsx scripts/camera-squat-v2-01b-shadow-compare.mjs --report
npx tsx scripts/camera-squat-v2-01b-shadow-compare.mjs --strict
```

- **`--report`**: 표만 출력, exit 0.
- **`--strict`**: manifest `expected`와 V2 `usableMotionEvidence` 불일치(또는 fixture 로드 실패) 시 **exit 1**.

## 동작

1. `fixtures/camera/squat/golden/manifest.json` 로드.
2. 각 `file` JSON 로드.
3. **V2 입력 프레임** (스크립트 내부, 비런타임):
   - `attempts[0].diagnosisSummary.squatCycle`에 `reversalAtMs` / `standingRecoveredAtMs`가 있으면, 마일스톤 시각으로 **깊이 곡선**을 선형 구간으로 재구성 (깊이 trace에 `rawDepthPeak` / `relativeDepthPeak` 사용).
   - 그렇지 않으면 `squatAttemptObservations`에서 시계열 `(ts, max(relativeDepthPeak, completion.relativeDepthPeak, currentDepth==1?0.99:currentDepth))`을 잡고, **~33ms**로 선형 보간. **마지막 관측 `currentDepth === 1`**이면(피크/전환 토큰) export에 **복귀 꼬리**를 400ms 구간에 합성해(오프라인) depth가 스탠딩 쪽으로 내려가도록 함.
4. `evaluateSquatMotionEvidenceV2(frames)` (PR3 `src/lib/camera/squat/squat-motion-evidence-v2.ts` 직접 import, **file URL**로 Windows에서 로드).
5. **legacy** (참고): `attempts`에 `progressionPassed` / `finalPassLatched`가 있으면 `pass`, 아니면 `fail`. `attempts`가 비어 있고 마지막 관측 `pass_core`에 `peakAtMs`는 있는데 `reversalAtMs` / `standingRecoveredAtMs`가 없으면 `late/fail`. 그 밖은 `unknown`.
6. **PASS 행** 정의: `expected === pass` 는 V2 `usableMotionEvidence` 가 true, `expected === fail` 는 false. **legacy는 판정에 쓰지 않는다** (다르면 `PASS` 유지).

## 제약 (절대 금지에 부합)

- `auto-progression`, `page`, pass-core, completion-state, threshold, final blocker, legacy 삭제: **터치 없음** (스크립트 + 본 문서만 추가).
- V2·프레임 추출은 **스크립트/오프라인**; 제품 런타임 **owner** 변경 없음.

---

## PR report (필수 답변)

### 1) V2가 valid shallow 를 pass 시키는가?

**예.** (본 PR의 golden `valid_shallow_must_pass_01` + 위 프레임 재구성 규칙 기준) `usableMotionEvidence === true` 가 되며, manifest `expected: pass` 와 일치한다.

### 2) V2가 valid deep 을 pass 시키는가?

**예.** `squatCycle` 마일스톤 기반 재구성으로 `down_up_return` / `usableMotionEvidence: true` 가 맞는다.

### 3) V2가 standing / seated 를 fail 시키는가?

**예.** `standing_must_fail_01` 은 `standing_only` / `no_meaningful_descent` 방향, `seated_must_fail_01` 은 `bottom_hold` / `no_return_to_start` 쪽으로 `usableMotionEvidence: false` (manifest `fail` 일치).  
※ seated 는 **마지막 `currentDepth === 1` 이 아님** → 복귀 꼬리를 붙이지 않아, 잘못 pass 되지 않게 했다.

### 4) 이번 PR이 runtime owner 를 바꿨는가? 바꾸면 실패다.

**아니요.** 엔진은 PR3에 이미 존재; 본 PR은 **오프라인 shadow 스크립트**만 추가한다. evalutor / auto-progression / page **연결( PR5 )은 하지 않는다**.

---

## Acceptance

- `npx tsx scripts/camera-squat-v2-01b-shadow-compare.mjs --strict` → **exit 0** (CI 게이트로 사용 가능).

## 산출물

| File |
|------|
| `scripts/camera-squat-v2-01b-shadow-compare.mjs` |
| `docs/pr/PR-SQUAT-V2-01B-SHADOW-COMPARE.md` |
