# SEO 설정 가이드

## ✅ 완료된 작업

### 1. 메타데이터 최적화
- **제목**: "사진 2장으로 끝내는 맞춤 체형 교정 | NASM 전문가 솔루션"
- **설명**: 거북목, 라운드숄더 등 핵심 키워드 포함
- **키워드**: 14개 핵심 검색어 설정

### 2. Open Graph 설정 (소셜 미디어 공유)
- 카카오톡, 페이스북, 트위터 공유 최적화
- 1200x630 이미지 메타데이터 설정
- 한국어(ko_KR) 로케일 설정

### 3. 구조화된 데이터 (JSON-LD)
- Schema.org 마크업 추가
- ProfessionalService 타입
- 3가지 플랜 정보 포함
- 평점 및 리뷰 수 표시

### 4. 사이트맵 (sitemap.xml)
- 자동 생성 설정 (`/src/app/sitemap.ts`)
- 주요 페이지 6개 포함
- 우선순위 및 업데이트 빈도 설정

### 5. Robots.txt
- 검색엔진 크롤링 허용
- Admin 페이지 크롤링 차단
- Sitemap 위치 명시

---

## 🚀 다음 단계 (필수)

### 1. Open Graph 이미지 생성 ⚠️
**현재 상태**: 이미지 파일이 아직 없음

**작업 필요**:
```bash
/public/og-image.jpg
```

**가이드**: `/public/OG_IMAGE_GUIDE.md` 참조

**빠른 생성 방법**:
1. Canva.com에서 1200x630 크기 선택
2. 다크 배경 + 오렌지 포인트 색상 사용
3. 텍스트: "사진 2장으로 끝내는 맞춤 체형 교정"
4. NASM 로고 또는 자격증 아이콘 추가
5. `og-image.jpg`로 저장 후 `/public/` 폴더에 업로드

### 2. 환경변수 설정
`.env.local` 파일에 다음 추가:
```bash
NEXT_PUBLIC_BASE_URL=http://localhost:3000  # 로컬 개발
# 또는
NEXT_PUBLIC_BASE_URL=https://your-domain.com  # 프로덕션
```

### 3. Google Search Console 등록
1. https://search.google.com/search-console 접속
2. 사이트 추가
3. 소유권 확인 코드 받기
4. `layout.tsx`의 `verification.google` 값 업데이트

### 4. 네이버 검색엔진 등록
1. https://searchadvisor.naver.com 접속
2. 사이트 등록
3. 소유권 확인

---

## 📊 테스트 체크리스트

### 로컬 테스트
- [ ] `npm run dev` 실행
- [ ] 브라우저에서 페이지 소스 보기 (Ctrl+U)
- [ ] `<title>` 태그 확인
- [ ] `<meta property="og:...">` 태그들 확인

### Open Graph 테스트
- [ ] [카카오톡 디버거](https://developers.kakao.com/tool/debugger/sharing)
- [ ] [Facebook 디버거](https://developers.facebook.com/tools/debug/)
- [ ] [Twitter Card 검증](https://cards-dev.twitter.com/validator)
- [ ] [LinkedIn 검증](https://www.linkedin.com/post-inspector/)

### 검색엔진 테스트
- [ ] Google: `site:your-domain.com` 검색
- [ ] 네이버: `site:your-domain.com` 검색
- [ ] Rich Results Test: https://search.google.com/test/rich-results

### 모바일 테스트
- [ ] [Google Mobile-Friendly Test](https://search.google.com/test/mobile-friendly)
- [ ] [PageSpeed Insights](https://pagespeed.web.dev/)

---

## 🎯 핵심 키워드 전략

### 메인 키워드 (높은 우선순위)
- 체형 교정
- 거북목 교정
- 라운드숄더
- 자세 교정
- 교정 운동

### 롱테일 키워드
- NASM 체형 교정
- 온라인 체형 분석
- 맞춤 교정 운동
- 24시간 체형 분석
- 사진으로 체형 교정

### 지역 키워드 (추가 가능)
- 서울 체형 교정
- 강남 자세 교정
- 온라인 PT 추천

---

## 📈 성과 측정

### Google Analytics 설정 (선택)
```typescript
// src/app/layout.tsx에 추가
<Script
  src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"
  strategy="afterInteractive"
/>
```

### Google Search Console 모니터링
- 클릭수 및 노출수
- 평균 게재순위
- CTR (클릭률)
- 검색 쿼리 분석

### 목표 설정
- 1주차: 사이트맵 인덱싱 완료
- 2주차: 주요 키워드 50위권 진입
- 1개월: "체형 교정" 검색 시 1~2페이지 노출
- 3개월: 오가닉 트래픽 100명/일 달성

---

## 🔧 추가 최적화 (선택사항)

### 1. 블로그 섹션 추가
SEO를 위한 콘텐츠 마케팅:
- "거북목 자가진단 방법"
- "라운드숄더 원인과 해결법"
- "집에서 할 수 있는 체형 교정 운동"

### 2. FAQ 섹션
구조화된 데이터로 FAQ 추가하면 Google 검색결과에 확장 표시 가능

### 3. 리뷰 시스템
실제 고객 리뷰를 구조화된 데이터로 추가하면 별점이 검색결과에 노출

### 4. AMP (Accelerated Mobile Pages)
모바일 로딩 속도 개선

### 5. 다국어 지원
`hreflang` 태그로 영어 버전 추가 시 해외 시장 진출 가능

---

## 📝 주의사항

### 하지 말아야 할 것
- ❌ 키워드 스터핑 (과도한 키워드 반복)
- ❌ 숨겨진 텍스트
- ❌ 중복 콘텐츠
- ❌ 부적절한 리다이렉트
- ❌ 자동 생성 콘텐츠

### 해야 할 것
- ✅ 양질의 콘텐츠 제공
- ✅ 빠른 로딩 속도 유지
- ✅ 모바일 친화적 디자인
- ✅ 정기적인 콘텐츠 업데이트
- ✅ 백링크 확보

---

## 📞 지원

문제 발생 시:
1. 이 문서의 체크리스트 확인
2. Google Search Console 에러 확인
3. 브라우저 개발자 도구 Console 확인

## 참고 자료
- [Google SEO 가이드](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)
- [Next.js Metadata 문서](https://nextjs.org/docs/app/building-your-application/optimizing/metadata)
- [Schema.org 마크업 가이드](https://schema.org/docs/gs.html)
