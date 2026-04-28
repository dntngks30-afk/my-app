# PR-RESET-00 — Reset Tab Parent SSOT (문서 전용)

## 목적

`/app` 내 **리셋 탭**을 향후 확장(10종 스트레칭 기반 즉시 리셋 추천·재생)하기 **전에**, 제품 방향·식별자 분리·추천 흐름·범위 금지를 **부모 SSOT**로 고정한다.

**본 PR은 문서만 추가한다.** 기능·API·UI·DB 마이그레이션·미디어 연결 구현은 포함하지 않는다.

## 생성·추가되는 파일

| 경로 | 역할 |
|------|------|
| [docs/ssot/RESET_TAB_2026_04.md](../ssot/RESET_TAB_2026_04.md) | Reset 탭 부모 SSOT (전문) |
| `docs/pr/PR-RESET-00-parent-ssot.md` (본 문서) | PR 요약·검증 기록 |

코드·스크립트·기존 문서의 **수정 없음**.

---

## RESET_TAB_2026_04.md 요약

- 리셋 탭은 **세션 생성 시스템이 아니라** **10종 스트레칭 기반 즉시 리셋 추천/재생** 소비 레이어로 정의된다.
- 사용자는 **불편감 언어**(10개 고정 이슈)로 진입하고, **2~3개** 스트레칭 추천(primary + alternatives)을 받는다.
- **상단 카드**에 이슈 요약·대표 썸네일·재생, **`ResetStretchModal`** 에서 **영상·설명·방법만** (세트·RPE·세션 완료·reflection·next session preview **제외**).
- 식별자: **`reset_key`**(이슈) / **`stretch_key`**(스트레칭 종류) / **`template_id`**(DB 연결, 후속 PR) 책임 분리.
- 목표 플로우: `ResetTabViewV2` → **`GET /api/reset/recommendations`** → 카탈로그·매핑·패턴 추천 → 상단 카드 + 하단 리스트 → **`POST /api/reset/media`** → **`ResetStretchModal`** → Mux 재생.

---

## 고정된 10개 사용자 이슈

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

(상세 규칙·표현 원칙은 SSOT 본문 참고.)

---

## 고정된 10종 스트레칭 (영문 NAME·키)

SSOT 본문의 표와 동일. 검색·리뷰용으로 영문 이름 예:

| stretch_key (요약) | 영문 NAME 예 |
|--------------------|---------------|
| sternocleidomastoid_stretch | **Sternocleidomastoid Stretch** |
| longitudinal_foam_roller_chest_opener | **Longitudinal Foam Roller Chest Opener** |
| levator_scapulae_upper_trap_stretch | **Levator Scapulae and Upper Trapezius Stretch** |

전체 10행 표는 [RESET_TAB_2026_04.md](../ssot/RESET_TAB_2026_04.md) 참고.

---

## 이슈별 2~3개 스트레칭 매핑 요약

각 이슈: **primary 1 + alternatives 2**. 이슈별 `short_goal`(리스트 보조 문구 방향) 포함.

- 예: **거북목** → primary 흉쇄유돌근 스트레칭; alternatives 견갑거근&상부 승모근, 폼롤러 세로 롱 오프너; short_goal **목 앞쪽 리셋**.  
- 예: **허리 뻐근함** → primary 캣카우; alternatives 대퇴 사두근·햄스트링; short_goal **골반·허리 이완**.  

전체 10개 블록은 SSOT §「10개 이슈별 매핑」에 정본으로 수록됨.

---

## 후속 PR 로드맵 (순서)

1. **PR-RESET-BE-01** — Reset stretch catalog + issue catalog 코드 SSOT 생성  
2. **PR-RESET-BE-02** — `GET /api/reset/recommendations`  
3. **PR-RESET-BE-03** — `POST /api/reset/media`  
4. **PR-RESET-FE-01** — `ResetTabViewV2` 연동·리스트→상단 카드  
5. **PR-RESET-FE-02** — `ResetStretchModal` · 재생  
6. **PR-RESET-DATA-01** — 실제 `template_id` / Mux `media_ref` 매핑  
7. **PR-RESET-QA-01** — 스모크·회귀 잠금  

**다음 진행 PR: PR-RESET-BE-01.**

---

## Non-goals (본 PR)

- 앱 코드·API·UI·DB 변경 없음.  
- 후속에서도 **명시 범위 밖이면** 홈 세션 플레이어·세션 API·composer·adaptive·public scoring·camera·readiness 판정 순서··`exercise_templates` 마이그레이션 등 리셋 비관련 코어는 수정하지 않는다(SSOT 본문 금지 목록과 동일).

---

## 검증 방법

1. **파일 개수**: 새로 생성된 파일은 아래 2개뿐인지 확인한다.  
   - `docs/ssot/RESET_TAB_2026_04.md`  
   - `docs/pr/PR-RESET-00-parent-ssot.md`  

2. **코드 변경 없음**: `git status` / `git diff` 에서 위 2파일 외 변경이 없어야 한다.

3. **키워드(정본 SSOT에 포함)**: 아래가 `RESET_TAB_2026_04.md` 에서 검색 가능해야 한다.  
   - `RESET_TAB_2026_04`, `reset_key`, `stretch_key`, `template_id`  
   - `Sternocleidomastoid Stretch`, `Longitudinal Foam Roller Chest Opener`, `Levator Scapulae and Upper Trapezius Stretch`  
   - `GET /api/reset/recommendations`, `POST /api/reset/media`, `ResetStretchModal`  

실행 예(PowerShell):

```powershell
rg "RESET_TAB_2026_04|reset_key|stretch_key|template_id|Sternocleidomastoid Stretch|Longitudinal Foam Roller Chest Opener|Levator Scapulae and Upper Trapezius Stretch|GET /api/reset/recommendations|POST /api/reset/media|ResetStretchModal" docs/ssot/RESET_TAB_2026_04.md
```

---

## 완료 조건

- [x] 부모 SSOT 문서 추가  
- [x] PR 설명 문서 추가  
- [ ] 리뷰어: **다음 PR은 PR-RESET-BE-01** 로 진행
