"use client";

import { useMemo } from "react";
import { typography } from "@qanda/qds4-web/Typography";
import { COLOR } from "@qanda/qds4-web/base.ts";
import type { Section, Highlight } from "@/types";
import { MathRenderer } from "./MathRenderer";
import {
  parseContentWithMath,
  type ContentSegment,
} from "@/lib/pdf/math-parser";

interface SectionRendererProps {
  section: Section;
  highlights?: Highlight[];
  isActive?: boolean;
  translation?: {
    original: string;
    translated: string;
  } | null;
  showBothTexts?: boolean; // Show both original and translated text
}

// Typography variant type
type TypographyVariant =
  | "large_title" | "title_1_strong" | "title_1" | "title_2_strong"
  | "title_2" | "title_3_strong" | "title_3" | "body_1_strong"
  | "body_1" | "body_2_strong" | "body_2" | "caption_1" | "caption_2";

// Title typography mapping based on section level
const TITLE_TYPOGRAPHY: Record<number, TypographyVariant> = {
  1: "title_1_strong",
  2: "title_2_strong",
  3: "title_3_strong",
};

/**
 * Renders a single section of the paper with text, math, and highlights
 * Based on ui-spec.yaml#SCR-002.components.pdf_viewer
 *
 * TASK-010: Added translation support
 * - functional-spec.yaml#F-005.states.showing_both
 * - ui-spec.yaml#SCR-002.components.parsed_text_viewer.states.translated
 */
export function SectionRenderer({
  section,
  highlights = [],
  isActive = false,
  translation = null,
  showBothTexts = false,
}: SectionRendererProps) {
  // Determine which content to parse (translated or original)
  const contentToDisplay = translation?.translated || section.content;

  // Parse content to identify math blocks and regular text
  const parsedContent = useMemo(() => {
    return parseContentWithMath(contentToDisplay);
  }, [contentToDisplay]);

  // Parse original content for showing both (only when needed)
  const parsedOriginalContent = useMemo(() => {
    if (!showBothTexts || !translation) return null;
    return parseContentWithMath(section.content);
  }, [showBothTexts, translation, section.content]);

  // Apply highlights to text segments
  const highlightedContent = useMemo(() => {
    return applyHighlights(parsedContent, highlights);
  }, [parsedContent, highlights]);

  // Apply highlights to original content (when showing both)
  const highlightedOriginalContent = useMemo(() => {
    if (!parsedOriginalContent) return null;
    return applyHighlights(parsedOriginalContent, highlights);
  }, [parsedOriginalContent, highlights]);

  // Helper function to render content segments
  const renderContentSegments = (segments: ContentSegment[], isOriginal: boolean = false) => {
    return segments.map((segment, index) => {
      if (segment.type === "math-block") {
        return (
          <MathRenderer
            key={index}
            math={segment.content}
            displayMode={true}
          />
        );
      }

      if (segment.type === "math-inline") {
        return (
          <MathRenderer
            key={index}
            math={segment.content}
            displayMode={false}
          />
        );
      }

      if (segment.type === "highlight") {
        return (
          <span
            key={index}
            style={{
              backgroundColor: isOriginal ? COLOR.gray_80 : COLOR.yellow_20,
              padding: "2px 4px",
              borderRadius: "2px",
              cursor: "help",
            }}
            title={segment.reason || "핵심 내용"}
          >
            {segment.content}
          </span>
        );
      }

      // Regular text - preserve paragraphs
      return (
        <span key={index}>
          {segment.content.split("\n\n").map((paragraph, pIdx) => (
            <p
              key={pIdx}
              style={{
                marginBottom: pIdx < segment.content.split("\n\n").length - 1 ? "16px" : 0,
              }}
            >
              {paragraph.split("\n").map((line, lIdx, arr) => (
                <span key={lIdx}>
                  {line}
                  {lIdx < arr.length - 1 && <br />}
                </span>
              ))}
            </p>
          ))}
        </span>
      );
    });
  };

  return (
    <article
      data-section-id={section.id}
      style={{
        padding: "24px 0",
        borderBottom: `1px solid ${COLOR.gray_90}`,
        transition: "background-color 0.2s ease",
        backgroundColor: isActive ? `${COLOR.blue_95}` : "transparent",
      }}
    >
      {/* Section title */}
      {section.title && (
        <h2
          className={typography(TITLE_TYPOGRAPHY[section.level] || "title_3")}
          style={{
            color: COLOR.gray_10,
            marginBottom: "16px",
          }}
        >
          {section.title}
        </h2>
      )}

      {/* Original text (when showing both) - ui-spec.yaml#SCR-002.states.translated */}
      {showBothTexts && highlightedOriginalContent && (
        <div
          className={typography("body_2")}
          style={{
            color: COLOR.gray_50,
            lineHeight: 1.6,
            padding: "16px",
            backgroundColor: COLOR.gray_90,
            borderRadius: "8px",
            marginBottom: "16px",
            borderLeft: `3px solid ${COLOR.gray_70}`,
          }}
        >
          <div
            className={typography("caption_1")}
            style={{
              color: COLOR.gray_60,
              marginBottom: "8px",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            Original
          </div>
          {renderContentSegments(highlightedOriginalContent, true)}
        </div>
      )}

      {/* Section content (translated or original) */}
      <div
        className={typography("body_1")}
        style={{
          color: COLOR.gray_20,
          lineHeight: 1.75,
        }}
      >
        {/* Translation indicator */}
        {translation && (
          <div
            className={typography("caption_1")}
            style={{
              color: COLOR.blue_50,
              marginBottom: "8px",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z" />
            </svg>
            번역됨
          </div>
        )}
        {renderContentSegments(highlightedContent)}
      </div>

      {/* Page indicator */}
      <div
        className={typography("caption_2")}
        style={{
          color: COLOR.gray_60,
          marginTop: "12px",
        }}
      >
        페이지 {section.page_start}
        {section.page_end > section.page_start && ` - ${section.page_end}`}
      </div>
    </article>
  );
}

// ContentSegment is now imported from @/lib/pdf/math-parser
// parseContentWithMath is now imported from @/lib/pdf/math-parser

/**
 * Apply highlights to text segments
 */
function applyHighlights(
  segments: ContentSegment[],
  highlights: Highlight[]
): ContentSegment[] {
  if (highlights.length === 0) {
    return segments;
  }

  const result: ContentSegment[] = [];

  for (const segment of segments) {
    if (segment.type !== "text") {
      result.push(segment);
      continue;
    }

    let text = segment.content;
    let modified = false;
    const highlightSegments: ContentSegment[] = [];
    let lastIndex = 0;

    // Sort highlights by text length (longest first) to avoid partial matches
    const sortedHighlights = [...highlights].sort(
      (a, b) => b.text.length - a.text.length
    );

    for (const highlight of sortedHighlights) {
      const index = text.indexOf(highlight.text, lastIndex);
      if (index !== -1) {
        // Add text before highlight
        if (index > lastIndex) {
          highlightSegments.push({
            type: "text",
            content: text.slice(lastIndex, index),
          });
        }

        // Add highlighted text
        highlightSegments.push({
          type: "highlight",
          content: highlight.text,
          reason: highlight.reason,
        });

        lastIndex = index + highlight.text.length;
        modified = true;
      }
    }

    if (modified) {
      // Add remaining text
      if (lastIndex < text.length) {
        highlightSegments.push({
          type: "text",
          content: text.slice(lastIndex),
        });
      }
      result.push(...highlightSegments);
    } else {
      result.push(segment);
    }
  }

  return result;
}
