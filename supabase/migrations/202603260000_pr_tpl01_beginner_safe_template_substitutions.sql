-- PR-TPL-01: beginner-safe template substitutions and copy refinement
-- 템플릿 ID 유지, 이름/설명/큐잉/주의문구만 교체
-- M16, M17, M18, M30, M48: 이름 교체
-- M42, M43: 설명/큐잉 보강 (short_cue, instructions, caution 컬럼 추가)
-- M29: 변경 없음

-- 1. short_cue, instructions, caution 컬럼 추가 (M42/M43용)
ALTER TABLE public.exercise_templates
  ADD COLUMN IF NOT EXISTS short_cue TEXT,
  ADD COLUMN IF NOT EXISTS instructions TEXT,
  ADD COLUMN IF NOT EXISTS caution TEXT;

COMMENT ON COLUMN public.exercise_templates.short_cue IS '짧은 큐잉 문구. 초보자 따라하기용';
COMMENT ON COLUMN public.exercise_templates.instructions IS '상세 수행 방법. 초보자용 설명';
COMMENT ON COLUMN public.exercise_templates.caution IS '주의 포인트. 흔한 실수 방지';

-- 2. M16: 스텝다운 → 벽 짚고 스플릿 스쿼트
UPDATE public.exercise_templates SET
  name = '벽 짚고 스플릿 스쿼트',
  short_cue = '벽을 가볍게 짚고, 몸을 아래로 천천히 내렸다가 앞발로 밀어 올라오세요.',
  instructions = '벽이나 의자를 한 손으로 가볍게 잡고 선다. 한 발은 앞에, 한 발은 뒤에 둔다. 몸통을 세운 채 양 무릎을 천천히 굽혀 아래로 내려간다. 가능한 범위까지 내려갔다가 앞발로 바닥을 밀며 올라온다.',
  caution = '앞무릎이 안쪽으로 무너지지 않게 한다. 몸통이 너무 앞으로 숙여지지 않게 한다. 깊이보다 균형과 천천한 움직임이 우선이다.'
WHERE id = 'M16';

-- 3. M17: 사이드 스텝 → 벽 짚고 스탠딩 힙 어브덕션
UPDATE public.exercise_templates SET
  name = '벽 짚고 스탠딩 힙 어브덕션',
  short_cue = '몸통은 세운 채, 다리만 옆으로 천천히 들어주세요.',
  instructions = '벽이나 의자를 한 손으로 가볍게 잡고 선다. 한쪽 다리를 무릎 편 상태로 옆으로 천천히 든다. 몸통이 기울지 않게 유지한다. 천천히 내린다.',
  caution = '다리를 높이 드는 것이 목적이 아니다. 골반이 따라 들리지 않게 한다. 발끝이 과하게 바깥으로 열리지 않게 한다.'
WHERE id = 'M17';

-- 4. M18: 숏풋 / 트라이포드 풋 → 양발 카프 레이즈
UPDATE public.exercise_templates SET
  name = '양발 카프 레이즈',
  short_cue = '발바닥으로 바닥을 밀며 뒤꿈치를 천천히 들어 올리세요.',
  instructions = '두 발로 선다. 발가락 쪽으로 체중을 보내며 뒤꿈치를 천천히 든다. 몸이 위로 길어지는 느낌을 만든다. 천천히 내려온다.',
  caution = '튕기지 않는다. 발목이 안/밖으로 흔들리지 않게 한다. 엄지발가락 쪽 접지도 유지한다.'
WHERE id = 'M18';

-- 5. M30: 레그 익스텐드 데드버그 → 쿼드러펫 숄더 탭
UPDATE public.exercise_templates SET
  name = '쿼드러펫 숄더 탭',
  short_cue = '몸통을 고정한 채 반대 어깨를 천천히 터치하세요.',
  instructions = '사각자세를 만든다. 오른손으로 왼쪽 어깨를 터치하고 돌아온다. 왼손으로 오른쪽 어깨를 터치한다. 좌우 번갈아 반복한다.',
  caution = '몸통이 좌우로 흔들리지 않게 한다. 골반이 돌아가지 않게 한다. 급하게 치지 않는다.'
WHERE id = 'M30';

-- 6. M42: 하프 니링 힙 쉬프트 - 설명/큐잉 보강 (이름 유지)
UPDATE public.exercise_templates SET
  short_cue = '몸통은 세운 채, 골반만 작게 옆으로 이동해보세요.',
  instructions = '한쪽 무릎은 바닥, 반대쪽 발은 앞에 둔 하프니링 자세를 만든다. 몸통을 세우고 골반이 정면을 보게 한다. 골반을 아주 조금 옆으로 또는 앞쪽으로 이동해 고관절 주변의 당김/압박 지점을 찾는다. 큰 동작이 아니라 작은 조절 동작으로 수행한다.',
  caution = '몸통을 크게 기울이지 않는다. 허리를 젖혀서 보상하지 않는다. 통증이 나는 방향으로 강하게 밀지 않는다.'
WHERE id = 'M42';

-- 7. M43: 90/90 힙 스위치 - 설명/큐잉 보강 (이름 유지)
UPDATE public.exercise_templates SET
  short_cue = '손으로 가볍게 지지하고, 무릎을 천천히 반대쪽으로 넘겨주세요.',
  instructions = '바닥에 앉아 양 무릎을 굽힌다. 한쪽으로 무릎을 넘겨 앞뒤 다리가 90/90 비슷한 모양이 되게 만든다. 손을 뒤에 짚어도 된다. 양 무릎을 천천히 반대쪽으로 넘겨 반대 90/90 자세를 만든다. 좌우로 번갈아 반복한다.',
  caution = '무릎을 억지로 누르지 않는다. 허리를 심하게 말지 않는다. 속도를 빠르게 하지 않는다.'
WHERE id = 'M43';

-- 8. M48: 밴드 풀어파트 → 스탠딩 W 리트랙션 (장비 없음: bodyweight)
UPDATE public.exercise_templates SET
  name = '스탠딩 W 리트랙션',
  equipment = ARRAY['bodyweight'],
  short_cue = '어깨를 내리고, 팔꿈치를 뒤로 당기며 등 뒤를 가볍게 모아주세요.',
  instructions = '두 발로 선다. 팔꿈치를 90도로 굽혀 몸 옆에서 W 모양을 만든다. 어깨를 내린 채 팔꿈치를 뒤로 살짝 당긴다. 날개뼈가 등 뒤로 부드럽게 모이는 느낌을 만든다. 잠깐 멈췄다가 돌아온다.',
  caution = '허리를 젖혀 가슴을 과하게 내밀지 않는다. 어깨를 으쓱하지 않는다. 팔만 뒤로 젖히지 않는다.'
WHERE id = 'M48';
