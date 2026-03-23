# PR-UI-TEXT-MASK-03B-FULL-ROLLBACK — Remove headline text-mask reveal

## 목적

PR-UI-TEXT-MASK-03에서 도입한 **헤드라인 clip 마스크 리빌**을 공개 퍼널 전역에서 제거하고, **평문 에디토리얼 헤딩**으로 되돌린다. 과한 연출 없이 차분·실행 중심 톤을 우선한다.

## CURRENT_IMPLEMENTED

- `TextMaskReveal` 컴포넌트 및 `src/components/public/text-mask/` 제거
- 랜딩·intro welcome·`BaselineResultStep1`·onboarding-prep·onboarding-complete에서 래퍼 제거, 카피·타이포 클래스 유지
- `docs/pr/PR-UI-TEXT-MASK-03.md` 삭제 (역사 기록은 본 문서로 대체)

## NOT_YET_IMPLEMENTED

- 대체 “눈에 띄는” 헤드라인 효과 없음

## 비범위

- 챕터 전환(02/02A), `src/lib/public/motion` 등 공용 모션 인프라
- `/app`, 비즈니스 로직, 라우트 의미

## 검증

- [ ] `TextMaskReveal` / `text-mask` import 0건
- [ ] `npm run build`
