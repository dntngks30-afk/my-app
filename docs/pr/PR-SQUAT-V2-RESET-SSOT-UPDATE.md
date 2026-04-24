# PR-SQUAT-V2-RESET-SSOT-UPDATE (PR1 — SSOT)

> PR1: SSOT 전용. 런타임 코드·테스트·threshold·카메라 동작·auto-progression·page·pass-core/completion-state는 **수정하지 않는다**.

---

## 1. 요약

이 PR은 **문서**만 갱신한다. 기존 `SquatRepEngineV2` / `passed` / `passDetected` 중심의 “스쿼트 판정기” SSOT 틀을 **폐기**하고, **SquatMotionEvidenceEngineV2** 중심의 “**사용 가능한 하체 굴곡/신전 motion evidence 획득**” 틀으로 **부모 SSOT**를 맞췄다.

필수 법칙(부모 SSOT에 명시):

- **SquatMotionEvidenceEngineV2 is the only runtime owner for squat camera progression.**
- **Legacy squat logic may analyze quality, but must not decide progression.**

또한 다음이 SSOT에 **명시**되었다.

- `usableMotionEvidence`가 스쿼트 **progression**의 단일 불리언 의미(“정확한 스쿼트 성공”이 아님).  
- **Legacy**는 `LegacySquatQualityAnalyzer` 개념으로 **quality / debug / data / analytics**만.  
- **auto-progression, page, trace, debug, analytics**는 **owner가 아니라 consumer**.  
- **downstream**은 `usableMotionEvidence`를 true→false, false→true로 **뒤집을 수 없음**.

---

## 2. 변경한 산출물

| 항목 | 경로 | 내용 |
|------|------|------|
| 갱신 | `docs/pr/PR-SQUAT-ENGINE-V2-RESET-SSOT.md` | 전면 재기술(프레임·법·결정객체·레거시·마이그레이션 표·fixture·흐름) |
| 신규 | `docs/pr/PR-SQUAT-V2-RESET-SSOT-UPDATE.md` | 본 PR 보고서 |

---

## 3. PR report — 필수 답변

### Q1. 이번 PR이 **생성한 authority**는 무엇인가?

**문서 수준**에서, 카메라 스쿼트 **progression**에 대한 **단일 런타임 소유권**을 **`SquatMotionEvidenceEngineV2`**에 부여하고, 그 진행 불리언을 **`usableMotionEvidence`**(의미: usable lower-body flexion/extension motion evidence acquired)로 **고정**했다. **Legacy** 측은 **품질·디버그·데이터** 분석 권한만 허용하고 **progression 결정권**은 **부정**하는 규칙을 SSOT에 **명문화**했다.

(코드에 새 런타임 소유권이 **이미 생긴** 것이 아니다. **문서**가 앞으로의 구현·리뷰를 묶는 **권한 선언**을 한 것이다.)

### Q2. **runtime authority**를 **변경**했는가?

**아니요.** **코드를 수정하지 않았으므로** 실제 런타임에서 어떤 모듈이 owner인지 **바뀌지는 않는다**. 변경한 것은 **SSOT(문서) 상의** 권한·용어·금지 사항뿐이다.

### Q3. downstream layer가 V2 `usableMotionEvidence`를 **뒤집을 수 있는 여지**를 **문서상** 제거했는가?

**예.** SSOT에 다음이 **명확히** 들어 있다: downstream은 `usableMotionEvidence === true`를 false로 **바꿀 수 없고**, `false`를 true로 **바꿀 수 없다**. 소비(표시, 로그, 라우팅 **입력으로서의 읽기**)는 가능하나 **재작성(override)** 는 금지.

### Q4. **코드 파일**을 수정했는가? (수정했다면 실패)

**아니요.** `docs/pr/`의 **마크다운 문서**만 갱신·추가했으며, **런타임 코드·테스트·threshold·카메라·page 등은 손대지 않았다.**

---

## 4. 참고 문서

- `docs/pr/PR-SQUAT-ENGINE-V2-RESET-SSOT.md` (갱신본)
- `docs/pr/PR-SQUAT-MOTION-EVIDENCE-V2-DESIGN-ROOM-MEMORY.md` (설계 메모, PR1~7)

---

## 5. 리뷰어 체크 (PR1)

- [ ] SSOT §0에 **Authority statement** 두 문장이 그대로 있는가.  
- [ ] `SquatMotionEvidenceEngineV2` / `usableMotionEvidence` / `LegacySquatQualityAnalyzer` / **immutable downstream**이 빠짐없이 기술되었는가.  
- [ ] 이 PR에 **`.ts` / `.tsx` / test** diff가 **없는가**.
