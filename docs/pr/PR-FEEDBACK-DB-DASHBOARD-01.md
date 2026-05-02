# PR-FEEDBACK-DB-DASHBOARD-01 — DB-first 사용자 피드백 + 관리자 대시보드

## 문제

기존 `POST /api/feedback`는 Resend 이메일 발송 실패 시 사용자 요청 전체를 실패 처리했다. 파일럿에서 이메일(도메인·쿼터·키) 이슈로 피드백이 유실되는 것은 운영 리스크였다.

## 변경 요약

- **CURRENT_IMPLEMENTED (본 PR 적용 후 코드 기준)**  
  - 피드백 접수 성공의 source of truth는 **`public.feedback_reports`에 대한 DB 저장 성공**이다.  
  - Resend 이메일은 운영자 알림용 **best-effort**이며, 실패해도 사용자에게는 성공으로 처리한다.  
  - `RESEND_API_KEY`가 없어도 DB 저장만 성공하면 `ok: true`이다.

## DB 스키마

- 마이그레이션: `supabase/migrations/202605030000_feedback_reports.sql`
- 테이블: `public.feedback_reports`
- RLS: **활성화**, anon/authenticated용 SELECT/INSERT 정책 **없음** (클라이언트 직접 접근 없음). 서비스 롤(API 라우트)로만 접근.

## API 계약

### `POST /api/feedback`

- 인증: Bearer(기존 `getCachedUserId`).
- 검증: 메시지 5~2000자, 카테고리 화이트리스트 (`general` | `bug` | `question` | `improvement`).
- 성공 응답 예: `{ ok: true, id: string, email_sent: boolean }`
- DB 저장 실패: `{ ok: false, code: 'FEEDBACK_SAVE_FAILED' }` (500).

### `GET /api/admin/feedback`

- 인증: Bearer + `requireAdmin` (`isAdmin` 재사용).
- 쿼리: `status`, `category`, `from`, `to` (YYYY-MM-DD, KST 일 단위 경계), `limit` (기본 100, 최대 200).
- 응답: `{ ok: true, items: FeedbackReportRow[], summary }`
- **`summary`는 현재 페이지(`items`, limit 슬라이스) 기준 집계**이며 전체 필터 매칭 행 수가 아니다.

### `PATCH /api/admin/feedback`

- 본문: `{ id: string, status?: ..., admin_note?: string | null }` (`status`와 `admin_note` 중 하나 이상).
- `status === 'resolved'`일 때 `resolved_at`을 설정한다.

## 관리자 UI

- 경로: `/admin/feedback`
- 권한: `getSessionSafe` + `/api/admin/check`와 동일 패턴.
- KPI 대시보드(`/admin/kpi`), 어드민 홈(`/admin`)으로 이동 링크 제공.

## Resend 정책

- 도메인 검증을 코드로 강제하지 않는다.
- 키 없음 → 경고 로그 후 이메일 스킵, 사용자 요청은 성공 가능.
- 발송 오류 → `console.error('[feedback] resend failed; saved to DB', …)`, 사용자 요청은 성공 유지.

## 검증

```bash
npm run test:feedback-db-dashboard
npm run build
```

수동:

1. 로그인 후 여정 탭에서 피드백 제출 → DB 행 확인.
2. 관리자 계정으로 `/admin/feedback` 목록·필터·상태 변경·메모 저장.

## 남은 리스크

- 운영 Supabase에 마이그레이션 적용 전까지 프로덕션 insert/list 실패 가능.
- 이메일 알림은 Resend 설정이 복구되기 전까지 스킵/실패할 수 있음 (의도된 best-effort).
- `summary`가 페이지 단위라 전체 건수 대시보드가 필요하면 후속 작업에서 집계 쿼리 분리 검토.

## 절대 금지 (본 PR 준수)

- Resend 도메인 검증을 코드로 강제하지 않음.
- `RESEND_API_KEY` 부재로 사용자 피드백 제출을 실패시키지 않음.
- 사용자 클라이언트가 Supabase로 `feedback_reports`를 직접 조회하지 않음.
- `feedback_reports`에 public SELECT 정책을 열지 않음.
- 기존 KPI 대시보드 API 계약 및 `/api/admin/check` 의미 변경 없음.
- 카메라·세션·결제·온보딩 코어 플로우 미변경.
