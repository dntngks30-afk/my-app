# PR2: V2 스코어링 구현 명세

## 개요(무엇이 바뀌는가)

- V2 폴더 내부(`src/features/movement-test/v2/`)만 변경
- 6축 동물 모델 + tension/asym + 복합 타입(아르마딜로/나무늘보) 스코어링
- 18문항 설문 → `calculateScoresV2` → `ScoreResultV2` 반환
- UI 파일(`src/app/movement-test/result/page.tsx`) 수정 금지. V1 라우트/기능 유지.

---

## 축/복합 타입 정의

| 구분 | 타입 | 설명 |
|------|------|------|
| **축(Axis)** | `turtle`, `hedgehog`, `kangaroo`, `penguin`, `crab`, `meerkat` | 6축 동물 (AnimalAxis) |
| **복합(Composite)** | `armadillo`, `sloth` | `CompositeTag` |

※ sloth는 축에서 제거되어 복합(sloth형)으로 이동. meerkat이 6축으로 추가됨.

---

## 타입 변경 내용 (PR2-1)

### AnimalAxis (6축)
- `'turtle'` \| `'hedgehog'` \| `'kangaroo'` \| `'penguin'` \| `'crab'` \| `'meerkat'`
- **제거:** `sloth`
- **추가:** `meerkat`

### CompositeTag (복합/혼합)
- `'armadillo'` \| `'sloth'` \| `null`
- **변경:** `meerkat` → `sloth` (나무늘보=복합 타입)

### sloth 축→복합 이동
- sloth(나무늘보)는 단일 축보다 2축 이상 혼합 패턴으로 해석되므로 복합 타입으로 이동. meerkat(미어캣)이 6축 중 하나로 추가됨.

---

## 설문 문항(18개 전체) — PR2-2 반영

### 응답 스케일 (0~4)
| 값 | 라벨 |
|----|------|
| 0 | 전혀 아니다 |
| 1 | 거의 아니다 |
| 2 | 보통 |
| 3 | 자주 |
| 4 | 거의 항상 |

- `ANSWER_CHOICES_V2` 상수로 export (questions.v2.ts)
- `QuestionV2`: `id`, `text`, `weights`

### q1/q2/q3 역할 (가중치·트리거 캡)
| 역할 | slot | 가중치 | 비고 |
|------|------|--------|------|
| q1 | 1 | 1.4 | 핵심 체감, **트리거 캡 기준** (q1 응답 ≤2면 base≤75) |
| q2 | 2 | 1.2 | 불편/피로 |
| q3 | 3 | 1.0 | 습관/관찰 |

- id 규칙: `v2_{영역}{slot}` (예: v2_A1 = A영역 q1)

### 18문항 (영역별 q1~q3)
- **A (거북이/turtle)**: 상부 전방화  
  A1: 스마트폰/노트북 오래 보면 목 앞으로… / A2: 하루 끝날 때 뒷목 뻐근… / A3: 거울/사진에서 고개 앞으로…
- **B (고슴도치/hedgehog)**: 가슴 닫힘·등 굽음  
  B1: 어깨 안쪽 말림… / B2: 팔 올릴 때 가슴/겨드랑이 뻐근… / B3: 상체 펴면 허리만 꺾임…
- **C (캥거루/kangaroo)**: 허리 과부하  
  C1: 서 있으면 허리 꺾이고 아랫배 전방… / C2: 오래 서거나 걷고 나면 허리 아래 피로… / C3: 스쿼트/런지에서 허리·앞허벅지에 힘…
- **D (펭귄/penguin)**: 무릎·발목 불안정  
  D1: 스쿼트/계단에서 무릎 안쪽… / D2: 밑창 안쪽 닳음… / D3: 무릎/발목 불안정…
- **F (게/crab)**: 편측 의존·비대칭 (나무늘보 조건: baseF≥55, baseG≤55)  
  F1: 한쪽 다리에 체중… / F2: 통증/뻐근함 한쪽… / F3: 생활습관 한쪽 치우침…
- **G (미어캣/meerkat)**: 전신 긴장 (아르마딜로 조건: baseG≥60)  
  G1: 쉬어도 몸 안 풀림… / G2: 스트레스 시 턱·목·어깨 힘… / G3: 잠들기 전 어깨/턱/목 힘…

※ **PR2-2는 문항/보기만 반영. 스코어링 구현은 PR2-3에서 진행.**

---

## 스코어링 공식 (PR2-3)

### 가중치 및 상수
| 항목 | 값 |
|------|-----|
| w1 (q1) | 1.4 |
| w2 (q2) | 1.2 |
| w3 (q3) | 1.0 |
| maxRaw | 14.4 |

### Base 점수 (영역별)
- `rawX = qX1 * 1.4 + qX2 * 1.2 + qX3 * 1.0`
- `baseX = (rawX / 14.4) * 100`
- unknown(미응답)은 계산 시 **2로 치환**
- 보정(Aid)은 순위/타입 결정에 영향 없음

### 트리거 캡
- `if qX1 <= 2` → `baseX = min(baseX, 75)`

### 정렬·요약
| 항목 | 설명 |
|------|------|
| top1/top2/top3 | axisScores 기준 내림차순 정렬 (축·점수) |
| avg | 6축 평균 → `avg6` (0~100) |
| std | **모집단 표준편차** 고정: `sqrt( mean( (xi-avg)^2 ) )` |
| triggerCountTop3 | top1Domain, top2Domain, top3Domain 각각의 q1이 ≥3인 개수 합 |

---

## 의사결정 트리 (PR2-3, 반드시 이 순서)

```
STEP 4-1 원숭이형(균형형) / MONKEY
  if 6축 모두 50% (eps 내) OR top1 < 55 → resultType="MONKEY"
  (이하 MONKEY가 아닐 때만 진행)

STEP 4-2 아르마딜로
  if top1>=72 AND top2>=72 AND top3>=72
     AND (top1-top3)<=10
     AND baseG(meerkat)>=60
     AND triggerCountTop3>=2
  → resultType="COMPOSITE_ARMADILLO", compositeTag="armadillo"

STEP 4-3 나무늘보
  if top1<68 AND 52<=avg<=62 AND std<10
     AND baseF(crab)>=55 AND baseG(meerkat)<=55
  → resultType="COMPOSITE_SLOTH", compositeTag="sloth"

STEP 4-4 기본형
  else → resultType="BASIC", mainAnimal=top1 axis
```

### 보조 경향 (subTendency)
- **BASIC만**: `(top1-top2) < 10` → subTendency = top2 axis, else null
- **MONKEY**: subTendency에 top2 포함 (가능하면)

---

## PR1 스켈레톤 계약(V2 export → 향후 UI 사용처)

### V2 export (변경 시 기존 계약 유지 필요)

| 파일 | Export | 용도 |
|------|--------|------|
| `scoring/types.ts` | `AnimalAxis`, `CompositeTag`, `TestAnswerValue`, `QuestionV2`, `ScoreResultV2`, `ResultTypeV2`, `ANIMAL_AXES` | 타입 정의 (PR2-1: ANIMAL_AXES / PR2-3: ResultTypeV2) |
| `data/questions.v2.ts` | `QUESTIONS_V2: QuestionV2[]` | 18문항 (현재 `[]`) |
| `scoring/scoring.v2.ts` | `calculateScoresV2(answers): ScoreResultV2` | 스코어 계산 |
| `scoring/composite.rules.ts` | `getCompositeTagV2(input): CompositeTag` | armadillo/sloth 판별 |
| `copy/results.v2.ts` | `RESULTS_COPY_V2` | 결과 카피 (현재 `{}`) |
| `copy/titles.v2.ts` | `TITLES_V2` | 타이틀 (index.ts에서 미export) |
| `copy/descriptions.v2.ts` | `DESCRIPTIONS_V2` | 설명 (index.ts에서 미export) |

### ScoreResultV2 구조(UI 기대 계약)

```ts
{
  axisScores: Record<AnimalAxis, number>;  // 0~100
  tension: number;   // 0~100
  asym: number;      // 0~100
  avg6: number;      // 0~100
  baseType: AnimalAxis;
  secondaryType: AnimalAxis | null;
  compositeTag: CompositeTag;  // 'armadillo' | 'sloth' | null
  // optional (PR2-3 추가)
  resultType?: ResultTypeV2;   // MONKEY | COMPOSITE_ARMADILLO | COMPOSITE_SLOTH | BASIC
  mainAnimal?: AnimalAxis;     // BASIC 시 top1 축
  subTendency?: AnimalAxis | null;
  top3Axes?: [AnimalAxis, AnimalAxis, AnimalAxis];  // 근거 문항 TOP3
}
```

### V1 UI(result/page.tsx) 참조 메모 (수정 금지)

- V1 전용: `TITLES`, `DESCRIPTIONS`, `ALL_QUESTIONS`, `calculateTestResult`, `adjustConfidenceWithImbalance`, `getSubTypeContent`, `getConfidenceCopy`, `createResultStory`
- story 필드: `section1_typeDeclare`, `section2_typeExplain`, `section3_confidence`, `section4_imbalance`, `section5_nextAction`
- subTypeContent 필드: `subTypeName`, `headline`, `summary`, `signs`, `quickWin`
- adjustedResult 필드: `mainType`, `subType`, `confidence`, `imbalanceSeverity`, `biasMainType`
- V2 UI는 별도 페이지/컴포넌트에서 `ScoreResultV2` 기반으로 구현 예정.

---

## 파일 변경 요약

| 경로 | 변경 내용 |
|------|-----------|
| `v2/scoring/types.ts` | PR2-1: AnimalAxis(sloth→meerkat), CompositeTag(meerkat→sloth), ANIMAL_AXES export / PR2-3: ResultTypeV2, ScoreResultV2 optional 필드 추가 |
| `v2/scoring/scoring.v2.ts` | PR2-1: ANIMAL_AXES를 types에서 import (types 변경 필수 의존성) |
| `v2/data/questions.v2.ts` | PR2-2: 18문항 정의, ANSWER_CHOICES_V2 export |
| `v2/scoring/scoring.v2.ts` | `calculateScoresV2` 구현 |
| `v2/scoring/composite.rules.ts` | `getCompositeTagV2` 구현 |
| `v2/copy/results.v2.ts` | 결과 카피 정의 |
| `v2/copy/titles.v2.ts` | (필요 시) 타이틀 정의 |
| `v2/copy/descriptions.v2.ts` | (필요 시) 설명 정의 |

---

## PR2-3 구현 메모

- **scoring.v2.ts**: MONKEY 판단(6축 모두 50 OR top1<55) 최우선 → composite.rules 호출은 MONKEY가 아닐 때만
- **composite.rules.ts**: armadillo/sloth/null 판정만 담당, CompositeTagInput에 top1/top2/top3, avg, std, triggerCountTop3 등 전달
- **std**: 모집단 표준편차 `sqrt(mean((xi-avg)^2))` 고정

---

## 검증 로그

```
# PR2-0 (문서만 생성 후)
$ pnpm run lint  # (결과)
$ pnpm run build # (결과)
$ git status     # docs/movement-test/PR2_v2_scoring.md 1개만 변경 확인

# PR2-1 (타입 변경)
$ pnpm run lint  # (결과)
$ pnpm run build # (결과)
# 변경: types.ts, docs, scoring.v2.ts(ANIMAL_AXES import - types 변경 필수 의존성)

# PR2-2 (문항 데이터)
$ pnpm run lint  # (결과)
$ pnpm run build # (결과)
# 변경: questions.v2.ts, docs
# 질문 개수: 18개, 축별 3문항 (A,B,C,D,F,G × 3)
# 보기: ANSWER_CHOICES_V2 export (QuestionV2 스키마에 options 없음)

# PR2-3 (스코어링 구현)
$ pnpm run lint  # 통과
$ pnpm run build # 통과
# 변경: scoring.v2.ts, composite.rules.ts, types.ts, docs
# 스코어링 공식·의사결정 트리 코드와 1:1 매칭
# std: 모집단 표준편차 sqrt(mean((xi-avg)^2)) 고정
```
