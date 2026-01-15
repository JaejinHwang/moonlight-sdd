/**
 * useSummary Hook
 * TASK-012: 논문 요약 기능
 *
 * spec_refs:
 * - functional-spec.yaml#F-007 (논문 요약)
 * - functional-spec.yaml#F-007.states
 *
 * State Machine (functional-spec.yaml#F-007.states):
 * - idle: 요약 대기
 * - summarizing: 요약 생성 중
 * - ready: 요약 표시 가능
 * - error: 요약 에러
 *
 * Transitions:
 * - idle -> summarizing: summarize_requested
 * - summarizing -> ready: summary_success
 * - summarizing -> error: summary_failed
 * - ready -> ready: expand_section, collapse_section
 * - error -> summarizing: retry
 */

import { useState, useCallback, useEffect } from "react";
import type { SectionSummary } from "@/types";

// State machine states from functional-spec.yaml#F-007.states
export type SummaryState = "idle" | "summarizing" | "ready" | "error";

interface SummaryData {
  overallSummary: string | null;
  sectionSummaries: SectionSummary[];
  keyFindings: string[];
}

interface UseSummaryOptions {
  paperId: string;
  autoLoad?: boolean;
}

interface UseSummaryReturn {
  // State
  state: SummaryState;
  error: string | null;

  // Data
  overallSummary: string | null;
  sectionSummaries: SectionSummary[];
  keyFindings: string[];

  // Section accordion state
  expandedSections: Set<string>;

  // Actions
  generateSummary: () => Promise<void>;
  retry: () => void;
  expandSection: (sectionId: string) => void;
  collapseSection: (sectionId: string) => void;
  toggleSection: (sectionId: string) => void;
  expandAllSections: () => void;
  collapseAllSections: () => void;

  // Status helpers
  isSummarizing: boolean;
  isReady: boolean;
  hasSummary: boolean;
}

export function useSummary({
  paperId,
  autoLoad = false,
}: UseSummaryOptions): UseSummaryReturn {
  // State machine
  const [state, setState] = useState<SummaryState>("idle");
  const [error, setError] = useState<string | null>(null);

  // Summary data
  const [summaryData, setSummaryData] = useState<SummaryData>({
    overallSummary: null,
    sectionSummaries: [],
    keyFindings: [],
  });

  // Accordion state for sections
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set()
  );

  // Load existing summary on mount
  useEffect(() => {
    if (!paperId || !autoLoad) return;

    const loadExistingSummary = async () => {
      try {
        const response = await fetch(`/api/papers/${paperId}/summary`);
        const data = await response.json();

        if (response.ok && data.exists && data.overall_summary) {
          setSummaryData({
            overallSummary: data.overall_summary,
            sectionSummaries: data.section_summaries || [],
            keyFindings: data.key_findings || [],
          });
          setState("ready");
        }
      } catch (err) {
        // Silent fail for auto-load - user can generate later
        console.log("No existing summary found");
      }
    };

    loadExistingSummary();
  }, [paperId, autoLoad]);

  // Generate summary - transition: idle -> summarizing -> ready/error
  const generateSummary = useCallback(async () => {
    if (!paperId) return;

    setState("summarizing");
    setError(null);

    try {
      const response = await fetch(`/api/papers/${paperId}/summary`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ type: "all" }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || "요약 생성에 실패했습니다.");
      }

      setSummaryData({
        overallSummary: data.overall_summary,
        sectionSummaries: data.section_summaries || [],
        keyFindings: data.key_findings || [],
      });

      setState("ready");
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "요약 생성에 실패했습니다.";
      setError(errorMessage);
      setState("error");
    }
  }, [paperId]);

  // Retry - transition: error -> summarizing
  const retry = useCallback(() => {
    if (state === "error") {
      generateSummary();
    }
  }, [state, generateSummary]);

  // Section accordion controls - transition: ready -> ready
  const expandSection = useCallback((sectionId: string) => {
    setExpandedSections((prev) => new Set([...prev, sectionId]));
  }, []);

  const collapseSection = useCallback((sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      next.delete(sectionId);
      return next;
    });
  }, []);

  const toggleSection = useCallback((sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }, []);

  const expandAllSections = useCallback(() => {
    setExpandedSections(
      new Set(summaryData.sectionSummaries.map((s) => s.sectionId))
    );
  }, [summaryData.sectionSummaries]);

  const collapseAllSections = useCallback(() => {
    setExpandedSections(new Set());
  }, []);

  return {
    // State
    state,
    error,

    // Data
    overallSummary: summaryData.overallSummary,
    sectionSummaries: summaryData.sectionSummaries,
    keyFindings: summaryData.keyFindings,

    // Section accordion
    expandedSections,

    // Actions
    generateSummary,
    retry,
    expandSection,
    collapseSection,
    toggleSection,
    expandAllSections,
    collapseAllSections,

    // Status helpers
    isSummarizing: state === "summarizing",
    isReady: state === "ready",
    hasSummary: !!summaryData.overallSummary,
  };
}
