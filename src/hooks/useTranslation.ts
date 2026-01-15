/**
 * useTranslation Hook
 * TASK-010: 자동 번역 기능
 *
 * spec_refs:
 * - functional-spec.yaml#F-005 (states)
 * - ui-spec.yaml#SCR-002.components.translation_toggle
 *
 * Implements the translation state machine from functional-spec:
 * - idle: 번역 대기 상태
 * - translating: 번역 처리 중
 * - translated: 번역 완료
 * - showing_both: 원문과 번역문 동시 표시
 * - error: 번역 에러
 */

import { useState, useCallback, useMemo } from "react";
import type { TranslationState, Translation, Section } from "@/types";

export interface TranslationData {
  sectionId: string;
  original: string;
  translated: string;
}

interface UseTranslationOptions {
  paperId: string;
  sections: Section[];
  defaultTargetLang?: string;
}

interface UseTranslationReturn {
  // State
  state: TranslationState;
  targetLang: string;
  translations: Map<string, TranslationData>;
  error: string | null;

  // Actions
  translate: (sectionId?: string) => Promise<void>;
  clearTranslation: () => void;
  setTargetLang: (lang: string) => void;
  toggleShowBoth: () => void;
  retry: () => void;

  // Helpers
  isTranslating: boolean;
  isTranslated: boolean;
  showingBoth: boolean;
  getTranslationForSection: (sectionId: string) => TranslationData | null;
}

// Supported languages with display names
export const SUPPORTED_LANGUAGES = [
  { code: "ko", name: "한국어" },
  { code: "en", name: "English" },
  { code: "ja", name: "日本語" },
  { code: "zh", name: "中文" },
  { code: "es", name: "Español" },
  { code: "fr", name: "Français" },
  { code: "de", name: "Deutsch" },
  { code: "pt", name: "Português" },
] as const;

export function useTranslation({
  paperId,
  sections,
  defaultTargetLang = "ko",
}: UseTranslationOptions): UseTranslationReturn {
  // State machine: idle | translating | translated | showing_both | error
  const [state, setState] = useState<TranslationState>("idle");
  const [targetLang, setTargetLang] = useState<string>(defaultTargetLang);
  const [translations, setTranslations] = useState<Map<string, TranslationData>>(
    new Map()
  );
  const [error, setError] = useState<string | null>(null);
  const [lastSectionId, setLastSectionId] = useState<string | null>(null);

  // Translate sections
  const translate = useCallback(
    async (sectionId?: string) => {
      // State transition: idle/error → translating
      setState("translating");
      setError(null);
      setLastSectionId(sectionId || null);

      try {
        const response = await fetch(`/api/papers/${paperId}/translate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            target_lang: targetLang,
            section_id: sectionId || null,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          // State transition: translating → error
          setState("error");
          setError(data.error?.message || "번역 중 오류가 발생했습니다.");
          return;
        }

        // Update translations map
        const newTranslations = new Map(translations);
        for (const t of data.translations) {
          newTranslations.set(t.section_id, {
            sectionId: t.section_id,
            original: t.original_text,
            translated: t.translated_text,
          });
        }
        setTranslations(newTranslations);

        // State transition: translating → translated
        setState("translated");
      } catch (err) {
        // State transition: translating → error
        console.error("Translation error:", err);
        setState("error");
        setError("네트워크 오류가 발생했습니다. 다시 시도해주세요.");
      }
    },
    [paperId, targetLang, translations]
  );

  // Clear translation
  const clearTranslation = useCallback(() => {
    // State transition: translated/showing_both → idle
    setState("idle");
    setTranslations(new Map());
    setError(null);
  }, []);

  // Toggle showing both original and translated
  const toggleShowBoth = useCallback(() => {
    if (state === "translated") {
      // State transition: translated → showing_both
      setState("showing_both");
    } else if (state === "showing_both") {
      // State transition: showing_both → translated
      setState("translated");
    }
  }, [state]);

  // Retry after error
  const retry = useCallback(() => {
    // State transition: error → idle, then re-translate
    translate(lastSectionId || undefined);
  }, [translate, lastSectionId]);

  // Helper to get translation for a specific section
  const getTranslationForSection = useCallback(
    (sectionId: string): TranslationData | null => {
      return translations.get(sectionId) || null;
    },
    [translations]
  );

  // Computed values
  const isTranslating = state === "translating";
  const isTranslated = state === "translated" || state === "showing_both";
  const showingBoth = state === "showing_both";

  return useMemo(
    () => ({
      state,
      targetLang,
      translations,
      error,
      translate,
      clearTranslation,
      setTargetLang,
      toggleShowBoth,
      retry,
      isTranslating,
      isTranslated,
      showingBoth,
      getTranslationForSection,
    }),
    [
      state,
      targetLang,
      translations,
      error,
      translate,
      clearTranslation,
      toggleShowBoth,
      retry,
      isTranslating,
      isTranslated,
      showingBoth,
      getTranslationForSection,
    ]
  );
}
