# PR-SQUAT-V2-00 — Golden Trace Harness (PR2)

> SSOT: `PR-SQUAT-ENGINE-V2-RESET-SSOT.md`, `PR-SQUAT-MOTION-EVIDENCE-V2-DESIGN-ROOM-MEMORY.md` §8.

## Purpose

실기기에서 내보낸 squat camera trace JSON을 **golden fixture**로 두고, (향후) `SquatMotionEvidenceEngineV2`가 **반드시 지켜야 할 최소 pass/fail 계약**을 harness로 잠근다.  
**이 PR은 런타임 동작을 바꾸지 않는다** (엔진 미구현 stub만 있음).

## Artifacts

| Path | Role |
|------|------|
| `fixtures/camera/squat/golden/manifest.json` | `id` / `file` / `expected` / `required` / `description` |
| `fixtures/camera/squat/golden/*.json` | Golden trace files (copied from real-device capture) |
| `fixtures/camera/squat/golden/README.md` | Human-oriented fixture index |
| `scripts/camera-squat-v2-00-golden-trace-harness.mjs` | Report / strict harness; `evaluateSquatMotionEvidenceV2` stub (PR3+로 교체) |

## Run

```bash
npx tsx scripts/camera-squat-v2-00-golden-trace-harness.mjs --report
npx tsx scripts/camera-squat-v2-00-golden-trace-harness.mjs --strict
```

(동일: `node scripts/camera-squat-v2-00-golden-trace-harness.mjs --report` 등)

### Modes

1. **`--report`** (기본)  
   - manifest/파일 누락, JSON 파싱 불가를 **명확히** 출력.  
   - `attempts`에 박힌 **직렬화된 레거시 힌트**만 (V2 **아님**, authority 아님) `contract↔export`로 표기.  
   - V2는 stub → **V2 vs 계약 mismatch로 프로세스를 죽이지 않음** (main이 아직 실패해도 exit 0).

2. **`--strict`** (회귀 게이트 예약)  
   - `required: true` 항목에 대해 파일 없음/깨진 JSON → **exit 1**.  
   - `evaluateSquatMotionEvidenceV2`가 `implemented: true`를 반환할 때만, `expected` vs 실제 pass/fail 불일치 → **exit 1**.  
   - **PR2**에서는 V2 **미구현**이므로, 파일 무결성만 만족하면 **exit 0** (스텁 경고 문구).

## V2 adapter (PR3+)

`scripts/camera-squat-v2-00-golden-trace-harness.mjs`의 `evaluateSquatMotionEvidenceV2`를, 엔진이 생기면 실제 `SquatMotionEvidenceEngineV2`를 호출하도록 갈아끼우면 된다.  
**pass** 의미는 SSOT: **usable lower-body flexion/extension motion evidence** (“완벽한 스쿼트” 아님).

---

## PR report (필수 답변)

### Q1. 이번 PR이 **runtime authority**를 만들었는가? 만들면 실패다.

**아니요.** `evaluateSquatMotionEvidenceV2`는 `implemented: false`만 돌려주는 **스텁**이며, 앱/카메라/자동진행/페이지 코드를 import 하지 않는다. **새 런타임 권한을 만들지 않는다.**

### Q2. golden fixture **contract**로 어떤 케이스를 잠갔는가?

`manifest.json`에 정의된 **필수 4 클래스**:

| `id` | `expected` | 의도 (V2) |
|------|------------|-----------|
| `valid_shallow_must_pass_01` | pass | 얕은 down-up-return 실기기; **usable motion evidence** = pass |
| `valid_deep_must_pass_01` | pass | 딥 down-up-return 실기기; **usable motion evidence** = pass |
| `standing_must_fail_01` | fail | 스탠딩/비사이클; evidence 아님 = fail |
| `seated_must_fail_01` | fail | 앉은/바텀 홀드 등 유효 복귀 없음; evidence 아님 = fail |

### Q3. **missing** fixture가 있다면 어떤 **파일**이 필요한가?

**리포에 반영된 현재는 없다.** 아래 4개가 `fixtures/camera/squat/golden/`에 있어야 하며(본 PR에서 사용자 제공 경로에서 복사), 모두 `manifest`의 `file`과 일치한다.

- `valid_shallow_must_pass_01.json`  
- `valid_deep_must_pass_01.json`  
- `standing_must_fail_01.json`  
- `seated_must_fail_01.json`  

누락 시 harness가 `--report` / `--strict`에서 해당 `path`를 찍는다.

### Q4. 런타임 동작 변경이 있는가?

**없다.** `src/`, `pass-core`, `completion-state`, `auto-progression`, `page` 등 **애플리케이션·카메라 런타임** 수정 없음. 추가분은 `fixtures/`, `scripts/`, `docs/pr/` 문서뿐이다.

### Q5. `--report` vs `--strict` behavior 요약

- Report: **정보** + 누락/손상 강조; main 미구현이어도 **게이트로 강제 종료 실패 X**.  
- Strict: **필수 파일·JSON** 필수; V2가 붙으면 **계약 vs V2**까지 실패로 승격 가능.

---

## Acceptance (PR2)

- [x] `manifest.json`이 읽힌다.  
- [x] missing / unreadable 출력이 명확하다.  
- [x] `--report` / `--strict`가 존재한다.  
- [x] 런타임(카메라) 동작 변경 없음.  
- [x] V2 엔진 본문 구현 없음 (stub만).
