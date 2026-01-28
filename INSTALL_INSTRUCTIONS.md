# PDF 자동 생성 시스템 설치 가이드

## 📦 필요한 패키지 설치

관리자 페이지의 PDF 자동 생성 기능을 사용하려면 다음 패키지를 설치해야 합니다:

```bash
npm install jspdf html2canvas
```

또는

```bash
npm install jspdf html2canvas --legacy-peer-deps
```

## 🎯 기능 설명

### 1. 자동 PDF 생성 시스템
- 관리자가 체크박스만 선택하면 전문적인 교정운동 PDF가 자동 생성됩니다
- 사진이 자동으로 PDF에 배치됩니다
- 진단별로 맞춤형 운동 프로그램이 자동 생성됩니다

### 2. 지원하는 진단 항목
- 거북목 (Forward Head)
- 라운드숄더 (Rounded Shoulder)
- 상완골 전방활주 (Anterior Humerus)
- 골반 전방경사 (Anterior Pelvic Tilt)
- 골반 후방경사 (Posterior Pelvic Tilt)

### 3. 심각도 선택
각 진단 항목마다 4단계 심각도를 선택할 수 있습니다:
- 정상
- 경미
- 중등도
- 심함

### 4. 자동 생성되는 PDF 내용
- 표지 (고객명, 날짜)
- 사진 분석 (정면/측면)
- 진단 결과
- 4단계 교정운동 프로그램
  - 1단계: 억제 (Inhibit) - 폼롤링/마사지
  - 2단계: 신장 (Lengthen) - 스트레칭
  - 3단계: 활성화 (Activate) - 근력 강화
  - 4단계: 통합 (Integrate) - 기능적 운동
- 운동 가이드

## 🚀 사용 방법

1. 관리자 페이지 접속 (`/admin`)
2. 왼쪽에서 분석할 요청 선택
3. 사진 확인
4. 오른쪽에서 해당하는 진단 항목 체크
5. "PDF 자동 생성" 버튼 클릭
6. PDF가 자동으로 다운로드됩니다!

## 💡 특징

- ✅ 체크박스만 선택하면 끝!
- ✅ 진단별 전문 운동 프로그램 자동 배정
- ✅ NASM-CES 기반 과학적 운동 처방
- ✅ 깔끔한 PDF 레이아웃
- ✅ 사진 자동 배치
- ✅ 운동별 세트/횟수/설명 포함

## 🛠️ 문제 해결

### 패키지 설치 오류 시
```bash
npm install jspdf@latest html2canvas@latest --force
```

### 빌드 오류 시
```bash
npm run build
```

로컬에서 먼저 테스트 후 배포하세요.
