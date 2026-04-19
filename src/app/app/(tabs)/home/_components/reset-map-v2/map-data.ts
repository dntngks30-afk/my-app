/**
 * Geometry + route structure for the reset map.
 * `label` / `description` are legacy fallback copy only (PR2+); runtime node text uses session-node-display resolver.
 */
export interface SessionNode {
  id: number
  x: number
  y: number
  week: number
  /** Legacy fallback — not canonical session truth when plan meta / summary exists */
  label: string
  type: 'workout' | 'milestone'
  /** Legacy fallback subtitle seed */
  description: string
  duration: string
  exercises: string[]
  elevation: number // meters — for map feel
}

// Trail snakes bottom→top. x: 50–340 on a 390-wide viewport.
// y descends from ~1520 (START) to ~60 (FINISH).
export const sessions: SessionNode[] = [
  {
    id: 1, x: 100, y: 1490, week: 1, label: '점화',
    type: 'workout', description: '전신 활성화',
    duration: '25분', exercises: ['스쿼트', '푸시업', '플랭크', '런지'], elevation: 120,
  },
  {
    id: 2, x: 200, y: 1410, week: 1, label: '기초',
    type: 'workout', description: '코어 안정성 구축',
    duration: '30분', exercises: ['데드 버그', '버드독', '글루트 브릿지', '사이드 플랭크'], elevation: 180,
  },
  {
    id: 3, x: 310, y: 1340, week: 1, label: '흐름',
    type: 'workout', description: '움직임 흐름과 유연성',
    duration: '20분', exercises: ['세계 최고의 스트레칭', '인치웜', '힙 서클', '캣카우'], elevation: 260,
  },
  {
    id: 4, x: 250, y: 1255, week: 1, label: '밀어내기',
    type: 'workout', description: '상체 푸시 집중',
    duration: '30분', exercises: ['인클라인 푸시업', '파이크 프레스', '딥스', '다이아몬드 푸시업'], elevation: 340,
  },
  {
    id: 5, x: 120, y: 1175, week: 1, label: '베이스캠프',
    type: 'milestone', description: '1주차 완료',
    duration: '35분', exercises: ['전신 서킷', '지구력 테스트', '스트레칭 시퀀스'], elevation: 450,
  },
  {
    id: 6, x: 70, y: 1085, week: 2, label: '도약',
    type: 'workout', description: '하체 파워',
    duration: '30분', exercises: ['점프 스쿼트', '불가리안 스플릿', '카프 레이즈', '월 시트'], elevation: 530,
  },
  {
    id: 7, x: 195, y: 1010, week: 2, label: '단련',
    type: 'workout', description: '근지구력 강화',
    duration: '35분', exercises: ['버피', '마운틴 클라이머', '케틀벨 스윙', '쓰러스터'], elevation: 620,
  },
  {
    id: 8, x: 320, y: 935, week: 2, label: '균형',
    type: 'workout', description: '안정성과 컨트롤',
    duration: '25분', exercises: ['싱글레그 데드리프트', '피스톨 스쿼트 연습', '보수 운동', 'Y-밸런스'], elevation: 720,
  },
  {
    id: 9, x: 230, y: 855, week: 2, label: '연소',
    type: 'workout', description: 'HIIT 컨디셔닝',
    duration: '25분', exercises: ['타바타 라운드', '스프린트 인터벌', '박스 점프', '배틀 로프'], elevation: 810,
  },
  {
    id: 10, x: 90, y: 775, week: 2, label: '능선',
    type: 'milestone', description: '2주차 완료 — 절반 도달',
    duration: '40분', exercises: ['중간 평가', '최대 반복 테스트', '리커버리 플로우'], elevation: 920,
  },
  {
    id: 11, x: 170, y: 695, week: 3, label: '상승',
    type: 'workout', description: '고급 복합 동작',
    duration: '35분', exercises: ['핸드스탠드 연습', 'L-시트 연습', '머슬업 드릴', '프론트 레버'], elevation: 1020,
  },
  {
    id: 12, x: 305, y: 620, week: 3, label: '투지',
    type: 'workout', description: '멘탈 강화 서킷',
    duration: '30분', exercises: ['EMOM 세트', '파머 캐리', '슬레드 푸시', '로디드 캐리'], elevation: 1120,
  },
  {
    id: 13, x: 230, y: 540, week: 3, label: '템포',
    type: 'workout', description: '템포 트레이닝',
    duration: '30분', exercises: ['슬로우 이센트릭', '포즈 렙', '텐션 유지', '아이소 홀드'], elevation: 1210,
  },
  {
    id: 14, x: 80, y: 465, week: 3, label: '맥박',
    type: 'workout', description: '유산소 & 민첩성',
    duration: '25분', exercises: ['래더 드릴', '콘 스프린트', '셔틀 런', '줄넘기'], elevation: 1300,
  },
  {
    id: 15, x: 185, y: 390, week: 3, label: '정상캠프',
    type: 'milestone', description: '3주차 완료',
    duration: '40분', exercises: ['근력 벤치마크', '스킬 평가', '능동 회복'], elevation: 1420,
  },
  {
    id: 16, x: 310, y: 315, week: 4, label: '정점',
    type: 'workout', description: '최고 퍼포먼스',
    duration: '35분', exercises: ['복합 동작', '파워 클린', '스내치', '오버헤드 스쿼트'], elevation: 1530,
  },
  {
    id: 17, x: 190, y: 245, week: 4, label: '한계',
    type: 'workout', description: '한계를 넘어서',
    duration: '35분', exercises: ['AMRAP 라운드', '치퍼 WOD', '파트너 드릴', '최대 노력 세트'], elevation: 1640,
  },
  {
    id: 18, x: 75, y: 180, week: 4, label: '강철',
    type: 'workout', description: '전신 강화',
    duration: '30분', exercises: ['전신 컴플렉스', '로디드 캐리', '그립 강화', '코어 마무리'], elevation: 1730,
  },
  {
    id: 19, x: 210, y: 110, week: 4, label: '명상',
    type: 'workout', description: '심신 연결',
    duration: '25분', exercises: ['요가 플로우', '호흡법', '명상', '심층 모빌리티'], elevation: 1820,
  },
  {
    id: 20, x: 195, y: 48, week: 4, label: '리셋',
    type: 'milestone', description: '여정 완료. 당신은 리셋되었습니다.',
    duration: '45분', exercises: ['최종 평가', '축하 서킷', '회복 & 성찰'], elevation: 1920,
  },
]

// Generate a smooth SVG path string through nodes
export function generatePathD(nodes: SessionNode[]): string {
  if (nodes.length < 2) return ''
  const pts = nodes.map(n => ({ x: n.x, y: n.y }))
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 0; i < pts.length - 1; i++) {
    const current = pts[i]
    const next = pts[i + 1]
    const midY = (current.y + next.y) / 2
    d += ` C ${current.x} ${midY}, ${next.x} ${midY}, ${next.x} ${next.y}`
  }
  return d
}

// Dense topographic contour lines at varying elevation intervals
export function generateContourLines(): { d: string; elevation: number; isMajor: boolean }[] {
  const lines: { d: string; elevation: number; isMajor: boolean }[] = []
  const totalContours = 28

  for (let i = 0; i < totalContours; i++) {
    const y = 40 + i * 55
    const elevation = 1920 - Math.round((y / 1560) * 1800)
    const isMajor = i % 4 === 0

    const seed = i * 137.5
    const a1 = 25 + Math.sin(seed * 0.013) * 18
    const a2 = 20 + Math.cos(seed * 0.017) * 15
    const a3 = 22 + Math.sin(seed * 0.021) * 12
    const ox1 = Math.cos(seed * 0.009) * 35
    const ox2 = Math.sin(seed * 0.011) * 30
    const ox3 = Math.cos(seed * 0.015) * 25

    lines.push({
      d: `M -10 ${y + a1 * 0.3} Q 65 ${y - a1 + ox1}, 130 ${y + a2 * 0.6 + ox2} T 260 ${y - a3 + ox3} Q 325 ${y + a2 * 0.4}, 400 ${y - a1 * 0.5 + ox1 * 0.3}`,
      elevation,
      isMajor,
    })
  }
  return lines
}

// Week zone regions on the map
export interface TerrainZone {
  id: number
  label: string
  yStart: number
  yEnd: number
  color: string
  elevationRange: string
}

export const terrainZones: TerrainZone[] = [
  { id: 1, label: '평지 구간', yStart: 1540, yEnd: 1140, color: 'oklch(0.82 0.06 145)', elevationRange: '120–450m' },
  { id: 2, label: '구릉 구간', yStart: 1140, yEnd: 740, color: 'oklch(0.80 0.05 80)', elevationRange: '450–920m' },
  { id: 3, label: '산악 구간', yStart: 740, yEnd: 350, color: 'oklch(0.78 0.04 40)', elevationRange: '920–1420m' },
  { id: 4, label: '정상 구간', yStart: 350, yEnd: 0, color: 'oklch(0.82 0.04 250)', elevationRange: '1420–1920m' },
]

// Small scenic features for map richness
export interface MapFeature {
  x: number
  y: number
  type: 'tree-cluster' | 'stream' | 'rock' | 'flag'
}

export const mapFeatures: MapFeature[] = [
  { x: 30, y: 1460, type: 'tree-cluster' },
  { x: 350, y: 1380, type: 'tree-cluster' },
  { x: 55, y: 1300, type: 'tree-cluster' },
  { x: 340, y: 1200, type: 'tree-cluster' },
  { x: 15, y: 1100, type: 'stream' },
  { x: 280, y: 1060, type: 'tree-cluster' },
  { x: 360, y: 880, type: 'rock' },
  { x: 25, y: 820, type: 'stream' },
  { x: 350, y: 700, type: 'rock' },
  { x: 40, y: 620, type: 'rock' },
  { x: 355, y: 500, type: 'rock' },
  { x: 30, y: 380, type: 'rock' },
  { x: 340, y: 270, type: 'rock' },
  { x: 360, y: 150, type: 'flag' },
]
