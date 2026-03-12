# Deep Test / Deep Result Validation Pack

도그푸딩·QA·내부 검토용 검증 기준. scoring 수정 없이 결과 품질과 일치감을 점검한다.

---

## 1. Validation 축 요약

| 축 | 무엇을 본다 | 자동화 | 수동 |
|----|-------------|--------|------|
| 결과 납득도 | primary_type·priority_vector가 입력과 맞는지 | ✓ persona check | 납득도 리뷰 |
| 결과-세션 일치감 | result narrative ↔ 첫 세션 방향 충돌 여부 | ✓ alignment check | - |
| pain_mode 과민/과소 | caution/protected가 적절한지 | ✓ fixture | 문서 체크리스트 |
| 설명 품질 | 과장·진단·모순·일반론 반복 여부 | ✓ quality check | - |

---

## 2. 결과 납득도 (Result Credibility)

### 무엇을 본다
- 사용자 답변(14문항) → primary_type, priority_vector, pain_mode가 논리적으로 연결되는지
- "이 답변이면 이 결과가 나오는 게 말이 되는가"

### 왜 중요한지
- 사용자가 "내가 한 답이 반영됐다"고 느끼지 않으면 이탈·불신 증가
- 랜덤처럼 보이면 제품 신뢰도 하락

### 합격 케이스
- 한발서기 흔들림 큼 + 스쿼트 무릎 흔들림 → LOWER_INSTABILITY, lower_stability 우선
- 벽천사 팔 못 올림 + 손목·팔꿈치 불편 → UPPER_IMMOBILITY, upper_mobility 우선
- 강한 통증(7~10) → pain_mode protected
- 모든 동작 양호 + 해당 없음 → STABLE, pain_mode none

### 실패 케이스
- 명확한 하체 흔들림인데 UPPER_IMMOBILITY로 나옴
- 통증 없는데 pain_mode protected
- STABLE인데 priority_vector에 큰 값이 여러 개

### 검증 방법
- `npm run test:deep-v3-persona` — persona fixture 기대값 검증

---

## 3. 결과-세션 일치감 (Result–Session Alignment)

### 무엇을 본다
- deep result narrative / first-session bridge / session generation 원칙 간 일치성
- 결과에서 말한 방향과 첫 세션 구성이 크게 어긋나지 않는지

### 왜 중요한지
- "하체 안정 우선"이라고 했는데 세션이 상체 가동성 위주면 사용자 혼란
- "통증 없는 범위 우선"인데 세션이 과격해 보이면 신뢰 하락

### 합격 케이스
- priority_vector lower_stability → first-session chips에 "하체 안정성", principles에 "하체 안정과 무릎 정렬 중심"
- pain_mode caution → conservativeNote "초반 강도는 보수적으로 설정됩니다", principles에 "통증 없는 범위에서..."
- trunk_control 우선 → avoid_tags에 lower_back_pain, focus_tags에 core_control

### 실패 케이스
- 결과: "통증 없는 범위 우선" / 세션: 과격한 강도·깊은 범위 위주
- 결과: "하체 안정 우선" / 세션: 상체 가동성만 강조
- pain_mode protected인데 first-session에 "보수적" 문구 없음

### 검증 방법
- `npm run test:deep-validation-pack` — explanation + first-session bridge 일치 검증

---

## 4. pain_mode 과민/과소 (Pain Mode Sensitivity)

### 무엇을 본다
- pain_mode가 너무 쉽게 caution/protected로 가는지(과민)
- 실제 통증/제약 신호가 있는데 none으로 빠지는지(과소)

### 왜 중요한지
- 과민: 저위험 사용자에게 과도한 보호 문구 → 이탈·피로
- 과소: 통증 있는 사용자에게 무리한 강도 권장 → 위험·불신

### known-safe (현재 규칙 하에서 적절)
- maxInt >= 3 → protected
- maxInt >= 2 → caution
- maxInt === 1 && primary_discomfort "해당 없음" → none (PR-ALG-13A)
- maxInt === 0 → none

### watch (과민 가능성)
- maxInt === 1, primary_discomfort 있음 → caution. 과민 가능
- stable-low-pain (maxInt=1, 해당 없음) → none. 적절

### watch (과소 가능성)
- 중간 통증(4~6) 여러 부위 → caution 이상 기대. none이면 과소
- 강한 통증(7~10) → protected 기대. caution이면 과소

### 검증 케이스 (fixture)
| id | 기대 | 통증 입력 | 판정 |
|----|------|-----------|------|
| stable-low-pain | none | 약간(0~3) 1곳, 해당 없음 | known-safe |
| pain-mode-caution | caution | 약간(0~3) 1곳, 목·어깨 | known-safe |
| pain-mode-protected | protected | 강함(7~10) | known-safe |
| lower-instability-severe | caution | 약간(0~3) + 무릎 흔들림 | known-safe |

### 검증 방법
- `npm run test:deep-validation-pack` — pain_mode 케이스 검증
- `npm run test:deep-v3-shadow-report` — shadow compare로 pain_mode 방향 분석

---

## 5. 설명 품질 (Explanation Quality)

### 무엇을 본다
- buildDeepResultReasonBridge, buildFirstSessionBridge, getV3PrescriptionNarrative 출력
- 근거 없는 과장, 진단처럼 보이는 문구, priority_vector/pain_mode와 모순, 첫 세션·결과 충돌, 추상적 일반론만 반복

### 품질 기준
- [ ] 근거 없는 과장 금지 (예: "당신은 심각한 하체 불안정")
- [ ] 진단처럼 보이는 문구 금지 (예: "증후군", "질환")
- [ ] priority_vector / pain_mode와 모순 금지
- [ ] 첫 세션 방향과 충돌 금지
- [ ] 너무 추상적인 일반론만 반복하지 않기

### 합격 케이스
- "하체가 무너지지 않게 버티는 안정성 신호가 우선순위로 잡혔어요." (lower_stability)
- "통증 응답이 있어 초반 강도와 범위는 보수적으로 잡아요." (pain_mode caution)
- chips: [하체 안정성, 좌우 균형] — priority_vector top axes와 일치

### 실패 케이스
- priority_vector에 lower_stability만 있는데 "상체 가동성이 먼저 필요합니다"
- pain_mode caution인데 conservativeNote 없음
- "당신은 ~증후군입니다" 같은 진단 문구

### 검증 방법
- `npm run test:deep-validation-pack` — explanation 품질 검증

---

## 6. Persona Validation Checklist

대표 persona별 한 줄 요약. `npm run test:deep-v3-persona` 통과 시 ✓.

| id | label | expected summary |
|----|-------|------------------|
| lower-instability-basic | 하체 불안정 기본형 | LOWER_INSTABILITY, pain none, lower_stability |
| lower-mobility-ankle | 하체 가동성 제한형 | LOWER_MOBILITY_RESTRICTION, lower_mobility |
| upper-immobility-basic | 상체 가동성 제한형 | UPPER_IMMOBILITY, upper_mobility, caution |
| trunk-control-protected | 몸통제어 보호형 | CORE_CONTROL_DEFICIT, trunk_control, caution |
| deconditioned-basic | 탈조건 기본형 | DECONDITIONED, deconditioned |
| stable-basic | 안정형 기본 | STABLE, pain none |
| pain-mode-protected | 통증 보호형 | DECONDITIONED, protected |
| pain-mode-caution | 통증 주의형 | CORE_CONTROL_DEFICIT, caution |
| asymmetry-strong | 비대칭 강한형 | CORE_CONTROL_DEFICIT, trunk_control, asymmetry |
| stable-low-pain | 안정형 경미통증 | STABLE, pain none (PR-ALG-13A) |

---

## 7. 실행 방법

### 자동화된 검증

```bash
# 1. Persona 검증 (primary_type, pain_mode, priority_vector)
npm run test:deep-v3-persona

# 2. Golden fixture 검증 (deep_v2/v3 호환)
npm run test:deep-golden
npm run test:deep-v3-smoke

# 3. Validation pack (persona + explanation + alignment + pain_mode)
npm run test:deep-validation-pack

# 4. Shadow compare (pain_mode 활성 vs 레거시)
npm run test:deep-v3-shadow-report

# 5. Result bridge smoke
npx tsx scripts/deep-result-bridge-smoke.mjs
```

### 수동 검토

| 항목 | 방법 |
|------|------|
| 결과 납득도 | persona 결과를 실제로 읽어보고 "말이 되는가" 판단 |
| 결과-세션 일치감 | result 페이지 → 첫 세션 rationale 비교 |
| pain_mode 과민/과소 | shadow report + low-risk 케이스 수동 확인 |
| 설명 품질 | result 페이지 narrative·reason bridge·first session 문구 리뷰 |

---

## 8. 한계

- session generator와의 실제 일치성은 session-scenario-check (Supabase 필요)에서 검증
- 사용자 납득도는 A/B 테스트·피드백 수집으로만 검증 가능
- pain_mode threshold는 문서·fixture 기준만 제공, 실제 운영 변경은 별도 PR
