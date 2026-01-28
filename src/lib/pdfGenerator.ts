// PDF 자동 생성 라이브러리
// 관리자가 체크박스만 선택하면 전문적인 교정운동 PDF를 자동 생성합니다.

import jsPDF from 'jspdf';

/**
 * 이미지 URL을 base64로 변환하는 헬퍼 함수
 */
async function urlToBase64(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('이미지 로드 실패:', error);
    throw error;
  }
}

// 진단 항목 타입
export interface DiagnosisData {
  // 거북목
  forwardHead: 'none' | 'mild' | 'moderate' | 'severe';
  // 라운드숄더
  roundedShoulder: 'none' | 'mild' | 'moderate' | 'severe';
  // 상완골 전방활주
  anteriorHumerus: 'none' | 'mild' | 'moderate' | 'severe';
  // 골반 전방경사
  anteriorPelvicTilt: 'none' | 'mild' | 'moderate' | 'severe';
  // 골반 후방경사
  posteriorPelvicTilt: 'none' | 'mild' | 'moderate' | 'severe';
}

// 운동 데이터베이스 (진단별 자동 운동 처방)
const exerciseDatabase = {
  forwardHead: {
    inhibit: [
      { name: '상부승모근 폼롤링', sets: 3, duration: '30초', description: 'SMR 기법으로 과긴장 해소' },
      { name: '후두하근 마사지볼', sets: 2, duration: '60초', description: '두개골 기저부 이완' },
    ],
    lengthen: [
      { name: '흉쇄유돌근 스트레칭', sets: 3, duration: '30초', description: '목 측면 근육 신장' },
      { name: '경추 신전 스트레칭', sets: 3, duration: '20초', description: '목 앞쪽 근육 늘리기' },
    ],
    activate: [
      { name: '심부경추굴곡근 운동', sets: 3, reps: 10, description: '턱 당기기 운동으로 목 안쪽 근육 강화' },
      { name: '하부승모근 Y레이즈', sets: 3, reps: 12, description: '견갑골 하강근 활성화' },
    ],
    integrate: [
      { name: '월 엔젤', sets: 3, reps: 10, description: '올바른 자세에서 견갑골 움직임 통합' },
      { name: '데드버그', sets: 3, reps: 10, description: '코어 안정화와 경추 정렬 유지' },
    ],
  },
  roundedShoulder: {
    inhibit: [
      { name: '대흉근 폼롤링', sets: 3, duration: '30초', description: '가슴 근육 긴장 완화' },
      { name: '광배근 폼롤링', sets: 3, duration: '30초', description: '등 외측 근육 이완' },
    ],
    lengthen: [
      { name: '도어웨이 스트레칭', sets: 3, duration: '30초', description: '가슴 근육 충분히 늘리기' },
      { name: '광배근 스트레칭', sets: 3, duration: '30초', description: '팔 올려 옆구리 늘리기' },
    ],
    activate: [
      { name: '견갑골 리트랙션', sets: 3, reps: 15, description: '어깨뼈 뒤로 모으기' },
      { name: '밴드 풀 어파트', sets: 3, reps: 12, description: '후면 삼각근 강화' },
    ],
    integrate: [
      { name: '푸시업 플러스', sets: 3, reps: 10, description: '전거근 통합 운동' },
      { name: '로우 투 익스터널 로테이션', sets: 3, reps: 10, description: '견갑골 안정화와 회전근개 강화' },
    ],
  },
  anteriorHumerus: {
    inhibit: [
      { name: '대흉근 마사지볼', sets: 2, duration: '60초', description: '가슴 트리거 포인트 해소' },
      { name: '전면 삼각근 폼롤링', sets: 3, duration: '30초', description: '어깨 앞쪽 이완' },
    ],
    lengthen: [
      { name: '슬리퍼 스트레치', sets: 3, duration: '30초', description: '어깨 후방 캡슐 늘리기' },
      { name: '크로스바디 스트레칭', sets: 3, duration: '30초', description: '후면 삼각근 신장' },
    ],
    activate: [
      { name: '외회전근 밴드 운동', sets: 3, reps: 15, description: '회전근개 후면 강화' },
      { name: '페이스 풀', sets: 3, reps: 12, description: '후면 어깨 근육 활성화' },
    ],
    integrate: [
      { name: '쿠반 프레스', sets: 3, reps: 10, description: '어깨 회전과 안정성 통합' },
      { name: '터키시 겟업', sets: 2, reps: 5, description: '어깨 안정성 종합 훈련' },
    ],
  },
  anteriorPelvicTilt: {
    inhibit: [
      { name: '고관절굴곡근 폼롤링', sets: 3, duration: '30초', description: '허벅지 앞쪽 긴장 완화' },
      { name: '요추 기립근 폼롤링', sets: 3, duration: '30초', description: '허리 근육 이완' },
    ],
    lengthen: [
      { name: '고관절굴곡근 스트레칭', sets: 3, duration: '30초', description: '무릎 꿇고 골반 밀기' },
      { name: '대퇴직근 스트레칭', sets: 3, duration: '30초', description: '허벅지 앞쪽 늘리기' },
    ],
    activate: [
      { name: '글루트 브릿지', sets: 3, reps: 15, description: '둔근 활성화로 골반 후방 당기기' },
      { name: '데드버그', sets: 3, reps: 12, description: '복부 코어 강화' },
    ],
    integrate: [
      { name: '루마니안 데드리프트', sets: 3, reps: 10, description: '후방사슬 통합 강화' },
      { name: '파머스 워크', sets: 3, duration: '30초', description: '중립 자세 유지 훈련' },
    ],
  },
  posteriorPelvicTilt: {
    inhibit: [
      { name: '햄스트링 폼롤링', sets: 3, duration: '30초', description: '허벅지 뒤쪽 긴장 완화' },
      { name: '복직근 마사지볼', sets: 2, duration: '60초', description: '복부 과긴장 해소' },
    ],
    lengthen: [
      { name: '햄스트링 스트레칭', sets: 3, duration: '30초', description: '다리 뒤쪽 충분히 늘리기' },
      { name: '척추 신전 스트레칭', sets: 3, duration: '20초', description: '고양이-소 자세' },
    ],
    activate: [
      { name: '고관절굴곡근 활성화', sets: 3, reps: 12, description: '다리 들기 운동' },
      { name: '요추 신전 운동', sets: 3, reps: 10, description: '슈퍼맨 자세' },
    ],
    integrate: [
      { name: '스쿼트', sets: 3, reps: 10, description: '올바른 골반 정렬로 앉기' },
      { name: '버드독', sets: 3, reps: 10, description: '척추 중립 유지 훈련' },
    ],
  },
};

// 심각도별 텍스트 변환
const severityText = {
  none: '정상',
  mild: '경미',
  moderate: '중등도',
  severe: '심함',
};

// 진단명 한글
const diagnosisNames = {
  forwardHead: '거북목',
  roundedShoulder: '라운드숄더',
  anteriorHumerus: '상완골 전방활주',
  anteriorPelvicTilt: '골반 전방경사',
  posteriorPelvicTilt: '골반 후방경사',
};

// 불균형 상태 상세 설명 (NASM-CES 기반)
const diagnosisExplanations = {
  forwardHead: {
    title: '거북목 (Forward Head Posture)',
    description: '머리가 신체 중심선보다 앞으로 이동한 상태입니다.',
    causes: [
      '장시간 스마트폰/컴퓨터 사용',
      '잘못된 수면 자세',
      '운전 등 특정 자세의 반복',
    ],
    effects: [
      '경추 과신전으로 인한 목 통증',
      '상부승모근 과긴장',
      '어깨 및 상부 등 통증',
      '두통과 턱관절 문제 유발 가능',
    ],
    mechanism: '머리 무게(약 5kg)가 앞으로 나갈수록 경추에 가해지는 부하가 기하급수적으로 증가합니다. 머리가 2.5cm 앞으로 나갈 때마다 경추 부담이 약 4.5kg씩 증가합니다.',
  },
  roundedShoulder: {
    title: '라운드숄더 (Rounded Shoulder)',
    description: '어깨가 앞쪽으로 말린 상태로, 견갑골의 외전 및 전방경사가 특징입니다.',
    causes: [
      '가슴 근육의 과긴장',
      '상부 등 근육의 약화',
      '장시간 구부정한 자세',
      '부적절한 근력 운동',
    ],
    effects: [
      '호흡 기능 저하',
      '어깨 충돌 증후군 위험',
      '견갑골 주변 통증',
      '팔 들어올리기 제한',
    ],
    mechanism: '대흉근과 소흉근의 단축으로 견갑골이 외전되고 전방으로 기울어집니다. 동시에 하부승모근과 전거근의 약화로 견갑골 안정성이 감소합니다.',
  },
  anteriorHumerus: {
    title: '상완골 전방활주 (Anterior Humeral Glide)',
    description: '상완골두가 관절와 내에서 정상 위치보다 앞쪽으로 이동한 상태입니다.',
    causes: [
      '회전근개 후면 약화',
      '대흉근의 과긴장',
      '부적절한 운동 패턴',
      '라운드숄더와 동반',
    ],
    effects: [
      '어깨 충돌 증후군',
      '회전근개 손상 위험',
      '어깨 통증 및 불안정성',
      '팔 동작 시 소리 발생',
    ],
    mechanism: '회전근개 근육(특히 극하근, 소원근)의 약화로 상완골두를 후방에서 안정화시키지 못하여 앞쪽으로 밀려나게 됩니다.',
  },
  anteriorPelvicTilt: {
    title: '골반 전방경사 (Anterior Pelvic Tilt)',
    description: '골반이 앞쪽으로 기울어진 상태로, 요추 전만이 과도하게 증가합니다.',
    causes: [
      '고관절굴곡근(장요근) 단축',
      '복부 근육 약화',
      '둔근 약화',
      '장시간 앉아있는 생활',
    ],
    effects: [
      '만성 요통',
      '햄스트링 긴장',
      '고관절 통증',
      '복부 돌출',
    ],
    mechanism: '고관절굴곡근과 요추 기립근의 과긴장이 골반을 전방으로 당기고, 약화된 복근과 둔근이 이를 저항하지 못하여 골반이 앞으로 기울어집니다.',
  },
  posteriorPelvicTilt: {
    title: '골반 후방경사 (Posterior Pelvic Tilt)',
    description: '골반이 뒤쪽으로 기울어진 상태로, 요추 전만이 감소하거나 소실됩니다.',
    causes: [
      '햄스트링 과긴장',
      '고관절굴곡근 약화',
      '잘못된 자세 습관',
      '복직근 과긴장',
    ],
    effects: [
      '요추 평평증',
      '디스크 압력 증가',
      '고관절 움직임 제한',
      '앉을 때 불편함',
    ],
    mechanism: '햄스트링과 복직근의 과긴장이 골반을 후방으로 당기고, 요추 신전근의 약화로 자연스러운 요추 전만 곡선이 상실됩니다.',
  },
};

/**
 * PDF 자동 생성 함수
 * @param diagnosis 진단 데이터
 * @param frontPhotoUrl 정면 사진 URL
 * @param sidePhotoUrl 측면 사진 URL
 * @param userName 사용자 이름
 * @returns PDF Blob
 */
export async function generateCorrectionPDF(
  diagnosis: DiagnosisData,
  frontPhotoUrl?: string,
  sidePhotoUrl?: string,
  userName: string = '고객님'
): Promise<Blob> {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  let yPos = 20;
  
  // 한글 폰트 설정 (브라우저 기본 폰트 사용)
  doc.setFont('helvetica');
  
  // ===== 1. 표지 =====
  doc.setFontSize(28);
  doc.setTextColor(249, 115, 22); // 오렌지색
  doc.text('맞춤형 교정운동 리포트', pageWidth / 2, 40, { align: 'center' });
  
  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.text(`${userName}`, pageWidth / 2, 60, { align: 'center' });
  
  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  const today = new Date().toLocaleDateString('ko-KR');
  doc.text(`작성일: ${today}`, pageWidth / 2, 70, { align: 'center' });
  
  doc.setFontSize(10);
  doc.text('NASM-CES 기반 체계적 교정 프로그램', pageWidth / 2, 80, { align: 'center' });
  
  // 사진 배치 (정면 + 측면)
  yPos = 100;
  if (frontPhotoUrl || sidePhotoUrl) {
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('자세 분석 사진', pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;
    
    const photoWidth = 60;
    const photoHeight = 80;
    const spacing = 10;
    
    try {
      // 이미지를 base64로 변환 후 추가
      if (frontPhotoUrl) {
        const frontBase64 = await urlToBase64(frontPhotoUrl);
        doc.addImage(frontBase64, 'JPEG', (pageWidth - photoWidth * 2 - spacing) / 2, yPos, photoWidth, photoHeight);
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text('정면', (pageWidth - photoWidth * 2 - spacing) / 2 + photoWidth / 2, yPos + photoHeight + 5, { align: 'center' });
      }
      if (sidePhotoUrl) {
        const sideBase64 = await urlToBase64(sidePhotoUrl);
        doc.addImage(sideBase64, 'JPEG', (pageWidth + spacing) / 2, yPos, photoWidth, photoHeight);
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text('측면', (pageWidth + spacing) / 2 + photoWidth / 2, yPos + photoHeight + 5, { align: 'center' });
      }
    } catch (error) {
      console.error('사진 추가 실패:', error);
      // 사진 추가 실패 시 텍스트로 표시
      doc.setFontSize(10);
      doc.setTextColor(255, 0, 0);
      doc.text('(사진을 불러올 수 없습니다)', pageWidth / 2, yPos + 40, { align: 'center' });
    }
  }
  
  // ===== 2. 진단 결과 요약 페이지 =====
  doc.addPage();
  yPos = 20;
  
  doc.setFontSize(20);
  doc.setTextColor(249, 115, 22);
  doc.text('진단 결과', 20, yPos);
  yPos += 15;
  
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  
  // 진단 항목 표시
  let diagnosisCount = 0;
  Object.entries(diagnosis).forEach(([key, severity]) => {
    if (severity !== 'none') {
      diagnosisCount++;
      const name = diagnosisNames[key as keyof typeof diagnosisNames];
      const level = severityText[severity];
      
      doc.setFillColor(249, 115, 22);
      doc.circle(25, yPos - 2, 2, 'F');
      doc.text(`${name}: ${level}`, 30, yPos);
      yPos += 8;
    }
  });
  
  if (diagnosisCount === 0) {
    doc.text('특이사항 없음 - 전반적으로 양호한 자세입니다.', 30, yPos);
  }
  
  yPos += 10;
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text('* NASM-CES 정적 자세 평가 기준 적용', 20, yPos);
  
  // ===== 3. 불균형 상세 설명 페이지들 =====
  Object.entries(diagnosis).forEach(([key, severity]) => {
    if (severity !== 'none') {
      const explanation = diagnosisExplanations[key as keyof typeof diagnosisExplanations];
      if (!explanation) return;
      
      doc.addPage();
      yPos = 20;
      
      // 제목
      doc.setFontSize(18);
      doc.setTextColor(249, 115, 22);
      doc.text(explanation.title, 20, yPos);
      yPos += 10;
      
      // 심각도 배지
      doc.setFontSize(10);
      doc.setFillColor(249, 115, 22);
      doc.roundedRect(20, yPos, 30, 7, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.text(severityText[severity], 35, yPos + 5, { align: 'center' });
      yPos += 15;
      
      // 설명
      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);
      doc.text(explanation.description, 20, yPos, { maxWidth: pageWidth - 40 });
      yPos += 12;
      
      // 발생 메커니즘
      doc.setFontSize(12);
      doc.setTextColor(249, 115, 22);
      doc.text('불균형 메커니즘', 20, yPos);
      yPos += 8;
      
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      const mechanismLines = doc.splitTextToSize(explanation.mechanism, pageWidth - 45);
      mechanismLines.forEach((line: string) => {
        doc.text(line, 25, yPos);
        yPos += 5;
      });
      yPos += 5;
      
      // 주요 원인
      doc.setFontSize(12);
      doc.setTextColor(249, 115, 22);
      doc.text('주요 원인', 20, yPos);
      yPos += 8;
      
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      explanation.causes.forEach((cause) => {
        doc.setFillColor(249, 115, 22);
        doc.circle(25, yPos - 1.5, 1.5, 'F');
        doc.text(cause, 30, yPos);
        yPos += 6;
      });
      yPos += 5;
      
      // 영향 및 증상
      doc.setFontSize(12);
      doc.setTextColor(249, 115, 22);
      doc.text('영향 및 증상', 20, yPos);
      yPos += 8;
      
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      explanation.effects.forEach((effect) => {
        doc.setFillColor(220, 38, 38);
        doc.circle(25, yPos - 1.5, 1.5, 'F');
        doc.text(effect, 30, yPos);
        yPos += 6;
      });
      yPos += 10;
      
      // NASM-CES 참고 노트
      doc.setFillColor(249, 115, 22, 0.1);
      doc.roundedRect(20, yPos, pageWidth - 40, 20, 3, 3, 'F');
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text('💡 NASM-CES 노트', 25, yPos + 5);
      doc.setFontSize(8);
      doc.text('이 불균형은 억제-신장-활성화-통합 4단계 교정 프로그램으로', 25, yPos + 10);
      doc.text('체계적으로 개선할 수 있습니다. 다음 페이지를 참고하세요.', 25, yPos + 15);
    }
  });
  
  // ===== 4. 4단계 교정운동 페이지 =====
  const stages = [
    { title: '1단계: 억제 (Inhibit)', key: 'inhibit', color: [220, 38, 38] },
    { title: '2단계: 신장 (Lengthen)', key: 'lengthen', color: [249, 115, 22] },
    { title: '3단계: 활성화 (Activate)', key: 'activate', color: [234, 179, 8] },
    { title: '4단계: 통합 (Integrate)', key: 'integrate', color: [34, 197, 94] },
  ];
  
  stages.forEach((stage) => {
    doc.addPage();
    yPos = 20;
    
    // 단계 제목
    doc.setFontSize(18);
    doc.setTextColor(stage.color[0], stage.color[1], stage.color[2]);
    doc.text(stage.title, 20, yPos);
    yPos += 10;
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    
    // 단계별 설명
    const stageDescriptions = {
      inhibit: '과활성 근육의 긴장을 완화합니다. (SMR 기법)',
      lengthen: '단축된 근육을 최적 길이로 늘립니다.',
      activate: '약화된 근육을 깨워 강화합니다.',
      integrate: '일상 동작에서 올바른 움직임을 통합합니다.',
    };
    
    doc.text(stageDescriptions[stage.key as keyof typeof stageDescriptions], 20, yPos);
    yPos += 15;
    
    // 운동 처방
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    
    let exerciseAdded = false;
    
    Object.entries(diagnosis).forEach(([key, severity]) => {
      if (severity !== 'none') {
        const exercises = exerciseDatabase[key as keyof typeof exerciseDatabase]?.[stage.key as keyof typeof exerciseDatabase.forwardHead];
        
        if (exercises && exercises.length > 0) {
          exercises.forEach((exercise: any, index: number) => {
            if (yPos > pageHeight - 40) {
              doc.addPage();
              yPos = 20;
            }
            
            exerciseAdded = true;
            
            // 운동 번호
            doc.setFillColor(stage.color[0], stage.color[1], stage.color[2]);
            doc.circle(25, yPos - 2, 3, 'F');
            doc.setFontSize(11);
            doc.setTextColor(255, 255, 255);
            doc.text(`${index + 1}`, 25, yPos + 1, { align: 'center' });
            
            // 운동 이름
            doc.setFontSize(12);
            doc.setTextColor(0, 0, 0);
            doc.text(exercise.name, 32, yPos);
            yPos += 6;
            
            // 운동 세부사항
            doc.setFontSize(10);
            doc.setTextColor(100, 100, 100);
            const details = exercise.sets ? 
              `${exercise.sets}세트 × ${exercise.reps || exercise.duration}` :
              exercise.duration;
            doc.text(details, 32, yPos);
            yPos += 5;
            
            // 운동 설명
            doc.setFontSize(9);
            doc.text(exercise.description, 32, yPos);
            yPos += 12;
          });
        }
      }
    });
    
    if (!exerciseAdded) {
      doc.setFontSize(11);
      doc.setTextColor(100, 100, 100);
      doc.text('해당 단계의 운동이 필요하지 않습니다.', 20, yPos);
    }
  });
  
  // ===== 5. 운동 가이드 페이지 =====
  doc.addPage();
  yPos = 20;
  
  doc.setFontSize(20);
  doc.setTextColor(249, 115, 22);
  doc.text('운동 가이드', 20, yPos);
  yPos += 15;
  
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  
  const guidelines = [
    '1. 매일 규칙적으로 실시하세요. (주 5-6회 권장)',
    '2. 순서를 지켜주세요: 억제 → 신장 → 활성화 → 통합',
    '3. 통증이 있다면 즉시 중단하고 전문가와 상담하세요.',
    '4. 처음에는 가벼운 강도로 시작하세요.',
    '5. 2-4주마다 자세를 재평가하여 진행 상황을 확인하세요.',
    '6. 일상생활에서도 올바른 자세를 의식하세요.',
  ];
  
  guidelines.forEach((guide) => {
    doc.text(guide, 20, yPos);
    yPos += 8;
  });
  
  yPos += 10;
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text('문의사항이 있으시면 언제든 연락주세요.', 20, yPos);
  yPos += 6;
  doc.text('함께 건강한 자세를 만들어가겠습니다!', 20, yPos);
  
  // PDF를 Blob으로 반환
  return doc.output('blob');
}

/**
 * PDF 다운로드 함수
 */
export function downloadPDF(blob: Blob, fileName: string = 'correction-report.pdf') {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
