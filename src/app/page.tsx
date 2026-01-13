"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { typography } from "@qanda/qds4-web/Typography";
import { COLOR } from "@qanda/qds4-web/base.ts";
import { DropZone, UrlInput } from "@/components/upload";

export default function Home() {
  const router = useRouter();

  // Handle PDF file upload (F-001)
  const handleFileSelect = useCallback(
    async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/papers", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error?.message || "업로드에 실패했습니다.");
      }

      // 업로드 성공 시 논문 뷰어 페이지로 이동
      router.push(`/paper/${result.id}`);
    },
    [router]
  );

  // Handle URL submission (F-002)
  const handleUrlSubmit = useCallback(
    async (url: string) => {
      const response = await fetch("/api/papers/url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error?.code || result.error?.message || "다운로드에 실패했습니다.");
      }

      // 다운로드 성공 시 논문 뷰어 페이지로 이동
      router.push(`/paper/${result.id}`);
    },
    [router]
  );

  return (
    <div
      style={{
        minHeight: "calc(100vh - 56px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "48px 24px",
        backgroundColor: COLOR.gray_100,
      }}
    >
      {/* Hero Section - ui-spec.yaml#SCR-001.components.hero_section */}
      <section
        style={{
          textAlign: "center",
          marginBottom: "48px",
          maxWidth: "600px",
        }}
      >
        <h1
          className={typography("large_title")}
          style={{ color: COLOR.gray_10, marginBottom: "16px" }}
        >
          논문 읽기를 더 쉽게
        </h1>
        <p
          className={typography("body_1")}
          style={{ color: COLOR.gray_50 }}
        >
          AI가 논문을 번역하고, 요약하고, 핵심 키워드를 설명해드립니다.
          <br />
          PDF를 업로드하고 바로 시작하세요.
        </p>
      </section>

      {/* Upload DropZone - ui-spec.yaml#SCR-001.components.upload_dropzone */}
      <section style={{ width: "100%", maxWidth: "500px" }}>
        <DropZone onFileSelect={handleFileSelect} />
      </section>

      {/* Divider with "or" text */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          width: "100%",
          maxWidth: "500px",
          margin: "24px 0",
        }}
      >
        <div
          style={{
            flex: 1,
            height: "1px",
            backgroundColor: COLOR.gray_80,
          }}
        />
        <span
          className={typography("body_2")}
          style={{
            color: COLOR.gray_50,
            padding: "0 16px",
          }}
        >
          또는
        </span>
        <div
          style={{
            flex: 1,
            height: "1px",
            backgroundColor: COLOR.gray_80,
          }}
        />
      </div>

      {/* URL Input - ui-spec.yaml#SCR-001.components.url_input */}
      <section style={{ width: "100%", maxWidth: "500px" }}>
        <UrlInput onSubmit={handleUrlSubmit} />
      </section>
    </div>
  );
}
