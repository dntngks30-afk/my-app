-- 빠른 수정: requests 테이블 RLS 정책
-- 복사해서 Supabase SQL Editor에 붙여넣고 실행하세요!

-- 기존 정책 삭제
DROP POLICY IF EXISTS "Anyone can insert requests" ON requests;
DROP POLICY IF EXISTS "Users can read own requests" ON requests;
DROP POLICY IF EXISTS "Users can update own requests" ON requests;

-- 새 정책 생성: 누구나 INSERT, SELECT, UPDATE 가능
CREATE POLICY "Anyone can insert requests"
ON requests FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Users can read own requests"
ON requests FOR SELECT TO public USING (true);

CREATE POLICY "Users can update own requests"
ON requests FOR UPDATE TO public USING (true) WITH CHECK (true);

-- 완료!
SELECT '✅ 완료! 이제 사진 업로드가 가능합니다.' as result;
