# Movement Type Test - 공유 기능 설정 가이드

## 📋 개요

Movement Type Test 결과를 URL로 공유할 수 있는 기능이 추가되었습니다.

### 주요 기능
1. **URL 링크 복사** - 결과를 영구 저장하고 공유 가능한 링크 생성
2. **카카오톡 공유** - 카카오톡으로 직접 공유
3. **SNS 공유** - 트위터, 페이스북 공유
4. **모바일 네이티브 공유** - 스마트폰의 기본 공유 기능
5. **공유 통계** - 조회수 집계

---

## 🗄️ 1단계: 데이터베이스 설정

### Supabase 테이블 생성

```bash
# Supabase SQL Editor에서 실행
psql -h your-db-host -U postgres -d postgres -f supabase-setup/create-movement-test-results-table.sql
```

또는 Supabase Dashboard > SQL Editor에서 `supabase-setup/create-movement-test-results-table.sql` 파일 내용을 복사하여 실행하세요.

### 생성되는 테이블 구조

```sql
movement_test_results
├── id (UUID) - Primary Key
├── share_id (VARCHAR) - 공유용 8자리 짧은 ID
├── main_type (VARCHAR) - 메인 타입
├── sub_type (VARCHAR) - 서브타입
├── confidence (INTEGER) - 신뢰도
├── type_scores (JSONB) - 타입별 점수
├── imbalance_yes_count (INTEGER)
├── imbalance_severity (VARCHAR)
├── bias_main_type (VARCHAR)
├── completed_at (TIMESTAMP)
├── duration_seconds (INTEGER)
├── view_count (INTEGER) - 조회수
├── created_at (TIMESTAMP)
└── updated_at (TIMESTAMP)
```

---

## 🔑 2단계: 카카오톡 API 설정

### 1. 카카오 개발자 등록

1. [Kakao Developers](https://developers.kakao.com/) 접속
2. 내 애플리케이션 > 애플리케이션 추가하기
3. 앱 이름: "포스처랩 움직임 타입 테스트"
4. 사업자명: "포스처랩"

### 2. 플랫폼 등록

**내 애플리케이션 > 앱 설정 > 플랫폼**

**Web 플랫폼 추가:**
- 사이트 도메인: `http://localhost:3000` (개발)
- 사이트 도메인: `https://posturelab.com` (운영)

### 3. JavaScript 키 발급

**내 애플리케이션 > 앱 키 > JavaScript 키**

발급받은 키를 `.env.local` 파일에 추가:

```bash
NEXT_PUBLIC_KAKAO_JS_KEY=your_javascript_key_here
```

### 4. 카카오톡 공유 설정

**내 애플리케이션 > 제품 설정 > 카카오 로그인**

**Redirect URI 설정 (선택):**
- `http://localhost:3000/movement-test`
- `https://posturelab.com/movement-test`

**동의 항목 (필요 시):**
- 프로필 정보: 선택 동의
- 카카오톡 메시지 전송: 필수 동의

---

## 🌐 3단계: 환경 변수 설정

### `.env.local` 파일 업데이트

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Base URL (공유 링크용)
NEXT_PUBLIC_BASE_URL=http://localhost:3000  # 개발
# NEXT_PUBLIC_BASE_URL=https://posturelab.com  # 운영

# Kakao
NEXT_PUBLIC_KAKAO_JS_KEY=your_javascript_key_here
```

---

## 🎨 4단계: Open Graph 이미지 준비

### 공유 시 표시될 이미지 생성

**이미지 규격:**
- 크기: 1200x630px
- 형식: PNG 또는 JPG
- 위치: `/public/og-image-movement-test.png`

**이미지 내용 예시:**
```
┌─────────────────────────────────┐
│   움직임 타입 테스트            │
│                                  │
│   🏔️ 담직형  🌊 날림형          │
│   ⚡ 버팀형  💨 흘림형          │
│                                  │
│   10분으로 알아보는              │
│   나의 움직임 패턴               │
└─────────────────────────────────┘
```

---

## 🧪 5단계: 테스트

### 로컬 테스트

1. **개발 서버 실행:**
   ```bash
   npm run dev
   ```

2. **테스트 진행:**
   - http://localhost:3000/movement-test 접속
   - 테스트 완료 후 결과 페이지에서 "공유하기" 버튼 확인

3. **공유 링크 테스트:**
   - URL 복사 버튼 클릭
   - 새 시크릿 창에서 복사한 링크 접속
   - 결과가 정상적으로 표시되는지 확인

4. **카카오톡 공유 테스트:**
   - 카카오톡 버튼 클릭
   - 카카오톡 앱으로 이동
   - 메시지 미리보기 확인

---

## 📊 6단계: 통계 확인

### Supabase Dashboard에서 확인

```sql
-- 전체 공유 결과 수
SELECT COUNT(*) as total_results FROM movement_test_results;

-- 타입별 분포
SELECT main_type, COUNT(*) as count 
FROM movement_test_results 
GROUP BY main_type 
ORDER BY count DESC;

-- 가장 많이 조회된 결과
SELECT share_id, main_type, sub_type, view_count, created_at
FROM movement_test_results 
ORDER BY view_count DESC 
LIMIT 10;

-- 최근 공유된 결과
SELECT share_id, main_type, sub_type, created_at
FROM movement_test_results 
ORDER BY created_at DESC 
LIMIT 10;
```

---

## 🔒 보안 및 개인정보

### RLS (Row Level Security) 정책

- ✅ **읽기**: 누구나 공유된 결과 조회 가능
- ✅ **쓰기**: 누구나 새 결과 저장 가능 (익명)
- ❌ **삭제**: 불가능 (관리자만 가능)
- ❌ **수정**: view_count만 업데이트 가능

### 개인정보 보호

**저장되지 않는 정보:**
- ❌ 사용자 이름
- ❌ 이메일
- ❌ IP 주소
- ❌ 개별 질문 답변
- ❌ 사진

**저장되는 정보:**
- ✅ 테스트 결과 (타입, 점수)
- ✅ 완료 시간
- ✅ 소요 시간
- ✅ 조회수

---

## 🚀 배포 체크리스트

### Vercel 배포 시

1. **환경 변수 설정:**
   - Vercel Dashboard > Settings > Environment Variables
   - 모든 `NEXT_PUBLIC_*` 변수 추가

2. **도메인 설정:**
   - `NEXT_PUBLIC_BASE_URL=https://posturelab.com`

3. **카카오 플랫폼 업데이트:**
   - Kakao Developers > 플랫폼 > Web
   - 운영 도메인 추가: `https://posturelab.com`

4. **빌드 확인:**
   ```bash
   npm run build
   npm run start
   ```

---

## 📱 사용자 플로우

```
사용자가 테스트 완료
       ↓
결과 페이지 표시
       ↓
자동으로 DB 저장 (share_id 생성)
       ↓
공유 버튼 활성화
       ↓
사용자가 공유 버튼 클릭
       ↓
① URL 복사 → 클립보드에 저장
② 카카오톡 → 카카오톡 앱으로 공유
③ 트위터 → 트위터로 공유
④ 페이스북 → 페이스북으로 공유
       ↓
친구가 공유 링크 클릭
       ↓
/movement-test/shared/[shareId] 페이지 표시
       ↓
조회수 +1
       ↓
"나도 테스트하기" CTA 표시
```

---

## 🛠️ 트러블슈팅

### 카카오톡 공유가 안 돼요

**원인:**
- JavaScript 키가 설정되지 않음
- 플랫폼 도메인이 등록되지 않음
- SDK 초기화 실패

**해결:**
1. `.env.local` 파일에 `NEXT_PUBLIC_KAKAO_JS_KEY` 확인
2. Kakao Developers에서 플랫폼 도메인 확인
3. 브라우저 콘솔에서 `window.Kakao.isInitialized()` 확인

### 공유 링크가 404 에러

**원인:**
- DB에 저장 실패
- share_id가 생성되지 않음
- API 라우트 오류

**해결:**
1. Supabase 연결 확인
2. 브라우저 콘솔에서 API 오류 확인
3. `/api/movement-test/save-result` 응답 확인

### 공유된 결과가 안 보여요

**원인:**
- share_id가 잘못됨
- RLS 정책 오류
- 테이블이 생성되지 않음

**해결:**
1. URL의 share_id 확인
2. Supabase > Table Editor에서 데이터 확인
3. RLS 정책 확인

---

## 📞 지원

문제가 계속되면 다음을 확인하세요:

1. **Supabase 로그**: Supabase Dashboard > Logs
2. **Vercel 로그**: Vercel Dashboard > Deployments > Logs
3. **브라우저 콘솔**: F12 > Console
4. **Network 탭**: F12 > Network

---

## 🎉 완료!

공유 기능이 정상적으로 작동하면:
- ✅ 테스트 완료 후 자동으로 공유 버튼 표시
- ✅ 각 공유 방법이 정상 작동
- ✅ 공유된 링크로 결과 확인 가능
- ✅ 조회수 정상 집계
