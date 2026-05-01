import type { Metadata, Viewport } from "next";
import { Geist, Noto_Sans_KR, Noto_Serif_KR } from "next/font/google";
import "./globals.css";
import { PresetProvider } from "@/components/PresetProvider";
import FontSwitcher from "@/components/FontSwitcher";
import PwaUpdateHandler from "@/components/shared/PwaUpdateHandler";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const notoSansKR = Noto_Sans_KR({
  variable: "--font-sans-noto",
  subsets: ["latin"],
  weight: ["100", "400", "500", "600", "700"],
});

const notoSerifKR = Noto_Serif_KR({
  variable: "--font-serif-noto",
  subsets: ["latin"],
  weight: ["400", "600", "700", "900"],
});

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://my-app-sigma-seven-96.vercel.app";
const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
const kakaoOgImageAbs = `${normalizedBaseUrl}/og/kakao2.jpg`;

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  appleWebApp: {
    capable: true,
    title: 'Move Re',
    statusBarStyle: 'black-translucent',
  },
  title: "사진 2장으로 끝내는 맞춤 자세 개선 | NASM 전문가 솔루션",
  description: "목과 어깨 자세가 불편하신가요? NASM-CES 전문가가 사진 2장으로 당신만을 위한 4단계 운동 루틴을 24시간 내에 보내드립니다.",
  keywords: [
    "자세 개선",
    "목 자세",
    "어깨 자세",
    "자세 분석",
    "운동 가이드",
    "NASM",
    "NASM-CES",
    "맞춤 운동",
    "체형 분석",
    "운동 전문가",
    "온라인 PT",
    "운동 루틴",
    "바른 자세",
    "체형 분석 서비스",
  ],
  authors: [{ name: "포스처랩" }],
  creator: "포스처랩",
  publisher: "포스처랩",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(baseUrl),
  alternates: {
    canonical: "/",
  },

openGraph: {
  type: "website",
  locale: "ko_KR",
  url: normalizedBaseUrl,
  title: "무료 움직임 테스트",
  description: "당신의 움직임은 어떤 동물과 닮았나요?",
  siteName: "포스처랩 - 자세 개선 운동 전문",
  images: [
    {
      url: kakaoOgImageAbs,
      width: 1200,
      height: 630,
      alt: "무료 움직임 테스트",
    },
  ],
},
twitter: {
  card: "summary_large_image",
  title: "무료 움직임 테스트",
  description: "당신의 움직임은 어떤 동물과 닮았나요?",
  images: [kakaoOgImageAbs],
  creator: "@posturelab",
},
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: "your-google-verification-code",
    // 추후 Google Search Console에서 받은 코드로 교체
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html 
      lang="ko"
      className={`${geistSans.variable} ${notoSansKR.variable} ${notoSerifKR.variable}`}
      style={{
        ['--font-geist-mono' as string]: 'var(--font-geist-sans)',
        ['--font-sans-ibm' as string]: 'var(--font-sans-noto)',
        ['--font-display-gowun' as string]: 'var(--font-serif-noto)',
        ['--font-sans-gothicA1' as string]: 'var(--font-sans-noto)',
        ['--font-sans-nanumGothic' as string]: 'var(--font-sans-noto)',
        ['--font-display-jua' as string]: 'var(--font-serif-noto)',
        ['--font-display-dohyeon' as string]: 'var(--font-serif-noto)',
        ['--font-display-nanumPen' as string]: 'var(--font-serif-noto)',
      }}
    >
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className="antialiased">
        <PresetProvider>
          <FontSwitcher />
          <PwaUpdateHandler />
          {children}
        </PresetProvider>
      </body>
    </html>
  );
}
