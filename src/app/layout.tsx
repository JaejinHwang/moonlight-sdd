import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Moonlight - AI 논문 읽기 도우미",
  description: "논문을 자동 번역, 핵심 요약, 도표 설명으로 쉽게 읽을 수 있습니다.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
