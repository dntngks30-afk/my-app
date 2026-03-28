# PR-ROLLBACK-DB66414-TO-MAIN-BASELINE

## 상태 라벨

- **CURRENT_IMPLEMENTED**: `main` 대비 `db66414` 이후 카메라 관련 변경 전부 되돌림(본 PR).
- **LOCKED_DIRECTION**: 회복 목적은 **db66414 스냅샷과 동일한 카메라 트리** — 이 PR에서 임계/래치/진단을 다시 손대지 않음.

## 왜 롤백인가

- 최근 `main`에서 스쿼트(깊은/얕은) 통과·GREEN·자동 진행이 불안정해졌다는 런타임 피드백.
- 본 PR은 **추가 수정 없이** 마지막으로 신뢰된 코드 상태로 되돌려 재검증하기 위한 **베이스라인 복구**다.

## 왜 베이스라인이 db66414인가

- 커밋 **`db664144107f72ef73c5cf0cd97540b1a0ccf349`** (`feat(camera): add shallow squat event-cycle completion owner`)를 제품 측에서 “마지막으로 정상 동작했던” 기준으로 지정함.
- 이 커밋 **이후**에만 적용되었던 변경을 역으로 적용해, 카메라 경로를 해당 시점과 동일하게 맞춤.

## 되돌린 커밋 범위 (시간 역순 · `db66414..HEAD`였던 것)

다음은 롤백 직전 `main`에서 `db66414` 다음에 있던 커밋들이다(본 PR에서 revert됨):

1. `c076a62` — fix(camera): prioritize squat success latch over settle ordering  
2. `f807108` — fix(camera): restore squat pass-to-latch diagnostics and export visibility  
3. `e08d1a4` — fix(camera): slightly relax low-band standing recovery threshold…  
4. `3560e08` — fix(camera): align ultra low-rom guarded finalize entry…  
5. `cab2f75` — fix(camera): align low-rom standing finalize drop proof…  
6. `120f450` — fix(camera): rollback 04e5 owner routing while keeping primary observability  
7. `80b2b1b` — fix(camera): debounce shallow squat success UI before latch  
8. `9f9f7cd` — feat(camera): smooth pose overlay rendering…  
9. `7917245` — fix(camera): stabilize squat primary geometry before low-rom fallback  
10. `e385b0e` — fix(camera): strengthen shallow squat low-rom cycle truth  

## 구현 방식

- 브랜치: `revert/rollback-to-db66414-camera-baseline`
- 명령: `git revert --no-commit db664144107f72ef73c5cf0cd97540b1a0ccf349..HEAD`  
- 충돌 없음. 복구 원칙에 따라 **db66414와의 차이**는 본 PR 문서 추가만 해당.

## 카메라 트리 동치 확인

롤백 후(본 문서 추가 전 기준) 다음이 **차이 없음**(빈 출력):

```bash
git diff --name-only db664144107f72ef73c5cf0cd97540b1a0ccf349 -- \
  src/lib/camera src/app/movement-test/camera src/components/camera scripts
```

## 머지 후 재검증(수동 · 문서만)

- 실기기: 깊은 스쿼트 통과  
- 실기기: 얕은 스쿼트 통과  
- PASS → GREEN → 다음 단계 전환  
- 성공 스냅샷 / export 동작(해당 시점 제품에 존재하는 경우)

## 자동 검증(실행함)

- `npx tsx scripts/camera-pr-04e3b-squat-event-cycle-owner-smoke.mjs` — 통과  
- `npx tsx scripts/camera-pr7-squat-completion-quality-split-smoke.mjs` — 통과  
- `npm run build` — 통과  

## 리스크 / 후속

- `db66414` 이후 문서·스모크 스크립트는 제거됨 — 필요 시 별도 PR로 문서만 복원 가능.  
- 이후 개선은 **이 베이스에서 다시 작은 PR**로 진행하는 것을 권장.
