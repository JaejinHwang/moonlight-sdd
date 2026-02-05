"use client";

/**
 * TranslationToolbar Component
 * TASK-010: 자동 번역 기능
 *
 * spec_refs:
 * - ui-spec.yaml#SCR-002.components.toolbar
 * - ui-spec.yaml#SCR-002.components.translation_toggle
 * - functional-spec.yaml#F-005.states
 *
 * Features:
 * - 번역 언어 선택
 * - 번역 토글 (Switch)
 * - 원문/번역 동시 표시 토글
 * - 번역 상태 표시 (Spinner)
 */

import { useState, useCallback } from "react";
import { typography } from "@qanda/qds4-web/Typography";
import { COLOR } from "@qanda/qds4-web/base.ts";
import { Switch } from "@qanda/qds4-web/Switch";
import { Spinner } from "@qanda/qds4-web/Spinner";
import { Button } from "@qanda/qds4-web/Button";
import type { TranslationState } from "@/types";
import { SUPPORTED_LANGUAGES } from "@/hooks/useTranslation";

interface TranslationToolbarProps {
  state: TranslationState;
  targetLang: string;
  sourceLang: string;
  showingBoth: boolean;
  error: string | null;
  onTranslate: () => void;
  onClear: () => void;
  onToggleShowBoth: () => void;
  onTargetLangChange: (lang: string) => void;
  onRetry: () => void;
}

export function TranslationToolbar({
  state,
  targetLang,
  sourceLang,
  showingBoth,
  error,
  onTranslate,
  onClear,
  onToggleShowBoth,
  onTargetLangChange,
  onRetry,
}: TranslationToolbarProps) {
  const [isLangSelectorOpen, setIsLangSelectorOpen] = useState(false);

  const isTranslating = state === "translating";
  const isTranslated = state === "translated" || state === "showing_both";
  const isError = state === "error";

  // Get current target language display name
  const currentLangName =
    SUPPORTED_LANGUAGES.find((l) => l.code === targetLang)?.name || targetLang;

  // Handle switch toggle
  const handleSwitchChange = useCallback(
    (checked: boolean) => {
      if (checked) {
        onTranslate();
      } else {
        onClear();
      }
    },
    [onTranslate, onClear]
  );

  // Handle language selection
  const handleLangSelect = useCallback(
    (langCode: string) => {
      onTargetLangChange(langCode);
      setIsLangSelectorOpen(false);
      // If already translated, re-translate with new language
      if (isTranslated) {
        // Wait for state update then translate
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
        gap: "16px",
        padding: "8px 16px",
        borderBottom: `1px solid ${COLOR.gray_80}`,
        backgroundColor: COLOR.gray_95,
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
          onChange={handleSwitchChange}
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
          <Switch
            checked={showingBoth}
            onChange={onToggleShowBoth}
          />
        </div>
      )}

      {/* Error state */}
      {isError && error && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginLeft: "auto",
          }}
        >
          <span
            className={typography("body_2")}
            style={{ color: COLOR.red_50 }}
          >
            {error}
          </span>
          <Button
            variant="outlined"
            size="s"
            onClick={onRetry}
          >
            다시 시도
          </Button>
        </div>
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
