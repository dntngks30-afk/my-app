Scope
readiness 계산 owner는 그대로 둔 채, readiness type/export surface만 정리한다.
legacy compat shape를 내부 compat 레이어로 격리한다.
신규 소비자가 readiness를 참조할 때 canonical surface만 보게 경계를 잠근다.
신규 소비자가 getCanonicalUserReadiness.ts나 legacy 타입명을 정본으로 오인하지 않게 naming / export boundary를 정한다.

부모 SSOT는 track 10을 readiness legacy type/export cleanup으로 잠그고 있고, legacy compat를 새 정본처럼 확장하는 것도 금지한다.

Non-goals
readiness 계산 규칙 변경
status, next_action, execution_block 의미 변경
next_action route semantics 변경
/api/readiness runtime behavior 변경
ReadinessEntryGate.tsx redirect policy 변경
onboarding / payment / claim / session-create / bootstrap 로직 변경
legacy compat 전면 삭제
/app/home, /app/checkin, /app/profile, AppShell, persistent tab shell, execution core 수정
Locked truth
readiness canonical owner는 계속 get-session-readiness.ts의 loadReadinessContext + buildSessionReadinessV1 + getSessionReadiness다. 이 파일은 PR-FLOW-06 canonical session readiness SSOT로 명시되어 있다.
API public contract는 계속 SessionReadinessV1다. /api/readiness는 이 contract를 그대로 반환한다.
browser-side public consumer도 계속 fetchReadinessClient + SessionReadinessV1다. ReadinessEntryGate.tsx는 SessionReadinessNextAction만 소비한다.
getCanonicalUserReadiness.ts는 이미 스스로를 “레거시 CanonicalUserReadiness 형태를 유지하기 위한 어댑터”라고 규정하고 있다. 이 파일은 정본 owner가 아니라 compat projection이어야 한다.
Why now

RF-01은 readiness의 owner / adapter / consumer 역할을 잠그는 PR이었고, legacy export 제거와 type surface 축소는 명시적으로 follow-up인 RF-10으로 미뤘다.

현재 repo에서는 canonical contract가 이미 SessionReadinessV1로 존재하지만, 동시에 getCanonicalUserReadiness.ts가 별도 legacy 타입군을 공개 export하고 있다. 이 파일은 AnalysisSourceMode, NextActionCode, SessionBlockingReasonCode, CanonicalUserReadiness, UNAUTHENTICATED_READINESS, getCanonicalUserReadiness를 외부에서 바로 import할 수 있게 노출하고 있다.

즉 지금 문제는 “계산이 두 군데서 일어난다”가 아니라, 파일 경로와 타입명이 새 소비자를 legacy 쪽으로 끌어당기는 표면이 아직 살아 있다는 점이다. RF-01 이후에 이 표면을 정리하지 않으면, 이후 코드가 다시 compat shape를 기준으로 붙으면서 같은 구조 리스크가 재생산된다. RF-01 문서도 정확히 이 export/type cleanup을 RF-10 후속으로 남겨두었다.

Current legacy compat surface

현재 legacy compat surface는 아래다.

src/lib/readiness/getCanonicalUserReadiness.ts
legacy adapter 파일
legacy 타입군 export
legacy unauthenticated constant export
legacy getter export

구체적으로 legacy compat로 분류해야 하는 표면:

AnalysisSourceMode
NextActionCode
SessionBlockingReasonCode
CanonicalUserReadiness
UNAUTHENTICATED_READINESS
getCanonicalUserReadiness

반대로 현재 canonical public surface는 이미 따로 존재한다.

src/lib/readiness/types.ts
SessionReadinessV1
SessionReadinessStatus
SessionReadinessNextAction
SessionReadinessResultSummary
PublicResultStageLabel
src/app/api/readiness/route.ts
SessionReadinessV1 transport surface
src/lib/readiness/fetchReadinessClient.ts
browser fetch entry
SessionReadinessV1 재노출

추가로, get-session-readiness.ts는 canonical owner이지만 동시에 ReadinessContext, loadReadinessContext, buildSessionReadinessV1까지 export하고 있다. 이들은 canonical 계산 내부 경계에 가깝고, 일반 소비자 public surface로 계속 넓게 열려 있으면 다른 모듈이 다시 projection owner처럼 행동할 위험이 있다.

Files / modules in scope

주 scope:

src/lib/readiness/getCanonicalUserReadiness.ts
src/lib/readiness/get-session-readiness.ts
src/lib/readiness/types.ts

verification / boundary 확인 범위:

src/lib/readiness/fetchReadinessClient.ts
src/app/api/readiness/route.ts
readiness import consumer 예시:
src/app/app/_components/ReadinessEntryGate.tsx

compat 잔존 검증 범위:

scripts/flow-07-canonical-user-readiness-smoke.mjs
이 스크립트는 아직 legacy export 존재를 가정하고 있으므로, compat는 “죽은 표면”이 아니라 아직 격리 대상이다.
Out of scope
ReadinessEntryGate.tsx 로직 수정
/api/readiness response shape 수정
SessionReadinessV1 필드 의미 수정
getCanonicalUserReadiness.ts 내부 projection semantics 수정
auth/pay/result/onboarding/app-home 경로 변경
bootstrap / session-create / session source alignment
compat consumer 전체 제거 작업
smoke/test 정책 개편
Public surface vs internal compat surface

이번 PR에서 잠가야 할 원칙은 아래다.

1. Canonical public surface

신규 소비자가 보아야 할 readiness 표면은 SessionReadiness 계열만이다.

허용 public naming 원칙:

SessionReadiness*
getSessionReadiness
UNAUTHENTICATED_SESSION_READINESS_V1
fetchReadinessClient

즉 “새 코드가 readiness를 읽는다”는 말은 기본적으로 SessionReadinessV1 contract를 읽는다는 뜻이어야 한다.

2. Internal canonical builder surface

아래는 owner 내부 빌드 경계로 취급한다.

ReadinessContext
loadReadinessContext
buildSessionReadinessV1

이 표면은 owner 내부 조립을 위한 것이지, 일반 소비자가 새 shape를 만드는 출발점이 되면 안 된다.

3. Internal compat surface

아래는 “필요하면 남기되, public하지 않게” 격리한다.

CanonicalUserReadiness
AnalysisSourceMode
NextActionCode
SessionBlockingReasonCode
UNAUTHENTICATED_READINESS
getCanonicalUserReadiness
4. Naming / export boundary 원칙
canonical public 이름은 SessionReadiness*만 쓴다.
legacy projection 이름은 generic하면 안 된다.
compat 파일/타입은 경로 또는 이름에서 compat / internal 성격이 드러나야 한다.
compat 표면은 readiness 기본 public entry에서 재export하면 안 된다.
새 runtime 소비자가 compat 표면을 직접 import하는 구조는 금지한다.

핵심은 “삭제”가 아니라 “잘못 집히지 않게 만드는 것”이다.

PR boundary

이 PR은 type/export surface cleanup only다.

허용 범위:

legacy compat export 축소 또는 격리
canonical public export 명확화
internal builder export 범위 축소
naming 정리로 compat/public 구분 강화
compat를 참조하는 smoke/script import 경로 정리

금지 범위:

readiness 계산 로직 변경
legacy projection 필드 의미 변경
next_action 매핑 변경
route behavior 변경
client gate behavior 변경
RF-01과의 구분
RF-01: 누가 owner인지를 잠그는 PR
RF-10: 무엇을 public하게 import할 수 있는지를 잠그는 PR

RF-01은 getCanonicalUserReadiness.ts를 adapter로 규정했지만, 아직 adapter 표면을 public import 대상으로 남겨두었다. RF-10은 그 남은 표면을 정리하는 후속이다. RF-01을 다시 하는 PR이 아니다.

Regression checklist
/api/readiness가 계속 SessionReadinessV1를 반환하는가
fetchReadinessClient가 계속 SessionReadinessV1 기준으로 동작하는가
ReadinessEntryGate.tsx가 계속 SessionReadinessNextAction만 소비하는가
legacy compat가 필요한 내부 smoke/script는 계속 참조 가능하지만, public default surface에는 노출되지 않는가
신규 consumer가 generic legacy 이름보다 SessionReadiness*를 먼저 보게 되는가
get-session-readiness.ts 내부 builder helper가 외부 신규 소비자 entry처럼 보이지 않게 되었는가
getCanonicalUserReadiness.ts가 owner처럼 오해될 여지를 줄였는가
runtime semantics, route behavior, READ ONLY 성격이 그대로 유지되는가
Risks
compat를 너무 세게 자르면 기존 smoke/script가 깨질 수 있다. 현재 flow-07-canonical-user-readiness-smoke.mjs는 legacy export 존재를 전제로 한다.
compat를 남기되 이름과 경로가 그대로면 신규 코드가 다시 그쪽에 붙는다.
canonical owner 내부 helper export를 그대로 넓게 두면, legacy adapter를 숨겨도 다른 모듈이 ReadinessContext 기반 새 projection을 만들 수 있다.
“public surface cleanup” 명분으로 runtime semantics까지 건드리면 RF-10 경계를 벗어난다.
Follow-up PRs
compat 잔존 consumer 정리
내부 smoke/script/서버 호환 의존을 줄이고, compat surface를 더 축소할 수 있는지 별도 확인
canonical builder internalization
ReadinessContext, loadReadinessContext, buildSessionReadinessV1를 owner 내부 전용으로 더 강하게 잠글 필요가 있으면 별도 PR로 분리
readiness module entry 정리
readiness 관련 파일이 늘어날수록 barrel/public entry 정책을 별도로 잠글 필요가 있으면 후속 PR로 분리
One-line boundary rule
정본은 SessionReadiness*만 public하다.
legacy CanonicalUserReadiness* 계열은 남더라도 internal compat다.
owner 내부 빌드 helper도 새 소비자 public entry가 되면 안 된다.