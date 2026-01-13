import type { Metadata } from "next";
import "@qanda/qds4-web/base.css";
import "./globals.css";
import { DesignSystemWrapper } from "@/components/providers";

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
      <body className="antialiased">
        <DesignSystemWrapper>{children}</DesignSystemWrapper>
      </body>
    </html>
  );
}
