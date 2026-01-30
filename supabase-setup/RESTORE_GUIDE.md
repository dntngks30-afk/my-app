# Supabase 데이터베이스 복구 가이드

## 🚨 긴급 복구 시 사용 방법

### 전체 복구 (추천)

1. **Storage Bucket 생성** (UI에서 수동)
   - `user-photos` (Public: Yes)
   - `assessments` (Public: Yes)

2. **SQL 실행** (Supabase SQL Editor)
   ```
   RESTORE_FINAL.sql 전체 실행
   ```

---

## 📝 단계별 복구

### Step 1: 테이블 생성
- users, requests, payments, assessments, solutions

### Step 2: Functions & Triggers
- delete_expired_assessments()
- handle_new_user()

### Step 3: RLS 정책
- 모든 테이블에 Row Level Security 적용
- **주의**: requests 테이블의 user_id는 TEXT 타입!

### Step 4: Storage 정책
- user-photos bucket
- assessments bucket

### Step 5: 관리자 설정
- 이메일 주소를 실제 관리자 이메일로 변경

---

## ⚠️ 중요 사항

### 타입 불일치 주의
- `requests.user_id`: **TEXT**
- 다른 테이블 `user_id`: **UUID**
- RLS 정책에서 `auth.uid()::text` 캐스팅 필요!

### Storage Bucket
- SQL로 생성 시 타입 에러 발생 가능
- **UI에서 수동 생성 권장**

---

## 🧪 복구 후 테스트

```bash
npm run dev
```

1. 회원가입/로그인
2. 설문 제출 → PDF 생성
3. 사진 업로드
4. 관리자 페이지 접근

---

## 📞 문제 발생 시

### "operator does not exist" 에러
→ 타입 캐스팅 확인 (`auth.uid()::text`)

### Storage 업로드 실패
→ Bucket Public 설정 및 RLS 정책 확인

### 관리자 페이지 접근 불가
→ Step 5 관리자 설정 재실행
