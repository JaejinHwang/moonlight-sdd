"use client";

import { useCallback, useState, useRef } from "react";
import { Button } from "@qanda/qds4-web/Button";
import { Icon } from "@qanda/qds4-web/Icon";
import { Spinner } from "@qanda/qds4-web/Spinner";
import { Tag } from "@qanda/qds4-web/Tag";
import { typography } from "@qanda/qds4-web/Typography";
import { COLOR } from "@qanda/qds4-web/base.ts";

// Error codes from functional-spec.yaml#F-001
const ErrorMessages = {
  INVALID_FILE_TYPE: {
    code: "INVALID_FILE_TYPE",
    message: "PDF 파일만 업로드할 수 있습니다.",
    recovery: "올바른 PDF 파일을 선택해주세요.",
  },
  FILE_TOO_LARGE: {
    code: "FILE_TOO_LARGE",
    message: "파일 크기가 10MB를 초과합니다.",
    recovery: "더 작은 파일을 업로드하거나 파일을 압축해주세요.",
  },
} as const;

type ErrorCode = keyof typeof ErrorMessages;

// States from functional-spec.yaml#F-001
type UploadState = "idle" | "drag_over" | "validating" | "uploading" | "error";

interface DropZoneProps {
  onFileSelect: (file: File) => Promise<void>;
  maxSize?: number; // bytes, default 10MB
  acceptedTypes?: string[];
  disabled?: boolean;
}

// Upload icon SVG
const UploadIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
    <path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z" />
  </svg>
);

export function DropZone({
  onFileSelect,
  maxSize = 10 * 1024 * 1024, // 10MB default
  acceptedTypes = ["application/pdf"],
  disabled = false,
}: DropZoneProps) {
  const [state, setState] = useState<UploadState>("idle");
  const [error, setError] = useState<ErrorCode | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Validate file according to functional-spec.yaml#F-001
  const validateFile = useCallback(
    (file: File): ErrorCode | null => {
      // Check file type - MIME type check with extension fallback
      // Some browsers may not correctly detect MIME type for files with
      // special characters in filename or via drag-and-drop
      const isPdfByMime = acceptedTypes.includes(file.type);
      const isPdfByExtension = file.name.toLowerCase().endsWith(".pdf");

      if (!isPdfByMime && !isPdfByExtension) {
        return "INVALID_FILE_TYPE";
      }
      // Check file size
      if (file.size > maxSize) {
        return "FILE_TOO_LARGE";
      }
      return null;
    },
    [acceptedTypes, maxSize]
  );

  const handleFile = useCallback(
    async (file: File) => {
      setFileName(file.name);

      // State: validating
      setState("validating");
      const validationError = validateFile(file);

      if (validationError) {
        // State: error
        setState("error");
        setError(validationError);
        return;
      }

      // State: uploading
      setState("uploading");
      setError(null);

      try {
        await onFileSelect(file);
        // Note: completed state will be handled by parent component
        // After successful upload, parent will navigate to viewer
        setState("idle");
      } catch {
        setState("error");
        setError("INVALID_FILE_TYPE"); // Generic error fallback
      }
    },
    [onFileSelect, validateFile]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled && state !== "uploading") {
        setState("drag_over");
      }
    },
    [disabled, state]
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (state === "drag_over") {
        setState("idle");
      }
    },
    [state]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();

      if (disabled || state === "uploading") return;

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFile(files[0]);
      }
    },
    [disabled, state, handleFile]
  );

  const handleClick = useCallback(() => {
    if (!disabled && state !== "uploading") {
      fileInputRef.current?.click();
    }
  }, [disabled, state]);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFile(files[0]);
      }
      // Reset input for same file selection
      e.target.value = "";
    },
    [handleFile]
  );

  const handleRetry = useCallback(() => {
    setState("idle");
    setError(null);
    setFileName(null);
  }, []);

  // Styles based on state (ui-spec.yaml#SCR-001.components.upload_dropzone)
  const getContainerStyles = (): React.CSSProperties => {
    const baseStyles: React.CSSProperties = {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "48px 24px",
      borderRadius: "12px",
      borderWidth: "2px",
      borderStyle: "dashed",
      cursor: disabled || state === "uploading" ? "default" : "pointer",
      transition: "all 0.2s ease",
      minHeight: "200px",
    };

    switch (state) {
      case "drag_over":
        return {
          ...baseStyles,
          borderColor: COLOR.blue_50,
          backgroundColor: COLOR.blue_95,
        };
      case "error":
        return {
          ...baseStyles,
          borderColor: COLOR.red_50,
          backgroundColor: COLOR.gray_95,
        };
      case "uploading":
      case "validating":
        return {
          ...baseStyles,
          borderColor: COLOR.gray_60,
          backgroundColor: COLOR.gray_95,
        };
      default:
        return {
          ...baseStyles,
          borderColor: COLOR.gray_60,
          backgroundColor: COLOR.gray_100,
        };
    }
  };

  const UploadIconComponent = (props: {
    size?: number;
    color?: keyof typeof COLOR;
  }) => (
    <Icon {...props}>
      <UploadIcon />
    </Icon>
  );

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      style={getContainerStyles()}
      role="button"
      tabIndex={0}
      aria-label="PDF 파일 업로드 영역"
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          handleClick();
        }
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        onChange={handleFileInputChange}
        style={{ display: "none" }}
        aria-hidden="true"
      />

      {/* Idle State */}
      {state === "idle" && (
        <>
          <UploadIconComponent size={48} color="gray_50" />
          <p
            className={typography("body_1")}
            style={{ color: COLOR.gray_30, marginTop: "16px" }}
          >
            PDF 파일을 여기에 드래그하거나 클릭하세요
          </p>
          <p
            className={typography("body_2")}
            style={{ color: COLOR.gray_50, marginTop: "8px" }}
          >
            최대 10MB까지 업로드 가능
          </p>
        </>
      )}

      {/* Drag Over State */}
      {state === "drag_over" && (
        <>
          <UploadIconComponent size={48} color="blue_50" />
          <p
            className={typography("body_1")}
            style={{ color: COLOR.blue_50, marginTop: "16px" }}
          >
            파일을 놓아주세요
          </p>
        </>
      )}

      {/* Validating/Uploading State */}
      {(state === "validating" || state === "uploading") && (
        <>
          <Spinner size={48} />
          <p
            className={typography("body_2")}
            style={{ color: COLOR.gray_30, marginTop: "16px" }}
          >
            {fileName}
          </p>
          <p
            className={typography("body_2")}
            style={{ color: COLOR.gray_50, marginTop: "8px" }}
          >
            {state === "validating" ? "파일 검증 중..." : "업로드 중..."}
          </p>
        </>
      )}

      {/* Error State */}
      {state === "error" && error && (
        <>
          <Tag color="red" style="tonal">
            {ErrorMessages[error].message}
          </Tag>
          <p
            className={typography("body_2")}
            style={{ color: COLOR.gray_50, marginTop: "12px" }}
          >
            {ErrorMessages[error].recovery}
          </p>
          <div
            onClick={(e) => {
              e.stopPropagation();
            }}
            style={{ marginTop: "16px" }}
          >
            <Button
              variant="outlined"
              size="s"
              onClick={handleRetry}
            >
              다시 시도
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
