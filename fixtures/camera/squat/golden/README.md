# Golden squat trace fixtures

이 디렉터리는 **실기기 스쿼트 카메라 trace**를 기반으로, **`SquatMotionEvidenceEngineV2`가 (향후) 반드시 맞춰야 할** 최소 pass/fail 계약을 고정한다.

- **pass**: “정확한 스쿼트 성공”이 아니라, SSOT에 정의된 **usable lower-body flexion/extension motion evidence** 획득.
- **fail**: 위 evidence가 성립하지 않는다고 기대하는 케이스.

## Files

| File | ID | Expected |
|------|----|--------|
| `valid_shallow_must_pass_01.json` | `valid_shallow_must_pass_01` | pass |
| `valid_deep_must_pass_01.json` | `valid_deep_must_pass_01` | pass |
| `standing_must_fail_01.json` | `standing_must_fail_01` | fail |
| `seated_must_fail_01.json` | `seated_must_fail_01` | fail |

`manifest.json`이 위 목록의 **SSOT**다. `id`, `file`, `expected` (`"pass"` \| `"fail"`), `required`, `description`를 포함한다.

## Harness

```bash
npx tsx scripts/camera-squat-v2-00-golden-trace-harness.mjs --report
npx tsx scripts/camera-squat-v2-00-golden-trace-harness.mjs --strict
```

- **--report**: 누락/불가 읽기 파일, (선택) trace에 박힌 레거시 힌트, V2 미구현 시 `implemented: false` 안내. **main이 아직 꼬여 있어도 이 모드는 회귀 게이트로 쓰지 않는다(기본 exit 0).**
- **--strict**: `required` fixture 파일 존재·JSON 파싱, V2 adapter가 `implemented: true`일 때만 기대값과 **실제** pass/fail 비교 실패 시 exit 1. PR2는 V2 **stub**이므로 계약/파일 무결성만 통과하면 exit 0.

자세한 동작은 `docs/pr/PR-SQUAT-V2-00-GOLDEN-TRACE-HARNESS.md`를 본다.
