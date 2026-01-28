# Open Graph 이미지 가이드

## 필요한 이미지

메타데이터에서 사용하는 소셜 미디어 공유 이미지를 생성해주세요.

### 1. og-image.jpg
- **위치**: `/public/og-image.jpg`
- **크기**: 1200 x 630px
- **형식**: JPG 또는 PNG
- **용도**: 카카오톡, 페이스북, 트위터 등 SNS 공유 시 표시되는 썸네일

#### 디자인 가이드라인:
- **배경**: 다크 네이비 (#0f172a) 그라데이션
- **메인 텍스트**: "사진 2장으로 끝내는 맞춤 체형 교정"
- **서브 텍스트**: "NASM-CES 전문가의 24시간 맞춤 솔루션"
- **로고**: NASM-CES 자격증 로고 포함
- **포인트 컬러**: 오렌지 (#f97316)
- **요소**:
  - 체형 분석 아이콘/일러스트
  - 전문가 인증 배지
  - 별점 또는 신뢰 지표

### 2. logo.png (선택사항)
- **위치**: `/public/logo.png`
- **크기**: 500 x 500px (정사각형)
- **형식**: PNG (투명 배경)
- **용도**: 구조화된 데이터의 브랜드 로고

## 임시 이미지 생성 방법

### 옵션 1: Canva 사용
1. Canva.com 접속
2. "1200 x 630" 사이즈 선택
3. 위 가이드라인에 따라 디자인
4. `og-image.jpg`로 다운로드하여 `/public/` 폴더에 저장

### 옵션 2: Figma 사용
1. 1200 x 630 프레임 생성
2. 다크 테마 + 오렌지 포인트로 디자인
3. Export as JPG

### 옵션 3: 온라인 도구
- https://www.ogimage.io/
- https://metatags.io/
- https://www.opengraph.xyz/

## 테스트 방법

이미지를 업로드한 후 다음 도구로 테스트:

1. **카카오톡 공유 미리보기**:
   - https://developers.kakao.com/tool/debugger/sharing

2. **페이스북 공유 디버거**:
   - https://developers.facebook.com/tools/debug/

3. **트위터 카드 검증**:
   - https://cards-dev.twitter.com/validator

4. **LinkedIn 검증**:
   - https://www.linkedin.com/post-inspector/

## 현재 상태

⚠️ **og-image.jpg 파일이 아직 생성되지 않았습니다.**

메타데이터는 이미 설정되어 있지만, 실제 이미지 파일을 생성하여 `/public/og-image.jpg` 경로에 배치해야 합니다.

임시로 빠르게 테스트하려면:
1. 온라인 도구를 사용하거나
2. Canva의 "Facebook Post" 템플릿 사용
3. 위 가이드라인대로 텍스트 추가
4. 다운로드 후 파일명을 `og-image.jpg`로 변경

## 체크리스트

- [ ] og-image.jpg (1200x630) 생성
- [ ] /public/ 폴더에 업로드
- [ ] 카카오톡 공유 테스트
- [ ] 페이스북 공유 테스트
- [ ] 실제 URL로 메타태그 확인
