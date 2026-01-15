"use client";

/**
 * KeywordExplanationModal Component
 * TASK-013: 키워드 추출 및 설명
 *
 * spec_refs:
 * - ui-spec.yaml#SCR-002.components.keyword_bottomsheet
 * - functional-spec.yaml#F-008 (키워드 추출 및 설명)
 *
 * Features:
 * - 키워드 정의 표시
 * - 논문 맥락 내 설명 표시
 * - 관련 용어 표시
 * - 외부 클릭 시 닫기
 */

import { useEffect, useCallback } from "react";
import { typography } from "@qanda/qds4-web/Typography";
import { COLOR } from "@qanda/qds4-web/base.ts";
import { Spinner } from "@qanda/qds4-web/Spinner";
import { Tag } from "@qanda/qds4-web/Tag";
import type { KeywordExplanation } from "@/hooks/useKeyword";

// Icons
const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
  </svg>
);

const BookIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
    <path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z" />
  </svg>
);

const ContextIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
  </svg>
);

const LinkIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
    <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z" />
  </svg>
);

interface KeywordExplanationModalProps {
  // State
  isOpen: boolean;
  isLoading: boolean;
  error: string | null;

  // Data
  keyword: string | null;
  explanation: KeywordExplanation | null;

  // Actions
  onClose: () => void;
}

export function KeywordExplanationModal({
  isOpen,
  isLoading,
  error,
  keyword,
  explanation,
  onClose,
}: KeywordExplanationModalProps) {
  // Handle escape key to close
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Handle backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  if (!isOpen) return null;

  return (
    <div
      onClick={handleBackdropClick}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "16px",
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="keyword-modal-title"
    >
      <div
        style={{
          backgroundColor: COLOR.gray_100,
          borderRadius: "16px",
          maxWidth: "480px",
          width: "100%",
          maxHeight: "80vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.2)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: `1px solid ${COLOR.gray_80}`,
          }}
        >
          <h2
            id="keyword-modal-title"
            className={typography("title_2_strong")}
            style={{
              color: COLOR.gray_10,
              margin: 0,
            }}
          >
            {keyword || "키워드"}
          </h2>
          <button
            onClick={onClose}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "36px",
              height: "36px",
              border: "none",
              borderRadius: "8px",
              backgroundColor: "transparent",
              color: COLOR.gray_50,
              cursor: "pointer",
            }}
            aria-label="닫기"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflow: "auto",
            padding: "20px",
          }}
        >
          {/* Loading state */}
          {isLoading && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "16px",
                padding: "32px",
              }}
            >
              <Spinner size={32} />
              <span
                className={typography("body_1")}
                style={{ color: COLOR.gray_50 }}
              >
                키워드 설명을 생성하고 있습니다...
              </span>
            </div>
          )}

          {/* Error state */}
          {error && !isLoading && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "12px",
                padding: "32px",
                textAlign: "center",
              }}
            >
              <span
                className={typography("body_1")}
                style={{ color: COLOR.red_50 }}
              >
                {error}
              </span>
            </div>
          )}

          {/* Explanation content */}
          {explanation && !isLoading && (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              {/* Definition */}
              <section>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginBottom: "12px",
                  }}
                >
                  <span style={{ color: COLOR.blue_50 }}>
                    <BookIcon />
                  </span>
                  <h3
                    className={typography("title_3_strong")}
                    style={{ color: COLOR.gray_10, margin: 0 }}
                  >
                    정의
                  </h3>
                </div>
                <p
                  className={typography("body_1")}
                  style={{
                    color: COLOR.gray_20,
                    lineHeight: "1.7",
                    margin: 0,
                  }}
                >
                  {explanation.definition}
                </p>
              </section>

              {/* Context in paper */}
              <section>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginBottom: "12px",
                  }}
                >
                  <span style={{ color: COLOR.orange_50 }}>
                    <ContextIcon />
                  </span>
                  <h3
                    className={typography("title_3_strong")}
                    style={{ color: COLOR.gray_10, margin: 0 }}
                  >
                    논문에서의 맥락
                  </h3>
                </div>
                <p
                  className={typography("body_1")}
                  style={{
                    color: COLOR.gray_20,
                    lineHeight: "1.7",
                    margin: 0,
                    backgroundColor: COLOR.gray_95,
                    padding: "12px 16px",
                    borderRadius: "8px",
                    borderLeft: `3px solid ${COLOR.orange_50}`,
                  }}
                >
                  {explanation.contextInPaper}
                </p>
              </section>

              {/* Related terms */}
              {explanation.relatedTerms.length > 0 && (
                <section>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      marginBottom: "12px",
                    }}
                  >
                    <span style={{ color: COLOR.green_50 }}>
                      <LinkIcon />
                    </span>
                    <h3
                      className={typography("title_3_strong")}
                      style={{ color: COLOR.gray_10, margin: 0 }}
                    >
                      관련 용어
                    </h3>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "8px",
                    }}
                  >
                    {explanation.relatedTerms.map((term) => (
                      <Tag key={term} color="gray" style="tonal">
                        {term}
                      </Tag>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            padding: "12px 20px",
            borderTop: `1px solid ${COLOR.gray_80}`,
          }}
        >
          <button
            onClick={onClose}
            className={typography("body_2_strong")}
            style={{
              padding: "10px 20px",
              border: "none",
              borderRadius: "8px",
              backgroundColor: COLOR.gray_90,
              color: COLOR.gray_30,
              cursor: "pointer",
            }}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
