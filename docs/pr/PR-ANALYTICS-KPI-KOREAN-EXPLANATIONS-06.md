# PR-ANALYTICS-KPI-KOREAN-EXPLANATIONS-06

**유형:** 어드민 KPI UX 카피 전용  
**상태:** CURRENT_IMPLEMENTED  

---

## 범위

- `/admin/kpi` 한국어 라벨·짧은 설명·섹션 안내 문구 추가
- 원본 이벤트명(event_name)은 디버깅용으로 유지 (원문 표시 + 선택적 한글 표시명 병기)

---

## 변경하지 않은 것

- 날짜 범위·클램프·API 집계 로직 (`admin-kpi.ts` 미변경)
- 리텐션 수식·적격 코호트 규칙
- 마이그레이션·신규 이벤트명·추적 호출·제품 라우트
- 결제·클레임·readiness·세션 생성·카메라 평가기·PWA·푸시 동작

---

## 추가 파일

| 경로 | 설명 |
|------|------|
| `src/lib/analytics/admin-kpi-labels.ts` | 요약 지표 라벨/설명, 섹션 제목, 퍼널 단계 한글명, 상세 블록 설명, 용어 안내, 원시 테이블 컬럼명 |

---

## 수정 파일

| 경로 | 설명 |
|------|------|
| `src/app/admin/kpi/KpiDashboardClient.tsx` | 사전 import, 카드·퍼널·메타 한글화, 용어 안내 블록, 원시 이벤트 표 한글 헤더 |
| `scripts/analytics-detailed-tracking-smoke.mjs` | 세션/카메라/PWA/알림 섹션 검증을 라벨 사전·바인딩 기준으로 정렬 |
| `scripts/analytics-kpi-korean-explanations-smoke.mjs` | PR-6 정적 검증 스모크 |
| `package.json` | `test:analytics-kpi-korean-explanations` |

---

## 한글 라벨·설명

요약 카드는 `ADMIN_KPI_SUMMARY_METRICS`에 정의된 라벨·설명을 사용합니다.  
요구사항에 맞춰 **실행 설정 완료율**(`onboarding_completion_rate`) 카드를 요약 그리드에 포함했습니다 (API 필드만 표시, 로직 변경 없음).

---

## 섹션 제목

`ADMIN_KPI_SECTION_TITLES` — 핵심 요약, 테스트 퍼널, 실행 전환 퍼널, 첫 세션 퍼널, 가장 큰 이탈 구간, 세션/카메라/PWA/알림 상세, 재방문율, 최근 이벤트 로그 등.

---

## 상세 블록 설명

`ADMIN_KPI_DETAIL_SECTION_EXPLANATIONS` — 세션 이탈·카메라·PWA·알림·재방문·원시 로그 목적 요약.

---

## 용어 안내

- **집계 대기:** D1/D3/D7 판단일 이전 코호트 (0%와 구분)
- **적격 코호트 가중 평균:** 측정 가능한 코호트만 가중 합산 (PR-5와 동일 의미)
- **이벤트 건수 기준:** 일부 표는 사용자 수가 아닌 이벤트 발생 횟수

---

## 테스트

```bash
npm run test:analytics-kpi-korean-explanations
npm run test:analytics-event-infra
npm run test:analytics-core-funnel-tracking
npm run test:analytics-admin-kpi-dashboard
npm run test:analytics-detailed-tracking
npm run test:analytics-retention-hardening
```

---

## 알려진 한계

- 서버가 내려주는 퍼널 스텝의 영문 `label` 필드는 그대로 두고, 클라이언트에서 `event_name`으로 한글 매핑합니다.
- 알 수 없는 이벤트는 원문 라벨 폴백.
- 레이아웃·디자인 시스템은 변경 최소화.
