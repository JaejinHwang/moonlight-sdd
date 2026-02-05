"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { typography } from "@qanda/qds4-web/Typography";
import { COLOR } from "@qanda/qds4-web/base.ts";
import { LoadingAnimation } from "@qanda/qds4-web/LoadingAnimation";
import { IconButton } from "@qanda/qds4-web/IconButton";
import { Icon } from "@qanda/qds4-web/Icon";
import { TopAppBar } from "@qanda/qds4-web/TopAppBar";
import { Button } from "@qanda/qds4-web/Button";
import type { Paper, Section, ViewerState } from "@/types";
import { PdfViewer, type PdfViewerRef, type SectionTranslation } from "@/components/viewer/PdfViewer";
import { SplitViewLayout } from "@/components/viewer/SplitViewLayout";
import { TableOfContents } from "@/components/viewer/TableOfContents";
import { ViewerToolbar } from "@/components/viewer/ViewerToolbar";
import { SummaryPanel } from "@/components/viewer/SummaryPanel";
import { KeywordPanel } from "@/components/viewer/KeywordPanel";
import { KeywordExplanationModal } from "@/components/viewer/KeywordExplanationModal";
import { useTranslation, useHighlight, useSummary, useKeyword } from "@/hooks";

// PDF 원본 뷰어는 SSR 비활성화 필요 (PDF.js는 브라우저에서만 동작)
const PdfOriginalViewer = dynamic(
  () => import("@/components/viewer/PdfOriginalViewer").then((mod) => mod.PdfOriginalViewer),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          backgroundColor: COLOR.gray_90,
        }}
      >
        <LoadingAnimation size={48} />
      </div>
    ),
  }
);

// SVG Icons for IconButton
const ArrowBackIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
    <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
  </svg>
);

const ShareIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
    <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z" />
  </svg>
);

const MoreVertIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
    <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
  </svg>
);

const MenuIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
    <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
  </svg>
);

// Icon wrapper components for QDS IconButton
const ArrowBackIconComponent = (props: { size?: number; color?: keyof typeof COLOR }) => (
  <Icon {...props}><ArrowBackIcon /></Icon>
);

const ShareIconComponent = (props: { size?: number; color?: keyof typeof COLOR }) => (
  <Icon {...props}><ShareIcon /></Icon>
);

const MoreVertIconComponent = (props: { size?: number; color?: keyof typeof COLOR }) => (
  <Icon {...props}><MoreVertIcon /></Icon>
);

const MenuIconComponent = (props: { size?: number; color?: keyof typeof COLOR }) => (
  <Icon {...props}><MenuIcon /></Icon>
);

// Error codes from functional-spec.yaml#F-003.error_cases
const ErrorCodes = {
  RENDER_MEMORY_ERROR: {
    code: "RENDER_MEMORY_ERROR",
    message: "페이지를 표시하는 데 문제가 발생했습니다.",
    recovery: "페이지를 새로고침해주세요.",
  },
  FONT_LOAD_ERROR: {
    code: "FONT_LOAD_ERROR",
    message: "일부 폰트가 로드되지 않았습니다.",
    recovery: "기본 폰트로 표시됩니다.",
  },
  IMAGE_LOAD_ERROR: {
    code: "IMAGE_LOAD_ERROR",
    message: "일부 이미지를 불러올 수 없습니다.",
    recovery: "이미지 영역에 placeholder 표시",
  },
  PAPER_NOT_FOUND: {
    code: "PAPER_NOT_FOUND",
    message: "논문을 찾을 수 없습니다.",
    recovery: "올바른 URL인지 확인해주세요.",
  },
};

export default function PaperViewerPage() {
  const params = useParams();
  const router = useRouter();
  const paperId = params.id as string;

  // State machine based on functional-spec.yaml#F-003.states
  const [viewerState, setViewerState] = useState<ViewerState>("idle");
  const [paper, setPaper] = useState<Paper | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [error, setError] = useState<typeof ErrorCodes[keyof typeof ErrorCodes] | null>(null);

  // PDF 페이지 동기화 상태
  const [currentPdfPage, setCurrentPdfPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(0);

  // 목차 관련 상태 (functional-spec.yaml#F-004)
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const pdfViewerRef = useRef<PdfViewerRef>(null);

  // 번역 기능 (TASK-010, functional-spec.yaml#F-005)
  const translation = useTranslation({
    paperId,
    sections,
    defaultTargetLang: "ko",
  });

  // 하이라이트 기능 (TASK-011, functional-spec.yaml#F-006)
  const highlight = useHighlight({
    paperId,
    autoLoad: true, // 자동으로 기존 하이라이트 로드
  });

  // 요약 기능 (TASK-012, functional-spec.yaml#F-007)
  const summary = useSummary({
    paperId,
    autoLoad: true, // 자동으로 기존 요약 로드
  });

  // 키워드 기능 (TASK-013, functional-spec.yaml#F-008)
  const keyword = useKeyword({
    paperId,
    autoLoad: true, // 자동으로 기존 키워드 로드
  });

  // 요약 패널 열림/닫힘 상태
  const [isSummaryPanelOpen, setIsSummaryPanelOpen] = useState(false);

  // 키워드 패널 열림/닫힘 상태 (TASK-013)
  const [isKeywordPanelOpen, setIsKeywordPanelOpen] = useState(false);

  // 모바일 탭 상태 (ui-spec.yaml#SCR-002.responsive.mobile - 탭으로 PDF/텍스트 전환)
  const [mobileActiveTab, setMobileActiveTab] = useState<"pdf" | "text">("pdf");

  // 모바일 목차 열림/닫힘 상태
  const [isMobileTocOpen, setIsMobileTocOpen] = useState(false);

  // Convert translation map to the format expected by PdfViewer
  const translationsForViewer: Map<string, SectionTranslation> = translation.translations;

  // Load paper data
  useEffect(() => {
    if (!paperId) return;

    const loadPaper = async () => {
      setViewerState("rendering");

      try {
        const response = await fetch(`/api/papers/${paperId}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error?.code || "PAPER_NOT_FOUND");
        }

        setPaper(data.paper);
        setSections(data.sections || []);
        setViewerState("ready");
      } catch (err) {
        console.error("Failed to load paper:", err);
        const errorCode = err instanceof Error ? err.message : "RENDER_MEMORY_ERROR";
        setError(ErrorCodes[errorCode as keyof typeof ErrorCodes] || ErrorCodes.RENDER_MEMORY_ERROR);
        setViewerState("error");
      }
    };

    loadPaper();
  }, [paperId]);

  // Handle retry action
  const handleRetry = useCallback(() => {
    setError(null);
    setViewerState("idle");
    // Trigger reload
    window.location.reload();
  }, []);

  // Handle back navigation
  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  // PDF 페이지 변경 핸들러
  const handlePdfPageChange = useCallback((page: number) => {
    setCurrentPdfPage(page);
  }, []);

  // PDF 총 페이지 수 설정
  const handleTotalPagesChange = useCallback((total: number) => {
    setTotalPages(total);
  }, []);

  // PDF 파일 URL (API에서 signed URL로 반환됨)
  const getPdfFileUrl = useCallback(() => {
    // API에서 반환한 signed URL 사용
    return paper?.file_url || "";
  }, [paper]);

  // 목차에서 섹션 클릭 시 스크롤 (functional-spec.yaml#F-004)
  const handleTocSectionClick = useCallback((sectionId: string) => {
    pdfViewerRef.current?.scrollToSection(sectionId);
    setActiveSectionId(sectionId);
  }, []);

  // 활성 섹션 변경 콜백 (스크롤 시)
  const handleActiveSectionChange = useCallback((sectionId: string | null) => {
    setActiveSectionId(sectionId);
  }, []);

  // 요약 패널 토글 (TASK-012)
  const handleToggleSummaryPanel = useCallback(() => {
    setIsSummaryPanelOpen((prev) => !prev);
  }, []);

  // 요약 패널에서 섹션 클릭 시 뷰어로 스크롤 (AC-2)
  const handleSummarySectionClick = useCallback((sectionId: string) => {
    pdfViewerRef.current?.scrollToSection(sectionId);
    setActiveSectionId(sectionId);
  }, []);

  // 키워드 패널 토글 (TASK-013)
  const handleToggleKeywordPanel = useCallback(() => {
    setIsKeywordPanelOpen((prev) => !prev);
  }, []);

  // 키워드 클릭 시 설명 모달 열기 (TASK-013, AC-2)
  const handleKeywordClick = useCallback((term: string) => {
    keyword.explainKeyword(term);
  }, [keyword]);

  // 모바일 목차 토글
  const handleToggleMobileToc = useCallback(() => {
    setIsMobileTocOpen((prev) => !prev);
  }, []);

  // 모바일 목차에서 섹션 클릭 시
  const handleMobileTocSectionClick = useCallback((sectionId: string) => {
    handleTocSectionClick(sectionId);
    setIsMobileTocOpen(false); // 목차 닫기
  }, [handleTocSectionClick]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        backgroundColor: COLOR.gray_100,
      }}
    >
      {/* TopAppBar - ui-spec.yaml#SCR-002.components.viewer_header */}
      <TopAppBar
          main={
            <span
              className={typography("title_2")}
              style={{
                color: COLOR.gray_10,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: "calc(100vw - 160px)",
              }}
            >
              {paper?.title || "로딩 중..."}
            </span>
          }
          leading={
            <div style={{ display: "flex", gap: "4px" }}>
              <IconButton
                Icon={ArrowBackIconComponent}
                onClick={handleBack}
                style="clear"
                iconSize={24}
                aria-label="뒤로 가기"
              />
              {/* 모바일 목차 버튼 - 데스크톱에서는 숨김 */}
              <span className="mobile-only" style={{ display: "inline-flex" }}>
                <IconButton
                  Icon={MenuIconComponent}
                  onClick={handleToggleMobileToc}
                  style="clear"
                  iconSize={24}
                  aria-label="목차 열기"
                />
              </span>
            </div>
          }
          trailing={
            <div style={{ display: "flex", gap: "8px" }}>
              <IconButton Icon={ShareIconComponent} style="clear" iconSize={24} aria-label="공유" />
              <IconButton Icon={MoreVertIconComponent} style="clear" iconSize={24} aria-label="더보기" />
            </div>
          }
        />

      {/* Main content area */}
      <main
        id="main-content"
        style={{
          flex: 1,
          display: "flex",
          overflow: "hidden",
        }}
      >
        {/* Loading state - ui-spec.yaml#SCR-002.components.pdf_viewer.states.loading */}
        {viewerState === "rendering" && (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "16px",
            }}
          >
            <LoadingAnimation size={48} />
            <span
              className={typography("body_1")}
              style={{ color: COLOR.gray_50 }}
            >
              논문을 불러오는 중...
            </span>
          </div>
        )}

        {/* Error state */}
        {viewerState === "error" && error && (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "16px",
              padding: "24px",
            }}
          >
            <span
              className={typography("title_2")}
              style={{ color: COLOR.red_50 }}
            >
              {error.message}
            </span>
            <span
              className={typography("body_1")}
              style={{ color: COLOR.gray_50 }}
            >
              {error.recovery}
            </span>
            <Button
              variant="accent"
              size="m"
              onClick={handleRetry}
            >
              다시 시도
            </Button>
          </div>
        )}

        {/* Ready state - TOC + Split View (PDF Original + Parsed Text) */}
        {viewerState === "ready" && paper && (
          <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
            {/* 모바일 목차 오버레이 */}
            <div
              className={`toc-overlay ${isMobileTocOpen ? "visible" : ""}`}
              onClick={() => setIsMobileTocOpen(false)}
            />

            {/* 모바일 목차 (오버레이) - mobile-only */}
            <div className={`toc-sidebar mobile-only ${isMobileTocOpen ? "open" : ""}`}>
              <TableOfContents
                sections={sections}
                activeSection={activeSectionId}
                onSectionClick={handleMobileTocSectionClick}
              />
            </div>

            {/* 데스크톱/태블릿용 목차 (항상 표시) - tablet-up */}
            <div className="tablet-up" style={{ flexShrink: 0 }}>
              <TableOfContents
                sections={sections}
                activeSection={activeSectionId}
                onSectionClick={handleTocSectionClick}
              />
            </div>

            {/* Main content with toolbar */}
            <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
              {/* Viewer Toolbar - ui-spec.yaml#SCR-002.components.toolbar (TASK-010, TASK-011, TASK-012, TASK-013) */}
              <ViewerToolbar
                // Translation props
                translationState={translation.state}
                targetLang={translation.targetLang}
                sourceLang={paper.language}
                showingBoth={translation.showingBoth}
                translationError={translation.error}
                onTranslate={translation.translate}
                onClearTranslation={translation.clearTranslation}
                onToggleShowBoth={translation.toggleShowBoth}
                onTargetLangChange={translation.setTargetLang}
                onRetryTranslation={translation.retry}
                // Highlight props
                highlightState={highlight.state}
                highlightError={highlight.error}
                onToggleHighlight={highlight.toggleHighlights}
                onRetryHighlight={highlight.retry}
                // Summary props (TASK-012)
                summaryState={summary.state}
                isSummaryPanelOpen={isSummaryPanelOpen}
                onToggleSummaryPanel={handleToggleSummaryPanel}
                // Keyword props (TASK-013)
                keywordState={keyword.state}
                isKeywordPanelOpen={isKeywordPanelOpen}
                onToggleKeywordPanel={handleToggleKeywordPanel}
              />

              {/* 모바일 탭 뷰 - ui-spec.yaml#SCR-002.responsive.mobile */}
              <div className="mobile-tab-view">
                {/* 탭 헤더 */}
                <div className="mobile-tab-header" style={{ backgroundColor: COLOR.gray_95 }}>
                  <Button
                    variant={mobileActiveTab === "pdf" ? "tonal" : "neutral"}
                    size="s"
                    onClick={() => setMobileActiveTab("pdf")}
                  >
                    PDF 원본
                  </Button>
                  <Button
                    variant={mobileActiveTab === "text" ? "tonal" : "neutral"}
                    size="s"
                    onClick={() => setMobileActiveTab("text")}
                  >
                    텍스트 / 번역
                  </Button>
                </div>

                {/* 탭 콘텐츠 */}
                <div className="mobile-tab-content">
                  {mobileActiveTab === "pdf" ? (
                    <PdfOriginalViewer
                      fileUrl={getPdfFileUrl()}
                      currentPage={currentPdfPage}
                      onPageChange={handlePdfPageChange}
                      onTotalPagesChange={handleTotalPagesChange}
                    />
                  ) : (
                    <PdfViewer
                      ref={pdfViewerRef}
                      paper={paper}
                      sections={sections}
                      highlights={highlight.isHighlighted ? highlight.highlights : []}
                      translations={translationsForViewer}
                      showBothTexts={translation.showingBoth}
                      onActiveSectionChange={handleActiveSectionChange}
                    />
                  )}
                </div>
              </div>

              {/* Split View + Summary Panel - 태블릿 이상에서만 표시 */}
              <div className="split-view-wrapper">
                {/* Split View */}
                <SplitViewLayout
                  initialRatio={0.5}
                  minWidth={300}
                  leftPanel={
                    <PdfOriginalViewer
                      fileUrl={getPdfFileUrl()}
                      currentPage={currentPdfPage}
                      onPageChange={handlePdfPageChange}
                      onTotalPagesChange={handleTotalPagesChange}
                    />
                  }
                  rightPanel={
                    <PdfViewer
                      ref={pdfViewerRef}
                      paper={paper}
                      sections={sections}
                      highlights={highlight.isHighlighted ? highlight.highlights : []}
                      translations={translationsForViewer}
                      showBothTexts={translation.showingBoth}
                      onActiveSectionChange={handleActiveSectionChange}
                    />
                  }
                />

                {/* Summary Panel (TASK-012) - ui-spec.yaml#SCR-002.components.side_panel */}
                {isSummaryPanelOpen && (
                  <SummaryPanel
                    state={summary.state}
                    error={summary.error}
                    overallSummary={summary.overallSummary}
                    sectionSummaries={summary.sectionSummaries}
                    keyFindings={summary.keyFindings}
                    expandedSections={summary.expandedSections}
                    onGenerateSummary={summary.generateSummary}
                    onRetry={summary.retry}
                    onToggleSection={summary.toggleSection}
                    onExpandAll={summary.expandAllSections}
                    onCollapseAll={summary.collapseAllSections}
                    onSectionClick={handleSummarySectionClick}
                    onClose={handleToggleSummaryPanel}
                  />
                )}

                {/* Keyword Panel (TASK-013) - ui-spec.yaml#SCR-002.components.side_panel */}
                {isKeywordPanelOpen && (
                  <KeywordPanel
                    state={keyword.state}
                    error={keyword.error}
                    keywords={keyword.keywords}
                    onExtractKeywords={keyword.extractKeywords}
                    onKeywordClick={handleKeywordClick}
                    onRetry={keyword.retry}
                    onClose={handleToggleKeywordPanel}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Keyword Explanation Modal (TASK-013) - ui-spec.yaml#SCR-002.components.keyword_bottomsheet */}
      <KeywordExplanationModal
        isOpen={keyword.selectedKeyword !== null}
        isLoading={keyword.isExplaining}
        error={keyword.error}
        keyword={keyword.selectedKeyword}
        explanation={keyword.explanation}
        onClose={keyword.clearExplanation}
      />
    </div>
  );
}
