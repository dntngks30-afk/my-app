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

const ogTitle = "MOVE RE - 내 몸 상태를 분석하고 리셋 운동을 시작하세요";
const ogDescription =
  "1분 테스트로 내 몸의 반복 패턴을 확인하고, 나에게 맞는 리셋 세션을 시작해보세요.";

export const viewport: Viewport = {
  themeColor: "#050814",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  appleWebApp: {
    capable: true,
    title: "MOVE RE",
    statusBarStyle: "black-translucent",
  },
  applicationName: "MOVE RE",
  title: {
    default: "MOVE RE | 내 몸 상태 기반 리셋 운동",
    template: "%s | MOVE RE",
  },
  description: ogDescription,
  keywords: [
    "MOVE RE",
    "리셋 운동",
    "움직임 테스트",
    "맞춤 운동",
    "몸 상태",
    "자세",
    "홈 트레이닝",
    "PWA",
  ],
  authors: [{ name: "MOVE RE" }],
  creator: "MOVE RE",
  publisher: "MOVE RE",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(normalizedBaseUrl),
  alternates: {
    canonical: "/",
  },

  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: normalizedBaseUrl,
    title: ogTitle,
    description: ogDescription,
    siteName: "MOVE RE",
    images: [
      {
        url: "/og/move-re-og.png",
        width: 1200,
        height: 630,
        alt: "MOVE RE 내 몸 상태 기반 리셋 운동",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: ogTitle,
    description: ogDescription,
    images: ["/og/move-re-og.png"],
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
