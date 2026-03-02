/**
 * Server-Timing 헤더 생성 헬퍼 (의존성 없음)
 * API 응답에 Server-Timing 헤더를 추가해 TTFB 원인 규명용
 */

interface Mark {
  name: string;
  dur: number;
}

export function createServerTiming() {
  const marks: Mark[] = [];
  const start = performance.now();
  let last = start;

  return {
    mark(name: string) {
      const now = performance.now();
      const dur = Math.round((now - last) * 10) / 10;
      last = now;
      marks.push({ name, dur });
    },
    header(): string {
      const now = performance.now();
      const total = Math.round((now - start) * 10) / 10;
      const parts = marks.map((m) => `${m.name};dur=${m.dur}`);
      parts.push(`total;dur=${total}`);
      return parts.join(', ');
    },
  };
}
