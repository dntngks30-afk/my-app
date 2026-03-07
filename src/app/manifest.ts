import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Move Re - 움직임 리셋 7일 맞춤 루틴',
    short_name: 'Move Re',
    description: '단 7일 만에 내 몸의 움직임을 리셋하는 맞춤형 체형 가이드',
    start_url: '/app/home',
    display: 'standalone',
    background_color: '#faf8f5',
    theme_color: '#0F172A',
    icons: [
      { src: '/brand/move-re-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/brand/move-re-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  };
}
