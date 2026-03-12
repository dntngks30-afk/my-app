# Deep Test Funnel Event Spec

이벤트 설계 SSOT. Deep Test 퍼널 품질 측정용 최소 계측 기준.

## 원칙

- 개인정보/자유서술 응답 원문 저장 금지
- lightweight, fire-and-forget
- 성능 저하 없이 구현
- 나중에 분포/전환/이탈 분석 가능

## 이벤트 목록

| 이벤트 | 발생 시점 | 필수 payload | optional | 금지 |
|--------|-----------|----------|----------|------|
| `deep_test_started` | run 페이지 진입, attempt 로드 완료 | `attempt_id`, `section_index` | `elapsed_ms` | answers 원문 |
| `deep_test_section_viewed` | 섹션 진입(뷰포트) | `section_id`, `section_index` | `section_entered_at` | - |
| `deep_test_section_completed` | 섹션 내 모든 질문 답변 후 다음 클릭 | `section_id`, `section_index`, `section_duration_ms` | `answered_count` | - |
| `deep_test_abandoned` | run 페이지 이탈(미완료) | `last_section`, `last_section_index`, `answered_count`, `elapsed_ms` | `last_question_id` | answers 원문 |
| `deep_test_submitted` | finalize API 성공 | `attempt_id` | - | - |
| `deep_result_viewed` | result 페이지 로드, 결과 표시 | `attempt_id`, `pain_mode`, `primary_type` | `top_priority_axis`, `secondary_type` | - |
| `deep_result_cta_clicked` | CTA 클릭 | `cta_type` | `attempt_id` | - |
| `deep_result_session_started` | createSession 성공 (결과 후) | - | `attempt_id` | - |

`deep_result_session_started`는 session_create 이벤트와 시간 상관으로 분석. 별도 이벤트 타입 없이 session_events에 `session_create`로 이미 기록됨.

## payload 상세

### deep_test_started
- `attempt_id`: string (UUID)
- `section_index`: number (0-based)

### deep_test_section_viewed
- `section_id`: 'basic' | 'squat' | 'wallangel' | 'sls' | 'final'
- `section_index`: number

### deep_test_section_completed
- `section_id`, `section_index`
- `section_duration_ms`: number (섹션 진입~다음 클릭 시점)

### deep_test_abandoned
- `last_section`: section_id
- `last_section_index`: number
- `answered_count`: number (질문 응답 수)
- `elapsed_ms`: number (시작~이탈 시점)

### deep_result_viewed
- `attempt_id`
- `pain_mode`: 'none' | 'caution' | 'protected'
- `primary_type`: STABLE | DECONDITIONED | NECK-SHOULDER | ...
- `top_priority_axis`: string[] (최대 2개, 예: ['lower_stability', 'deconditioned'])
- `secondary_type`: optional

### deep_result_cta_clicked
- `cta_type`: 'session_start' | 'home' | 'retest' | 'install'

## 실행 방법

- `npm run dev` 후 run/result 페이지 사용 시 자동으로 이벤트 전송
- API: `POST /api/deep-test/track` (Bearer 인증 필요)
- dev: `console.debug` fallback
- 결과→세션 전환: `deep_result_cta_clicked` (cta_type=session_start) + `session_events.session_create` 시간 상관으로 분석

## 저장

- `session_events` 테이블에 `event_type` = 위 이벤트명으로 저장
- `meta` 필드에 payload
- `session_number` = null
