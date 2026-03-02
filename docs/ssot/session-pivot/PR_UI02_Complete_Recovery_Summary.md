# PR UI-02: Session Complete + Recovery + Summary

## 목적

세션 레일에서 **운동 종료 버튼**, **Recovery 모달** (이탈 후 복구), **완료 요약 화면** 추가.  
기존 7일 플레이어/엔진 수정 없음.

---

## 변경 파일

| 분류 | 경로 | 내용 |
|------|------|------|
| lib | `src/lib/session/client.ts` | `completeSession` 함수 추가 |
| lib (NEW) | `src/lib/session/storage.ts` | sessionStorage draft helper |
| 컴포넌트 | `src/app/app/routine/_components/SessionRoutinePanel.tsx` | 종료/체크/복구/요약 로직 |
| 컴포넌트 (NEW) | `SessionRecoveryModal.tsx` | [이어하기] [지금 종료하기] [기록 버리기] |
| 컴포넌트 (NEW) | `SessionCompleteSummary.tsx` | 오늘 시간 / 진척도 / 다음 테마 |
| 문서 (NEW) | `docs/ssot/session-pivot/PR_UI02_Complete_Recovery_Summary.md` | 이 문서 |

**7일 플레이어/엔진/API 변경: 0개**

---

## 구현 요약

### 1) Sticky 종료 버튼
- `panelState === 'active'`일 때만 노출
- 일부 미완료 시: Confirm 모달 ("그래도 종료할까요?") → [그대로 종료] [계속하기]
- `POST /api/session/complete` 호출 (유저 클릭 시에만)
- `completion_mode`: 전부 체크 → `all_done`, 그 외 → `partial_done`

### 2) 진행 체크 + 로컬 저장
- `plan_json.segments[].items` 기준 체크박스
- itemKey: `segTitle_order_templateId`
- sessionStorage 키: `mr_session_active_${session_number}_v1`
- 저장 내용: `{ sessionNumber, startedAtMs, lastUpdatedAtMs, checked, note }`

### 3) Recovery 모달
- 조건: `active != null` + 로컬 draft 존재 + 동일 sessionNumber
- [이어하기] → 모달 닫기, 체크 상태 유지
- [지금 종료하기] → complete 호출
- [기록 버리기] → 로컬 삭제

### 4) 시간 기록
- startedAtMs: active 최초 로드 시 세팅
- duration = endTime - startTime (초)
- 상한 120분(7200초) 초과 시 clamp + "비정상적으로 길어 보여요" 안내

### 5) 완료 화면 (Summary)
- 오늘 운동 시간 (mm:ss)
- 진척도 (completed_sessions / total_sessions)
- 다음 테마 (next_theme만, 운동 리스트 금지)
- [홈으로] [루틴 확인] 버튼

---

## Acceptance Tests

### A1) 7일 파일 diff 0개
`git diff main --name-only` → routine-plan, routine-engine, routine/player 미포함 ✅

### A2) 종료 버튼
- active 세션 있을 때만 sticky 버튼 노출
- 일부 미완료 → confirm 모달
- "그대로 종료" → POST /api/session/complete 1회

### A3) Recovery
- 세션 도중 새로고침 → 로컬 저장 있으면 Recovery 모달
- [이어하기] → 체크 상태 복구
- [기록 버리기] → 로컬 삭제

### A4) 시간
- startedAtMs: active 최초 로드 시 세팅
- duration 120분 상한 적용

### A5) 완료 화면
- progress / next_theme 기반 Summary 렌더
- 운동 리스트 예고 없음 (테마만)

---

## 알려진 제한

- **영상/플레이어 연결 없음** (의도): segment items는 텍스트 리스트 + 체크박스만. 실제 운동 영상 재생은 별도 PR.

---

## Rollback

`git revert <커밋 SHA>`. 7일 시스템 영향 없음.
