# PR-UI-CHAPTER-TRANSITION-02A — Flicker correction (content-layer only)

## 목적

PR-UI-CHAPTER-TRANSITION-02에서 **전체 씬(배경 포함)에 opacity 0→1** 이 걸려 랜딩·라우트 전환이 **깜빡임**처럼 느껴지던 문제를 고친다. 배경(코스믹/노이즈/글로우)은 **고정**하고, **콘텐츠 슬롯만** 짧은 `translateY` 진입만 허용한다.

## CURRENT_IMPLEMENTED

- `globals.css`: `.public-chapter-content-*` / `.public-survey-question-swap` — **opacity 키프레임 제거**, `prefers-reduced-motion` 시 `animation: none`
- `StitchSceneShell`: `contentEnter` (`default` | `light` | `calm` | `minimal` | `off`), `variant="camera"` 이면 항상 모션 없음
- 랜딩·인트로·설문: 각 셸의 **main(또는 콘텐츠 컬럼)** 에만 클래스 부착
- 라우트 `template.tsx` **제거** — 전체 트리 재래핑으로 인한 번쩍임 제거
- `publicChapterContentClass()` — 콘텐츠 전용 클래스명 ( `enterClass.ts` )
- 카메라 진입 `CameraEntry`: `contentEnter="off"`, 내부 `animate-in fade-in` 제거
- `RefineBridge` / `PublicResultRenderer` / `StitchSessionPreparingScene` 등 **전역 fade-in** 제거 또는 translate-only로 교체

## NOT_YET_IMPLEMENTED

- 별도 영속 배경 레이아웃(단일 레이아웃에서 라우트만 갈아끼우기) — 현재는 시각적으로 동일 패밀리 배경 + 콘텐츠만 이동으로 근사

## 검증

- [ ] 공개 퍼널 전환 시 전체 화면이 사라졌다 나타나는 느낌 없음
- [ ] `npm run build`
- [ ] `/app` 미변경
