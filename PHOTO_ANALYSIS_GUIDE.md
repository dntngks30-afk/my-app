# 사진 분석 시스템 가이드

## 📌 개요

사진 기반 체형 분석 시스템이 구현되었습니다.
이 시스템은 **의학 진단이 아닌 운동·체형 교정 관점**의 분석만 수행합니다.

---

## 🎯 구현된 기능

### 1. 사진 분석 API (`/api/analyze-photo`)
- OpenAI GPT-4 Vision API를 사용하여 사진 분석
- 사진 품질 체크 (5가지 기준)
- 체형 특징 관찰 및 설명
- 불확실성 명시
- 교정운동 방향 제안

### 2. 새로운 PDF 생성기
- `PhotoAnalysisReportPDF`: 사진 분석 결과를 PDF로 변환
- 조건부 표현 사용 ("~로 보일 수 있습니다")
- 분석 한계 명시
- 재촬영 가이드 포함

---

## 🔧 설정

### 1. OpenAI API 키 설정

`.env.local` 파일에 OpenAI API 키를 추가하세요:

```env
OPENAI_API_KEY=sk-your-actual-api-key-here
```

**⚠️ 중요**: `placeholder-key`를 실제 OpenAI API 키로 교체해야 합니다!

### 2. OpenAI API 키 발급

1. https://platform.openai.com 접속
2. 로그인 후 "API keys" 메뉴 선택
3. "Create new secret key" 클릭
4. 생성된 키를 복사하여 `.env.local`에 붙여넣기

---

## 💻 사용 방법

### API 호출 예시

```typescript
// 사진 분석 요청
const response = await fetch('/api/analyze-photo', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    frontPhotoUrl: 'https://your-supabase-url/storage/...',
    sidePhotoUrl: 'https://your-supabase-url/storage/...',
    surveyData: {
      // 선택적: 설문 데이터 포함
      discomfort: ['목', '어깨'],
      exerciseExperience: '없음',
    },
  }),
});

const result = await response.json();

if (result.success) {
  const analysis = result.analysis;
  
  // 분석 가능 여부 확인
  if (analysis.qualityCheck.canAnalyze) {
    // 관찰 결과 사용
    analysis.analysis.observations.forEach(obs => {
      console.log(`${obs.area}: ${obs.finding}`);
    });
  } else {
    // 재촬영 가이드 표시
    analysis.recommendations.retakeSuggestions.forEach(suggestion => {
      console.log(suggestion);
    });
  }
}
```

### PDF 생성 예시

```typescript
import { renderToBuffer } from '@react-pdf/renderer';
import { PhotoAnalysisReportPDF } from '@/lib/pdf-generator';

// 분석 결과를 PDF로 변환
const pdfBuffer = await renderToBuffer(
  <PhotoAnalysisReportPDF
    analysis={analysisResult}
    userEmail="user@example.com"
    userName="홍길동"
    photoUrls={{
      front: frontPhotoUrl,
      side: sidePhotoUrl,
    }}
  />
);

// Supabase Storage에 업로드
const { data, error } = await supabase.storage
  .from('assessments')
  .upload(`reports/${Date.now()}.pdf`, pdfBuffer, {
    contentType: 'application/pdf',
  });
```

---

## 📋 분석 프롬프트 규칙

### 절대 규칙 (위반 금지)
- ❌ "문제입니다 / 이상입니다 / 치료가 필요합니다" 사용 금지
- ❌ 진단, 병명, 통증 원인 단정 금지
- ✅ 항상 조건부·경향성 표현 사용
- ✅ 분석 불가 시, 억지로 분석하지 말 것

### 표현 가이드
| ❌ 피해야 할 표현 | ✅ 사용해야 할 표현 |
|---|---|
| "거북목이 있습니다" | "거북목 경향이 관찰됩니다" |
| "골반이 틀어져 있습니다" | "골반 기울기가 보일 수 있습니다" |
| "치료가 필요합니다" | "전문가 상담을 권장합니다" |
| "문제가 있습니다" | "참고가 필요할 수 있습니다" |

---

## 🔄 통합 평가 페이지 업데이트

`/full-assessment` 페이지에서 사진 분석 기능을 사용하려면:

```typescript
// src/app/full-assessment/page.tsx

const handleSubmit = async () => {
  // 1. 사진 업로드
  const frontUrl = await uploadPhoto(frontPhoto, 'front');
  const sideUrl = await uploadPhoto(sidePhoto, 'side');

  // 2. 사진 분석
  const analysisResponse = await fetch('/api/analyze-photo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      frontPhotoUrl: frontUrl,
      sidePhotoUrl: sideUrl,
      surveyData: responses,
    }),
  });

  const { success, analysis } = await analysisResponse.json();

  // 3. PDF 생성 및 이메일 발송
  if (success && analysis.qualityCheck.canAnalyze) {
    // PDF 생성 로직 (서버에서 처리)
    const pdfResponse = await fetch('/api/generate-photo-report', {
      method: 'POST',
      body: JSON.stringify({
        analysis,
        email,
        name,
        photoUrls: { front: frontUrl, side: sideUrl },
      }),
    });
  }
};
```

---

## 📊 분석 결과 구조

```typescript
{
  "qualityCheck": {
    "canAnalyze": true,
    "passedChecks": 5,
    "totalChecks": 5,
    "issues": []
  },
  "analysis": {
    "observations": [
      {
        "area": "목/경추",
        "finding": "머리가 중심선보다 앞쪽에 위치한 경향이 관찰됩니다",
        "visualEvidence": "귀의 위치가 어깨선보다 앞쪽에 있습니다",
        "functionalImpact": "장시간 앉아있을 때 목 부위의 피로감이 나타날 수 있습니다"
      }
    ],
    "summary": "전반적으로 상체가 전방으로 기울어진 경향이 관찰됩니다..."
  },
  "recommendations": {
    "exercises": [
      "목 심부 굴곡근 활성화 운동",
      "흉추 신전 가동성 운동",
      "견갑골 후인 운동"
    ],
    "retakeSuggestions": []
  },
  "disclaimer": "본 분석은 단일 사진을 기반으로..."
}
```

---

## 🚀 다음 단계

1. **OpenAI API 키 발급 및 설정**
2. **개발 서버 재시작**: `npm run dev`
3. **테스트 사진으로 API 테스트**
4. **통합 평가 페이지에 기능 추가**
5. **사용자 플로우 테스트**

---

## 💰 비용 참고

OpenAI GPT-4 Vision API 비용:
- GPT-4o: 약 $0.01 ~ $0.03 / 이미지 (해상도에 따라)
- 월 100건 분석 시: 약 $1 ~ $3

**권장**: 프로덕션 환경에서는 분석 결과를 캐싱하여 비용 절감

---

## ❓ 문제 해결

### Q: "OPENAI_API_KEY가 설정되지 않았습니다" 에러
**A**: `.env.local` 파일에 실제 OpenAI API 키를 설정하고 개발 서버를 재시작하세요.

### Q: 분석 결과가 너무 단정적입니다
**A**: `postureAnalysisPrompt.ts` 파일에서 프롬프트를 수정하여 더 조건부적인 표현을 강조하세요.

### Q: 사진 품질 체크가 너무 엄격합니다
**A**: `postureAnalysisPrompt.ts`의 `MODULE 1` 섹션에서 PASS 기준을 조정하세요 (현재: 4개 이상).

---

## 📚 관련 파일

- `/src/lib/prompts/postureAnalysisPrompt.ts` - 분석 프롬프트
- `/src/app/api/analyze-photo/route.ts` - 분석 API
- `/src/lib/pdf-generator.tsx` - PDF 생성기 (`PhotoAnalysisReportPDF`)
- `.env.local` - 환경 변수 설정

---

**구현 완료!** 이제 사진 기반 체형 분석 시스템을 사용할 수 있습니다. 🎉
