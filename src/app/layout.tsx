import type { Metadata } from "next";
import { 
  Geist, 
  Geist_Mono, 
  Noto_Sans_KR, 
  IBM_Plex_Sans_KR, 
  Gowun_Dodum,
  Gothic_A1,
  Nanum_Gothic,
  Jua,
  Do_Hyeon,
  Nanum_Pen_Script
} from "next/font/google";
import "./globals.css";
import { PresetProvider } from "@/components/PresetProvider";
import FontSwitcher from "@/components/FontSwitcher";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoSansKR = Noto_Sans_KR({
  variable: "--font-sans-noto",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const ibmPlexSansKR = IBM_Plex_Sans_KR({
  variable: "--font-sans-ibm",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const gowunDodum = Gowun_Dodum({
  variable: "--font-display-gowun",
  subsets: ["latin"],
  weight: ["400"],
});

// 본문 폰트 후보 (산스)
const gothicA1 = Gothic_A1({
  variable: "--font-sans-gothicA1",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const nanumGothic = Nanum_Gothic({
  variable: "--font-sans-nanumGothic",
  subsets: ["latin"],
  weight: ["400", "700", "800"],
});

// 타이틀 폰트 후보 (디스플레이)
const jua = Jua({
  variable: "--font-display-jua",
  subsets: ["latin"],
  weight: ["400"],
});

const doHyeon = Do_Hyeon({
  variable: "--font-display-dohyeon",
  subsets: ["latin"],
  weight: ["400"],
});

const nanumPenScript = Nanum_Pen_Script({
  variable: "--font-display-nanumPen",
  subsets: ["latin"],
  weight: ["400"],
});

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://posturelab.com";

export const metadata: Metadata = {
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
    url: "/",
    title: "사진 2장으로 끝내는 맞춤 자세 개선 | NASM 전문가 솔루션",
    description: "목과 어깨 자세가 불편하신가요? NASM-CES 전문가가 사진 2장으로 당신만을 위한 4단계 운동 루틴을 24시간 내에 보내드립니다.",
    siteName: "포스처랩 - 자세 개선 운동 전문",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "포스처랩 - NASM 기반 맞춤 자세 개선 운동 가이드",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "사진 2장으로 끝내는 맞춤 자세 개선 | NASM 전문가 솔루션",
    description: "목과 어깨 자세가 불편하신가요? NASM-CES 전문가가 사진 2장으로 당신만을 위한 4단계 운동 루틴을 24시간 내에 보내드립니다.",
    images: ["/og-image.jpg"],
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
      className={`${geistSans.variable} ${geistMono.variable} ${notoSansKR.variable} ${ibmPlexSansKR.variable} ${gowunDodum.variable} ${gothicA1.variable} ${nanumGothic.variable} ${jua.variable} ${doHyeon.variable} ${nanumPenScript.variable}`}
    >
      <head>
        <link rel="icon" href="/favicon.ico" />
        <meta name="theme-color" content="#0f172a" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
        
        {/* 카카오톡 SDK */}
        <script 
          src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.0/kakao.min.js"
          integrity="sha384-l+xbElFSnPZ2rOaPrU//2FF5B4LB8FiX5q4fXYTlfcG4PGpMkE1vcL7kNXI6Cci0"
          crossOrigin="anonymous"
          async
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (window.Kakao && !window.Kakao.isInitialized()) {
                window.Kakao.init('${process.env.NEXT_PUBLIC_KAKAO_JS_KEY || 'YOUR_KAKAO_JS_KEY'}');
              }
            `
          }}
        />
      </head>
      <body className="antialiased">
        <PresetProvider>
          <FontSwitcher />
          {children}
        </PresetProvider>
      </body>
    </html>
  );
}
