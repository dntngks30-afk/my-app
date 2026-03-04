# P3_MEDIA_02C: RoutineHub 미디어 캐시·재시도

## 개요

RoutineHub(4주 세션 루틴 탭)에서 `/api/media/sign` 중복 호출 제거, 만료 처리, 실패 시 재시도 UX를 적용한다.

## 캐시 규칙

### 1) payloadCache

- **키**: `templateId` (string)
- **값**: `{ payload: MediaPayloadHub, expiresAt: number }`
- **저장 시점**: `/api/media/sign` 응답 수신 시
- **만료 계산**: `expiresAt = now + (cache_ttl_sec ?? 60) * 1000`

### 2) batchInflightMap

- **키**: `templateIds` 정렬 후 `join(',')` (예: `M01,M02,M03`)
- **값**: `Promise<Record<templateId, { payload, expiresAt }>>`
- **목적**: 동일 templateIds 조합에 대한 배치 sign 중복 호출 방지

### 3) 만료 처리

- **버퍼**: `expiresAt - 10초` 이전에 만료로 간주
- **재발급 대상**: `!cached || !isCacheValid(cached.expiresAt)`
- **캐시 유효 판단**: `Date.now() < expiresAt - CACHE_BUFFER_SEC * 1000`

## 요청 대상

- **렌더되는 items만**: `flattenPlanToAccordionItems` 결과(최대 4개)의 `templateId`만 수집
- **중복 제거**: `Set`으로 dedupe
- **캐시 유효 항목 제외**: `payloadCache`에 있고 `isCacheValid`인 templateId는 sign 요청에서 제외

## 재시도 UX

- **상태**: `loading` | `ready` | `placeholder` | `error`
- **error 시**: "영상을 불러올 수 없습니다" + "재시도" 버튼
- **재시도 동작**: 해당 `templateId`만 `payloadCache`에서 제거 후 `/api/media/sign` 재호출

## Acceptance Tests

1. **중복 호출 제거**
   - 같은 plan 화면에서 리렌더/탭 왕복 3회 해도 `/api/media/sign` 호출은 1회 또는 최소(만료 전)
   - 네트워크에서 동일 templateIds로 폭주하지 않음

2. **만료 대응**
   - `expiresAt`이 지난 payload로 재생 시도 시 자동 재발급(캐시 miss → sign 재요청)
   - 또는 "재시도" 버튼으로 복구

3. **실패 복구**
   - `/api/media/sign` 실패(잘못된 id, 네트워크 끊김) 시
   - 해당 아이템에 "재시도" 버튼 표시
   - 클릭 시 정상 복구 가능

4. **build**
   - `npm run build` PASS
