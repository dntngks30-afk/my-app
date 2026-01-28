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

export const metadata: Metadata = {
  title: "사진 2장으로 끝내는 맞춤 체형 교정 | NASM 전문가 솔루션",
  description: "거북목, 라운드숄더 고민이신가요? NASM-CES 전문가가 사진 2장으로 당신만을 위한 4단계 교정 운동 루틴을 24시간 내에 보내드립니다.",
  keywords: [
    "체형 교정",
    "거북목 교정",
    "라운드숄더",
    "자세 교정",
    "교정 운동",
    "NASM",
    "NASM-CES",
    "맞춤 운동",
    "체형 분석",
    "교정 전문가",
    "온라인 PT",
    "운동 루틴",
    "척추 교정",
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
  metadataBase: process.env.NEXT_PUBLIC_BASE_URL 
    ? new URL(process.env.NEXT_PUBLIC_BASE_URL)
    : new URL("https://posturelab.com"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: "/",
    title: "사진 2장으로 끝내는 맞춤 체형 교정 | NASM 전문가 솔루션",
    description: "거북목, 라운드숄더 고민이신가요? NASM-CES 전문가가 사진 2장으로 당신만을 위한 4단계 교정 운동 루틴을 24시간 내에 보내드립니다.",
    siteName: "포스처랩 - 체형 교정 전문",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "포스처랩 - NASM 기반 맞춤 체형 교정 솔루션",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "사진 2장으로 끝내는 맞춤 체형 교정 | NASM 전문가 솔루션",
    description: "거북목, 라운드숄더 고민이신가요? NASM-CES 전문가가 사진 2장으로 당신만을 위한 4단계 교정 운동 루틴을 24시간 내에 보내드립니다.",
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
