"use client";

import { useRef, useCallback, useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { typography } from "@qanda/qds4-web/Typography";
import { COLOR } from "@qanda/qds4-web/base.ts";
import type { Paper, Section, Highlight } from "@/types";
import { SectionRenderer } from "./SectionRenderer";

// Translation data type for section-based translations
export interface SectionTranslation {
  sectionId: string;
  original: string;
  translated: string;
}

interface PdfViewerProps {
  paper: Paper;
  sections: Section[];
  highlights?: Highlight[];
  // Support for per-section translations (TASK-010)
  translations?: Map<string, SectionTranslation>;
  showBothTexts?: boolean; // Show both original and translated text
  onActiveSectionChange?: (sectionId: string | null) => void;
}

export interface PdfViewerRef {
  scrollToSection: (sectionId: string, behavior?: ScrollBehavior) => void;
  getContainerRef: () => HTMLDivElement | null;
}

// ui-spec.yaml#SCR-002.components.pdf_viewer
// TASK-010: Added translation support for F-005
export const PdfViewer = forwardRef<PdfViewerRef, PdfViewerProps>(function PdfViewer({
  paper,
  sections,
  highlights = [],
  translations,
  showBothTexts = false,
  onActiveSectionChange,
}, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentSectionId, setCurrentSectionId] = useState<string | null>(null);
  const isScrollingRef = useRef(false);

  // Track current section based on scroll position (Intersection Observer)
  useEffect(() => {
    if (!containerRef.current || sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // 프로그래매틱 스크롤 중에는 Observer 무시
        if (isScrollingRef.current) return;

        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const sectionId = entry.target.getAttribute("data-section-id");
            if (sectionId) {
              setCurrentSectionId(sectionId);
              onActiveSectionChange?.(sectionId);
            }
          }
        });
      },
      {
        root: containerRef.current,
        rootMargin: "-20% 0px -70% 0px", // Trigger when section is in top 30%
        threshold: 0,
      }
    );

    // Observe all section elements
    const sectionElements = containerRef.current.querySelectorAll("[data-section-id]");
    sectionElements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [sections, onActiveSectionChange]);

  // 특정 섹션으로 스크롤
  const scrollToSection = useCallback((sectionId: string, behavior: ScrollBehavior = "smooth") => {
    const container = containerRef.current;
    if (!container) return;

    const sectionElement = container.querySelector(`[data-section-id="${sectionId}"]`);
    if (!sectionElement) {
      console.warn(`Section with id "${sectionId}" not found`);
      return;
    }

    // 프로그래매틱 스크롤 시작
    isScrollingRef.current = true;
    setCurrentSectionId(sectionId);
    onActiveSectionChange?.(sectionId);

    sectionElement.scrollIntoView({
      behavior,
      block: "start",
    });

    // 스크롤 완료 후 플래그 해제
    const scrollDuration = behavior === "smooth" ? 350 : 50;
    setTimeout(() => {
      isScrollingRef.current = false;
    }, scrollDuration);
  }, [onActiveSectionChange]);

  // ref를 통해 외부에 함수 노출
  useImperativeHandle(ref, () => ({
    scrollToSection,
    getContainerRef: () => containerRef.current,
  }), [scrollToSection]);

  // Get highlights for a specific section
  const getHighlightsForSection = useCallback(
    (sectionId: string): Highlight[] => {
      return highlights.filter((h) => h.sectionId === sectionId);
    },
    [highlights]
  );

  // Get translation for a specific section (TASK-010)
  const getTranslationForSection = useCallback(
    (sectionId: string): { original: string; translated: string } | null => {
      if (!translations) return null;
      const translation = translations.get(sectionId);
      if (!translation) return null;
      return {
        original: translation.original,
        translated: translation.translated,
      };
    },
    [translations]
  );

  return (
    <div
      ref={containerRef}
      style={{
        height: "100%",
        overflow: "auto",
        backgroundColor: COLOR.gray_95,
        overscrollBehavior: "contain",
      }}
    >
      {/* Content container */}
      <div
        style={{
          padding: "0 24px",
          maxWidth: "800px",
          margin: "0 auto",
        }}
      >
        {/* Paper title header */}
        <header
          style={{
            padding: "32px 0",
            borderBottom: `1px solid ${COLOR.gray_80}`,
            marginBottom: "24px",
          }}
        >
          <h1
            className={typography("title_1_strong")}
            style={{ color: COLOR.gray_10, marginBottom: "8px" }}
          >
            {paper.title}
          </h1>
          <div
            className={typography("body_2")}
            style={{ color: COLOR.gray_50 }}
          >
            {paper.page_count} 페이지 | {paper.language.toUpperCase()}
          </div>
        </header>

        {/* Sections */}
        {sections.map((section) => (
          <SectionRenderer
            key={section.id}
            section={section}
            highlights={getHighlightsForSection(section.id)}
            isActive={currentSectionId === section.id}
            translation={getTranslationForSection(section.id)}
            showBothTexts={showBothTexts}
          />
        ))}

        {/* End of document indicator */}
        {sections.length > 0 && (
          <footer
            style={{
              padding: "48px 0",
              textAlign: "center",
              borderTop: `1px solid ${COLOR.gray_80}`,
              marginTop: "24px",
            }}
          >
            <span
              className={typography("body_2")}
              style={{ color: COLOR.gray_60 }}
            >
              문서 끝
            </span>
          </footer>
        )}
      </div>

      {/* Empty state */}
      {sections.length === 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            padding: "48px",
          }}
        >
          <span
            className={typography("title_2")}
            style={{ color: COLOR.gray_50, marginBottom: "8px" }}
          >
            내용이 없습니다
          </span>
          <span
            className={typography("body_1")}
            style={{ color: COLOR.gray_60 }}
          >
            논문 파싱 중 문제가 발생했을 수 있습니다.
          </span>
        </div>
      )}
    </div>
  );
});
