import { PoseGuide } from './types';

export const POSE_GUIDES: PoseGuide[] = [
  {
    id: 'neutral-stand',
    title: '중립 서기(정렬 체크)',
    intent: '기본 정렬(머리-흉곽-골반-발)의 습관을 체크해요.',
    durationSec: 10,
    prepCountdownSec: 3,
    instructions: [
      '카메라에서 2m 정도 떨어져 전신이 보이게 서 주세요.',
      '발은 골반 너비, 11자에 가깝게.',
      '갈비뼈를 살짝 내리고 턱은 가볍게 당겨요.',
      '10초 동안 숨을 자연스럽게 쉬며 유지합니다.',
    ],
    checklist: [
      { id: 'feet', label: '발이 한쪽으로 꺾이지 않고 11자에 가깝다', tip: '발끝이 너무 벌어지면 무릎 라인이 흐트러질 수 있어요.' },
      { id: 'ribs', label: '갈비뼈가 들려 보이지 않는다', tip: '가슴을 과하게 들면 허리 과신전이 쉽게 생겨요.' },
      { id: 'chin', label: '턱이 앞으로 튀어나오지 않는다', tip: '턱을 살짝 당기고 정수리를 위로 길게.' },
    ],
    media: { kind: 'gif', src: '/pose-guides/neutral-stand.gif', alt: '중립 서기 가이드' },
    camera: { facingMode: 'user', mirror: true, recommendedDistanceText: '2m 거리', framingHint: 'full-body' },
    safetyNotes: ['통증이 있으면 즉시 중단하세요.'],
  },
  {
    id: 'overhead-squat',
    title: '오버헤드 스쿼트(전신 협응)',
    intent: '발-무릎-골반-흉곽-어깨 협응을 한 번에 확인해요.',
    durationSec: 12,
    prepCountdownSec: 3,
    instructions: [
      '양팔을 머리 위로 뻗고(가능한 범위에서) 내려갑니다.',
      '무릎은 발끝 방향으로, 발바닥은 3점 지지(뒤꿈치/엄지/새끼).',
      '가능한 깊이까지 내려갔다가 올라오세요.',
      '천천히 2회 반복 후 2초 정지.',
    ],
    checklist: [
      { id: 'knees', label: '무릎이 안쪽으로 무너지지 않는다', tip: '무릎을 발끝 방향으로 밀어준다는 느낌.' },
      { id: 'heels', label: '뒤꿈치가 뜨지 않는다', tip: '발의 3점 지지를 먼저 만들고 내려가요.' },
      { id: 'arms', label: '팔이 귀 옆에서 크게 앞으로 떨어지지 않는다', tip: '흉추/견갑 가동성이 제한일 수 있어요.' },
    ],
    media: { kind: 'gif', src: '/pose-guides/overhead-squat.gif', alt: '오버헤드 스쿼트 가이드' },
    camera: { facingMode: 'user', mirror: true, recommendedDistanceText: '2.5m 거리', framingHint: 'full-body' },
  },
  {
    id: 'hip-hinge',
    title: '힙 힌지(골반 접기)',
    intent: '허리로 숙이는지, 골반으로 접는지 패턴을 봅니다.',
    durationSec: 10,
    prepCountdownSec: 3,
    instructions: [
      '옆모습이 보이게 90도 회전해서 서 주세요.',
      '무릎은 살짝 굽힌 상태에서 엉덩이를 뒤로 보냅니다.',
      '등은 길게, 허리는 꺾지 않게.',
      '힌지 자세를 10초 유지합니다.',
    ],
    checklist: [
      { id: 'pelvis', label: '엉덩이가 뒤로 빠지며 상체가 같이 기울어진다', tip: '무릎만 굽히며 내려가면 스쿼트 패턴으로 바뀌어요.' },
      { id: 'spine', label: '허리가 과하게 꺾이거나 둥글게 말리지 않는다', tip: '갈비뼈-골반 간격을 일정하게.' },
    ],
    media: { kind: 'gif', src: '/pose-guides/hip-hinge.gif', alt: '힙 힌지 가이드' },
    camera: { facingMode: 'user', mirror: true, recommendedDistanceText: '2m 거리', framingHint: 'full-body' },
  },
];
