# UI-DEEP-ONB-ONE: Deep 시작 페이지 빈도 + /app/routine 디버그 라벨

## 목적

1. Deep Test 시작 페이지에 "주 몇 회 가능?"(2/3/4/5) 추가, `POST /api/session/profile` best-effort 저장
2. `/app/routine` 상단에 Path B 반영 상태를 눈으로 확정할 수 있는 디버그 라벨 추가

---

## 변경 파일

| 파일 | 변경 |
|------|------|
| `src/app/app/deep-test/run/page.tsx` | targetFrequency, TargetFrequencyPicker, handleNext 시 profile 저장 |
| `src/components/session/TargetFrequencyPicker.tsx` | 신규 (2/3/4/5 버튼) |
| `src/lib/session/client.ts` | `postSessionProfile()` 추가 |
| `src/app/app/routine/_components/RoutineHubClient.tsx` | 디버그 라벨 (total_sessions, templateId) |
| `docs/ssot/session-pivot/PR_UI_DEEP_ONB_ONE_Frequency+DebugBadge.md` | 이 문서 |

---

## A) 빈도 질문

- **위치**: Section 0 (기본 정보) 상단
- **옵션**: 2/3/4/5 (주 2회~주 5회)
- **기본값**: 3
- **저장**: "다음" 클릭 시 `POST /api/session/profile` best-effort (fail-open)
- **draft**: 실패 시 sessionStorage `session_target_frequency_draft` 저장, 다음 진입 시 prefill
- **제약**: deep answers에 포함 금지

---

## B) 디버그 라벨

- **위치**: `/app/routine` 상단 (Today 헤더 아래), 작고 흐린 텍스트
- **표시 값**:
  - `total_sessions`: progress.total_sessions 또는 unknown
  - `template`: segments[0].items[0].templateId → stub / M01~M28 / unknown
- **숨김**: `NEXT_PUBLIC_SHOW_DEBUG_BADGES=0` 또는 `false` 시 비표시

---

## 수락 테스트

- U1) Deep Test 시작 페이지에서 "주 몇 회 가능?"(2/3/4/5) 노출, 기본 3
- U2) 빈도 선택 후 "다음" → Network에 `POST /api/session/profile` 발생
- U3) Deep answers payload에 target_frequency 미포함
- U4) `/app/routine` 상단에 디버그 라벨 표시 (비로그인: unknown, 로그인: 숫자)
- U5) create 후 templateId가 stub_* 또는 M01~M28로 표시
