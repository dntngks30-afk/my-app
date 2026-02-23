/**
 * /app 메인 화면용 더미 데이터
 */

export const GROWTH_CARD = {
  week: 1,
  title: '아기 거북이 탈출기',
  progressPercent: 40,
  fromLabel: '아기거북이',
  toLabel: '어린이거북이',
} as const;

export const DAY_STEPPER = [
  { day: 1, status: 'done' as const },
  { day: 2, status: 'done' as const },
  { day: 3, status: 'active' as const },
  { day: 4, status: 'locked' as const },
  { day: 5, status: 'locked' as const },
  { day: 6, status: 'locked' as const },
  { day: 7, status: 'locked' as const },
];

export const TODAY_ROUTINE = {
  dayLabel: 'Day 3',
  durationBadge: '12분',
  exercises: [
    { id: '1', title: 'V1 90/90 벽 호흡', subtext: '흉추 회전 · 5분', thumbnail: null },
    { id: '2', title: '가슴 펴기 스트레치', subtext: '흉추 신전 · 4분', thumbnail: null },
    { id: '3', title: '턱 당기기', subtext: '경추 후굴 · 3분', thumbnail: null },
  ],
};
