# PDF 한글 지원 및 이미지 추가 가이드

## 문제점
- jsPDF는 기본적으로 한글을 지원하지 않습니다
- 한글이 깨져서 외계어로 표시됩니다
- 인체 그림을 추가하려면 별도 작업 필요

## 해결 방법

### 방법 1: 한글 폰트 Base64 인코딩 (복잡함)
1. 한글 폰트 파일을 Base64로 변환
2. jsPDF에 등록
3. 파일 크기 증가 (수 MB)

### 방법 2: pdfmake 사용 (추천!)
더 나은 한글 지원과 레이아웃 기능 제공

```bash
npm uninstall jspdf html2canvas
npm install pdfmake
```

### 방법 3: 서버 사이드 PDF 생성 (가장 전문적)
- Puppeteer 또는 Playwright 사용
- HTML을 PDF로 변환
- 완벽한 한글 지원
- 복잡한 레이아웃 가능

## 임시 해결책: 영어 + 간단한 한글

현재 코드를 수정하여:
1. 주요 내용은 영어로 표시
2. 간단한 한글은 이미지로 변환
3. 인체 그림은 외부 URL 이미지 사용

## 빠른 수정

### 1. 패키지 설치
```bash
npm install pdfmake
npm install --save-dev @types/pdfmake
```

### 2. 한글 폰트 다운로드
- Noto Sans KR (무료)
- https://fonts.google.com/noto/specimen/Noto+Sans+KR

### 3. 코드 재작성 필요
pdfmake는 jsPDF와 API가 완전히 다릅니다.

## 추천: HTML → PDF 변환

가장 쉬운 방법:
1. HTML로 리포트 페이지 작성
2. Puppeteer로 PDF 변환
3. 완벽한 한글 지원
4. CSS로 디자인 가능
