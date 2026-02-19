# PR3: V2 플로우 및 라우팅

## 요약

- 랜딩(`/`) Hero + 카드 4개 유지, 설문 바로 노출 제거
- **"테스트 시작"** 버튼 → `/movement-test/survey` 직행 (precheck 스킵)
- 플로우: `/` → survey → result

---

## UI 계약(Design Contract - LandingPage 1:1 재사용)

- 모든 신규 페이지는 LandingPage와 동일한 래퍼/컨테이너를 사용:
  <div className="min-h-screen bg-[var(--bg)]">
  <section className="py-16 md:py-24"> (Hero)
  <div className="container mx-auto px-4">
  <div className="max-w-4xl mx-auto ...">
- 카드 스타일은 LandingPage 카드 4개와 동일 토큰 사용:
  rounded-[var(--radius)]
  bg-[var(--surface)]
  border border-[color:var(--border)]
  shadow-[var(--shadow-0)]
- 텍스트 컬러는 var(--text)/var(--muted)만 사용
- 임의 hex 컬러 추가 금지(hover 포함)
- 버튼/입력도 동일 토큰 기반으로만 스타일링(rounded-[var(--radius)] 권장)

---

## 라우팅

```
/ → /movement-test/survey → /movement-test/result
```
(precheck 스킵, precheck 라우트는 유지·재활용 가능)

| 경로 | 용도 |
|------|------|
| `/` | 랜딩 (바로 precheck로 진입 가능) |
| `/movement-test/precheck` | 사전 체크 (신규) |
| `/movement-test/survey` | 설문 18문항 (신규) |
| `/movement-test/result` | V2 결과 (기존 페이지 V2로 교체) |

---

## 저장 키 및 세션

| 항목 | 값 |
|------|-----|
| localStorage 키 | `movementTestSession:v2` |

### 세션 스키마

```ts
{
  version: 'v2';
  isCompleted: boolean;
  startedAt: string;      // ISO 8601
  completedAt?: string;    // ISO 8601 (optional)
  profile: Record<string, unknown>;  // 프로필 필드
  answersById: Record<string, 0 | 1 | 2 | 3 | 4>;
}
```

---

## PR3 정책

- **v1(40문항/4타입) 스코어링**: 더 이상 사용하지 않음
- **`/movement-test/result`**: V2 결과 페이지로 교체
- **PR2(v2 scoring/questions/copy)**: 이번 PR3에서 **수정 금지**(사용만)

---

## 허용 변경 (PR3 전체)

| 파일 | 내용 |
|------|------|
| `src/app/page.tsx` | (루트 랜딩) |
| `src/app/movement-test/precheck/page.tsx` | 신규 |
| `src/app/movement-test/survey/page.tsx` | 신규 |
| `src/app/movement-test/result/page.tsx` | V2 결과로 교체 |
| `docs/movement-test/PR3_v2_flow.md` | 신규 (본 문서) |

---

## 금지

- `src/features/movement-test/v2/**` 전부 수정 금지
- 기존 v1 scoring/questions/utils 수정 금지 (사용 안 함만)

---

## PR3-1 (랜딩 진입 플로우)

| 변경 | 내용 |
|------|------|
| 랜딩 Hero/카드 4개 | 유지 |
| SurveyForm | 제거 (설문 바로 노출 안 함) |
| "테스트 시작" 버튼 | 추가, 클릭 시 `/movement-test/precheck` 이동 |

---

## Precheck 4동작: 방법/체크포인트(왜 문구 제거)

- **구성**: 각 항목은 (A) 따라하기(3줄 이내) + (B) 체크 포인트(2~3개)만 포함. '왜' 설명 문장 제거.
- **레이아웃**: 2열 그리드(모바일 1열)로 구성해 직관성을 높임. `grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6`
- **4가지 자가 체크**: (1) 벽 정렬 체크 10초 (2) 벽 천사 5회 (3) 한발서기 좌/우 10초 (4) 30초 호흡/긴장 체크
- **카드 하단 문구**: "방금 느낀 감각을 기억한 채로 다음 설문을 진행해요."

---

## PR3-2 PATCH (precheck 압축 + 모달)

- precheck 메인 = 프로필 입력으로 전환 (페이지 길이 단축)
- 4동작 가이드는 모달로 이동 (버튼 클릭 시 팝업)
- 디스클레이머 상단 고정 노출 ("본 테스트는 의학적 진단이 아닌...")
- 모바일 퍼스트 반응형 적용 (grid-cols-1 md:grid-cols-2)
- 기능 로직 변경 없음 (KEY, profile, handleNext 동일)

### PR3-2 PATCH (Header + Disclaimer + CTA)

- precheck 상단에 "무료 움직임 테스트" 헤더 고정 (LandingPage 톤)
- 디스클레이머는 카드 제거, 작은 안내 텍스트로 처리
- 1분 자가 테스트 방법은 CTA 버튼(brand 스타일)으로 배치 (모달 오픈)

---

## PR3-3 (Survey 위저드)

| 항목 | 내용 |
|------|------|
| 진입 | precheck "다음" 후 /movement-test/survey |
| 구조 | QUESTIONS_V2 18문항 → 축별 6그룹, 화면당 동일 축 3문항 |
| 축 순서 | turtle → hedgehog → kangaroo → penguin → crab → meerkat |
| 정렬 | 축 내부 q1→q2→q3 (id 파싱으로 slot 정렬) |
| 응답 | 0~4 라디오 (전혀 아니다 / 거의 아니다 / 보통 / 자주 / 거의 항상) |
| 다음 버튼 | 3문항 모두 응답 시 활성화 |
| 저장 | KEY=movementTestSession:v2, answersById 갱신, 선택/다음 시마다 즉시 저장 |
| 완료 | isCompleted=true, completedAt=ISO 저장 후 /movement-test/result 이동 |

---

## PR3-4 (Result v2 교체)

| 항목 | 내용 |
|------|------|
| 세션 소스 | `movementTestSession:v2`만 읽음 (v1/레거시 제거) |
| 없음/미완료 | LandingPage 톤 안내 카드 + "테스트 하러 가기" → / |
| 스코어링 | calculateScoresV2 (answersById) |
| 출력 | 결과 타이틀, mainAnimal/resultType, subTendency(있으면), 6축 점수(바), 다시 테스트 버튼 |
