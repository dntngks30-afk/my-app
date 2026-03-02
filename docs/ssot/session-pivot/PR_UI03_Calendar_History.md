# UI-03: Session calendar stamps + history list

## 목적

/app/routine (Session rail UI)에 캘린더 스탬프와 완료 히스토리 리스트 추가.
UI만 변경. 7일 시스템/플레이어 미변경.

---

## 변경 요약

| 파일 | 변경 |
|------|------|
| `src/lib/session/client.ts` | `getSessionHistory()` 추가 |
| `src/app/app/routine/_components/SessionHistoryPanel.tsx` | 신규 (캘린더 + 리스트) |
| `src/app/app/routine/_components/RoutineHubClient.tsx` | history fetch + panel 배치 |

---

## 네트워크 규칙

- **GET /api/session/active**: mount 시 1회 (SessionRoutinePanel, 기존)
- **GET /api/session/history**: mount 시 1회 (RoutineHubClient, 신규)
- **POST /api/session/create**: 버튼 클릭 시에만 (자동 호출 없음)

---

## UI 설명

1. **캘린더 스탬프**: 최근 14일 타임라인, 완료 기록 있으면 ✓ 표시
2. **완료 리스트**: 최대 20개, session_number + theme + 완료일 (로컬 날짜)
3. **duration_seconds**: null이면 숨김 (의도)

---

## 장애 허용

history API 실패(404/500) 시:
- SessionHistoryPanel 숨김
- Active/Create 패널 정상 동작
- 루틴 생성/진행 영향 없음

---

## 선행 조건

- **BE-HIST-01** 머지 필요: `GET /api/session/history` 라우트. 머지 전에는 history 패널이 숨겨짐(404).

---

## 수락 테스트

- A1) 7일 시스템/player 파일 변경 0개
- A2) Network: active 1회, history 1회, create 자동 호출 없음
- A3) UI: 캘린더 스탬프, 리스트 표시
- A4) history 실패 시 Active/CTA 정상
- A5) 빌드/린트 통과
