-- 테스트 데이터 추가
-- Supabase Dashboard → SQL Editor에서 실행하세요

-- 테스트 이미지 URL (Unsplash 무료 이미지)
INSERT INTO requests (
  user_id,
  front_url,
  side_url,
  status
) VALUES (
  'test-user-001',
  'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=600&fit=crop',
  'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=400&h=600&fit=crop',
  'pending'
);

-- 확인
SELECT * FROM requests ORDER BY created_at DESC LIMIT 5;
