# UI-DEEP-ONB-01: Deep Test 시작 페이지에 주당 빈도(2/3/4/5) 추가

## 목적

Deep Test 시작 페이지(나이/성별/운동경험 묻는 화면)에 주당 목표 빈도(2/3/4/5) 선택을 추가하고,
선택값을 `POST /api/session/profile`로 best-effort 저장한다.

---

## 변경 파일

| 파일 | 변경 |
|------|------|
| `src/app/app/deep-test/run/page.tsx` | targetFrequency state, TargetFrequencyPicker, handleNext 시 profile 저장 |
| `src/components/deep-test/TargetFrequencyPicker.tsx` | 신규 (2/3/4/5 버튼 그룹) |
| `src/lib/session/client.ts` | `postSessionProfile()` 추가 |
| `docs/ssot/session-pivot/PR_UI_DEEP_ONB01_FrequencyInStart.md` | 이 문서 |

---

## UX

- **위치**: Section 0 (기본 정보) 상단, 첫 질문보다 먼저
- **UI**: 2/3/4/5 선택 버튼 (주 2회, 주 3회, 주 4회, 주 5회)
- **기본값**: 3 (12세션) preselect
- **저장 타이밍**: "다음" 버튼 클릭 시 1회
- **에러 처리**: 실패해도 다음으로 진행 (fail-open). 실패 시 "저장 실패(네트워크)" 토스트 1회
- **draft**: 실패 시 sessionStorage `session_target_frequency_draft`에 저장, 다음 진입 시 prefill

---

## 제약

- **deep answers에 포함 금지**: target_frequency는 scoring payload에 넣지 않음
- **create 호출 금지**: `/api/session/create` 호출/자동생성 없음
- **Deep Result 페이지**: 빈도 질문 없음 (시작 페이지만)

---

## 수락 테스트

- U1) Deep Test 시작 페이지(section 0)에서만 빈도 질문 노출
- U2) 기본값 3 선택 상태로 "다음" 진행 가능
- U3) 2/3/4/5 선택 후 "다음" 누르면 `/api/session/profile` 네트워크 요청 발생
- U4) `/api/session/profile` 실패해도 Deep Test 흐름이 막히지 않음
- U5) deep attempt 저장 payload에 target_frequency 미포함
