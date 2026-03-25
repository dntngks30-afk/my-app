# PR-CAM-01 — 카메라 evidence quality의 planning-oriented semantics 정렬

## Findings

- PR-SURVEY-07 이후 `mergeSurveyAndCameraSessionHintsForFirstSession`은 설문 `survey_session_hints`와 refined 카메라 evidence를 **보수적으로** 병합한다.
- 병합 분기에 쓰이던 `camera_evidence_quality`(strong/partial/minimal)는 `camera-to-evidence`의 **분석 신호 강도**에 가깝고, “세션 계획에 얼마나 영향을 줄 수 있는가”와 1:1로 대응하지 않는다(특히 pass와의 조합).
- 구버전 claimed refined에는 planning 전용 티어가 없어, `source_mode === 'camera'` 등에서 역추적 시 **과도한 standard 가정** 위험이 있었다.

## PR-SURVEY-07 이후 planning-oriented semantics가 필요한 이유

- 세션 1 정책은 **설문이 baseline planning truth**이고 카메라는 **보정용 evidence channel**이다. 동일한 문자열(`strong` 등)이 “분석이 잘 됐다”와 “planner가 reinforce까지 허용”을 동시에 암시하면 정책이 불투명해진다.
- 명시적 티어(`none` / `limited` / `standard`)로 **병합 eligibility**를 고정하면, refined → session summary → plan generator 경로가 감사 가능해진다.

## Files changed

| 파일 | 역할 |
|------|------|
| `src/lib/deep-v2/session/camera-planning-evidence-tier.ts` | `computeCameraPlanningEvidenceTier`, `resolveCameraPlanningTierForSessionMerge` 단일 정규화 |
| `src/lib/deep-v2/session/merge-survey-camera-session-hints.ts` | 티어 기준 병합; `SessionCameraTranslationMetaV1`에 `camera_planning_evidence_tier`, `tier_resolution_trace` |
| `src/lib/deep-v2/builders/build-camera-refined-result.ts` | `_compat`·`refined_meta`에 `camera_planning_evidence_tier` 저장 |
| `src/lib/result/deep-result-v2-contract.ts` | `_compat` 선택 필드 문서화 |
| `src/lib/deep-v2/session/survey-session-hints-first-session.ts` | rationale tag `camera_planning_tier_*` |
| `src/lib/deep-v2/adapters/camera-to-evidence.ts` | 분석 품질 vs planning 티어 주석 정렬 |

## Normalized quality tiers and mapping rules

### Planning tier (`CameraPlanningEvidenceTier`)

| Tier | 의미(세션 병합) |
|------|------------------|
| `none` | 카메라 planning 영향 없음 → 설문 힌트 그대로(클론) |
| `limited` | 기존 partial 계열: dampen/caution 위주, PV 조건 만족 시 제한적 reinforce |
| `standard` | 기존 strong 계열: reinforce/dampen/caution_only 허용 범위 확대(정책 내) |

### Refined 빌드 시 매핑 (`computeCameraPlanningEvidenceTier`)

- `!cameraPass` 또는 `analysisQuality === 'minimal'` → `none`
- `analysisQuality === 'partial'` → `limited`
- `analysisQuality === 'strong'` && pass → `standard`

(pass만으로 `standard`가 되지 않음.)

### Legacy / claimed 역추정 (`resolveCameraPlanningTierForSessionMerge`)

- `_compat.camera_planning_evidence_tier`가 유효하면 **최우선**.
- 없으면 `camera_evidence_quality` + `camera_pass` + `reason_codes` / `source_mode` 등으로 보수적 역추정.
- `source_mode === 'camera'`인데 분석 품질이 불명 → **예전처럼 strong 가정 금지**, `limited` (`cam_tier:legacy_unknown_camera_as_limited`).

`SessionCameraTranslationMetaV1.camera_evidence_quality`는 **legacy/감사용**이며 `unknown` 가능.

## Intentionally not changed

- Public 라우트, renderer, 카피, 카메라 캡처 UX, evaluator 본체, low-ROM / overhead 타이밍, auth/pay/readiness/claim/onboarding 플로우.
- UnifiedDeepResultV2 코어 스키마의 필수 필드(가산적 `_compat`·메타만 확장).
- `camera_evidence_quality` 문자열 의미(어댑터 분석 강도) — 하위 호환 유지.

## Risks / follow-ups

- 오래된 refined JSON은 티어 없이 역추정에 의존; trace로 구분 가능.
- evaluator·capture 품질 모델이 개선되면 `computeCameraPlanningEvidenceTier` 매핑만 조정하는 것이 안전한 확장 지점이다.

## Acceptance checklist

- [ ] 카메라 결과 없음 / refined 아님 → 세션 힌트 병합 없음(기존과 동일).
- [ ] 약한 카메라(none) → 병합 조기 반환, 설문 주도.
- [ ] limited / standard → PR-SURVEY-07과 동등한 보수적 reinforce·dampen·caution 분기(티어만 명시화).
- [ ] `npm run build` 통과.
- [ ] 공개 라우트·렌더러·카피 변경 없음.

## Suggested git commands

```bash
git add \
  src/lib/deep-v2/session/camera-planning-evidence-tier.ts \
  src/lib/deep-v2/session/merge-survey-camera-session-hints.ts \
  src/lib/deep-v2/builders/build-camera-refined-result.ts \
  src/lib/result/deep-result-v2-contract.ts \
  src/lib/deep-v2/session/survey-session-hints-first-session.ts \
  src/lib/deep-v2/adapters/camera-to-evidence.ts \
  docs/pr/PR-CAM-01.md

git commit -m "feat(session): PR-CAM-01 planning-oriented camera evidence tier"
```
