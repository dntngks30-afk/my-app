# Storage Bucket 수동 생성 가이드

SQL로 Storage Bucket을 생성할 때 타입 에러가 발생할 수 있습니다.
**UI에서 수동으로 생성하는 것을 권장합니다.**

## 📦 생성할 Bucket 2개

### 1️⃣ user-photos
- **이름**: `user-photos`
- **Public**: ✅ Yes
- **용도**: 사용자가 업로드한 전면/측면 사진

### 2️⃣ assessments
- **이름**: `assessments`
- **Public**: ✅ Yes
- **용도**: 설문 분석 결과 PDF 파일

---

## 🚀 생성 방법

1. Supabase Dashboard → **Storage** 메뉴
2. **New bucket** 클릭
3. Name 입력, **Public bucket** 체크
4. **Create bucket** 클릭
5. 위 과정을 2번 반복 (user-photos, assessments)

---

## 🔐 Storage Policy 설정 (SQL)

Bucket 생성 후, 아래 SQL을 **별도로 실행**하세요:

```sql
-- user-photos policies
DROP POLICY IF EXISTS "Anyone can upload to user-photos" ON storage.objects;
CREATE POLICY "Anyone can upload to user-photos" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'user-photos');

DROP POLICY IF EXISTS "Anyone can read user-photos" ON storage.objects;
CREATE POLICY "Anyone can read user-photos" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'user-photos');

-- assessments policies
DROP POLICY IF EXISTS "Anyone can upload to assessments" ON storage.objects;
CREATE POLICY "Anyone can upload to assessments" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'assessments');

DROP POLICY IF EXISTS "Anyone can read assessments" ON storage.objects;
CREATE POLICY "Anyone can read assessments" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'assessments');
```

---

✅ **완료되면**: 설문 제출 시 PDF가 정상적으로 저장됩니다!
