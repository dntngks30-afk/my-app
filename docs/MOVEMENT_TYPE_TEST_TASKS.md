# 움직임 타입 테스트 - 작업 목록 (Task List)

## 📊 프로젝트 개요
- **프로젝트명**: 움직임 타입 테스트 시스템
- **예상 기간**: 2-3주
- **우선순위**: High
- **담당자**: 개발팀

---

## 🎯 Phase 1: 기초 설정 및 데이터 구조 (1-2일)

### ✅ Task 1.1: 프로젝트 구조 설정
- [ ] `/app/movement-test` 디렉토리 생성
- [ ] 필요한 하위 폴더 생성 (components, data, utils)
- [ ] TypeScript 인터페이스 파일 생성
- [ ] 기본 라우팅 설정

**파일 생성**:
```
/app/movement-test/
  ├── page.tsx
  ├── layout.tsx
  ├── /components/
  ├── /data/
  └── /utils/
```

**예상 시간**: 1시간

---

### ✅ Task 1.2: TypeScript 인터페이스 정의
- [ ] `types/movement-test.ts` 파일 생성
- [ ] Question, Option, Answer 인터페이스 정의
- [ ] TestResult, TypeDescription 인터페이스 정의
- [ ] 타입 가드 함수 작성

**파일**: `src/types/movement-test.ts`

```typescript
// 모든 인터페이스 정의
export interface Question { ... }
export interface Option { ... }
export interface Answer { ... }
export interface TestResult { ... }
export interface TypeDescription { ... }
```

**예상 시간**: 2시간

---

### ✅ Task 1.3: 질문 데이터 작성
- [ ] 4지선다 질문 30개 작성
- [ ] 예/아니오 질문 10개 작성
- [ ] 각 선택지에 타입 및 점수 할당
- [ ] 서브타입 가중치 질문 표시

**파일**: `src/app/movement-test/data/questions.ts`

**질문 카테고리**:
- 보행 패턴 (5문항)
- 자세 습관 (5문항)
- 운동 선호도 (5문항)
- 일상 동작 (5문항)
- 통증/불편감 (5문항)
- 근력/유연성 (5문항)

**예상 시간**: 4시간

---

### ✅ Task 1.4: 타입 설명 데이터 작성
- [ ] 16가지 서브타입 설명 작성
- [ ] 각 타입별 특징 정리
- [ ] 추천 운동 리스트 작성
- [ ] 피해야 할 운동 리스트 작성
- [ ] 생활습관 조언 작성

**파일**: `src/app/movement-test/data/type-descriptions.ts`

**각 타입별 포함 내용**:
- 타입명 및 부제
- 상세 설명 (200-300자)
- 주요 특징 5가지
- 추천 운동 5가지
- 피해야 할 운동 3가지
- 생활습관 팁 3가지

**예상 시간**: 6시간

---

## 🎨 Phase 2: UI 컴포넌트 개발 (3-4일)

### ✅ Task 2.1: 진행률 표시 컴포넌트
- [ ] ProgressBar 컴포넌트 생성
- [ ] 진행률 계산 로직
- [ ] 애니메이션 효과 추가
- [ ] 반응형 디자인 적용

**파일**: `src/app/movement-test/components/ProgressBar.tsx`

**기능**:
- 현재 진행률 % 표시
- 현재 페이지 / 전체 페이지 표시
- 부드러운 transition 애니메이션
- 타입별 색상 적용 (결과 페이지)

**예상 시간**: 2시간

---

### ✅ Task 2.2: 4지선다 질문 컴포넌트
- [ ] MultipleChoice 컴포넌트 생성
- [ ] 선택지 버튼 디자인
- [ ] 선택 상태 관리
- [ ] 호버/포커스 효과
- [ ] 접근성 속성 추가

**파일**: `src/app/movement-test/components/MultipleChoice.tsx`

**기능**:
- 4개 선택지 라디오 버튼
- 선택 시 시각적 피드백
- 키보드 네비게이션 지원
- 모바일 터치 최적화

**예상 시간**: 3시간

---

### ✅ Task 2.3: 예/아니오 질문 컴포넌트
- [ ] BinaryChoice 컴포넌트 생성
- [ ] 토글 스위치 또는 버튼 디자인
- [ ] 선택 상태 관리
- [ ] 애니메이션 효과

**파일**: `src/app/movement-test/components/BinaryChoice.tsx`

**기능**:
- 예/아니오 토글 버튼
- 명확한 시각적 구분
- 터치 친화적 크기

**예상 시간**: 2시간

---

### ✅ Task 2.4: 질문 페이지 컴포넌트
- [ ] QuestionPage 컴포넌트 생성
- [ ] 페이지네이션 로직
- [ ] 답변 검증 로직
- [ ] 이전/다음 버튼
- [ ] 페이지 전환 애니메이션

**파일**: `src/app/movement-test/components/QuestionPage.tsx`

**기능**:
- 한 페이지에 5-6개 질문 표시
- 모든 질문 답변 시 "다음" 버튼 활성화
- 미답변 질문 강조 표시
- 부드러운 페이지 전환

**예상 시간**: 4시간

---

### ✅ Task 2.5: 결과 페이지 메인 컴포넌트
- [ ] ResultPage 컴포넌트 생성
- [ ] 타입 결과 표시 섹션
- [ ] 애니메이션 효과 (결과 등장)
- [ ] 반응형 레이아웃

**파일**: `src/app/movement-test/components/ResultPage.tsx`

**기능**:
- 메인 타입 대형 표시
- 서브타입 부제목
- 점수 시각화 (차트 또는 바)
- 스크롤 애니메이션

**예상 시간**: 3시간

---

### ✅ Task 2.6: 타입 설명 카드 컴포넌트
- [ ] TypeCard 컴포넌트 생성
- [ ] 타입별 색상 테마 적용
- [ ] 특징 리스트 표시
- [ ] 아이콘 추가

**파일**: `src/app/movement-test/components/TypeCard.tsx`

**기능**:
- 타입 설명 카드
- 주요 특징 아이콘 + 텍스트
- 호버 효과
- 반응형 그리드

**예상 시간**: 2시간

---

### ✅ Task 2.7: 운동 가이드 컴포넌트
- [ ] ExerciseGuide 컴포넌트 생성
- [ ] 추천 운동 리스트
- [ ] 피해야 할 운동 리스트
- [ ] 아코디언 또는 탭 UI

**파일**: `src/app/movement-test/components/ExerciseGuide.tsx`

**기능**:
- 운동 카드 리스트
- 운동 설명 펼치기/접기
- 우선순위 표시
- 인쇄 친화적 레이아웃

**예상 시간**: 3시간

---

### ✅ Task 2.8: 불균형 리포트 컴포넌트
- [ ] ImbalanceReport 컴포넌트 생성
- [ ] 감지된 불균형 표시
- [ ] 경고 아이콘 및 색상
- [ ] 개선 방향 제시

**파일**: `src/app/movement-test/components/ImbalanceReport.tsx`

**기능**:
- 불균형 패턴 리스트
- 심각도 표시 (색상 코딩)
- 간단한 설명
- 관련 운동 링크

**예상 시간**: 2시간

---

## 🧮 Phase 3: 로직 및 상태 관리 (2-3일)

### ✅ Task 3.1: 점수 계산 로직
- [ ] calculateResult 함수 작성
- [ ] 기본 타입 점수 합산
- [ ] 서브타입 결정 로직
- [ ] 불균형 패턴 분석
- [ ] 단위 테스트 작성

**파일**: `src/app/movement-test/utils/calculateResult.ts`

**로직**:
```typescript
export function calculateResult(answers: Answer[]): TestResult {
  // 1. 기본 타입 점수 계산
  const scores = calculateTypeScores(answers);
  
  // 2. 메인 타입 결정
  const mainType = getMainType(scores);
  
  // 3. 서브타입 결정
  const subType = getSubType(mainType, answers);
  
  // 4. 불균형 분석
  const imbalances = analyzeImbalances(answers);
  
  return { mainType, subType, scores, imbalances, completedAt: new Date() };
}
```

**예상 시간**: 4시간

---

### ✅ Task 3.2: 입력 검증 유틸리티
- [ ] validation.ts 파일 생성
- [ ] 필수 답변 체크 함수
- [ ] 데이터 무결성 검증
- [ ] 오류 메시지 생성

**파일**: `src/app/movement-test/utils/validation.ts`

**함수**:
- `validatePageAnswers()`: 페이지 답변 완료 확인
- `validateAllAnswers()`: 전체 답변 완료 확인
- `getUnansweredQuestions()`: 미답변 질문 ID 반환
- `validateQuestionData()`: 질문 데이터 무결성 검증

**예상 시간**: 2시간

---

### ✅ Task 3.3: 상태 관리 Context
- [ ] TestContext 생성
- [ ] 답변 상태 관리
- [ ] 현재 페이지 상태
- [ ] 결과 상태
- [ ] localStorage 연동

**파일**: `src/app/movement-test/context/TestContext.tsx`

**상태**:
```typescript
interface TestState {
  answers: Answer[];
  currentPage: number;
  totalPages: number;
  result: TestResult | null;
  isComplete: boolean;
}
```

**액션**:
- `setAnswer(questionId, value)`
- `nextPage()`
- `prevPage()`
- `calculateAndSetResult()`
- `resetTest()`

**예상 시간**: 3시간

---

### ✅ Task 3.4: localStorage 유틸리티
- [ ] 진행 상황 저장 함수
- [ ] 진행 상황 불러오기 함수
- [ ] 데이터 초기화 함수
- [ ] 에러 핸들링

**파일**: `src/app/movement-test/utils/storage.ts`

**함수**:
- `saveProgress(answers, currentPage)`
- `loadProgress()`
- `clearProgress()`
- `hasProgress()`: 저장된 진행 상황 확인

**예상 시간**: 2시간

---

## 🎨 Phase 4: 스타일링 및 애니메이션 (2일)

### ✅ Task 4.1: Tailwind 커스텀 설정
- [ ] tailwind.config.js 확장
- [ ] 타입별 색상 팔레트 정의
- [ ] 커스텀 애니메이션 추가
- [ ] 반응형 브레이크포인트 설정

**파일**: `tailwind.config.js`

**커스텀 색상**:
```javascript
colors: {
  type: {
    담직: '#3B82F6',
    날림: '#F59E0B',
    버팀: '#EF4444',
    흘림: '#10B981',
  }
}
```

**예상 시간**: 1시간

---

### ✅ Task 4.2: 페이지 전환 애니메이션
- [ ] Framer Motion 설치 (선택적)
- [ ] 페이지 전환 애니메이션 구현
- [ ] 결과 등장 애니메이션
- [ ] 버튼 호버 효과

**애니메이션**:
- Fade in/out
- Slide left/right
- Scale up (결과 카드)
- Progress bar smooth transition

**예상 시간**: 3시간

---

### ✅ Task 4.3: 반응형 디자인 최적화
- [ ] 모바일 레이아웃 조정
- [ ] 태블릿 레이아웃 조정
- [ ] 데스크톱 레이아웃 조정
- [ ] 터치 타겟 크기 최적화

**브레이크포인트 테스트**:
- 320px (모바일 S)
- 375px (모바일 M)
- 768px (태블릿)
- 1024px (데스크톱)
- 1440px (와이드)

**예상 시간**: 3시간

---

### ✅ Task 4.4: 다크모드 지원 (선택적)
- [ ] 다크모드 색상 팔레트
- [ ] 테마 토글 버튼
- [ ] localStorage 테마 저장
- [ ] 시스템 설정 감지

**예상 시간**: 2시간

---

## 🧪 Phase 5: 테스트 및 검증 (2일)

### ✅ Task 5.1: 단위 테스트
- [ ] 점수 계산 로직 테스트
- [ ] 검증 함수 테스트
- [ ] 유틸리티 함수 테스트
- [ ] Jest 설정

**파일**: `__tests__/movement-test/`

**테스트 케이스**:
- 모든 질문 답변 시 올바른 타입 계산
- 부분 답변 시 에러 처리
- 경계값 테스트
- 불균형 패턴 감지

**예상 시간**: 4시간

---

### ✅ Task 5.2: 통합 테스트
- [ ] 전체 플로우 테스트
- [ ] 페이지 네비게이션 테스트
- [ ] 상태 관리 테스트
- [ ] localStorage 테스트

**테스트 시나리오**:
1. 시작 → 모든 질문 답변 → 결과 확인
2. 중간에 이전 버튼으로 답변 수정
3. 페이지 새로고침 후 진행 상황 복원
4. 다시 테스트 버튼 클릭 시 초기화

**예상 시간**: 3시간

---

### ✅ Task 5.3: 접근성 테스트
- [ ] 키보드 네비게이션 테스트
- [ ] 스크린 리더 테스트
- [ ] 색상 대비 검증
- [ ] ARIA 속성 확인

**도구**:
- axe DevTools
- Lighthouse
- WAVE

**예상 시간**: 2시간

---

### ✅ Task 5.4: 크로스 브라우저 테스트
- [ ] Chrome 테스트
- [ ] Firefox 테스트
- [ ] Safari 테스트
- [ ] Edge 테스트
- [ ] 모바일 브라우저 테스트

**예상 시간**: 2시간

---

## 🚀 Phase 6: 최적화 및 배포 (1-2일)

### ✅ Task 6.1: 성능 최적화
- [ ] 코드 분할 (lazy loading)
- [ ] 이미지 최적화
- [ ] 번들 크기 분석
- [ ] useMemo/useCallback 적용

**최적화 대상**:
- 결과 페이지 lazy load
- 타입 설명 데이터 동적 import
- 이미지 WebP 변환
- 불필요한 리렌더링 방지

**예상 시간**: 3시간

---

### ✅ Task 6.2: SEO 최적화
- [ ] 메타 태그 추가
- [ ] Open Graph 태그
- [ ] 구조화된 데이터 (JSON-LD)
- [ ] sitemap.xml 업데이트

**파일**: `src/app/movement-test/layout.tsx`

**메타 데이터**:
```typescript
export const metadata = {
  title: '움직임 타입 테스트 | PostureLab',
  description: '당신의 움직임 패턴을 분석하고 맞춤형 교정운동을 추천받으세요',
  keywords: '움직임 테스트, 체형 분석, 교정운동',
  openGraph: { ... }
}
```

**예상 시간**: 2시간

---

### ✅ Task 6.3: 에러 바운더리 및 로깅
- [ ] Error Boundary 컴포넌트
- [ ] 에러 로깅 시스템
- [ ] 사용자 친화적 에러 메시지
- [ ] 재시도 메커니즘

**파일**: `src/app/movement-test/components/ErrorBoundary.tsx`

**예상 시간**: 2시간

---

### ✅ Task 6.4: 문서화
- [ ] README.md 작성
- [ ] 컴포넌트 주석 추가
- [ ] 사용자 가이드 작성
- [ ] API 문서 (내부용)

**문서**:
- 설치 및 실행 방법
- 컴포넌트 구조 설명
- 데이터 구조 설명
- 커스터마이징 가이드

**예상 시간**: 2시간

---

### ✅ Task 6.5: 배포 준비
- [ ] 환경 변수 설정
- [ ] 빌드 테스트
- [ ] Vercel 배포 설정
- [ ] 도메인 연결

**체크리스트**:
- [ ] `npm run build` 성공
- [ ] 프로덕션 모드 테스트
- [ ] 환경 변수 검증
- [ ] 배포 후 smoke test

**예상 시간**: 2시간

---

## 📋 Phase 7: 추가 기능 (선택적, 1-2일)

### ✅ Task 7.1: PDF 다운로드 기능
- [ ] PDF 생성 라이브러리 설치 (@react-pdf/renderer)
- [ ] 결과 PDF 템플릿 디자인
- [ ] 다운로드 버튼 구현
- [ ] PDF 스타일링

**예상 시간**: 4시간

---

### ✅ Task 7.2: 결과 공유 기능
- [ ] 공유 URL 생성
- [ ] SNS 공유 버튼 (카카오톡, 페이스북)
- [ ] 이미지 생성 (og:image)
- [ ] 클립보드 복사 기능

**예상 시간**: 3시간

---

### ✅ Task 7.3: 진행 상황 복원 팝업
- [ ] 저장된 진행 상황 감지
- [ ] 복원 확인 모달
- [ ] 새로 시작 / 이어하기 선택
- [ ] 애니메이션 효과

**예상 시간**: 2시간

---

### ✅ Task 7.4: 통계 대시보드 (관리자용)
- [ ] 타입별 분포 차트
- [ ] 완료율 통계
- [ ] 평균 소요 시간
- [ ] 불균형 패턴 빈도

**예상 시간**: 4시간

---

## 🐛 Phase 8: 버그 수정 및 개선 (진행 중)

### 알려진 이슈
- [ ] 이슈 1: [설명]
- [ ] 이슈 2: [설명]
- [ ] 이슈 3: [설명]

### 개선 사항
- [ ] 개선 1: [설명]
- [ ] 개선 2: [설명]
- [ ] 개선 3: [설명]

---

## 📊 작업 진행 현황

### 전체 진행률
```
Phase 1: ⬜⬜⬜⬜⬜ 0%
Phase 2: ⬜⬜⬜⬜⬜ 0%
Phase 3: ⬜⬜⬜⬜⬜ 0%
Phase 4: ⬜⬜⬜⬜⬜ 0%
Phase 5: ⬜⬜⬜⬜⬜ 0%
Phase 6: ⬜⬜⬜⬜⬜ 0%
Phase 7: ⬜⬜⬜⬜⬜ 0% (선택적)
```

### 예상 총 작업 시간
- **필수 작업**: 약 80-100시간
- **선택적 작업**: 약 13시간
- **총 예상 기간**: 2-3주 (1인 기준)

---

## 🎯 우선순위 매트릭스

### P0 (필수, 즉시 시작)
- Task 1.1, 1.2, 1.3, 1.4
- Task 2.1, 2.2, 2.3, 2.4
- Task 3.1, 3.2, 3.3

### P1 (중요, 1주 내)
- Task 2.5, 2.6, 2.7, 2.8
- Task 3.4
- Task 4.1, 4.2, 4.3

### P2 (보통, 2주 내)
- Task 5.1, 5.2, 5.3, 5.4
- Task 6.1, 6.2, 6.3, 6.4, 6.5

### P3 (선택적, 여유 있을 때)
- Task 4.4 (다크모드)
- Task 7.1, 7.2, 7.3, 7.4

---

## 📝 일일 체크리스트 템플릿

### Day 1
- [ ] 프로젝트 구조 설정
- [ ] TypeScript 인터페이스 정의
- [ ] 질문 데이터 작성 시작 (10개)

### Day 2
- [ ] 질문 데이터 완료 (40개)
- [ ] 타입 설명 데이터 작성 시작

### Day 3
- [ ] 타입 설명 데이터 완료
- [ ] ProgressBar 컴포넌트
- [ ] MultipleChoice 컴포넌트

### Day 4
- [ ] BinaryChoice 컴포넌트
- [ ] QuestionPage 컴포넌트
- [ ] 페이지네이션 로직

### Day 5
- [ ] ResultPage 컴포넌트
- [ ] TypeCard 컴포넌트
- [ ] 점수 계산 로직

... (계속)

---

## 🔄 변경 이력

| 날짜 | 버전 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 2026-01-29 | 1.0 | 초기 작업 목록 생성 | AI Assistant |
| | | | |
| | | | |

---

## 📞 문의 및 지원

- **기술 문의**: [개발팀 이메일]
- **작업 할당**: [프로젝트 매니저]
- **이슈 트래킹**: [Jira/GitHub Projects 링크]

---

**문서 작성일**: 2026-01-29  
**최종 업데이트**: 2026-01-29  
**다음 리뷰 예정일**: 2026-02-05
