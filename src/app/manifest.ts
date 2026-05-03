import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'MOVE RE',
    short_name: 'MOVE RE',
    description: '내 몸 상태 기반 리셋 운동',
    start_url: '/app/home',
    display: 'standalone',
    background_color: '#050814',
    theme_color: '#050814',
    icons: [
      { src: '/brand/move-re-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/brand/move-re-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  };
}
