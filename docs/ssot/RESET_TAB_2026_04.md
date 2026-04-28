# RESET_TAB_2026_04 — MOVE RE Reset Tab Parent SSOT

Status: Canonical parent SSOT for the in-app Reset tab (“리셋” 탭).  
Documentation stack: 상위 규칙은 [SSOT_PUBLIC_FIRST_2026_03.md](../SSOT_PUBLIC_FIRST_2026_03.md), [AGENTS.md](../../AGENTS.md) 등 기존 7종과 충돌 시 **번호가 작은 문서가 우선**한다. 본 문서는 **RESET_TAB_2026_04** 기능 방향만 고정한다.

---

## 버전 라벨 (검색·컨트랙트 참조용)

본 문서의 정본 식별자: **`RESET_TAB_2026_04`** (코드 상수 또는 PR 리뷰 시 이 문자열로 본 SSOT 회귀를 가리킨다.)

스토리지/구현 분리 원칙(LOCKED_DIRECTION):

| 식별자 | 역할 |
|--------|------|
| **`reset_key`** | 사용자가 선택하는 **불편 이슈**(10개 고정 ENUM). 리스트 노출·추천 규칙의 입력 키. |
| **`stretch_key`** | 스트레칭 **종류**(10종 고정). 미디어/카탈로그·모달 재생 선택의 입력 키. |
| **`template_id`** | DB `exercise_templates.id` 또는 동등 레코드 참조.**후속 PR**에서 카탈로그와 매핑해 연결한다. 본 SSOT에서는 **개념만 고정**한다. |

구현 검증 필드: `RESET_TAB_2026_04`, `reset_key`, `stretch_key`, `template_id`; UI/API 이름 참조 **`GET /api/reset/recommendations`**, **`POST /api/reset/media`**, **`ResetStretchModal`**; 영상 표시명 참조 **`Sternocleidomastoid Stretch`**, **`Longitudinal Foam Roller Chest Opener`**, **`Levator Scapulae and Upper Trapezius Stretch`**.

---

## 목적

리셋 탭을 **“세션 생성 시스템”의 일부가 아니라**, **10종 스트레칭 기반의 즉시 리셋 추천·재생 소비 레이어**로 정의한다. 사용자가 짧게 긴장을 풀기 위한 **경량 진입**(불편감 선택 → 추천 → 재생)을 고정하고, 플랜/세션/적응 루프와의 경계를 분명히 한다.

---

## 상태 표기 (SSOT 패턴 준수)

- **CURRENT_IMPLEMENTED**: `/app/checkin`(탭) 등에 리셋 UI 자리표시자 존재할 수 있다(구현은 변동 가능).
- **LOCKED_DIRECTION**: 본 문서의 이슈 10종·스트레칭 10종 매핑·소비 레이어 경계는 **후속 PR에서 수정 시 문서 업데이트 또는 상위 리뷰**를 전제로 한다.

---

## 핵심 정의 (LOCKED_DIRECTION)

1. 리셋 탭은 사용자가 느끼는 **불편감 표현** 기준으로 진입한다.
2. 사용자는 “거북목”, “허리 뻐근함” 등 **문제 언어**로 선택한다.
3. 앱은 해당 이슈에 대해 **2~3개** 스트레칭을 추천한다(아래 매핑의 primary + alternatives).
4. **상단 카드**: 선택된 이슈 요약과 대표 스트레칭 썸네일 및 **재생 버튼**을 보여준다.
5. 재생 버튼을 누르면 **전용 모달 (`ResetStretchModal`)** 이 열리고 **영상·설명·방법**만 제공한다.

**포함하지 않는다 (NOT)**:

- 세트 기록
- RPE
- 세션 완료/적응
- 리플렉션(reflection)
- next session preview  

위 기능은 세션 패널/루틴 진행 SSOT 소관이며 **리셋 탭 모달 범위 밖**이다.

---

## 제품 경계

- 리셋 탭은 **`/app/home` 리셋맵·세션 생성·SessionPanel 루프와 분리된 consumer layer**이다.
- **readiness** 및 **result_summary**는 필요 시 참조만 하며, **판정 순서나 truth를 변경하지 않는다.**
- public result 스코어링, 카메라 분석기, 세션 컴포저(composer), adaptive loop는 리셋 탭 범위에 **포함하지 않는다**(명시 후속 작업 목록 참고).

---

## 식별자 책임 (LOCKED_DIRECTION)

세 가지 식별자를 혼합하지 않는다.

1. **`reset_key`**: “무슨 불편 이슈냐” (UX 리스트 및 추천 정책 입력).
2. **`stretch_key`**: “어떤 스트레칭 종류이냐” (카탈로그·모달 재생 선택).
3. **`template_id`**: 장기적으로 **실제 템플릿/실행 레코드**와 연결. PR-RESET-DATA-01 등에서 매핑한다.

본 문서는 **한글 명·영문 표기·내부 키**를 아래 표와 매핑으로 고정한다.

---

## Reset flow (목표 구조)

목표 사용자·서버 책임 흐름(LOCKED_DIRECTION / NOT_YET_IMPLEMENTED 구현 순서는 후속 PR 참고):

```
ResetTabViewV2
  → GET /api/reset/recommendations
  → Reset Catalog / Issue Mapping / User Pattern Recommendation
  → 상단 추천 카드 + 하단 이슈 리스트
  → POST /api/reset/media
  → ResetStretchModal
  → Mux 영상 재생
```

- **`GET /api/reset/recommendations`**: `reset_key`(및 선택적 사용자 패턴 입력) 기반 추천 2~3개 반환.**세션 생성이 아니다.**
- **`POST /api/reset/media`**: 선택된 **`stretch_key`** 또는 `template_id`에 대한 **재생 가능한 미디어 레퍼런스**만 반환하도록 하는 리셋 전용 래퍼(기존 `/api/media/sign` 등과 책임 분리를 전제로 설계 가능). 세부 계약은 PR-RESET-BE-03에서 정한다.

---

## 10개 사용자 이슈 (고정 `reset_key` 순서 예시 — 표시 문구 고정)

1. 거북목  
2. 라운드숄더  
3. 등이 뻣뻣함  
4. 허리 뻐근함  
5. 고관절 답답함  
6. 엉덩이 깊은 뻐근함  
7. 무릎 불편감  
8. 목·어깨 뻐근함  
9. 어깨·겨드랑이 답답함  
10. 골반-허리 긴장  

표현 원칙:

- 리스트 **메인 텍스트**: 사용자 불편감 언어.  
- 리스트 **보조 텍스트**: 리셋 방향(`short_goal`과 정렬 가능).  
- **상단 카드**: 선택 이슈 → “왜 이 리셋이 필요한지” 연결 카피.  
- **모달 제목**: 해당 스트레칭의 **실제 이름**(한글; 영문은 표 또는 자막에만).

### 예시 (형식 참고만)

리스트 줄:

```
거북목 / 목 앞쪽 리셋
```

상단 카드:

```
거북목이 신경 쓰인다면  
목 앞쪽 긴장과 등 상부 굳음을 먼저 풀어보세요.
```

모달 제목 예 (한글):

```
흉쇄유돌근 스트레칭
```

(영문 예: **`Sternocleidomastoid Stretch`**)

---

## 10개 스트레칭 카탈로그 표 (stretch_key 고정)

| No | 한글 영상명 | 영문 NAME | stretch_key | asset_slug |
|---:|---|---|---|---|
| 1 | 흉쇄유돌근 스트레칭 | Sternocleidomastoid Stretch | sternocleidomastoid_stretch | sternocleidomastoid-stretch |
| 2 | 대퇴 사두근 스트레칭 | Quadriceps Stretch | quadriceps_stretch | quadriceps-stretch |
| 3 | 햄스트링 스트레칭 | Hamstring Stretch | hamstring_stretch | hamstring-stretch |
| 4 | 이상근 스트레칭(앉아서) | Seated Piriformis Stretch | seated_piriformis_stretch | seated-piriformis-stretch |
| 5 | 대둔근 스트레칭 | Gluteus Maximus Stretch | gluteus_maximus_stretch | gluteus-maximus-stretch |
| 6 | 이상근 스트레칭(누워서) | Supine Piriformis Stretch | supine_piriformis_stretch | supine-piriformis-stretch |
| 7 | 캣카우(허리) 스트레칭 | Cat-Cow Spine Stretch | cat_cow_spine_stretch | cat-cow-spine-stretch |
| 8 | 폼롤러 광배근 스트레칭 | Foam Roller Lat Stretch | foam_roller_lat_stretch | foam-roller-lat-stretch |
| 9 | 폼롤러 세로로 두고 위에 눕기 | Longitudinal Foam Roller Chest Opener | longitudinal_foam_roller_chest_opener | longitudinal-foam-roller-chest-opener |
| 10 | 견갑거근&상부 승모근 스트레칭 | Levator Scapulae and Upper Trapezius Stretch | levator_scapulae_upper_trap_stretch | levator-scapulae-upper-trap-stretch |

주의:

- **`stretch_key`**: 코드·API 내부 로직 전용 ENUM.  
- **`asset_slug`**: 영상 파일명/Mux manifest/admin 라벨 **후보**; 확정 매핑은 PR-RESET-DATA-01에서 `template_id`와 함께 고정한다.  
- **`template_id`** (DB/exercise_templates): 본표에는 없음.**후속 PR**에서 줄 단위 매핑.

---

## 10개 이슈별 매핑 (정본)

각 이슈는 **primary 1개 + alternatives 최대 2개** 로 고정된다.

### 1. 거북목

- **primary**: 흉쇄유돌근 스트레칭  
- **alternatives**:  
  - 견갑거근&상부 승모근 스트레칭  
  - 폼롤러 세로로 두고 위에 눕기  
- **short_goal**: 목 앞쪽 리셋  

### 2. 라운드숄더

- **primary**: 폼롤러 세로로 두고 위에 눕기 (**Longitudinal Foam Roller Chest Opener**)  
- **alternatives**:  
  - 폼롤러 광배근 스트레칭  
  - 견갑거근&상부 승모근 스트레칭 (**Levator Scapulae and Upper Trapezius Stretch**)  
- **short_goal**: 가슴·흉곽 열기  

### 3. 등이 뻣뻣함

- **primary**: 캣카우(허리) 스트레칭  
- **alternatives**:  
  - 폼롤러 광배근 스트레칭  
  - 폼롤러 세로로 두고 위에 눕기  
- **short_goal**: 척추 움직임 리셋  

### 4. 허리 뻐근함

- **primary**: 캣카우(허리) 스트레칭  
- **alternatives**:  
  - 대퇴 사두근 스트레칭  
  - 햄스트링 스트레칭  
- **short_goal**: 골반·허리 이완  

### 5. 고관절 답답함

- **primary**: 이상근 스트레칭(앉아서)  
- **alternatives**:  
  - 대둔근 스트레칭  
  - 대퇴 사두근 스트레칭  
- **short_goal**: 고관절 주변 이완  

### 6. 엉덩이 깊은 뻐근함

- **primary**: 이상근 스트레칭(누워서)  
- **alternatives**:  
  - 이상근 스트레칭(앉아서)  
  - 대둔근 스트레칭  
- **short_goal**: 둔부 깊은 긴장 완화  

### 7. 무릎 불편감

- **primary**: 대퇴 사두근 스트레칭  
- **alternatives**:  
  - 햄스트링 스트레칭  
  - 대둔근 스트레칭  
- **short_goal**: 허벅지 긴장 완화  

### 8. 목·어깨 뻐근함

- **primary**: 견갑거근&상부 승모근 스트레칭 (**Levator Scapulae and Upper Trapezius Stretch**)  
- **alternatives**:  
  - 흉쇄유돌근 스트레칭 (**Sternocleidomastoid Stretch**)  
  - 폼롤러 세로로 두고 위에 눕기 (**Longitudinal Foam Roller Chest Opener**)  
- **short_goal**: 목 뒤쪽 긴장 완화  

### 9. 어깨·겨드랑이 답답함

- **primary**: 폼롤러 광배근 스트레칭  
- **alternatives**:  
  - 폼롤러 세로로 두고 위에 눕기  
  - 견갑거근&상부 승모근 스트레칭  
- **short_goal**: 광배근·겨드랑이 라인 이완  

### 10. 골반-허리 긴장

- **primary**: 캣카우(허리) 스트레칭  
- **alternatives**:  
  - 대둔근 스트레칭  
  - 이상근 스트레칭(누워서)  
- **short_goal**: 골반 주변 리셋  

---

## 후속 PR 로드맵 (표시 순서)

| PR | 목표 요약 |
|----|-----------|
| **PR-RESET-BE-01** | Reset stretch catalog + issue catalog **코드 SSOT** 생성 |
| **PR-RESET-BE-02** | `GET /api/reset/recommendations` 추천 API 생성 |
| **PR-RESET-BE-03** | `POST /api/reset/media` 리셋 전용 media wrapper API 생성 |
| **PR-RESET-FE-01** | `ResetTabViewV2` API 연결 및 하단 리스트 클릭 시 상단 카드 변경 |
| **PR-RESET-FE-02** | `ResetStretchModal` 구현 및 영상 재생 |
| **PR-RESET-DATA-01** | 실제 `template_id` / Mux media_ref 매핑 |
| **PR-RESET-QA-01** | 스모크 테스트 및 회귀 잠금 |

다음 PR: **PR-RESET-BE-01**.

---

## Non-goals 및 절대 금지 (LOCKED_DIRECTION)

본 리셋 탭(SSOT 포함)에서는 **명시 후속 PR 또는 별도 허용 없이** 아래 경로·시스템을 **변경하지 않는다**(PR-RESET-00 및 위 로드맵 전체 공통 규칙).

- `src/app/app/(tabs)/home/**`
- `SessionPanelV2.tsx`
- `ExercisePlayerModal.tsx`
- `/api/session/create`
- `/api/session/complete`
- session composer
- adaptive engine
- public result scoring
- camera analyzer
- readiness **판정 순서**
- **`exercise_templates` DB migration** (리셋 전용 카탈로그는 코드·문서 또는 별도 매핑 테이블로 도입 검토 가능하나, 명시 후속까지 기본 수정 금지)

리셋 탭은 readiness / result_summary를 **소비**할 수 있으나 **readiness truth 소유권은 변경하지 않는다.**

---

## 참고 체크 (문서 작성자용)

본 문서 키워드 체크리스트 한 줄: **`RESET_TAB_2026_04`**, `reset_key`, `stretch_key`, `template_id`, `Sternocleidomastoid Stretch`, `Longitudinal Foam Roller Chest Opener`, `Levator Scapulae and Upper Trapezius Stretch`, **`GET /api/reset/recommendations`**, **`POST /api/reset/media`**, **`ResetStretchModal`**.
