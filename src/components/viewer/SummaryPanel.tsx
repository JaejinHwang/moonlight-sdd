"use client";

/**
 * SummaryPanel Component
 * TASK-012: 논문 요약 기능
 *
 * spec_refs:
 * - ui-spec.yaml#SCR-002.components.side_panel
 * - functional-spec.yaml#F-007 (논문 요약)
 *
 * Features:
 * - 전체 요약 표시
 * - 섹션별 요약 아코디언
 * - 핵심 발견 목록
 * - 섹션 클릭 시 뷰어 스크롤 연동
 */

import { useCallback } from "react";
import { typography } from "@qanda/qds4-web/Typography";
import { COLOR } from "@qanda/qds4-web/base.ts";
import { Spinner } from "@qanda/qds4-web/Spinner";
import { Button } from "@qanda/qds4-web/Button";
import type { SectionSummary } from "@/types";
import type { SummaryState } from "@/hooks/useSummary";

// Icons
const ChevronDownIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
    <path d="M7 10l5 5 5-5z" />
  </svg>
);

const ChevronUpIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
    <path d="M7 14l5-5 5 5z" />
  </svg>
);

const SummaryIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
    <path d="M14 17H4v2h10v-2zm6-8H4v2h16V9zM4 15h16v-2H4v2zM4 5v2h16V5H4z" />
  </svg>
);

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
  </svg>
);

const LinkIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
    <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z" />
  </svg>
);

interface SummaryPanelProps {
  // State
  state: SummaryState;
  error: string | null;

  // Data
  overallSummary: string | null;
  sectionSummaries: SectionSummary[];
  keyFindings: string[];

  // Accordion state
  expandedSections: Set<string>;

  // Actions
  onGenerateSummary: () => void;
  onRetry: () => void;
  onToggleSection: (sectionId: string) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onSectionClick: (sectionId: string) => void;
  onClose: () => void;
}

export function SummaryPanel({
  state,
  error,
  overallSummary,
  sectionSummaries,
  keyFindings,
  expandedSections,
  onGenerateSummary,
  onRetry,
  onToggleSection,
  onExpandAll,
  onCollapseAll,
  onSectionClick,
  onClose,
}: SummaryPanelProps) {
  const isSummarizing = state === "summarizing";
  const isReady = state === "ready";
  const isError = state === "error";
  const isIdle = state === "idle";

  // Handle section header click - toggle accordion
  const handleSectionToggle = useCallback(
    (sectionId: string) => {
      onToggleSection(sectionId);
    },
    [onToggleSection]
  );

  // Handle "go to section" click - scroll to section
  const handleGoToSection = useCallback(
    (sectionId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      onSectionClick(sectionId);
    },
    [onSectionClick]
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
            <SummaryIcon />
          </span>
          <span
            className={typography("title_3_strong")}
            style={{ color: COLOR.gray_10 }}
          >
            논문 요약
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
          aria-label="요약 패널 닫기"
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
        {/* Idle state - Generate button */}
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
              AI가 논문의 핵심 내용을 요약해드립니다.
            </span>
            <Button variant="accent" size="m" onClick={onGenerateSummary}>
              요약 생성하기
            </Button>
          </div>
        )}

        {/* Loading state */}
        {isSummarizing && (
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
              논문을 분석하고 있습니다...
            </span>
            <span
              className={typography("caption_1")}
              style={{ color: COLOR.gray_60 }}
            >
              최대 45초 정도 소요될 수 있습니다
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

        {/* Ready state - Show summary */}
        {isReady && overallSummary && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Overall Summary */}
            <div>
              <h3
                className={typography("title_3_strong")}
                style={{
                  color: COLOR.gray_10,
                  marginBottom: "12px",
                }}
              >
                전체 요약
              </h3>
              <div
                className={typography("body_2")}
                style={{
                  color: COLOR.gray_20,
                  lineHeight: "1.6",
                  whiteSpace: "pre-wrap",
                }}
              >
                {overallSummary}
              </div>
            </div>

            {/* Key Findings */}
            {keyFindings.length > 0 && (
              <div>
                <h3
                  className={typography("title_3_strong")}
                  style={{
                    color: COLOR.gray_10,
                    marginBottom: "12px",
                  }}
                >
                  핵심 발견
                </h3>
                <ul
                  style={{
                    margin: 0,
                    padding: "0 0 0 20px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  {keyFindings.map((finding, index) => (
                    <li
                      key={index}
                      className={typography("body_2")}
                      style={{
                        color: COLOR.gray_20,
                        lineHeight: "1.5",
                      }}
                    >
                      {finding}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Section Summaries */}
            {sectionSummaries.length > 0 && (
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "12px",
                  }}
                >
                  <h3
                    className={typography("title_3_strong")}
                    style={{ color: COLOR.gray_10 }}
                  >
                    섹션별 요약
                  </h3>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      onClick={onExpandAll}
                      className={typography("caption_1")}
                      style={{
                        padding: "4px 8px",
                        border: "none",
                        borderRadius: "4px",
                        backgroundColor: "transparent",
                        color: COLOR.blue_50,
                        cursor: "pointer",
                      }}
                    >
                      모두 펼치기
                    </button>
                    <button
                      onClick={onCollapseAll}
                      className={typography("caption_1")}
                      style={{
                        padding: "4px 8px",
                        border: "none",
                        borderRadius: "4px",
                        backgroundColor: "transparent",
                        color: COLOR.blue_50,
                        cursor: "pointer",
                      }}
                    >
                      모두 접기
                    </button>
                  </div>
                </div>

                {/* Accordion */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  {sectionSummaries.map((section) => {
                    const isExpanded = expandedSections.has(section.sectionId);

                    return (
                      <div
                        key={section.sectionId}
                        style={{
                          border: `1px solid ${COLOR.gray_80}`,
                          borderRadius: "8px",
                          overflow: "hidden",
                          backgroundColor: COLOR.gray_100,
                        }}
                      >
                        {/* Accordion header */}
                        <button
                          onClick={() => handleSectionToggle(section.sectionId)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            width: "100%",
                            padding: "12px",
                            border: "none",
                            backgroundColor: isExpanded
                              ? COLOR.gray_95
                              : "transparent",
                            cursor: "pointer",
                            textAlign: "left",
                          }}
                        >
                          <span
                            className={typography("body_2_strong")}
                            style={{
                              color: COLOR.gray_10,
                              flex: 1,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              paddingRight: "8px",
                            }}
                          >
                            {section.title}
                          </span>
                          <span style={{ color: COLOR.gray_50 }}>
                            {isExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
                          </span>
                        </button>

                        {/* Accordion content */}
                        {isExpanded && (
                          <div
                            style={{
                              padding: "0 12px 12px",
                              borderTop: `1px solid ${COLOR.gray_90}`,
                            }}
                          >
                            <p
                              className={typography("body_2")}
                              style={{
                                color: COLOR.gray_30,
                                lineHeight: "1.5",
                                margin: "12px 0",
                              }}
                            >
                              {section.summary}
                            </p>
                            <button
                              onClick={(e) =>
                                handleGoToSection(section.sectionId, e)
                              }
                              className={typography("caption_1")}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "4px",
                                padding: "6px 10px",
                                border: `1px solid ${COLOR.gray_80}`,
                                borderRadius: "4px",
                                backgroundColor: "transparent",
                                color: COLOR.blue_50,
                                cursor: "pointer",
                              }}
                            >
                              <LinkIcon />
                              해당 섹션으로 이동
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
