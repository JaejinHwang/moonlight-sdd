"use client";

import { useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { typography } from "@qanda/qds4-web/Typography";
import { COLOR } from "@qanda/qds4-web/base.ts";

interface MathRendererProps {
  math: string;
  displayMode?: boolean;
}

/**
 * Renders LaTeX math expressions using KaTeX
 * Based on functional-spec.yaml#F-003 edge_case: "수식이 많은 논문"
 * and ui-spec.yaml#SCR-002.components.pdf_viewer.states.ready
 */
export function MathRenderer({ math, displayMode = false }: MathRendererProps) {
  const rendered = useMemo(() => {
    try {
      return katex.renderToString(math, {
        displayMode,
        throwOnError: false,
        errorColor: COLOR.red_50,
        strict: false,
        trust: false,
        // Common macros for academic papers
        macros: {
          "\\R": "\\mathbb{R}",
          "\\N": "\\mathbb{N}",
          "\\Z": "\\mathbb{Z}",
          "\\Q": "\\mathbb{Q}",
          "\\C": "\\mathbb{C}",
          "\\argmax": "\\operatorname{arg\\,max}",
          "\\argmin": "\\operatorname{arg\\,min}",
        },
      });
    } catch (error) {
      console.error("KaTeX render error:", error);
      return null;
    }
  }, [math, displayMode]);

  // Error state - show raw math with error indicator
  if (!rendered) {
    return (
      <span
        className={typography("body_2")}
        style={{
          color: COLOR.red_50,
          fontFamily: "monospace",
          backgroundColor: COLOR.red_95,
          padding: "2px 6px",
          borderRadius: "4px",
        }}
        title="수식 렌더링 실패"
      >
        {displayMode ? `$$${math}$$` : `$${math}$`}
      </span>
    );
  }

  // Display mode (block math) - center aligned with margins
  if (displayMode) {
    return (
      <div
        style={{
          margin: "16px 0",
          padding: "12px",
          backgroundColor: COLOR.gray_95,
          borderRadius: "4px",
          overflowX: "auto",
          textAlign: "center",
        }}
        dangerouslySetInnerHTML={{ __html: rendered }}
      />
    );
  }

  // Inline mode
  return (
    <span
      style={{ verticalAlign: "middle" }}
      dangerouslySetInnerHTML={{ __html: rendered }}
    />
  );
}
