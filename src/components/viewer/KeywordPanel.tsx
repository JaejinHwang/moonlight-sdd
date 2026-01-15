"use client";

/**
 * KeywordPanel Component
 * TASK-013: 키워드 추출 및 설명
 *
 * spec_refs:
 * - ui-spec.yaml#SCR-002.components.side_panel
 * - functional-spec.yaml#F-008 (키워드 추출 및 설명)
 *
 * Features:
 * - 핵심 키워드 목록 표시
 * - 중요도별 키워드 그룹화
 * - 키워드 클릭 시 설명 모달 표시
 * - 키워드 빈도수 표시
 */

import { useCallback } from "react";
import { typography } from "@qanda/qds4-web/Typography";
import { COLOR } from "@qanda/qds4-web/base.ts";
import { Spinner } from "@qanda/qds4-web/Spinner";
import { Button } from "@qanda/qds4-web/Button";
import { Tag } from "@qanda/qds4-web/Tag";
import type { Keyword } from "@/types";
import type { KeywordState } from "@/hooks/useKeyword";

// Icons
const KeywordIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
    <path d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z" />
  </svg>
);

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
  </svg>
);

interface KeywordPanelProps {
  // State
  state: KeywordState;
  error: string | null;

  // Data
  keywords: Keyword[];

  // Actions
  onExtractKeywords: () => void;
  onKeywordClick: (term: string) => void;
  onRetry: () => void;
  onClose: () => void;
}

// Get tag color based on importance
function getImportanceColor(
  importance: "high" | "medium" | "low"
): "blue" | "orange" | "gray" {
  switch (importance) {
    case "high":
      return "blue";
    case "medium":
      return "orange";
    case "low":
      return "gray";
  }
}

// Get importance label in Korean
function getImportanceLabel(importance: "high" | "medium" | "low"): string {
  switch (importance) {
    case "high":
      return "핵심";
    case "medium":
      return "중요";
    case "low":
      return "관련";
  }
}

export function KeywordPanel({
  state,
  error,
  keywords,
  onExtractKeywords,
  onKeywordClick,
  onRetry,
  onClose,
}: KeywordPanelProps) {
  const isExtracting = state === "extracting";
  const isReady = state === "ready";
  const isError = state === "error";
  const isIdle = state === "idle";
  const isExplaining = state === "explaining";

  // Group keywords by importance
  const groupedKeywords = {
    high: keywords.filter((k) => k.importance === "high"),
    medium: keywords.filter((k) => k.importance === "medium"),
    low: keywords.filter((k) => k.importance === "low"),
  };

  // Handle keyword click
  const handleKeywordClick = useCallback(
    (term: string) => {
      onKeywordClick(term);
    },
    [onKeywordClick]
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        backgroundColor: COLOR.gray_100,
        borderLeft: `1px solid ${COLOR.gray_80}`,
        width: "320px",
        minWidth: "280px",
        maxWidth: "400px",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          borderBottom: `1px solid ${COLOR.gray_80}`,
          backgroundColor: COLOR.gray_95,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ color: COLOR.blue_50 }}>
            <KeywordIcon />
          </span>
          <span
            className={typography("title_3_strong")}
            style={{ color: COLOR.gray_10 }}
          >
            핵심 키워드
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "32px",
            height: "32px",
            border: "none",
            borderRadius: "4px",
            backgroundColor: "transparent",
            color: COLOR.gray_50,
            cursor: "pointer",
          }}
          aria-label="키워드 패널 닫기"
        >
          <CloseIcon />
        </button>
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "16px",
        }}
      >
        {/* Idle state - Extract button */}
        {isIdle && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "16px",
              padding: "32px 16px",
              textAlign: "center",
            }}
          >
            <span
              className={typography("body_1")}
              style={{ color: COLOR.gray_50 }}
            >
              AI가 논문에서 핵심 키워드를 추출합니다.
            </span>
            <Button variant="accent" size="m" onClick={onExtractKeywords}>
              키워드 추출하기
            </Button>
          </div>
        )}

        {/* Loading state */}
        {isExtracting && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "16px",
              padding: "32px 16px",
            }}
          >
            <Spinner size={32} />
            <span
              className={typography("body_1")}
              style={{ color: COLOR.gray_50 }}
            >
              키워드를 추출하고 있습니다...
            </span>
            <span
              className={typography("caption_1")}
              style={{ color: COLOR.gray_60 }}
            >
              최대 15초 정도 소요될 수 있습니다
            </span>
          </div>
        )}

        {/* Error state */}
        {isError && error && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "16px",
              padding: "32px 16px",
              textAlign: "center",
            }}
          >
            <span
              className={typography("body_1")}
              style={{ color: COLOR.red_50 }}
            >
              {error}
            </span>
            <Button variant="outlined" size="m" onClick={onRetry}>
              다시 시도
            </Button>
          </div>
        )}

        {/* Ready state - Show keywords */}
        {(isReady || isExplaining) && keywords.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Stats */}
            <div
              className={typography("caption_1")}
              style={{ color: COLOR.gray_50 }}
            >
              총 {keywords.length}개의 키워드가 추출되었습니다
            </div>

            {/* High importance keywords */}
            {groupedKeywords.high.length > 0 && (
              <KeywordGroup
                title="핵심 키워드"
                keywords={groupedKeywords.high}
                importance="high"
                onKeywordClick={handleKeywordClick}
                isExplaining={isExplaining}
              />
            )}

            {/* Medium importance keywords */}
            {groupedKeywords.medium.length > 0 && (
              <KeywordGroup
                title="중요 키워드"
                keywords={groupedKeywords.medium}
                importance="medium"
                onKeywordClick={handleKeywordClick}
                isExplaining={isExplaining}
              />
            )}

            {/* Low importance keywords */}
            {groupedKeywords.low.length > 0 && (
              <KeywordGroup
                title="관련 키워드"
                keywords={groupedKeywords.low}
                importance="low"
                onKeywordClick={handleKeywordClick}
                isExplaining={isExplaining}
              />
            )}
          </div>
        )}

        {/* Ready but no keywords */}
        {isReady && keywords.length === 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "16px",
              padding: "32px 16px",
              textAlign: "center",
            }}
          >
            <span
              className={typography("body_1")}
              style={{ color: COLOR.gray_50 }}
            >
              추출된 키워드가 없습니다.
            </span>
            <Button variant="outlined" size="m" onClick={onExtractKeywords}>
              다시 추출하기
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// Keyword group component
interface KeywordGroupProps {
  title: string;
  keywords: Keyword[];
  importance: "high" | "medium" | "low";
  onKeywordClick: (term: string) => void;
  isExplaining: boolean;
}

function KeywordGroup({
  title,
  keywords,
  importance,
  onKeywordClick,
  isExplaining,
}: KeywordGroupProps) {
  return (
    <div>
      <h3
        className={typography("title_3_strong")}
        style={{
          color: COLOR.gray_10,
          marginBottom: "12px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        {title}
        <Tag color={getImportanceColor(importance)} style="tonal">
          {String(keywords.length)}
        </Tag>
      </h3>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "8px",
        }}
      >
        {keywords.map((keyword) => (
          <button
            key={keyword.term}
            onClick={() => onKeywordClick(keyword.term)}
            disabled={isExplaining}
            className={typography("body_2")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 12px",
              border: `1px solid ${COLOR.gray_80}`,
              borderRadius: "16px",
              backgroundColor: COLOR.gray_100,
              color: COLOR.gray_20,
              cursor: isExplaining ? "wait" : "pointer",
              transition: "all 0.2s ease",
              opacity: isExplaining ? 0.7 : 1,
            }}
            onMouseEnter={(e) => {
              if (!isExplaining) {
                e.currentTarget.style.backgroundColor = COLOR.blue_95;
                e.currentTarget.style.borderColor = COLOR.blue_50;
                e.currentTarget.style.color = COLOR.blue_50;
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = COLOR.gray_100;
              e.currentTarget.style.borderColor = COLOR.gray_80;
              e.currentTarget.style.color = COLOR.gray_20;
            }}
          >
            <span>{keyword.term}</span>
            {keyword.frequency > 1 && (
              <span
                className={typography("caption_2")}
                style={{
                  color: COLOR.gray_50,
                  backgroundColor: COLOR.gray_90,
                  padding: "2px 6px",
                  borderRadius: "10px",
                }}
              >
                {keyword.frequency}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
