import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Move Re - 움직임 리셋 7일 맞춤 루틴',
    short_name: 'Move Re',
    description: '단 7일 만에 내 몸의 움직임을 리셋하는 맞춤형 체형 가이드',
    start_url: '/app/home',
    display: 'standalone',
    background_color: '#FFFFFF',
    theme_color: '#000000',
    icons: [
      { src: '/icon.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
