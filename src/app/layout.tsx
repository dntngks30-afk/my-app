import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
    <html lang="ko">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <meta name="theme-color" content="#0f172a" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
