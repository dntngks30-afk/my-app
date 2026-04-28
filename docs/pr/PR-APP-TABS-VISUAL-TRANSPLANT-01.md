# PR-APP-TABS-VISUAL-TRANSPLANT-01

## 목적 (CURRENT_IMPLEMENTED)

- V2 하단 내비 **리셋**(`/app/checkin`)·**여정**(`/app/profile`) 화면을 `/app/home` 도너와 동일한 **다크 네이비(oklch) + 오렌지 악센트 + 글래스 카드** 톤으로 맞춤.
- **`BottomNav`** 도너 테마 적용 범위를 `/app/home`, `/app/checkin`, `/app/profile`로 통일.

## 기능·백엔드 (변경 없음 의도)

- 세션 생성·completion·결제·auth·Rail 등 **실행 로직 미수정**.
- 이 PR은 **표현(presentation)만** 변경.

## 변경·추가 파일

| 파일 | 내용 |
|------|------|
| `src/app/app/_components/BottomNav.tsx` | `useDonorTheme` 조건에 `checkin`·`profile` 추가 |
| `src/app/app/_components/nav-v2/appTabTheme.ts` | 공통 배경·카드·텍스트 토큰 |
| `src/app/app/_components/nav-v2/ResetTabViewV2.tsx` | 리셋 탭 UI(정적 카피) |
| `src/app/app/_components/nav-v2/JourneyTabViewV2.tsx` | 여정 탭 UI(진행목·메뉴·FAQ 시트·로그아웃) |
| `src/app/app/(tabs)/checkin/page.tsx` | navV2 시 `ResetTabViewV2`만 렌더, **레거시(navV2=0)는 주간 리포트 fetch 유지** |
| `src/app/app/(tabs)/profile/page.tsx` | navV2 시 `JourneyTabViewV2`, 기존 `getActiveSession`으로 완료 수만 전달 |

## 의도적으로 정적/mock인 것

- 리셋 탭 카드 클릭·「이 스트레칭 해보기」: **동작 없음**(향후 플레이어 연결).
- 여정 탭 진행도·메트릭·움직임 타입 문구: **데모 카피**·`completedSessions`/`totalSessions={12}` 기준 진행률만 반영(`totalSessions` 고정 상수로 추후 교체 가능).
- FAQ/운영 지침: **간단 패널**; 개인정보·약관은 `/privacy`, `/terms` 링크 병행.
- 피드백 메일: `support@posturelab.com` **mailto 상수**(레포 타 경로와 동일 문자열 존재).

## 지연되는 백엔드 연동

- 진짜 패턴 라벨·추천 스트레칭 ID·실제 완료/총 세션 수 소스 단일화.
- 주간 통계 차트 고도화.
- 리셋 이슈별 네비게이션·딥링크.

## 수동 테스트 체크리스트

- [ ] `/app/home` — 지도·BottomNav 도너 톤 유지(회귀 없음 가정).
- [ ] `/app/checkin` — 다크 리셋 탭, 하단 **리셋** 활성.
- [ ] `/app/profile` — 다크 여정 탭, 하단 **여정** 활성.
- [ ] 로그아웃 동작.
- [ ] 소폭(360px) 가로 오버플로 없음.

