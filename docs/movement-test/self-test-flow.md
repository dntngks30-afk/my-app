# 자가테스트 플로우 (Self-Test v3)

## 팝업 노출 조건

- 설문 6축 점수(`turtle`, `hedgehog`, `kangaroo`, `penguin`, `crab`, `meerkat`) 평균이 **35~49% (포함)** 일 때만 자가테스트 팝업 노출
- 평균이 범위를 벗어나면 팝업 없이 기존 흐름으로 결과 확정
- 축 점수 스케일이 0~1이면 내부에서 100 배율로 보정 후 평균 계산

## 팝업 분기

| 선택 | 동작 |
|------|------|
| **자가테스트 하기** | 설문 답변 저장 + `selfTest.isCompleted=false` 저장 후 `/movement-test/self-test` 이동 |
| **건너뛰기** | 설문 답변 저장 후 즉시 결과 확정. Top1 축 점수가 30% 이하이면 `monkey`, 아니면 Top1 축 동물로 확정 |

## 전역 안전장치

- 무료테스트 결과 확정 시점에 **Top1 축 점수 <= 30%** 이면 `monkey`로 확정
- 단, 자가테스트를 완료하여 최종 타입이 이미 정해진 경우에는 이 안전장치로 덮어쓰지 않음

## 자가테스트 문항 (3문항)

### self1: 벽천사 5회
- 가이드: 뒤통수-등-엉덩이를 벽에 가볍게 붙이고 허리가 과하게 뜨지 않게 유지한 채 팔 올리기/내리기 5회
- 질문: 가장 가까운 느낌은?
  - 목/어깨 긴장 + 턱 전방 -> `turtle`
  - 허리 과신전/허리 버팀 -> `kangaroo`
  - 다리 흔들림/무릎 내측 붕괴 -> `penguin`
  - 좌우 차이 뚜렷 -> `crab`
  - 해당사항 없음 -> `monkey`

### self2: 제자리 스쿼트 5회
- 가이드: 발 어깨너비, 발바닥 전체 지지로 앉았다 일어나기 5회
- 질문: 가장 가까운 현상은?
  - 발/무릎 내측 붕괴 -> `penguin`
  - 허리로 버팀 -> `kangaroo`
  - 상체 전방 쏠림/목 전방 -> `turtle`
  - 한쪽 체중 쏠림/한쪽 불편 -> `crab`
  - 해당사항 없음 -> `monkey`

### self3: 한발서기 좌/우 10초
- 가이드: 좌 10초 + 우 10초 후 더 불안정했던 쪽 기준으로 선택
- 질문: (한쪽이라도) 가장 가까운 현상은?
  - 목/어깨 올라감 + 숨 멈춤 -> `turtle`
  - 허리 꺾임/엉덩이 전방 -> `kangaroo`
  - 발 흔들림 + 무릎 내측 -> `penguin`
  - 좌우 차이 뚜렷 -> `crab`
  - 해당사항 없음 -> `monkey`

## 자가테스트 확정 로직

- 3문항에서 선택된 타입에 각 1점
- 최고점 타입을 최종 타입으로 확정
- 동점 우선순위: **한발서기(self3) > 스쿼트(self2) > 벽천사(self1)**
- 최종 타입 후보: `turtle | kangaroo | penguin | crab | monkey`

## 세션 저장 필드

`movementTestSession:v2`에 다음 필드를 사용:

```ts
selfTest?: {
  isCompleted: boolean;
  answersById: Record<'self1'|'self2'|'self3', 0|1|2|3|4> | Record<string, never>;
  finalType?: 'turtle' | 'kangaroo' | 'penguin' | 'crab' | 'monkey';
  completedAt?: string;
};
finalType?: 'turtle' | 'hedgehog' | 'kangaroo' | 'penguin' | 'crab' | 'meerkat' | 'armadillo' | 'sloth' | 'monkey';
```

## monkey 타입

- `monkey`는 축(axisScores) 타입이 아니라 **최종 결과 타입 전용**
- 이미지 매핑: `/animals/monkey.png`
