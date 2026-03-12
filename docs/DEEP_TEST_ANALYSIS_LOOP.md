# Deep Test / Result Analysis Loop

데이터가 쌓였을 때 **무엇을 보고**, **어떻게 판단하고**, **무엇을 고칠지** 정리한 문서.

## 1. 퍼널 구조

```
deep_test_started
    → deep_test_submitted
        → deep_result_viewed
            → deep_result_cta_clicked (cta_type=session_start)
                → session_create / session_create_idempotent
```

- `deep_test_started`: 테스트 시작
- `deep_test_submitted`: 테스트 완료(확정)
- `deep_result_viewed`: 결과 페이지 진입
- `deep_result_cta_clicked`: CTA 클릭 (session_start / home / retest)
- `session_create`: 실제 세션 생성 (session_events)

## 2. 주요 KPI

| KPI | 정의 | 목표 |
|-----|------|------|
| **Test completion rate** | submitted / started | ≥ 60% |
| **Result reach rate** | result_viewed / submitted | ≥ 95% |
| **Result → session conversion** | session_create (결과 후 30분 이내) / result_viewed | ≥ 25% |
| **CTA click rate** | cta_clicked(session_start) / result_viewed | ≥ 40% |
| **Abandon distribution** | last_section별 이탈 비율 | - |
| **Section dwell time** | section_completed별 평균 duration_ms | - |

## 3. KPI 해석 기준

### Test completion rate
- **< 50%**: 질문 난이도·길이 또는 UX 문제 가능성. 섹션별 이탈 위치 확인.
- **50~60%**: 개선 여지. abandon_by_section으로 병목 구간 파악.
- **≥ 60%**: 양호.

### Result reach rate
- **< 90%**: finalize 후 리다이렉트 실패 또는 네트워크 이슈 가능성.
- **≥ 95%**: 정상.

### Result → session conversion
- **< 20%**: 결과 신뢰도 문제 또는 CTA 설계 문제. 결과 설명·CTA 문구 검토.
- **20~25%**: 개선 여지.
- **≥ 25%**: 양호.

### CTA click rate (session_start)
- **< 30%**: CTA 가시성·위치·문구 검토.
- **≥ 40%**: 양호.

## 4. pain_mode 분포 해석

| 조건 | 해석 |
|------|------|
| **none < 40%** | caution/protected 과민 가능성. threshold 검토. |
| **caution > 40%** | 과민 가능성. pain_mode 규칙 재검토. |
| **protected > 20%** | protected 과도 가능성. gate 조건 검토. |
| **정상 범위** | none 50~70%, caution 20~35%, protected 5~15% |

## 5. priority_vector 분포 해석

| 조건 | 해석 |
|------|------|
| **특정 축 > 50%** | 문항 설계 편향 가능성. 해당 축에 영향을 주는 질문 검토. |
| **deconditioned > 30%** | deconditioned 축 과다. age/experience/workstyle 문항 영향 검토. |
| **균형** | 상위 3축 합계 60~80%, 한 축이 40% 미만 |

## 6. Abandon 위치

- **abandon_by_section**: 어느 섹션에서 가장 많이 이탈하는지 (Most abandoned section)
- **abandon_by_question**: last_question_id 있을 때 (optional)
- **average_section_dwell**: 섹션별 평균 체류시간 (Longest dwell section)

## 6-1. Result → Session 전환 분석

| 지표 | 정의 |
|------|------|
| **result_view_rate** | result_viewed / submitted |
| **cta_click_rate** | cta_clicked(session_start) / result_viewed |
| **session_start_rate** | session_create(결과 후 30분 이내) / result_viewed |

- **session_start_rate < 20%**: 결과 신뢰도 또는 CTA 문제. 결과 설명·CTA 문구 검토.

## 7. 실행 방법

```bash
# DB 기반 (Supabase env 필요)
npm run analyze:deep-test -- --days 30

# JSON 파일 기반 (오프라인)
npm run analyze:deep-test -- --input events.json
```

## 8. 관련 문서

- [DEEP_TEST_EVENT_SPEC.md](./DEEP_TEST_EVENT_SPEC.md) — 이벤트 구조
- [DEEP_VALIDATION_PACK.md](./DEEP_VALIDATION_PACK.md) — 검증 기준
