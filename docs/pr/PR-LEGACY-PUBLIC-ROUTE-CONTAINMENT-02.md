# PR — Legacy public route containment (02)

**목표 (CURRENT_IMPLEMENTED / containment PR)**  
파일럿 전에 과거 레거시 플로우(`/my-routine`, `/full-assessment` 등)가 사용자에게 새 노출되지 않도록 **리다이렉트와 CTA만** 정리한다. 라우트/페이지 **삭제나 API 제거는 하지 않는다.**

**SSOT 정렬**: public-first canonical flow 유지; `/app/home`, AppShell, SessionPanelV2, session/create, readiness, public result 계약 미변경.

## 변경 파일

| 파일 | 내용 |
|------|------|
| `next.config.ts` | `legacyTopLevel`: `/my-routine`, `/my-routine/:path*` → `/app/home`; `/full-assessment`, `/full-assessment/:path*` → `/` (permanent) |
| `src/app/payments/stripe-success/StripeSuccessClient.tsx` | 레거시 `/my-routine` CTA 제거; `/app/home`·복사 완화; 구독+루틴 준비 시 primary만 `/app/home` (중복 secondary 숨김) |
| `src/app/payments/success/PaymentSuccessClient.tsx` | Toss/레거시 성공 CTA에서 `/full-assessment`, `/my-report`, 사진·영상 업로드 유도 문구 제거; `MOVE RE 시작하기` 등으로 통일; 결제 `POST /api/payments` 본문 로직 무변경 |
| `src/lib/notifications/daily-workout-sender.ts` | 푸시 `action_url`/이메일 링크 `/app/home`; 카피 "내 리셋맵 보기" |
| `src/app/movement-test/retest-comparison/RetestComparisonClient.tsx` | `router.push('/app/home')`; 버튼 "내 리셋맵 보기" 등 |

## Acceptance checklist

1. `/my-routine` → `/app/home`
2. `/my-routine/coach-comments` 등 하위 경로 → `/app/home`
3. `/full-assessment` → `/`
4. `/app/routine` 계열 → 기존처럼 `/app/home` (LEGACY_ROUTES `app/` 세그먼트)
5. Stripe success 화면 CTA에 `/my-routine` 없음
6. Toss/legacy payment success에 `/full-assessment`, 사진·영상 업로드 필수 CTA 없음
7. daily notification `action_url` 등이 `/app/home`
8. retest comparison에서 `/my-routine` 버튼 없음, 리셋맵 카피
9. 공개 랜딩→설문→결과 등 public 퍼널은 본 PR에서 수정 대상 아님
10. `/app/home` 실행 코어 미변경

## 검증

- `npm run lint`
- `npx tsc --noEmit`  
전역 오류가 있으면 본 PR 터치 파일과 무관한지 구분해 보고.

## Non-goals

- `/my-routine`, `/full-assessment` 페이지 파일 삭제
- 결제 승인/Stripe verify·루틴 생성 API 제거 또는 동작 변경
- DB 마이그레이션
- 실행/온보딩/리드니스 스키마 수정
