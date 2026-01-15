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
        {/* Skip link for keyboard navigation - ui-spec.yaml#accessibility */}
        <a href="#main-content" className="skip-link">
          본문으로 건너뛰기
        </a>
        <DesignSystemWrapper>{children}</DesignSystemWrapper>
      </body>
    </html>
  );
}
