# PR UI-01: Routine Tab — Session Rail 1-Tap Create/Resume

## 목적

루틴 탭(`/app/routine`)에서 **Path B 세션 레일**로 오늘 세션 루틴을 1탭으로 생성/복구.  
기존 7일 시스템 UI/엔진 변경 없음.

---

## 변경 파일

| 분류 | 경로 | 내용 |
|------|------|------|
| lib (NEW) | `src/lib/session/client.ts` | `/api/session/*` fetch 헬퍼 (타입 포함) |
| 컴포넌트 (NEW) | `src/app/app/routine/_components/SessionRoutinePanel.tsx` | 패널 전체 로직 |
| 컴포넌트 (수정) | `src/app/app/routine/_components/RoutineHubClient.tsx` | import 1줄 + JSX 1줄 삽입 |

**7일 API/엔진/플레이어 파일 변경: 0개**

---

## 화면 흐름

```
/app/routine 진입
  │
  ├─ GET /api/session/active (1회)
  │     │
  │     ├─ active 있음 → 세그먼트 리스트 렌더 (Resume)
  │     ├─ active 없음 → "바로 오늘 루틴 만들기" 버튼
  │     ├─ done (completed >= total) → 완료 배지
  │     └─ 오류 → 에러 메시지
  │
  └─ "바로 오늘 루틴 만들기" 클릭
        │
        ├─ POST /api/session/create(ok, short)
        │     │
        │     ├─ 200 → 세그먼트 리스트 렌더
        │     └─ 404(DEEP_RESULT_MISSING) → "Deep Test 시작하기" CTA
        │
        └─ "조정" 버튼 → 바텀시트 (mood 3칩 + budget 2칩) → create 호출
```

---

## 컴포넌트 상태 머신

| 상태 | 트리거 | 표시 |
|------|--------|------|
| `loading` | mount | 스켈레톤 |
| `active` | active 세션 있음 | 테마 + 세그먼트 리스트 |
| `empty` | active 없음 | "바로 오늘 루틴 만들기" 버튼 |
| `deep_missing` | create 404 | "Deep Test 필요" + 이동 버튼 |
| `done` | completed_sessions >= total | 완료 배지 |
| `error` | 네트워크/401 | 에러 메시지 |

---

## 네트워크 가드 (A2/A3 검증)

- `GET /api/session/active`: `useRef(initializedRef)`로 mount 1회만 보장
- `POST /api/session/create`: 버튼 클릭 핸들러 내에서만 호출, `creating` 플래그로 중복 방지
- 무한 재시도 없음 (에러 시 상태 전환만)

---

## 에러 처리 (A4)

| 에러 | 처리 |
|------|------|
| 401 | "로그인이 필요합니다" 메시지 표시 |
| 404 DEEP_RESULT_MISSING | `deep_missing` 상태 → "Deep Test 시작하기 →" 버튼 (→ `/app/deep-test`) |
| 기타 | 에러 메시지 표시 |

---

## Acceptance Tests

### A1) 7일 파일 diff
```
git diff main --name-only
→ src/app/app/routine/_components/RoutineHubClient.tsx (import + JSX만)
신규: SessionRoutinePanel.tsx, src/lib/session/client.ts
```
7일 API/엔진/플레이어 변경: 0개 ✅

### A2) 네트워크 (active 없을 때)
```
GET /api/session/active: 1회
POST /api/session/create: 자동 호출 없음 (버튼 클릭 전까지)
```

### A3) 버튼 플로우
```
"바로 오늘 루틴 만들기" 클릭
→ POST /api/session/create 1회
→ 응답 active.plan_json.segments 기반 리스트 렌더
```

### A4) 에러 처리
```
deep 없는 계정 create → 404 DEEP_RESULT_MISSING → "Deep Test 시작하기" CTA 표시
401 → 로그인 유도 메시지
```

### A5) 빌드
```
npm run build → exit 0 (81 routes, ✓ Compiled successfully)
```

---

## Rollback

`git revert <이 커밋 SHA>`  
기존 7일 시스템 영향 없음.

---

## 다음 PR 제안

- **UI-02**: "운동 종료" 버튼 + `/api/session/complete` 연결 + 이탈 복구 모달
- **BE-04**: 컨디션×시간 매트릭스 고도화 (세트/볼륨/회복형 정교화)
