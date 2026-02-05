# 동물 MBTI + 움직임 테스트 시스템 PRD (Product Requirements Document)

**문서 버전**: 2.1 (UX/UI 리디자인 통합판)  
**최종 수정일**: 2026-02-05  
**작성자**: AI Assistant  
**승인자**: [프로젝트 매니저]

---

## 🧾 리디자인 변경 요약 (v2.1)
- **Scope**: 랜딩(`/`), 테스트 UI(문항 화면), 결과 UI의 **비주얼/레이아웃 리디자인** (점수/계산 로직은 유지)
- **Key Changes**
  1) 기본 테마: Dark → **Light(밝은 여백 + 카드 UI)**
  2) 랜딩(`/`): **히어로 + 3단계 카드 + CTA 1개** 도입
  3) 테스트: 기본 **1문항/화면 + 타일형 선택지(큰 터치 영역)**로 완주율 개선
  4) 진행률: % 부담 최소화(“1/30” 중심)
  5) 16Personalities 참고는 **레이아웃 패턴만**, 아이콘/일러스트는 자체 스타일(유사 디자인 리스크 방지)
- **Non-goals**
  - 동물/서브타입 점수 계산 로직 변경 없음
  - 카메라 기반 자동 분석 강제 없음(MVP는 가이드형 셀프체크)

---

## 📋 프로젝트 개요

### 목적
사용자가 **“내 움직임 성향 + 몸의 보상패턴”**을 쉽고 재밌게 파악하도록  
**동물 MBTI(4대 타입 + 16 서브타입)**로 분류하고, **즉시 실행 가능한 교정운동/습관 가이드**를 제공하는 웹 기반 테스트 시스템.

### 핵심 가치
- **진입장벽 0**: `/`에서 1번 클릭(CTA)으로 즉시 테스트 시작
- **유머러스하지만 신뢰감**: 동물 캐릭터로 직관적 이해 + 결과 설명은 전문가 톤
- **즉시 행동 유도**: 결과에 “오늘 당장 할 것 3개” 포함
- **정확도 강화 옵션**: “움직임 테스트(가이드형/체크형)”로 설문 정확도 보정
- **전환은 얇게**: 유료 CTA는 결과 화면 1곳(1개 버튼), 정보형 톤 유지(과한 유도 금지)
- **밝은 UI/친절한 톤**: 넓은 여백, 카드형 레이아웃, 큰 버튼으로 ‘부담 없는 테스트’ 경험

---

## 🎯 제품 컨셉

### 1) 동물 MBTI 구조 (4대 타입 + 16 서브타입)

#### 메인 타입 4개(동물)
- **치타**: 빠름/급함/과열(초반 과속 → 빨리 지침)
- **거북이**: 느림/성실/안전(꾸준하지만 변화가 늦음)
- **미어캣**: 눈치/긴장/집중(신경 많이 쓰고 과긴장)
- **해파리**: 유유자적/힘누수/흐름(긴장 낮지만 효율도 낮음)

#### 서브타입 16개(예시 체계)
- 각 동물 타입마다 4개 서브타입
- 서브타입은 “통증/불균형/보상 패턴” + “생활 습관” 기반으로 결정
- 예:
  - **치타**: 과열형 / 불안정형 / 편측형 / 회복부족형
  - **거북이**: 안전지향형 / 경직형 / 둔감형 / 정체형
  - **미어캣**: 과긴장형 / 호흡부족형 / 편측감시형 / 컨트롤집착형
  - **해파리**: 힘누수형 / 무기력형 / 흐름과다형 / 기초부족형

> ✅ 구현 원칙(중요): 기존 로직이 담직/날림/버팀/흘림 + 16서브라면  
> **점수/계산 로직은 유지**하고 **표시/설명만 동물로 치환**(리스크↓/속도↑).

---

## 👤 타겟 사용자
- 운동 초보/일반인: “왜 운동하면 아픈지” 이해하고 싶은 사람
- 운동은 하는데 통증/정체가 있는 사람
- 테스트/성향 콘텐츠 좋아하는 사람(공유/입소문 유도)

---

## 🧭 사용자 플로우(필수)

### 상단 탭(고정)
- **움직임유형**: 타입 소개(동물 4종/16종)
- **움직임테스트**: 정확도 보정용 “움직임 체크(가이드형)”
- **심층분석(유료)**: 사진/영상 업로드 + AI 1차 + 전문가 코멘트 포함(Phase 확장)
- **아티클**: 교정운동/습관 콘텐츠

### 메인(`/`) 핵심 플로우 (v2.1)
1) `/` 접속 → **밝은 랜딩(히어로 + 3단계 카드 + CTA 1개)**
2) CTA(“테스트 시작”) 클릭 → `/test` 진입(즉시 1문항 시작)
3) 설문 완료 → 결과 페이지(`/movement-test/result`)
4) (선택) 정확도 올리기: **움직임테스트 탭**에서 3~5개 동작 체크
5) (선택) 심층분석(유료)로 업셀(과한 유도 금지, 결과 하단 1개 CTA)

---

## 🎯 기능 요구사항

## 1. 테스트 구성

### 1.1 기본 설문(메인 분류) — 4지선다 24~32문항
- **목적**: 동물 메인 타입(4) + 서브타입(16) 분류
- **원칙**
  - 초보도 이해 가능한 문장(운동 용어 최소화)
  - 한 문항에서 “가장 가깝다” 선택(고민 줄이기)
  - 일부 문항은 서브타입 가중치용(`subTypeWeight=true`)
  - (옵션) multiple 1~2개 선택 시 1순위 100%, 2순위 50% 가중치 적용 가능

**예시 질문 구조**
```ts
{
  id: 1,
  type: "multiple",
  question: "운동을 시작하면 보통 어떤 편이야?",
  options: [
    { id: "q1_a", text: "처음에 확 달리고 금방 지친다", animal: "치타", score: 3 },
    { id: "q1_b", text: "천천히 하지만 끝까지 꾸준히 한다", animal: "거북이", score: 3 },
    { id: "q1_c", text: "괜히 긴장되고 자세를 계속 신경 쓴다", animal: "미어캣", score: 3 },
    { id: "q1_d", text: "힘이 잘 안 들어가고 대충 흐른다", animal: "해파리", score: 3 }
  ],
  subTypeWeight: true
}
1.2 불균형/보상 패턴 체크 — 예/아니오 8~12문항
목적: 결과 설명의 근거 강화(“내 몸 얘기처럼” 보이게)

구조

예/아니오(이진)

불균형 플래그 누적

예시

{
  id: 31,
  type: "binary",
  question: "사진을 찍으면 어깨 높이가 다르게 보이는 편이야?",
  imbalanceFlag: "shoulder_asymmetry"
}
1.3 움직임 테스트(정확도 보정) — 가이드형 체크(카메라 필수 아님)
목적: 설문 기반 분류의 신뢰도 보정(“체크로 확인했다” 근거)

방식(MVP 권장)

카메라 분석을 ‘기본’으로 강제하지 않음

가이드 + 셀프체크(체감/대칭/통증) 중심

구성 예시(3~5개)

벽 기대기: 목/등 뜨는 정도

스쿼트 5회: 무릎 안쪽/발뒤꿈치 들림

한발 서기 20초: 좌우 차이/흔들림

팔 올리기: 어깨 걸림/비대칭

힙힌지: 허리 꺾임/햄스트링 당김

결과 반영

서브타입 동점/근접 시 tie-break

confidence(low|mid|high) 산출(간단 룰)

2. 사용자 경험(UX) 요구사항(핵심)
2.0 UX/UI 리디자인 요구사항(v2.1, 필수)
2.0.1 비주얼 원칙
기본 테마는 Light (밝은 배경 + 흰 카드 + 얇은 보더)

카드/버튼은 라운드 크게, 그림자는 약하게

포인트 컬러는 2~3개만 사용(남발 금지)

16Personalities는 레이아웃 패턴만 참고, 아이콘/일러스트는 자체 스타일(유사 디자인 리스크 방지)

2.0.2 레이아웃 원칙
한 화면에는 “주인공 요소 1개”(질문 1개, CTA 1개)

텍스트는 짧게, 행동 지시형 문장

모바일 터치 타겟 44px 이상

2.0.3 랜딩(/) 구성(필수)
히어로: 타이틀 + 서브 + CTA 1개

3단계 카드: 테스트 → 결과 → 심층분석(유료)

하단 고지: “의학적 진단이 아닌 습관/성향 체크” 문구

2.1 메인에서 즉시 시작
/ 접속 시 히어로/단계 카드가 먼저 보이고, CTA 1번 클릭으로 테스트 진입

상단 탭은 항상 고정(신뢰감 + 탐색성)

2.2 진행률/페이지네이션 (v2.1)
기본은 1문항/화면(권장): 완주율/집중도 최적화

진행 표시는 “질문 1/30” + 얇은 바(%)는 선택적으로 숨김

“이전/다음” 제공(답 수정 가능)

첫 미답변 자동 포커스/스크롤

(옵션/Phase) 컴팩트 모드: 페이지당 4~6문항

2.3 필수 답변 검증
미답변 질문 강조(테두리/문구)

첫 미답변 자동 스크롤/포커스

오류 문구는 짧고 직관적(예: “여기 하나만 더 체크!”)

2.4 톤 가이드(중요)
문장: 짧고 직설적

유머: “타입 한 줄 디스”는 넣되, 결과 가이드는 전문가 톤 유지

과장 금지: “진단” 표현 금지 → “성향/습관/패턴”으로 통일

2.5 선택지 UI(필수)
선택지는 작은 라디오가 아니라 **타일형 버튼(Choice Tile)**로 제공

선택 상태가 한눈에 보이도록 배경/보더 변화

긴 문장은 2줄 제한 + 말줄임(가독성 유지)

키보드/스크린리더 접근 가능(ARIA 라벨 포함)

3. 점수 계산 로직
3.1 메인 타입 점수(동물 4종)
const scores = { 치타: 0, 거북이: 0, 미어캣: 0, 해파리: 0 };

const mainAnimal = (Object.keys(scores) as (keyof typeof scores)[])
  .reduce((a, b) => (scores[a] > scores[b] ? a : b));
3.2 서브타입 계산(16종)
subTypeWeight=true 문항 + 불균형 플래그 + (선택) 움직임테스트 체크 합산

결과 형식 예: 치타-과열형, 미어캣-과긴장형 …

3.3 불균형 진단
const imbalances = binaryAnswers
  .filter(a => a.answer === true)
  .map(a => a.imbalanceFlag);
3.4 움직임 테스트 보정(선택)
움직임 체크 결과가 있으면:

서브타입 후보 간 동점/근접일 때 tie-break

confidence: low | mid | high 산출(간단 룰 기반)

4. 결과 페이지 요구사항
4.1 결과 구성(필수)
메인 타입(동물) + 서브타입 큰 제목

요약 3줄

너의 강점

너의 위험 포인트

오늘의 1순위 수정 포인트

특징 3~5개(행동/자세/회복/통증 패턴)

근거(Evidence) 섹션

설문에서 강하게 나온 항목 2~3개

불균형 체크 결과

(있으면) 움직임 테스트 체크 요약

레이아웃: 위 구성은 카드형 섹션으로 분리(스캔 가능하게)

4.2 교정운동 가이드(실행형)
오늘 당장 10분 루틴(필수): 3개 운동 + 세트/횟수/주의점

7일 루틴(프리뷰): 1주 계획표 미리보기(유료로 확장 가능)

피해야 할 것 2~3개: “지금은 이걸 하면 더 꼬임” 스타일

4.3 액션 버튼/CTA
무료: 다시 테스트, (선택) 결과 저장(PDF/이미지)

유료: 심층분석(사진/영상 + 전문가 코멘트) 버튼은 1개만

유료 CTA는 결과 하단의 1개 카드/섹션에만 배치(중복 배치 금지)

5. 아티클(콘텐츠) 요구사항 (v2.1)
목적
신뢰도/SEO/재방문 강화, 결과 → 심층분석 전환 보조

IA(카테고리 최소)
자세·통증 / 5분 루틴 / 테스트 해설 / 습관·세팅

글 템플릿(고정)
한 줄 결론 → 원인 → 5분 루틴 → 영상 → 체크리스트 → CTA(테스트/심층분석)

유튜브 연동 규칙(성능)
유튜브는 iframe 즉시 로딩 금지(썸네일 클릭 시 로드, 모바일 성능 보호)

🛠 기술 요구사항 (요약)
1) 기술 스택
프레임워크: Next.js 14 (App Router)

언어: TypeScript

스타일링: Tailwind CSS

상태 관리: React useState/useContext

세션 저장: localStorage (진행 중 답변/결과 저장)

2) TypeScript 인터페이스(권장)
type AnimalType = '치타' | '거북이' | '미어캣' | '해파리';

interface Question {
  id: number;
  question: string;
  type: 'multiple' | 'binary';
  options?: Option[];
  category?: string;
  subTypeWeight?: boolean;
  imbalanceFlag?: string;
}

interface Option {
  id: string;
  text: string;
  animal: AnimalType;
  score: number;
  subTypeModifier?: string;
}

interface Answer {
  questionId: number;
  selectedOptionIds?: string[];  // multiple에서 1~2개 선택(가중치) 구조면 배열
  binaryAnswer?: boolean;
}

interface MovementCheck {
  id: string;      // ex) squat_knee_in
  label: string;   // ex) "스쿼트할 때 무릎이 안으로 모인다"
  value: boolean;
}

interface TestResult {
  mainAnimal: AnimalType;
  subType: string; // 16종 중 하나
  scores: Record<AnimalType, number>;
  imbalances: string[];
  movementChecks?: MovementCheck[];
  confidence?: 'low' | 'mid' | 'high';
  completedAt: string; // ISO
}

interface TypeDescription {
  mainAnimal: AnimalType;
  subType: string;
  title: string;
  oneLiner?: string;        // 한 줄 디스(가벼운 유머)
  description: string;      // 전문가 톤
  characteristics: string[];
  todayRoutine: Exercise[]; // 오늘 10분 루틴(필수)
  weekPreview?: Exercise[]; // 7일 프리뷰(선택)
  avoid?: string[];
  lifestyleTips?: string[];
}

interface Exercise {
  name: string;
  description: string;
  sets?: string;
  reps?: string;
  frequency?: string;
  caution?: string;
}
3) 컴포넌트/라우트 구조(권장)
/app
  /page.tsx                    # 메인: 랜딩(히어로+3카드+CTA)
/test
  /page.tsx                    # 설문 1문항/화면 진행(권장)
  /components
    TopTabs.tsx
    ProgressMini.tsx           # 1/30 + 얇은 바(권장)
    ChoiceTile.tsx             # 타일형 선택지(권장)
    MultipleChoice.tsx
    BinaryChoice.tsx
/movement-test
  /result/page.tsx
  /components
    ResultSummary.tsx
    ExerciseToday.tsx
    ExerciseWeekPreview.tsx
    EvidencePanel.tsx
  /data
    questions.ts
    typeDescriptions.ts
  /utils
    calculateResult.ts
    validation.ts
/articles
  /page.tsx
  /[slug]/page.tsx
/deep-analysis
  /page.tsx
4) 데이터 저장/처리 정책
✅ 기본: 클라이언트에서만 계산/표시

✅ 진행 중 답변/결과: localStorage 저장(옵션)

✅ “다시 테스트”: 저장 데이터 초기화(선택)

🚫 개인 식별 정보 수집 금지(이메일/전화번호 등)

5) 반응형/접근성(A11y)
모바일 우선(>= 320px)

터치 타겟 최소 44x44px

키보드 네비게이션 가능

ARIA 라벨/색 대비 WCAG AA 준수

✅ 검증 및 오류 처리
필수 검증(배포 전)
npm run lint 통과

npm run build 통과

수동 체크리스트
/ 접속 → 랜딩 렌더 + CTA 정상

CTA 클릭 → /test 진입

진행/이전/다음 정상

결과 페이지 정상 표시

탭 4개 라우팅 정상

/articles 리스트/상세 정상(구현 시)

오류 메시지 가이드(짧게)
“여기 하나만 더 체크!”

“모든 질문에 답해줘”

“결과 계산이 꼬였어. 다시 한 번!”

🚀 성능 최적화(가볍게)
결과 설명 데이터 lazy/dynamic import 가능

점수 계산은 memo/useMemo로 불필요한 재계산 방지

데이터 파일(questions/typeDescriptions) 분리로 번들 관리

유튜브는 썸네일 클릭 시 로드(iframe 지연)

📈 향후 확장 가능성(Phase)
Phase 2
결과 이미지 저장(공유 최적화)

7일 루틴 자동 생성(난이도/장비별)

결과 비교(전/후)

Phase 3
심층분석(유료): 업로드 + AI 1차 + 전문가 코멘트 + 개인 루틴

구독형(주간 재테스트/피드백)

회원 계정/진행 트래킹

📋 성공 지표(KPI)
메인 진입 → 테스트 시작률: > 80%

테스트 완료율: > 70%

결과 페이지 체류시간: > 45초

결과 저장/공유 클릭률: > 10%

결과 → 심층분석 클릭률: 3~7%(초기 목표)

🐛 알려진 제약사항(MVP)
카메라 기반 자동 분석은 MVP 필수 아님(가이드형 체크로 대체)

브라우저 호환성: IE11 미지원

오프라인 모드: 미지원

다국어: 한국어만

“진단” 표현 사용 금지(법/의료 리스크)

📞 지원 및 문의
기술 문의: [이메일]

버그 리포트: [GitHub Issues]

기능 제안: [피드백 폼]

🧾 Change Log
v2.1 (2026-02-05): Light 리디자인 통합, 랜딩(히어로+3카드+CTA), 1문항/화면, 타일형 선택지, 진행률 부담 최소화, 아티클/유튜브 연동 규칙 추가

v2.0: 동물 MBTI + 설문/불균형/움직임체크 기반 구조 확정