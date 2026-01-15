/**
 * useHighlight Hook
 * TASK-011: 핵심 하이라이트 기능
 *
 * spec_refs:
 * - functional-spec.yaml#F-006 (states)
 * - ui-spec.yaml#SCR-002.components.pdf_viewer
 *
 * Implements the highlight state machine from functional-spec:
 * - idle: 분석 대기
 * - analyzing: AI 분석 중
 * - highlighted: 하이라이트 표시 중
 * - hidden: 하이라이트 숨김
 * - error: 분석 에러
 */

import { useState, useCallback, useMemo, useEffect } from "react";
import type { Highlight } from "@/types";

// Highlight state type based on functional-spec.yaml#F-006.states
export type HighlightState = "idle" | "analyzing" | "highlighted" | "hidden" | "error";

interface UseHighlightOptions {
  paperId: string;
  autoLoad?: boolean;
}

interface UseHighlightReturn {
  // State
  state: HighlightState;
  highlights: Highlight[];
  error: string | null;

  // Actions
  analyze: (sectionId?: string) => Promise<void>;
  toggleHighlights: () => void;
  clearHighlights: () => void;
  retry: () => void;

  // Helpers
  isAnalyzing: boolean;
  isHighlighted: boolean;
  isHidden: boolean;
  getHighlightsForSection: (sectionId: string) => Highlight[];
}

export function useHighlight({
  paperId,
  autoLoad = false,
}: UseHighlightOptions): UseHighlightReturn {
  // State machine: idle | analyzing | highlighted | hidden | error
  const [state, setState] = useState<HighlightState>("idle");
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastSectionId, setLastSectionId] = useState<string | null>(null);

  // Auto-load highlights on mount if enabled
  useEffect(() => {
    if (autoLoad && paperId) {
      fetchExistingHighlights();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoad, paperId]);

  // Fetch existing highlights from API (GET)
  const fetchExistingHighlights = useCallback(async () => {
    try {
      const response = await fetch(`/api/papers/${paperId}/highlights`);
      const data = await response.json();

      if (response.ok && data.highlights && data.highlights.length > 0) {
        setHighlights(data.highlights);
        setState("highlighted");
      }
    } catch (err) {
      console.error("Failed to fetch existing highlights:", err);
      // Silently fail - user can still trigger manual analysis
    }
  }, [paperId]);

  // Analyze and extract highlights
  const analyze = useCallback(
    async (sectionId?: string) => {
      // State transition: idle/error/hidden → analyzing
      setState("analyzing");
      setError(null);
      setLastSectionId(sectionId || null);

      try {
        const response = await fetch(`/api/papers/${paperId}/highlights`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            section_id: sectionId || null,
            force_refresh: false,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          // State transition: analyzing → error
          setState("error");
          setError(data.error?.message || "핵심 내용 분석에 실패했습니다.");
          return;
        }

        // Update highlights
        setHighlights(data.highlights || []);

        // State transition: analyzing → highlighted
        setState("highlighted");
      } catch (err) {
        // State transition: analyzing → error
        console.error("Highlight analysis error:", err);
        setState("error");
        setError("네트워크 오류가 발생했습니다. 다시 시도해주세요.");
      }
    },
    [paperId]
  );

  // Toggle highlights visibility
  const toggleHighlights = useCallback(() => {
    if (state === "highlighted") {
      // State transition: highlighted → hidden
      setState("hidden");
    } else if (state === "hidden") {
      // State transition: hidden → highlighted
      setState("highlighted");
    } else if (state === "idle" || state === "error") {
      // If not analyzed yet, start analysis
      analyze();
    }
  }, [state, analyze]);

  // Clear highlights
  const clearHighlights = useCallback(() => {
    // State transition: highlighted/hidden/error → idle
    setState("idle");
    setHighlights([]);
    setError(null);
  }, []);

  // Retry after error
  const retry = useCallback(() => {
    // State transition: error → analyzing
    analyze(lastSectionId || undefined);
  }, [analyze, lastSectionId]);

  // Helper to get highlights for a specific section
  const getHighlightsForSection = useCallback(
    (sectionId: string): Highlight[] => {
      if (state === "hidden") {
        return []; // Don't show highlights when hidden
      }
      return highlights.filter((h) => h.sectionId === sectionId);
    },
    [highlights, state]
  );

  // Computed values
  const isAnalyzing = state === "analyzing";
  const isHighlighted = state === "highlighted";
  const isHidden = state === "hidden";

  return useMemo(
    () => ({
      state,
      highlights,
      error,
      analyze,
      toggleHighlights,
      clearHighlights,
      retry,
      isAnalyzing,
      isHighlighted,
      isHidden,
      getHighlightsForSection,
    }),
    [
      state,
      highlights,
      error,
      analyze,
      toggleHighlights,
      clearHighlights,
      retry,
      isAnalyzing,
      isHighlighted,
      isHidden,
      getHighlightsForSection,
    ]
  );
}
