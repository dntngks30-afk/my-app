# PR1: Auth UI 전면 교체 (HARD MODE)

## MAIN UI 토큰 표 (src/app/(main)/page.tsx 기준)

| 항목 | className |
|------|-----------|
| A. Page Wrapper | `min-h-screen bg-[var(--bg)]` |
| B. Container | `container mx-auto px-4` + `max-w-4xl mx-auto` / `max-w-3xl mx-auto` |
| C. Card | `rounded-[var(--radius)] bg-[var(--surface)] border border-[color:var(--border)] shadow-[var(--shadow-0)] w-full p-5 sm:p-6 lg:p-10` |
| D. Title Typography | `text-lg lg:text-xl font-semibold text-[var(--text)] mb-2` |
| E. Description Typography | `text-sm lg:text-base leading-relaxed text-[var(--muted)]` |
| F. Badge | `variant="outline"`, `text-xs font-medium text-[var(--muted)] uppercase tracking-wide` (SurveyForm category L301) |
| G. Input | `rounded-[var(--radius)] h-11` (MAIN에 Input 없음, radius는 카드와 동일) |
| H. Primary Button | `px-6 py-3 rounded-[var(--radius)] font-semibold bg-[var(--brand)] text-white hover:brightness-95` (SurveyForm L331-337) |
| I. Link style | `text-[var(--brand)] underline-offset-4 hover:underline` / `text-[var(--muted)] underline-offset-4 hover:underline` |

## 적용 증빙 표 (파일:라인)

| 토큰 | 적용 위치 |
|------|-----------|
| A (Page Wrapper) | AuthShell.tsx:L18 |
| B (Container) | AuthShell.tsx:L19-21 |
| C (Card) | AuthShell.tsx:L38-40 |
| D (Title) | AuthShell.tsx:L28-33 |
| E (Desc) | AuthShell.tsx:L34-36 |
| F (Badge) | AuthShell.tsx:L22-27 |
| G (Input) | AuthCard.tsx:L47, L61 / signup/complete/page.tsx:L32, L44, L55 |
| H (Button) | AuthCard.tsx:L80-82 / signup/complete/page.tsx:L58-61 |
| I (Link) | AuthCard.tsx:L69-74, L93-94, L99-100, L106-108 |

## 변경 파일 리스트

- `tsconfig.json` - baseUrl 추가
- `src/components/auth/AuthShell.tsx` - 신규
- `src/components/auth/AuthCard.tsx` - 신규
- `src/app/login/page.tsx` - 신규
- `src/app/signup/page.tsx` - 레거시 제거 후 AuthCard로 교체
- `src/app/signup/complete/page.tsx` - 신규

## 검증

```bash
pnpm run lint
pnpm run build
```

- /login, /signup, /signup/complete 가 MAIN과 동일 톤(여백/카드/버튼/타이포)으로 표시됨
- 레거시 signup(Supabase 호출 등) 0
- UI only, auth 로직 없음 (stub만)
