# PR-RESULT-EXPLANATION-UPGRADE-01

## 목적

공개 결과 화면에서 **이미 계약에 있는 필드**(`reason_codes`, `secondary_type`, `source_mode`, `evidence_level`, `missing_signals`)를 활용해  
“왜 이런 결과인지”가 조금 더 느껴지도록 **표현 레이어만** 보강한다.

- 스코어링·빌더·계약·카메라 로직 **미변경**
- 숫자·벡터·raw 코드 문자열 **비노출**
- 레이아웃·3단 구조 **유지**

## 변경 파일

| 파일 | 내용 |
|------|------|
| `src/components/public-result/public-result-labels.ts` | 이유 문장 매핑(`REASON_CODE_INSIGHT_PHRASES`), 헬퍼(`pickReasonInsightBullets`, `buildPublicResultHeaderHint`, 등), Step2/3 보조 한 줄(`CAREFUL_FIT_BY_PRIMARY`, `STEP3_ORDER_FIT_BY_PRIMARY`) |
| `src/components/public-result/PublicResultRenderer.tsx` | Step 1~3에 보조 문장 연결, 헤더 힌트를 `source_mode`·`evidence_level` 반영 |

## 동작 요약

1. **헤더** — `buildPublicResultHeaderHint`: baseline은 `evidence_level`(lite vs 그 외)로 문구 구분, refined는 `source_mode === 'camera'`일 때 동작 반영·조정 톤.
2. **Step 1** — `buildSecondaryTendencySentence`: 보조 타입을 라벨 나열 대신 한 문장으로.
3. **Step 2** — `summary_copy` 그대로 + `pickReasonInsightBullets(reason_codes)` 최대 2개(사람 읽기 문장).  
   refined + `baseline_was_*` 포함 시 `buildRefinementShiftSupportLine` 한 줄.  
   `pickLightMissingHintLine(missing_signals)`는 최대 1줄·선택.  
   조심 목록 아래 `CAREFUL_FIT_BY_PRIMARY`로 “왜 이 조심이 이 결과와 맞는지” 한 줄.
4. **Step 3** — `STEP3_ORDER_FIT_BY_PRIMARY`로 순서 제안과 패턴의 연결 한 줄.

## 회귀·리스크

- `reason_codes`에 매핑 없는 코드가 많으면 불릿 0개일 수 있음 → 후속으로 `REASON_CODE_INSIGHT_PHRASES`만 점진 확장 가능.
- `baseline_was_*`는 문자열로 노출하지 않고, 존재 여부만으로 일반화된 한 줄을 씀.

## 검증

- `npx tsc --noEmit` (해당 파일 관련 에러 없음)
- 로컬에서 baseline/refined 페이지 수동 확인 권장
