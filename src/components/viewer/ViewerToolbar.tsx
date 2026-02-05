"use client";

/**
 * ViewerToolbar Component
 * TASK-010: 자동 번역 기능
 * TASK-011: 핵심 하이라이트 기능
 * TASK-012: 논문 요약 기능
 * TASK-013: 키워드 추출 및 설명
 *
 * spec_refs:
 * - ui-spec.yaml#SCR-002.components.toolbar
 * - ui-spec.yaml#SCR-002.components.translation_toggle
 * - functional-spec.yaml#F-005.states (번역)
 * - functional-spec.yaml#F-006.states (하이라이트)
 * - functional-spec.yaml#F-007.states (요약)
 * - functional-spec.yaml#F-008.states (키워드)
 *
 * Features:
 * - 번역 언어 선택 및 번역 토글
 * - 하이라이트 토글
 * - 원문/번역 동시 표시 토글
 * - 요약 패널 토글
 * - 키워드 패널 토글
 * - 처리 상태 표시 (Spinner)
 */

import { useState, useCallback } from "react";
import { typography } from "@qanda/qds4-web/Typography";
import { COLOR } from "@qanda/qds4-web/base.ts";
import { Switch } from "@qanda/qds4-web/Switch";
import { Spinner } from "@qanda/qds4-web/Spinner";
import { Button } from "@qanda/qds4-web/Button";
import type { TranslationState } from "@/types";
import type { HighlightState } from "@/hooks/useHighlight";
import type { SummaryState } from "@/hooks/useSummary";
import type { KeywordState } from "@/hooks/useKeyword";
import { SUPPORTED_LANGUAGES } from "@/hooks/useTranslation";

// Summary icon
const SummaryIcon = ({ active }: { active?: boolean }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill={active ? COLOR.blue_50 : COLOR.gray_50}
  >
    <path d="M14 17H4v2h10v-2zm6-8H4v2h16V9zM4 15h16v-2H4v2zM4 5v2h16V5H4z" />
  </svg>
);

// Keyword icon (TASK-013)
const KeywordIcon = ({ active }: { active?: boolean }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill={active ? COLOR.blue_50 : COLOR.gray_50}
  >
    <path d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z" />
  </svg>
);

interface ViewerToolbarProps {
  // Translation props
  translationState: TranslationState;
  targetLang: string;
  sourceLang: string;
  showingBoth: boolean;
  translationError: string | null;
  onTranslate: () => void;
  onClearTranslation: () => void;
  onToggleShowBoth: () => void;
  onTargetLangChange: (lang: string) => void;
  onRetryTranslation: () => void;

  // Highlight props
  highlightState: HighlightState;
  highlightError: string | null;
  onToggleHighlight: () => void;
  onRetryHighlight: () => void;

  // Summary props (TASK-012)
  summaryState?: SummaryState;
  isSummaryPanelOpen?: boolean;
  onToggleSummaryPanel?: () => void;

  // Keyword props (TASK-013)
  keywordState?: KeywordState;
  isKeywordPanelOpen?: boolean;
  onToggleKeywordPanel?: () => void;
}

export function ViewerToolbar({
  // Translation
  translationState,
  targetLang,
  sourceLang,
  showingBoth,
  translationError,
  onTranslate,
  onClearTranslation,
  onToggleShowBoth,
  onTargetLangChange,
  onRetryTranslation,

  // Highlight
  highlightState,
  highlightError,
  onToggleHighlight,
  onRetryHighlight,

  // Summary (TASK-012)
  summaryState,
  isSummaryPanelOpen,
  onToggleSummaryPanel,

  // Keyword (TASK-013)
  keywordState,
  isKeywordPanelOpen,
  onToggleKeywordPanel,
}: ViewerToolbarProps) {
  const [isLangSelectorOpen, setIsLangSelectorOpen] = useState(false);

  // Translation state helpers
  const isTranslating = translationState === "translating";
  const isTranslated =
    translationState === "translated" || translationState === "showing_both";
  const isTranslationError = translationState === "error";

  // Highlight state helpers
  const isAnalyzing = highlightState === "analyzing";
  const isHighlighted = highlightState === "highlighted";
  const isHighlightHidden = highlightState === "hidden";
  const isHighlightError = highlightState === "error";

  // Get current target language display name
  const currentLangName =
    SUPPORTED_LANGUAGES.find((l) => l.code === targetLang)?.name || targetLang;

  // Handle translation switch toggle
  const handleTranslationSwitchChange = useCallback(
    (checked: boolean) => {
      if (checked) {
        onTranslate();
      } else {
        onClearTranslation();
      }
    },
    [onTranslate, onClearTranslation]
  );

  // Handle highlight switch toggle
  const handleHighlightSwitchChange = useCallback(
    (checked: boolean) => {
      onToggleHighlight();
    },
    [onToggleHighlight]
  );

  // Handle language selection
  const handleLangSelect = useCallback(
    (langCode: string) => {
      onTargetLangChange(langCode);
      setIsLangSelectorOpen(false);
      // If already translated, re-translate with new language
      if (isTranslated) {
        setTimeout(() => onTranslate(), 0);
      }
    },
    [onTargetLangChange, isTranslated, onTranslate]
  );

  // Filter out source language from options
  const availableLanguages = SUPPORTED_LANGUAGES.filter(
    (l) => l.code !== sourceLang
  );

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "24px",
        padding: "8px 16px",
        borderBottom: `1px solid ${COLOR.gray_80}`,
        backgroundColor: COLOR.gray_95,
        flexWrap: "wrap",
      }}
    >
      {/* Translation Section */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
        {/* Language selector */}
        <div style={{ position: "relative" }}>
          <Button
            variant="outlined"
            size="s"
            onClick={() => setIsLangSelectorOpen(!isLangSelectorOpen)}
            disabled={isTranslating}
          >
            {`${currentLangName} ▼`}
          </Button>

          {/* Language dropdown */}
          {isLangSelectorOpen && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                marginTop: "4px",
                minWidth: "120px",
                backgroundColor: COLOR.gray_100,
                border: `1px solid ${COLOR.gray_80}`,
                borderRadius: "8px",
                boxShadow: `0 4px 12px color-mix(in srgb, ${COLOR.gray_10} 15%, transparent)`,
                zIndex: 100,
                overflow: "hidden",
              }}
            >
              {availableLanguages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => handleLangSelect(lang.code)}
                  className={typography("body_2")}
                  style={{
                    display: "block",
                    width: "100%",
                    padding: "10px 16px",
                    textAlign: "left",
                    border: "none",
                    backgroundColor:
                      lang.code === targetLang ? COLOR.blue_95 : "transparent",
                    color:
                      lang.code === targetLang ? COLOR.blue_50 : COLOR.gray_20,
                    cursor: "pointer",
                  }}
                >
                  {lang.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Translation toggle switch */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span
            className={typography("body_2")}
            style={{ color: COLOR.gray_40 }}
          >
            번역
          </span>
          <Switch
            checked={isTranslated}
            onChange={handleTranslationSwitchChange}
            disabled={isTranslating}
          />
          {isTranslating && <Spinner size={16} />}
        </div>

        {/* Show both toggle (only visible when translated) */}
        {isTranslated && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span
              className={typography("body_2")}
              style={{ color: COLOR.gray_40 }}
            >
              원문 함께 보기
            </span>
            <Switch checked={showingBoth} onChange={onToggleShowBoth} />
          </div>
        )}

        {/* Translation error */}
        {isTranslationError && translationError && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span
              className={typography("body_2")}
              style={{ color: COLOR.red_50 }}
            >
              {translationError}
            </span>
            <Button variant="outlined" size="s" onClick={onRetryTranslation}>
              다시 시도
            </Button>
          </div>
        )}
      </div>

      {/* Divider */}
      <div
        style={{
          width: "1px",
          height: "24px",
          backgroundColor: COLOR.gray_70,
        }}
      />

      {/* Highlight Section - functional-spec.yaml#F-006 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        {/* Highlight icon */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill={isHighlighted ? COLOR.yellow_50 : COLOR.gray_50}
        >
          <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
        </svg>
        <span className={typography("body_2")} style={{ color: COLOR.gray_40 }}>
          핵심 하이라이트
        </span>
        <Switch
          checked={isHighlighted}
          onChange={handleHighlightSwitchChange}
          disabled={isAnalyzing}
        />
        {isAnalyzing && <Spinner size={16} />}

        {/* Highlight error */}
        {isHighlightError && highlightError && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span
              className={typography("body_2")}
              style={{ color: COLOR.red_50 }}
            >
              {highlightError}
            </span>
            <Button variant="outlined" size="s" onClick={onRetryHighlight}>
              다시 시도
            </Button>
          </div>
        )}
      </div>

      {/* Divider */}
      {onToggleSummaryPanel && (
        <div
          style={{
            width: "1px",
            height: "24px",
            backgroundColor: COLOR.gray_70,
          }}
        />
      )}

      {/* Summary Section - TASK-012, functional-spec.yaml#F-007 */}
      {onToggleSummaryPanel && (
        <Button
          variant={isSummaryPanelOpen ? "tonal" : "outlined"}
          size="s"
          onClick={onToggleSummaryPanel}
        >
          {summaryState === "summarizing" ? "요약 중..." : "요약"}
        </Button>
      )}

      {/* Keyword Section - TASK-013, functional-spec.yaml#F-008 */}
      {onToggleKeywordPanel && (
        <Button
          variant={isKeywordPanelOpen ? "tonal" : "outlined"}
          size="s"
          onClick={onToggleKeywordPanel}
        >
          {keywordState === "extracting" ? "추출 중..." : "키워드"}
        </Button>
      )}

      {/* Close dropdown when clicking outside */}
      {isLangSelectorOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 99,
          }}
          onClick={() => setIsLangSelectorOpen(false)}
        />
      )}
    </div>
  );
}
