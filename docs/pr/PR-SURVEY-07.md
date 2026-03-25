# PR-SURVEY-07 — Survey + camera refined session-quality translation (session 1)

## Findings

- Refined `UnifiedDeepResultV2`는 `_compat`에 `survey_session_hints`를 남기지 않아, claimed refined만 쓰는 사용자는 PR-SURVEY-05 힌트 소비가 사실상 빠질 수 있었다.
- 카메라 품질(`strong` / `partial` / `minimal`)은 빌더에만 있고 JSON에는 없어, 세션 경로에서 **역추적**하거나 **저장 시** `_compat`에 남겨야 감사 가능하다.
- 설문 힌트를 baseline truth로 두고, 카메라는 **보수적 보강·댐핑·주의 전용**으로만 얹는 명시적 정책이 없으면 “카메라가 숨은 플래너처럼” 보이기 쉽다.

## Why survey-only session bias is no longer sufficient once refined results are claimed

- Refined 행은 `priority_vector`·`reason_codes`·evidence가 baseline과 달라질 수 있으나, 세션 1 품질 힌트는 설문 해석에서 왔다. **동일 사용자**에게는 baseline 힌트 + 카메라 evidence를 **한 줄로 합치는 정책**이 필요하다.
- 약한 카메라 신호로 설문을 뒤집으면 SSOT·퍼널 원칙과 충돌한다 → 품질 계층에 따른 **제한적 병합**만 허용한다.

## Files changed

- `src/lib/result/deep-result-v2-contract.ts` — `_compat` 선택 필드 `camera_evidence_quality`, `camera_pass` 문서화.
- `src/lib/deep-v2/builders/build-camera-refined-result.ts` — baseline의 `survey_session_hints`·관련 `_compat` 보존 + 카메라 품질·pass 저장.
- `src/lib/deep-v2/session/merge-survey-camera-session-hints.ts` — 병합 정책(신규).
- `src/lib/deep-result/session-deep-summary.ts` — `session_camera_translation?`.
- `src/lib/deep-result/buildSessionDeepSummaryFromPublicResult.ts` — `stage === 'refined'`일 때 병합 후 힌트·메타 전달.
- `src/lib/deep-v2/session/survey-session-hints-first-session.ts` — observability에 카메라 병합·`camera_merged_hint_fields`.
- `src/lib/session/plan-generator.ts` — `session_camera_translation` 입력.
- `src/app/api/session/create/route.ts` — 캐시·`buildSessionPlanJson`에 전달.
- `src/lib/session-gen-cache.ts` — 캐시 키에 `session_camera_translation`.
- `docs/pr/PR-SURVEY-07.md` — 본 문서.

## Exact merge policy and precedence

**전역 순서 (변경 없음)**  
1. 하드 가드: `pain_mode protected` / `safety_mode red`  
2. beginner / 첫 세션 가드레일 (plan-generator 기존)  
3. **병합된** `survey_session_hints` (설문 baseline + refined 카메라 정책)

**병합 진입**  
- `public_results.stage === 'refined'` 이고 `survey_session_hints`가 유효할 때만 `mergeSurveyAndCameraSessionHintsForFirstSession` 실행.  
- baseline-only → 병합 없음, PR-SURVEY-06과 동일.

**카메라 품질 분류**  
- `_compat.camera_evidence_quality` 우선.  
- 없으면: `reason_codes`에 `camera_evidence_partial` → `partial`; `source_mode === 'camera'` && `evidence_level === 'lite'` → `minimal`; `source_mode === 'camera'` → `strong`; 그 외 `unknown`.

**품질별**  
- **minimal / unknown**: 힌트 필드 변경 없음, `influence_level: none`, trace에 survey-led 명시.  
- **partial**: 기본 progression 한 단계 보수화; `priority_vector.asymmetry` 임계 이상이면 비대칭 주의 한 단계 상향; `camera_pass === false`면 `caution_only` + intro/volume/progression 추가 보수; `movement === mixed`이고 가동성 축 평균이 충분하면 `mobility_first`로만 조정(패스 실패 시 가동성 강화는 하지 않음).  
- **strong**: progression 보수화; 가동성 정렬·태그로 제한적 reinforce; `camera_pass === false`면 `caution_only`로 볼륨/intro 추가.

## Camera influence levels and meaning

| Level | 의미 |
|--------|------|
| `none` | 카메라가 세션 힌트 필드를 거의 바꾸지 않음(약한 evidence 또는 unknown). |
| `dampen` | 진행 신뢰·보수 쪽으로 설문보다 한 단계 조이는 쪽이 주됨. |
| `reinforce` | 설문과 정렬된 가동성 강조 등 소폭 강화. |
| `caution_only` | 패스 실패 등으로 주의·볼륨·intro 중심, 과신 억제. |

## What was intentionally not changed

- 라우트, 렌더러, 카피, readiness, claim, onboarding, auth/pay, 카메라 채점 코어, Unified 필수 필드 검증.
- plan-generator의 PR-SURVEY-05 티어/볼륨/캡/골드패스 **알고리즘 본체**(입력 힌트만 병합 결과로 바뀜).
- 세션 2+ 범위 확대.

## Risks / follow-ups

- 구 refined JSON에 힌트가 없으면 병합 이점이 없음 → 신규 저장분부터 baseline 힌트 보존으로 완화.
- 병합 임계값은 도그푸딩 후 미세 조정 가능.

## Acceptance checklist

- [ ] baseline-only claimed → 이전과 동일(병합 메타 없음).
- [ ] refined + 힌트 없음 → 동작 변화 없음.
- [ ] refined + 약한 카메라 → 힌트 필드 변경 없음·`influence_level: none`.
- [ ] `npm run build` 성공.

## Suggested git commands

```bash
git add src/lib/result/deep-result-v2-contract.ts src/lib/deep-v2/builders/build-camera-refined-result.ts src/lib/deep-v2/session/merge-survey-camera-session-hints.ts src/lib/deep-result/session-deep-summary.ts src/lib/deep-result/buildSessionDeepSummaryFromPublicResult.ts src/lib/deep-v2/session/survey-session-hints-first-session.ts src/lib/session/plan-generator.ts src/app/api/session/create/route.ts src/lib/session-gen-cache.ts docs/pr/PR-SURVEY-07.md
git commit -m "feat(session): PR-SURVEY-07 merge survey hints with camera evidence for session 1"
```
