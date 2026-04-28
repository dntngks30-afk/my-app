# PR-RESET-QA-01 — Reset stretch 미디어 회귀

## 전제

- PR-DATA-01B ledger 검수 완료 + PR-DATA-02 마이그레이션·attach 완료(또는 스테이징 동일).

## 수동 점검 (CHECKLIST)

### `/app/checkin` — Reset 스트레치

- [ ] 10개 스트레치 각각 **Play** 시도 시 placeholder_unmapped **기본 경로가 아닌** 실제 스트림(또는 지정된 미디어)으로 이어지는지.
- [ ] 네트워크 오프라인/지연 시 기대된 폴백(기존 정책 유지)만 확인.

### 실기기

- [ ] iOS/Android PWA 또는 브라우저에서 영상 재생·전체화면·정지 동작.

### 홈·실행 코어 (보호 영역)

- [ ] `/app/home` UI·탭 셸·세션 플레이어 **변경 없음**(회귀만). Reset 작업으로 인한 부수 효과 없음 확인.

## 비범위

- 자동 E2E 스크립트 추가(필요 시 후속 PR).
