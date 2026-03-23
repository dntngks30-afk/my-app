# MOVE RE — Public Funnel Brand UI SSOT

**목적:** active public 퍼널(랜딩·설문·결과·온보딩·클레임 준비)의 시각 언어를 **토큰 + primitive**로 고정해, 이후 화면 추가 시 톤 드리프트를 막는다.

**범위:** `src/components/public-brand/*`, `--mr-public-*` CSS 변수, 이 문서.  
**비범위:** `/app` 실행 코어, API, readiness, claim, session-create 로직.

---

## 1. 원칙 (Guardrails)

| 규칙 | 설명 |
|------|------|
| 한 화면 = 한 메시지 | 풀스크린 `100svh`, 스크롤 남용 금지(콘텐츠 예외는 결과 스텝 내부만). |
| 토큰 우선 | 배경·액센트·표면·테두리는 **`--mr-public-*`** 또는 Tailwind `mr-*` 유틸만 사용. |
| Primitive 우선 | 새 public CTA/카드/레일/칩은 **공용 컴포넌트**로만 추가. |
| 한국어 중심 | 헤드라인·본문은 KO 우선; 영어는 랜딩 서브 레이블 수준만. |
| 앰버/피치 액센트 | CTA·포커스·진행 강조는 **단일 액센트** (`--mr-public-accent`). |

---

## 2. 색상 토큰 (Canonical)

| 토큰 | 용도 |
|------|------|
| `--mr-public-bg-base` | 메인 네이비 배경 `#0d161f` |
| `--mr-public-bg-deep` | 더 깊은 베이스(필요 시) `#070b11` |
| `--mr-public-accent` | 피치/앰버 CTA·포커스 `#ff7b00` |
| `--mr-public-accent-hover` | CTA 호버 `#ff8f26` |
| `--mr-public-accent-muted` | 보더/글로우용 앰버 알파 |
| `--mr-public-fg` | 기본 텍스트 `rgb(241 245 249)` 계열 |
| `--mr-public-fg-muted` | 보조 텍스트 |
| `--mr-public-surface` | 카드 표면 `rgba(255,255,255,0.04)` |
| `--mr-public-border` | 카드/칩 보더 `rgba(255,255,255,0.10)` |

**Cosmic glow:** `.mr-public-funnel-shell` + `.mr-public-cosmic-glow` 레이어(그라데이션만, 임의 box-shadow 추가 금지).

---

## 3. 타이포

| 용도 | 규칙 |
|------|------|
| 브랜드 워드마크 | `var(--font-serif-noto)` — “Move Re” 등 |
| 본문·헤드라인 | `var(--font-sans-noto)` |
| Eyebrow | `text-[11px] uppercase tracking-widest text-slate-500` (primitive `MoveReHeroBlock`) |

---

## 4. Spacing / Radius / Shadow (고정 세트)

| 항목 | 값 |
|------|-----|
| 풀스크린 패딩 | `px-6` (가로), 세로는 `py-8`~`py-10` |
| 콘텐츠 최대 너비 | `max-w-md` |
| CTA 높이 | Primary `min-h-[52px]`~`min-h-[56px]` |
| 카드 radius | `rounded-2xl` (`--mr-public-radius-card`) |
| CTA radius | `rounded-2xl` |
| 그림자 | CTA만 `shadow-lg shadow-black/25` (Primary primitive). 카드는 border+surface, 무질서한 shadow 금지. |

---

## 5. 컴포넌트 법칙 (Primitives)

| 컴포넌트 | 사용처 |
|----------|--------|
| `MoveReFullscreenScreen` | 모든 public 풀스크린 루트 |
| `MoveReTopBar` | 선택 — 뒤로가기/타이틀 |
| `MoveReProgressRail` | 상단 얇은 진행 막대 |
| `MoveReHeroBlock` | eyebrow + 제목 + 부제 + 액센트 구분선 |
| `MoveReSurfaceCard` | 어두운 표면 카드 |
| `MoveRePrimaryCTA` | 주요 버튼 |
| `MoveReSecondaryCTA` | 보조(링크/아웃라인) |
| `MoveReChoiceChip` | 주간 횟수·경험 등 선택 칩 |

---

## 6. 상태 라벨 (문서)

- **CURRENT_IMPLEMENTED:** 토큰·primitive·문서는 저장소에 반영된 시점 기준.
- **LOCKED_DIRECTION:** public 퍼널은 단일 다크 코스믹 무드 유지.
- **NOT_YET_IMPLEMENTED:** `/app` 내부·어드민은 본 SSOT 비적용.

---

## 7. 변경 시 체크리스트

1. 새 hex를 페이지에 직접 넣지 않았는가?  
2. 새 버튼을 primitive 없이 만들지 않았는가?  
3. `100svh` 레이아웃이 깨지지 않았는가?  
4. 영어 카피가 헤드라인을 잡지 않았는가?

---

## 8. 구현 위치 (코드)

| 구분 | 경로 |
|------|------|
| CSS 토큰·글로우·패널 유틸 | `src/app/globals.css` (`:root` `--mr-public-*`, `.mr-public-funnel-shell`, `.mr-public-cosmic-glow`, `.mr-public-panel-accent`) |
| Primitives | `src/components/public-brand/` (`MoveReFullscreenScreen`, `MoveReTopBar`, `MoveReProgressRail`, `MoveReHeroBlock`, `MoveReSurfaceCard`, `MoveRePrimaryCTA`, `MoveReSecondaryCTA`, `MoveReChoiceChip`, `index.ts`) |
| 결과 스텝 UI 토큰 정렬 | `src/components/public-result/PublicResultRenderer.tsx` (액센트 → CSS 변수) |
