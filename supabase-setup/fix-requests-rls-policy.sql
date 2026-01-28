-- requests 테이블 RLS 정책 수정
-- Supabase Dashboard → SQL Editor에서 실행하세요

-- 1. 기존 정책 모두 삭제 (있다면)
DROP POLICY IF EXISTS "Anyone can insert requests" ON requests;
DROP POLICY IF EXISTS "Anyone can read requests" ON requests;
DROP POLICY IF EXISTS "Users can insert own requests" ON requests;
DROP POLICY IF EXISTS "Users can read own requests" ON requests;
DROP POLICY IF EXISTS "Admins can read all requests" ON requests;

-- 2. RLS 활성화 (이미 되어있을 수 있음)
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;

-- 3. 모든 사용자가 INSERT 가능하도록 설정 (익명 포함)
CREATE POLICY "Anyone can insert requests"
ON requests
FOR INSERT
TO public
WITH CHECK (true);

-- 4. 모든 사용자가 자신의 데이터 읽기 가능
CREATE POLICY "Users can read own requests"
ON requests
FOR SELECT
TO public
USING (true);

-- 5. 모든 사용자가 자신의 데이터 업데이트 가능
CREATE POLICY "Users can update own requests"
ON requests
FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

-- 6. 확인: 정책 목록 보기
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'requests';

-- 7. 테스트: 간단한 INSERT 시도
INSERT INTO requests (user_id, status)
VALUES ('test-policy-check', 'pending');

-- 8. 확인 후 테스트 데이터 삭제
DELETE FROM requests WHERE user_id = 'test-policy-check';

SELECT '✅ RLS 정책이 성공적으로 설정되었습니다!' as message;
