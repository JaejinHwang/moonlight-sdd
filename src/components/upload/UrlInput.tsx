"use client";

import { useState, useCallback } from "react";
import { Button } from "@qanda/qds4-web/Button";
import { Spinner } from "@qanda/qds4-web/Spinner";
import { typography } from "@qanda/qds4-web/Typography";
import { COLOR } from "@qanda/qds4-web/base.ts";

/**
 * URL Input Component
 * Based on ui-spec.yaml#SCR-001.components.url_input
 *
 * States from functional-spec.yaml#F-002:
 * - idle: URL 입력 대기
 * - validating: URL 유효성 검증 중
 * - downloading: PDF 다운로드 중
 * - error: 에러 상태
 */

// Error codes from functional-spec.yaml#F-002
const ErrorMessages: Record<string, string> = {
  INVALID_URL: "올바른 URL을 입력해주세요.",
  PDF_NOT_FOUND: "해당 URL에서 PDF를 찾을 수 없습니다.",
  ACCESS_DENIED: "해당 논문에 접근할 수 없습니다.",
  DOWNLOAD_FAILED: "다운로드에 실패했습니다. 다시 시도해주세요.",
  FILE_TOO_LARGE: "파일 크기가 10MB를 초과합니다.",
  UNAUTHORIZED: "로그인이 필요합니다.",
};

type UrlInputState = "idle" | "loading" | "error";

interface UrlInputProps {
  onSubmit: (url: string) => Promise<void>;
  disabled?: boolean;
}

export function UrlInput({ onSubmit, disabled = false }: UrlInputProps) {
  const [url, setUrl] = useState("");
  const [state, setState] = useState<UrlInputState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();

      const trimmedUrl = url.trim();
      if (!trimmedUrl || disabled) return;

      setState("loading");
      setErrorMessage(null);

      try {
        await onSubmit(trimmedUrl);
        // Success - parent will handle navigation
        setUrl("");
        setState("idle");
      } catch (error) {
        setState("error");
        if (error instanceof Error) {
          // Try to parse error code from message
          const errorCode = Object.keys(ErrorMessages).find((code) =>
            error.message.includes(code)
          );
          setErrorMessage(
            errorCode ? ErrorMessages[errorCode] : error.message
          );
        } else {
          setErrorMessage("알 수 없는 오류가 발생했습니다.");
        }
      }
    },
    [url, onSubmit, disabled]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const isLoading = state === "loading";

  return (
    <div style={{ width: "100%" }}>
      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          gap: "12px",
          alignItems: "stretch",
        }}
      >
        {/* Native HTML input (as per ui-spec.yaml - input is native, button is QDS) */}
        <input
          type="url"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            if (state === "error") {
              setState("idle");
              setErrorMessage(null);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder="arXiv URL 또는 PDF 링크를 입력하세요"
          disabled={disabled || isLoading}
          aria-label="논문 URL 입력"
          aria-invalid={state === "error"}
          style={{
            flex: 1,
            padding: "12px 16px",
            fontSize: "16px",
            borderRadius: "8px",
            border: `1px solid ${state === "error" ? COLOR.red_50 : COLOR.gray_70}`,
            backgroundColor: COLOR.gray_100,
            color: COLOR.gray_10,
            outline: "none",
            transition: "border-color 0.2s",
          }}
          onFocus={(e) => {
            if (state !== "error") {
              e.target.style.borderColor = COLOR.blue_50;
            }
          }}
          onBlur={(e) => {
            if (state !== "error") {
              e.target.style.borderColor = COLOR.gray_70;
            }
          }}
        />

        {/* QDS Button with loading state */}
        <div style={{ position: "relative", minWidth: "100px" }}>
          <Button
            type="submit"
            variant="accent"
            size="m"
            disabled={disabled || isLoading || !url.trim()}
          >
            {isLoading ? "불러오는 중..." : "불러오기"}
          </Button>
          {isLoading && (
            <div
              style={{
                position: "absolute",
                left: "12px",
                top: "50%",
                transform: "translateY(-50%)",
              }}
            >
              <Spinner size={16} />
            </div>
          )}
        </div>
      </form>

      {/* Error message - ui-spec.yaml: Typography(caption_1, color=red_50) */}
      {state === "error" && errorMessage && (
        <p
          className={typography("caption_1")}
          style={{
            color: COLOR.red_50,
            marginTop: "8px",
            marginLeft: "4px",
          }}
        >
          {errorMessage}
        </p>
      )}

      {/* Helper text */}
      <p
        className={typography("caption_1")}
        style={{
          color: COLOR.gray_50,
          marginTop: "8px",
          marginLeft: "4px",
        }}
      >
        arXiv, PDF 직접 링크를 지원합니다
      </p>
    </div>
  );
}
