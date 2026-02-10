# SPEC - Survey Flow (/movement-test/survey)

## 0. 범위
이 스펙은 아래 3개 라우트의 동작 규칙을 정의한다.
- /movement-test (소개)
- /movement-test/survey (설문)
- /movement-test/result (결과)

유료 결제, 업로드, PDF 생성은 이번 스펙 범위 밖(Out of scope).

---

## 1. 용어
- "세션" = 사용자의 설문 진행 상태(답변, 현재 페이지, 진행률 포함)
- "답변" = questionId에 대한 선택 결과
- "완료" = 40문항(또는 시스템이 요구하는 제출 조건)을 충족하고 제출 버튼을 눌러 결과를 계산한 상태

---

## 2. 라우트별 목적과 진입 규칙

### 2.1 /movement-test (src/app/movement-test/page.tsx)
목적: 테스트 소개 및 시작.

요구사항:
- [MT-INTRO-1] "테스트 시작" 버튼이 존재한다.
- [MT-INTRO-2] 버튼 클릭 시 /movement-test/survey 로 이동한다.
- [MT-INTRO-3] 기존 세션이 존재할 경우 버튼 문구는 "이어하기"로 바뀔 수 있다(선택사항).
- [MT-INTRO-4] 사용자가 원하면 "처음부터 다시" 버튼으로 세션 초기화 가능(선택사항).

### 2.2 /movement-test/survey (src/app/movement-test/survey/page.tsx)
목적: 40개 질문을 페이지네이션으로 진행.

진입 규칙:
- [MT-SURVEY-ENTRY-1] 세션이 없으면 새 세션을 생성한다.
- [MT-SURVEY-ENTRY-2] 세션이 있으면 마지막 진행 상태(현재 페이지, 답변)를 복구한다.

### 2.3 /movement-test/result (src/app/movement-test/result/page.tsx)
목적: 결과 표시.

진입 규칙:
- [MT-RESULT-ENTRY-1] 결과 산출에 필요한 답변 데이터가 없으면 "설문 데이터가 없습니다" 안내를 표시한다.
- [MT-RESULT-ENTRY-2] 안내와 함께 /movement-test 로 돌아가는 버튼을 제공한다.
- [MT-RESULT-ENTRY-3] 결과 데이터가 있으면 즉시 결과를 렌더링한다.

---

## 3. 세션 저장(로컬 저장소) 규칙

저장 매체:
- localStorage 사용 (키는 아래 고정)

키 정의:
- [MT-STORAGE-1] localStorage key = "movementTestSession:v1"

세션 스키마(최소):
- answers: Record<string, any> (questionId -> answer payload)
- pageIndex: number (현재 페이지 인덱스, 0부터)
- updatedAt: number (Date.now())
- isCompleted: boolean (제출 완료 여부)
- result?: any (결과가 계산되면 저장 가능)

저장 타이밍:
- [MT-STORAGE-2] 사용자가 선택지를 클릭해 답변이 변경될 때마다 즉시 저장한다.
- [MT-STORAGE-3] 페이지 이동(이전/다음) 직후에도 저장한다.
- [MT-STORAGE-4] 제출(완료) 시 isCompleted=true 및 result 저장.

복구 타이밍:
- [MT-STORAGE-5] /movement-test/survey 진입 시 localStorage를 읽어 세션을 복원한다.
- [MT-STORAGE-6] 세션 파싱 실패/스키마 불일치 시 세션을 폐기하고 새 세션으로 시작한다.

초기화:
- [MT-STORAGE-7] "처음부터 다시"를 실행하면 해당 key를 삭제하고 /movement-test로 이동한다(또는 survey 0페이지로).

---

## 4. 설문 페이지네이션 규칙

페이지 구성:
- [MT-PAGE-1] QUESTIONS_PER_PAGE = 5 (현재 코드 기준 유지)
- [MT-PAGE-2] 총 페이지 수 = ceil(총 질문수 / QUESTIONS_PER_PAGE)

이전/다음 버튼:
- [MT-PAGE-3] 이전 버튼: pageIndex > 0일 때만 활성화
- [MT-PAGE-4] 다음 버튼: 현재 페이지의 "필수 질문"이 충족되어야 활성화
- [MT-PAGE-5] 마지막 페이지에서는 다음 대신 "제출" 버튼 노출

필수 질문 충족 규칙(최소 버전):
- [MT-REQ-1] 현재 페이지에 노출된 모든 질문이 답변되어야 다음/제출 가능
- [MT-REQ-2] multiple 타입은 최소 1개 이상 선택되어야 답변 처리
- [MT-REQ-3] binary 타입은 yes/no 중 1개 선택되어야 답변 처리

UX:
- [MT-UX-1] 진행률 표시(예: 40문항 중 답변 완료 수 또는 페이지 기준)
- [MT-UX-2] 사용자가 뒤로 갔다가 와도 기존 선택 상태가 그대로 보인다.

---

## 5. 결과 산출 규칙(스펙 레벨)

- [MT-RESULT-1] 제출 시 answers를 기반으로 결과 타입을 1개 산출한다.
- [MT-RESULT-2] 동점 발생 시, 아래 우선순위로 1개로 확정한다:
  1) (권장) 가장 최근에 점수가 올라간 타입 우선(updatedAt 기반)
  2) 또는 고정 우선순위 배열(예: 담직 > 버팀 > 날림 > 흘림)
  ※ 프로젝트에서 이미 구현된 로직이 있다면 그 로직을 "정답"으로 간주하고 문서만 맞춘다.

- [MT-RESULT-3] 결과 산출 후 즉시 /movement-test/result로 라우팅한다.
- [MT-RESULT-4] 결과 페이지는 localStorage의 result가 있으면 그대로 사용하고, 없으면 answers로 재계산할 수 있다(둘 중 하나로 통일).

---

## 6. 에러/엣지 케이스

- [MT-EDGE-1] localStorage 접근 불가(사파리 프라이빗 등) 시: 메모리 상태로만 진행하되 새로고침 시 초기화될 수 있음을 안내(선택).
- [MT-EDGE-2] 설문 도중 결과 페이지 직접 접근: 안내 후 /movement-test 유도.
- [MT-EDGE-3] 질문 데이터 변경으로 기존 answers와 매칭이 안 될 경우: 깨끗이 초기화하고 다시 시작 유도.
