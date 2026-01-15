/**
 * useKeyword Hook
 * TASK-013: 키워드 추출 및 설명
 *
 * spec_refs:
 * - functional-spec.yaml#F-008.states
 * - ui-spec.yaml#SCR-002.components.side_panel
 *
 * States (from functional-spec.yaml#F-008):
 * - idle: 추출 대기
 * - extracting: 키워드 추출 중
 * - ready: 키워드 목록 표시
 * - explaining: 키워드 설명 표시 중
 * - error: 추출 에러
 */

import { useState, useCallback, useEffect } from "react";
import type { Keyword } from "@/types";

// State types from functional-spec.yaml#F-008.states
export type KeywordState = "idle" | "extracting" | "ready" | "explaining" | "error";

// Keyword explanation type
export interface KeywordExplanation {
  term: string;
  definition: string;
  contextInPaper: string;
  relatedTerms: string[];
}

interface UseKeywordOptions {
  paperId: string;
  autoLoad?: boolean;
}

interface UseKeywordReturn {
  // State
  state: KeywordState;
  error: string | null;

  // Data
  keywords: Keyword[];
  selectedKeyword: string | null;
  explanation: KeywordExplanation | null;

  // Actions
  extractKeywords: () => Promise<void>;
  explainKeyword: (term: string) => Promise<void>;
  clearExplanation: () => void;
  retry: () => void;

  // Derived states
  isExtracting: boolean;
  isReady: boolean;
  isExplaining: boolean;
}

export function useKeyword({
  paperId,
  autoLoad = false,
}: UseKeywordOptions): UseKeywordReturn {
  // State machine - functional-spec.yaml#F-008.states
  const [state, setState] = useState<KeywordState>("idle");
  const [error, setError] = useState<string | null>(null);

  // Data
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<KeywordExplanation | null>(null);

  // Derived states
  const isExtracting = state === "extracting";
  const isReady = state === "ready";
  const isExplaining = state === "explaining";

  // Load existing keywords on mount
  useEffect(() => {
    if (!autoLoad || !paperId) return;

    const loadExistingKeywords = async () => {
      try {
        const response = await fetch(`/api/papers/${paperId}/keywords`);

        if (response.ok) {
          const data = await response.json();
          if (data.keywords && data.keywords.length > 0) {
            setKeywords(data.keywords);
            setState("ready");
          }
        }
      } catch (err) {
        console.error("Failed to load existing keywords:", err);
        // Don't set error state, just stay in idle
      }
    };

    loadExistingKeywords();
  }, [paperId, autoLoad]);

  // Extract keywords - transition: idle -> extracting -> ready/error
  const extractKeywords = useCallback(async () => {
    if (!paperId) return;

    setState("extracting");
    setError(null);

    try {
      const response = await fetch(`/api/papers/${paperId}/keywords`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          force_refresh: false,
          max_keywords: 15,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || "키워드 추출에 실패했습니다.");
      }

      setKeywords(data.keywords || []);
      setState("ready");
    } catch (err) {
      console.error("Keyword extraction error:", err);
      setError(err instanceof Error ? err.message : "키워드 추출에 실패했습니다.");
      setState("error");
    }
  }, [paperId]);

  // Explain keyword - transition: ready -> explaining -> ready
  const explainKeyword = useCallback(
    async (term: string) => {
      if (!paperId || !term) return;

      setState("explaining");
      setSelectedKeyword(term);
      setError(null);

      try {
        const encodedTerm = encodeURIComponent(term);
        const response = await fetch(
          `/api/papers/${paperId}/keywords/${encodedTerm}/explain`
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error?.message || "키워드 설명을 가져올 수 없습니다.");
        }

        setExplanation({
          term: data.term,
          definition: data.definition,
          contextInPaper: data.context_in_paper,
          relatedTerms: data.related_terms || [],
        });
        setState("ready"); // Stay in ready state, just showing explanation
      } catch (err) {
        console.error("Keyword explanation error:", err);
        setError(err instanceof Error ? err.message : "키워드 설명을 가져올 수 없습니다.");
        setState("ready"); // Return to ready state on error
      }
    },
    [paperId]
  );

  // Clear explanation - transition: explaining -> ready
  const clearExplanation = useCallback(() => {
    setSelectedKeyword(null);
    setExplanation(null);
  }, []);

  // Retry - transition: error -> extracting
  const retry = useCallback(() => {
    extractKeywords();
  }, [extractKeywords]);

  return {
    // State
    state,
    error,

    // Data
    keywords,
    selectedKeyword,
    explanation,

    // Actions
    extractKeywords,
    explainKeyword,
    clearExplanation,
    retry,

    // Derived states
    isExtracting,
    isReady,
    isExplaining,
  };
}
