# 움직임 타입 테스트 시스템 PRD (Product Requirements Document)

## 📋 프로젝트 개요

### 목적
사용자의 움직임 패턴을 분석하여 4가지 기본 타입(담직·날림·버팀·흘림)과 16가지 서브타입 중 하나로 분류하고, 맞춤형 교정운동 가이드를 제공하는 웹 기반 설문 시스템

### 핵심 가치
- 과학적 움직임 분석을 통한 개인 맞춤형 운동 가이드
- 직관적이고 사용자 친화적인 설문 경험
- 즉각적인 결과 제공 및 실행 가능한 조언

---

## 🎯 기능 요구사항

### 1. 설문 시스템

#### 1.1 4지선다 질문 (30문항)
- **목적**: 4가지 기본 움직임 타입 판별
- **구조**:
  - 각 질문은 4개의 선택지 제공
  - 각 선택지는 특정 타입에 점수 부여
  - 일부 질문은 서브타입 가중치 포함

**예시 질문 구조**:
```typescript
{
  id: 1,
  question: "계단을 오를 때 어떤 느낌이 드나요?",
  options: [
    { text: "무릎에 힘이 들어가며 안정적으로 오른다", type: "담직", score: 3 },
    { text: "가볍게 빠르게 오른다", type: "날림", score: 3 },
    { text: "천천히 힘을 주며 오른다", type: "버팀", score: 3 },
    { text: "자연스럽게 흐르듯 오른다", type: "흘림", score: 3 }
  ],
  subTypeWeight: true // 서브타입 구분용
}
```

#### 1.2 예/아니오 질문 (10문항)
- **목적**: 불균형 및 보상 패턴 진단
- **구조**:
  - 예/아니오 이진 선택
  - 특정 불균형 패턴 식별

**예시 질문**:
```typescript
{
  id: 31,
  question: "한쪽 어깨가 다른 쪽보다 높다고 느낀 적이 있나요?",
  type: "binary",
  imbalanceFlag: "shoulder_asymmetry"
}
```

### 2. 사용자 경험 (UX)

#### 2.1 진행률 표시
- 상단에 진행률 바 (0-100%)
- 현재 페이지 / 전체 페이지 표시
- 시각적 피드백 (색상, 애니메이션)

#### 2.2 페이지네이션
- 한 페이지당 5-6개 질문 표시
- "다음" 버튼은 모든 질문 답변 시 활성화
- "이전" 버튼으로 답변 수정 가능
- 부드러운 페이지 전환 애니메이션

#### 2.3 필수 답변 검증
- 미답변 질문 시각적 표시 (빨간 테두리, 경고 메시지)
- 스크롤 자동 이동 (첫 번째 미답변 질문으로)
- 명확한 오류 메시지

### 3. 점수 계산 로직

#### 3.1 기본 타입 계산
```typescript
// 4가지 타입별 총점 계산
const scores = {
  담직: 0,
  날림: 0,
  버팀: 0,
  흘림: 0
}

// 최고 점수 타입이 메인 타입
const mainType = Object.keys(scores).reduce((a, b) => 
  scores[a] > scores[b] ? a : b
);
```

#### 3.2 서브타입 계산
```typescript
// 서브타입 가중치 질문 분석
// 메인 타입 + 보조 타입 조합으로 16가지 서브타입 결정
const subType = calculateSubType(mainType, weightedAnswers);
```

#### 3.3 불균형 진단
```typescript
// 예/아니오 질문 결과로 불균형 패턴 식별
const imbalances = binaryAnswers
  .filter(a => a.answer === true)
  .map(a => a.imbalanceFlag);
```

### 4. 결과 페이지

#### 4.1 타입 결과 표시
- **메인 타입**: 큰 제목으로 강조
- **서브타입**: 부제목으로 표시
- **타입 설명**: 2-3 문단 상세 설명
- **특징**: 주요 움직임 특성 3-5가지

#### 4.2 교정운동 가이드
- **우선순위 운동**: 3-5가지 핵심 운동
- **피해야 할 운동**: 2-3가지 주의 운동
- **생활습관 조언**: 일상에서 실천 가능한 팁

#### 4.3 불균형 진단
- 감지된 불균형 패턴 리스트
- 각 불균형에 대한 간단한 설명
- 개선 방향 제시

#### 4.4 액션 버튼
- **PDF 다운로드**: 결과 리포트 저장
- **다시 테스트**: 설문 초기화
- **유료 상담 신청**: 프리미엄 서비스 연결

---

## 🛠 기술 요구사항

### 1. 기술 스택
- **프레임워크**: Next.js 14 (App Router)
- **언어**: TypeScript
- **스타일링**: Tailwind CSS
- **상태 관리**: React useState/useContext
- **폼 관리**: React Hook Form (선택적)

### 2. TypeScript 인터페이스

```typescript
// 질문 타입
interface Question {
  id: number;
  question: string;
  type: 'multiple' | 'binary';
  options?: Option[];
  category?: string;
  subTypeWeight?: boolean;
  imbalanceFlag?: string;
}

// 선택지 타입
interface Option {
  id: string;
  text: string;
  type: '담직' | '날림' | '버팀' | '흘림';
  score: number;
  subTypeModifier?: string;
}

// 답변 타입
interface Answer {
  questionId: number;
  selectedOption?: string;
  binaryAnswer?: boolean;
}

// 결과 타입
interface TestResult {
  mainType: '담직' | '날림' | '버팀' | '흘림';
  subType: string; // 16가지 중 하나
  scores: {
    담직: number;
    날림: number;
    버팀: number;
    흘림: number;
  };
  imbalances: string[];
  completedAt: Date;
}

// 타입 설명
interface TypeDescription {
  mainType: string;
  subType: string;
  title: string;
  description: string;
  characteristics: string[];
  recommendedExercises: Exercise[];
  avoidExercises: string[];
  lifestyleTips: string[];
}

// 운동 정보
interface Exercise {
  name: string;
  description: string;
  sets?: string;
  reps?: string;
  frequency?: string;
}
```

### 3. 컴포넌트 구조

```
/app
  /movement-test
    /page.tsx                 # 메인 진입점
    /components
      /QuestionPage.tsx       # 질문 페이지 컴포넌트
      /ProgressBar.tsx        # 진행률 표시
      /MultipleChoice.tsx     # 4지선다 질문
      /BinaryChoice.tsx       # 예/아니오 질문
      /ResultPage.tsx         # 결과 페이지
      /TypeCard.tsx           # 타입 설명 카드
      /ExerciseGuide.tsx      # 운동 가이드
      /ImbalanceReport.tsx    # 불균형 리포트
    /data
      /questions.ts           # 질문 데이터
      /typeDescriptions.ts    # 타입 설명 데이터
    /utils
      /calculateResult.ts     # 점수 계산 로직
      /validation.ts          # 입력 검증
```

### 4. 데이터 저장
- **로컬 상태**: React Context API 사용
- **세션 저장**: localStorage (진행 중 답변 임시 저장)
- **외부 전송 없음**: 모든 데이터는 클라이언트 측에서만 처리

### 5. 반응형 디자인
- **모바일 우선**: 320px 이상
- **태블릿**: 768px 이상
- **데스크톱**: 1024px 이상
- **터치 친화적**: 버튼 최소 44x44px

### 6. 접근성 (A11y)
- 키보드 네비게이션 지원
- ARIA 레이블 적용
- 색상 대비 WCAG AA 준수
- 스크린 리더 호환

---

## 📊 데이터 구조 예시

### 질문 데이터 샘플

```typescript
export const questions: Question[] = [
  // 4지선다 질문 (1-30)
  {
    id: 1,
    type: 'multiple',
    question: '평소 걸을 때 어떤 느낌인가요?',
    category: '보행',
    subTypeWeight: false,
    options: [
      { id: 'q1_a', text: '무게 중심이 낮고 안정적이다', type: '담직', score: 3 },
      { id: 'q1_b', text: '가볍고 빠르게 움직인다', type: '날림', score: 3 },
      { id: 'q1_c', text: '힘을 주며 단단하게 걷는다', type: '버팀', score: 3 },
      { id: 'q1_d', text: '자연스럽고 부드럽게 흐른다', type: '흘림', score: 3 }
    ]
  },
  // ... 29개 더
  
  // 예/아니오 질문 (31-40)
  {
    id: 31,
    type: 'binary',
    question: '한쪽 어깨가 다른 쪽보다 높나요?',
    imbalanceFlag: 'shoulder_asymmetry'
  },
  // ... 9개 더
];
```

### 16가지 서브타입 정의

```typescript
export const subTypes = [
  // 담직 계열 (4가지)
  '담직-안정형', '담직-균형형', '담직-지구력형', '담직-파워형',
  
  // 날림 계열 (4가지)
  '날림-민첩형', '날림-순발형', '날림-유연형', '날림-스피드형',
  
  // 버팀 계열 (4가지)
  '버팀-근력형', '버팀-지지형', '버팀-안정형', '버팀-파워형',
  
  // 흘림 계열 (4가지)
  '흘림-유연형', '흘림-조화형', '흘림-적응형', '흘림-균형형'
];
```

---

## 🎨 UI/UX 디자인 가이드

### 색상 팔레트
```typescript
const typeColors = {
  담직: '#3B82F6', // 파란색 - 안정감
  날림: '#F59E0B', // 주황색 - 역동성
  버팀: '#EF4444', // 빨간색 - 힘
  흘림: '#10B981', // 초록색 - 조화
};
```

### 레이아웃
- **헤더**: 로고 + 진행률
- **메인**: 질문 카드 (중앙 정렬, 최대 너비 800px)
- **푸터**: 네비게이션 버튼 (이전/다음)

### 애니메이션
- 페이지 전환: Fade + Slide (300ms)
- 버튼 호버: Scale(1.05) + Shadow
- 진행률 바: Smooth width transition

---

## ✅ 검증 및 오류 처리

### 입력 검증
1. **필수 답변 체크**
   ```typescript
   const isPageComplete = currentPageQuestions.every(q => 
     answers.find(a => a.questionId === q.id)
   );
   ```

2. **데이터 무결성**
   - 모든 질문 ID 유니크
   - 선택지 ID 유니크
   - 점수 범위 검증 (1-5)

### 오류 메시지
- "모든 질문에 답변해주세요"
- "답변을 선택해주세요"
- "결과 계산 중 오류가 발생했습니다"

### 예외 처리
```typescript
try {
  const result = calculateResult(answers);
  setTestResult(result);
} catch (error) {
  console.error('Result calculation failed:', error);
  setError('결과를 계산할 수 없습니다. 다시 시도해주세요.');
}
```

---

## 🚀 성능 최적화

### 1. 코드 분할
- 결과 페이지 lazy loading
- 타입 설명 데이터 동적 import

### 2. 메모이제이션
- 점수 계산 함수 useMemo
- 질문 필터링 useMemo

### 3. 이미지 최적화
- Next.js Image 컴포넌트 사용
- WebP 포맷 우선

---

## 📱 반응형 브레이크포인트

```typescript
const breakpoints = {
  mobile: '320px',
  tablet: '768px',
  desktop: '1024px',
  wide: '1280px'
};
```

### 모바일 (< 768px)
- 1열 레이아웃
- 큰 터치 타겟
- 간소화된 네비게이션

### 태블릿 (768px - 1024px)
- 2열 레이아웃 (결과 페이지)
- 중간 크기 카드

### 데스크톱 (> 1024px)
- 3열 레이아웃 (결과 페이지)
- 사이드바 네비게이션
- 풍부한 애니메이션

---

## 🔒 보안 및 개인정보

### 데이터 처리
- ✅ 모든 데이터는 클라이언트 측에서만 처리
- ✅ 서버 전송 없음
- ✅ localStorage 사용 시 암호화 고려
- ✅ 개인 식별 정보 수집 안 함

### 세션 관리
- 브라우저 닫으면 데이터 삭제 (선택적)
- "다시 테스트" 시 완전 초기화

---

## 📈 향후 확장 가능성

### Phase 2 기능
- [ ] 결과 공유 기능 (SNS)
- [ ] 결과 비교 (이전 테스트와)
- [ ] 상세 리포트 PDF 생성
- [ ] 운동 영상 링크 추가

### Phase 3 기능
- [ ] 사용자 계정 시스템
- [ ] 진행 상황 추적
- [ ] 전문가 상담 예약 연동
- [ ] 커뮤니티 기능

---

## 📋 성공 지표 (KPI)

1. **완료율**: 시작 대비 완료 비율 > 70%
2. **소요 시간**: 평균 완료 시간 < 10분
3. **재방문율**: 결과 페이지 재방문 > 30%
4. **전환율**: 결과 → 유료 상담 신청 > 5%

---

## 🐛 알려진 제약사항

1. 브라우저 호환성: IE 11 미지원
2. 오프라인 모드: 미지원
3. 다국어: 한국어만 지원
4. 인쇄 최적화: 미구현

---

## 📞 지원 및 문의

- 기술 문의: [이메일]
- 버그 리포트: [GitHub Issues]
- 기능 제안: [피드백 폼]

---

**문서 버전**: 1.0  
**최종 수정일**: 2026-01-29  
**작성자**: AI Assistant  
**승인자**: [프로젝트 매니저]
