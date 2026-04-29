# PR — PWA / 인앱 브라우저 설치 가이드 (01)

## 목적

온보딩·세션 준비 완료 후 `/app/home` 진입 직전 stitch 완료 화면(`StitchOnboardingCompleteScene`)에서, **접속 환경에 맞는 홈 화면 저장(앱처럼 실행) 안내**를 보여 준다.

이 PR은 **Android Chrome의 `beforeinstallprompt`만 믿는 UX가 아니다.** 파일럿 사용자는 카카오톡·인스타·유튜브·스레드 등 **인앱 브라우저**로 진입할 가능성이 크고, 이 환경에서는 설치 모달이 뜨지 않거나 제한되는 경우가 많다. 그래서 **인앱 감지 → 외부 브라우저(Chrome/Safari)로 열기 안내 → 홈 화면 추가** 순서를 짧게 안내하는 것이 중심이다.

## 왜 install prompt 중심이 아닌가

- 인앱 WebView 계열에서는 `beforeinstallprompt`가 없거나 비활성인 경우가 많다.
- iOS Safari는 표준 설치 prompt API가 없고, 공유 시트로 수동 추가가 기본이다.
- 그럼에도 Android Chrome 정식 브라우저에서는 `beforeinstallprompt`가 있으면 **선택적으로** 실제 prompt를 호출할 수 있다.

## 상황별 UX (요약)

| 모드 | 요지 |
|------|------|
| `standalone` | 이미 홈 화면/앱 모드 → 설치 안내 축약 |
| `in_app` | 인앱 → Chrome/Safari로 열기 단계(최대 3단계) + 링크 복사 |
| `android_chrome_prompt` | `beforeinstallprompt` 보유 → 홈 화면 저장 CTA로 prompt |
| `android_chrome_manual` | prompt 미준비 등 → 수동 메뉴 안내 + 링크 복사 |
| `ios_safari` | 공유 → 홈 화면에 추가 안내(모달 3단계) |
| `desktop_or_other` | 짧은 모바일 저장 권장 문구 |

## 수정·추가 파일

| 파일 | 역할 |
|------|------|
| `src/lib/pwa/usePwaInstallGuideState.ts` | UA 기반 인앱 감지, standalone, `beforeinstallprompt` 보관·`promptInstall`, 모드 계산 |
| `src/components/pwa/PwaInstallGuideCard.tsx` | 상황별 카드 + dark glass 모달(ESC/백드롭 닫기) |
| `src/components/stitch/postpay/StitchOnboardingCompleteScene.tsx` | 카피·레이아웃, `/my-routine` 제거, 가이드 카드 삽입 |
| `docs/pr/PR-PWA-INAPP-BROWSER-INSTALL-GUIDE-01.md` | 본 문서 |

## 보장 범위

- 완료 화면에서 **레거시 `/my-routine` 링크가 제거**된다.
- 제목·본문이 **리셋맵/실행 앱** 중심 문구로 맞춰진다.
- 설치·저장은 **권장**이며, **`앱으로 이동하기`는 항상 가능**하다(기존 `claimDone` disabled 조건 유지).
- 인앱 사용자에게 **Chrome/Safari에서 여는 방법**과 **링크 복사** fallback을 제공한다.
- **이 PR은 인앱 브라우저를 외부 브라우저로 강제 이동시키지 않는다.** (intent URL, 앱 스킴 hack, `location` 강제 조작 없음)

## 보장하지 않는 범위

- 모든 WebView/인앱 브라우저의 완벽한 식별
- OS·앱 버전별 메뉴 레이블 100% 일치
- `beforeinstallprompt` 미지원 브라우저에서의 자동 설치
- service worker / manifest 구조의 대규모 변경 (본 PR에서 하지 않음)

## 수동 검증 체크리스트

- [ ] 카카오톡 인앱: 인앱 안내 + Android/iOS 분기 문구, 링크 복사, 완료 화면에서 Chrome install prompt 전용 CTA가 **인앱에서만** 보이지 않음
- [ ] 인스타그램 인앱: 동일
- [ ] 유튜브 / 스레드 인앱: 인앱 안내 + 링크 복사
- [ ] Android Chrome(일반): `beforeinstallprompt` 시 홈 화면 저장 CTA, dismiss/accept 후에도 앱 이동 가능
- [ ] Android Chrome prompt 없음: 수동 안내 또는 링크 복사, 화면 깨짐 없음
- [ ] iPhone Safari: 공유 → 홈 화면에 추가 안내, **가짜 install prompt 버튼 없음**
- [ ] standalone / PWA 아이콘 실행: 안내 축약, 앱 이동 가능
- [ ] `claimDone === false`: 메인 CTA disabled 유지
- [ ] 레이아웃: 모바일 `100svh`에서 과도하게 길지 않음

## 남은 후속 과제

- 인앱 UA 패턴 추가·조정(운영 로그·파일럿 피드백 기반)
- `npm run lint`가 프로젝트에서 정상 동작하도록 Next/ESLint 스크립트 정비(기존 이슈)
- Web App Manifest / 아이콘과 안내 카피의 더 촘촘한 정합(별도 PR)
