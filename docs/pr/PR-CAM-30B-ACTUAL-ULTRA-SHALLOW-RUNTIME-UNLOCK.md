# PR-CAM-30B — Actual Ultra-Shallow Reversal Unlock for 0.02–0.08 (Runtime)

## Status

**CURRENT_IMPLEMENTED**

- **핵심 런타임** (`guardedUltraShallowReversalAssist`, `hasGuardedShallowSquatAscent`, 구간 분기)은 **PR-CAM-29B** 커밋에서 `squat-reversal-confirmation.ts` / `pose-features.ts`에 반영됨.
- **PR-CAM-30B**는 (1) ultra-shallow guarded **실패 노트**를 스펙 문자열 `guarded_ultra_shallow_no_hit`로 통일하고, (2) **런타임 회귀 전용 스모크** 3종과 본 문서를 추가한다.

---

## 1. Findings

### 93ef251 만 보면 “docs+smoke only”로 보이는 이유

93ef251은 PR-CAM-29C 문서·스모크만 추가한 커밋이다. **그 이전** 438a59d(PR-CAM-29B)에 이미 `[0.02, 0.08)` guarded assist와 guarded ascent phase가 들어가 있다. “0.06에서 막힌다”는 관측은 **29B 이전** 또는 **recovery_hold / 기타 completion 조건**과 겹친 경우로 해석하는 것이 타당하다.

### 0.02~0.08 unlock이 병목인 이유 (역사적)

`relativeDepthPeak < 0.08` 구간은 예전에는 strict 2-frame hit만 허용되어 얕은 ROM에서 `no_reversal`이 빈번했다. 29B에서 monotonic assist + ascent streak + post-peak 길이로 guarded 경로를 열었다.

---

## 2. Files Changed (30B)

| 항목 | 내용 |
|------|------|
| `squat-reversal-confirmation.ts` | 실패 시 note: `guarded_ultra_shallow_no_hit` |
| `scripts/camera-cam30b-ultra-shallow-runtime-reversal-smoke.mjs` | 런타임 reversal + 실패 노트 검증 |
| `scripts/camera-cam30b-guarded-shallow-ascent-runtime-smoke.mjs` | pose-features ascent 런타임 |
| `scripts/camera-cam30b-ultra-shallow-runtime-integration-smoke.mjs` | E2E + 0.08~0.12 + deep 회귀 |
| `docs/pr/PR-CAM-30B-ACTUAL-ULTRA-SHALLOW-RUNTIME-UNLOCK.md` | 본 문서 |
| `docs/pr/PR-CAM-29C-...md` | 실패 노트 명칭 한 줄 정렬 |

---

## 3. Regression Guards

- **standing/jitter:** `relativeDepthPeak < LEGACY_ATTEMPT_FLOOR` → strict-only, guarded 분기 미진입.
- **seated hold / spike:** monotonic assist·ascent streak·post-peak 길이 미충족 → `guarded_ultra_shallow_no_hit`.
- **미수정:** `squat-completion-state`, `squat-event-cycle`, `auto-progression`, `squat-depth-signal`, squat `page.tsx`.

---

## 4. Tests Run

```bash
npx tsx scripts/camera-cam30b-ultra-shallow-runtime-reversal-smoke.mjs
npx tsx scripts/camera-cam30b-guarded-shallow-ascent-runtime-smoke.mjs
npx tsx scripts/camera-cam30b-ultra-shallow-runtime-integration-smoke.mjs
# + 요구 회귀 목록 (04e2, 04e3a/b, arming, retro, ultra-low, core, cam29a x2)
```

---

## 5. Residual

- `recovery_hold_too_short` 등 **reversal 이후** completion 타이밍은 별 이슈로 남을 수 있음.
