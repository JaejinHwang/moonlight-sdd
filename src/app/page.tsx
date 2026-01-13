"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { typography } from "@qanda/qds4-web/Typography";
import { COLOR } from "@qanda/qds4-web/base.ts";
import { DropZone } from "@/components/upload";

export default function Home() {
  const router = useRouter();

  const handleFileSelect = useCallback(
    async (file: File) => {
      // TODO: TASK-004에서 실제 업로드 API 연동 예정
      // 현재는 파일 선택만 처리하고 콘솔에 로그 출력
      console.log("File selected:", file.name, file.size, file.type);

      // 임시: 업로드 시뮬레이션 (2초 딜레이)
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // TODO: 실제 구현 시 반환된 paper ID로 라우팅
      // router.push(`/paper/${paperId}`);
      alert(`파일 업로드 완료: ${file.name}\n(TASK-004에서 실제 API 연동 예정)`);
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

      {/* URL Input - TODO: TASK-006에서 구현 예정 */}
      {/* <section style={{ marginTop: "24px" }}>
        <Button variant="accent">URL로 논문 불러오기</Button>
      </section> */}
    </div>
  );
}
