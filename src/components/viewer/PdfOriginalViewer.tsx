"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { typography } from "@qanda/qds4-web/Typography";
import { COLOR } from "@qanda/qds4-web/base.ts";
import { LoadingAnimation } from "@qanda/qds4-web/LoadingAnimation";
import { IconButton } from "@qanda/qds4-web/IconButton";
import { Icon } from "@qanda/qds4-web/Icon";

// PDF.js worker 설정
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// react-pdf 스타일
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// SVG Icons
const ZoomInIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
    <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
    <path d="M12 10h-2v2H9v-2H7V9h2V7h1v2h2v1z"/>
  </svg>
);

const ZoomOutIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
    <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
    <path d="M7 9h5v1H7z"/>
  </svg>
);

const ChevronLeftIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
    <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
  </svg>
);

const ChevronRightIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
    <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
  </svg>
);

// Icon wrapper components
const ZoomInIconComponent = (props: { size?: number; color?: keyof typeof COLOR }) => (
  <Icon {...props}><ZoomInIcon /></Icon>
);
const ZoomOutIconComponent = (props: { size?: number; color?: keyof typeof COLOR }) => (
  <Icon {...props}><ZoomOutIcon /></Icon>
);
const ChevronLeftIconComponent = (props: { size?: number; color?: keyof typeof COLOR }) => (
  <Icon {...props}><ChevronLeftIcon /></Icon>
);
const ChevronRightIconComponent = (props: { size?: number; color?: keyof typeof COLOR }) => (
  <Icon {...props}><ChevronRightIcon /></Icon>
);

interface PdfOriginalViewerProps {
  fileUrl: string;
  currentPage?: number;
  onPageChange?: (page: number) => void;
  onTotalPagesChange?: (totalPages: number) => void;
}

export function PdfOriginalViewer({
  fileUrl,
  currentPage: externalPage,
  onPageChange,
  onTotalPagesChange,
}: PdfOriginalViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [internalPage, setInternalPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const isScrollingToPage = useRef<boolean>(false);

  // 외부에서 제어하는 페이지 또는 내부 상태 사용
  const pageNumber = externalPage ?? internalPage;

  // 컨테이너 너비 감지
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  const onDocumentLoadSuccess = useCallback(
    ({ numPages }: { numPages: number }) => {
      setNumPages(numPages);
      setIsLoading(false);
      onTotalPagesChange?.(numPages);
    },
    [onTotalPagesChange]
  );

  const onDocumentLoadError = useCallback((err: Error) => {
    console.error("PDF load error:", err);
    setError("PDF를 불러올 수 없습니다.");
    setIsLoading(false);
  }, []);

  // 페이지로 스크롤
  const scrollToPage = useCallback((page: number) => {
    const pageElement = pageRefs.current.get(page);
    if (pageElement && scrollContainerRef.current) {
      isScrollingToPage.current = true;
      pageElement.scrollIntoView({ behavior: "smooth", block: "center" });
      // 스크롤 애니메이션 후 플래그 해제
      setTimeout(() => {
        isScrollingToPage.current = false;
      }, 500);
    }
  }, []);

  const goToPage = useCallback(
    (page: number) => {
      const newPage = Math.max(1, Math.min(page, numPages));
      if (onPageChange) {
        onPageChange(newPage);
      } else {
        setInternalPage(newPage);
      }
      scrollToPage(newPage);
    },
    [numPages, onPageChange, scrollToPage]
  );

  const prevPage = useCallback(() => {
    goToPage(pageNumber - 1);
  }, [pageNumber, goToPage]);

  const nextPage = useCallback(() => {
    goToPage(pageNumber + 1);
  }, [pageNumber, goToPage]);

  const zoomIn = useCallback(() => {
    setScale((prev) => Math.min(prev + 0.25, 3.0));
  }, []);

  const zoomOut = useCallback(() => {
    setScale((prev) => Math.max(prev - 0.25, 0.5));
  }, []);

  // 스크롤 시 현재 페이지 감지
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer || numPages === 0) return;

    const handleScroll = () => {
      // 프로그래매틱 스크롤 중이면 무시
      if (isScrollingToPage.current) return;

      const containerRect = scrollContainer.getBoundingClientRect();
      const containerCenter = containerRect.top + containerRect.height / 2;

      let closestPage = 1;
      let closestDistance = Infinity;

      pageRefs.current.forEach((element, page) => {
        const rect = element.getBoundingClientRect();
        const pageCenter = rect.top + rect.height / 2;
        const distance = Math.abs(pageCenter - containerCenter);

        if (distance < closestDistance) {
          closestDistance = distance;
          closestPage = page;
        }
      });

      if (closestPage !== pageNumber) {
        if (onPageChange) {
          onPageChange(closestPage);
        } else {
          setInternalPage(closestPage);
        }
      }
    };

    scrollContainer.addEventListener("scroll", handleScroll, { passive: true });
    return () => scrollContainer.removeEventListener("scroll", handleScroll);
  }, [numPages, pageNumber, onPageChange]);

  // 키보드 네비게이션
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;

      switch (e.key) {
        case "ArrowLeft":
          prevPage();
          break;
        case "ArrowRight":
          nextPage();
          break;
        case "+":
        case "=":
          zoomIn();
          break;
        case "-":
          zoomOut();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [prevPage, nextPage, zoomIn, zoomOut]);

  // 페이지 ref 설정 함수
  const setPageRef = useCallback((page: number, element: HTMLDivElement | null) => {
    if (element) {
      pageRefs.current.set(page, element);
    } else {
      pageRefs.current.delete(page);
    }
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        backgroundColor: COLOR.gray_90,
        overflow: "hidden",
      }}
      aria-label="PDF 원본 뷰어"
    >
      {/* PDF 컨트롤 바 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
          padding: "8px 16px",
          backgroundColor: COLOR.gray_95,
          borderBottom: `1px solid ${COLOR.gray_80}`,
          flexShrink: 0,
        }}
      >
        {/* 페이지 네비게이션 */}
        <IconButton
          Icon={ChevronLeftIconComponent}
          onClick={prevPage}
          style="clear"
          iconSize={20}
          disabled={pageNumber <= 1}
          aria-label="이전 페이지"
        />
        <span
          className={typography("body_2")}
          style={{ color: COLOR.gray_30, minWidth: "80px", textAlign: "center" }}
        >
          {pageNumber} / {numPages || "-"}
        </span>
        <IconButton
          Icon={ChevronRightIconComponent}
          onClick={nextPage}
          style="clear"
          iconSize={20}
          disabled={pageNumber >= numPages}
          aria-label="다음 페이지"
        />

        {/* 구분선 */}
        <div
          style={{
            width: "1px",
            height: "20px",
            backgroundColor: COLOR.gray_70,
            margin: "0 8px",
          }}
        />

        {/* 줌 컨트롤 */}
        <IconButton
          Icon={ZoomOutIconComponent}
          onClick={zoomOut}
          style="clear"
          iconSize={20}
          disabled={scale <= 0.5}
          aria-label="줌 아웃"
        />
        <span
          className={typography("body_2")}
          style={{ color: COLOR.gray_30, minWidth: "50px", textAlign: "center" }}
        >
          {Math.round(scale * 100)}%
        </span>
        <IconButton
          Icon={ZoomInIconComponent}
          onClick={zoomIn}
          style="clear"
          iconSize={20}
          disabled={scale >= 3.0}
          aria-label="줌 인"
        />
      </div>

      {/* PDF 렌더링 영역 - 연속 스크롤 */}
      <div
        ref={scrollContainerRef}
        style={{
          flex: 1,
          overflow: "auto",
          padding: "16px",
        }}
      >
        {isLoading && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              gap: "16px",
            }}
          >
            <LoadingAnimation size={48} />
            <span
              className={typography("body_1")}
              style={{ color: COLOR.gray_50 }}
            >
              PDF 로딩 중...
            </span>
          </div>
        )}

        {error && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              gap: "16px",
            }}
          >
            <span
              className={typography("title_2")}
              style={{ color: COLOR.red_50 }}
            >
              {error}
            </span>
            <span
              className={typography("body_1")}
              style={{ color: COLOR.gray_50 }}
            >
              파일 경로를 확인해주세요.
            </span>
          </div>
        )}

        {!error && (
          <Document
            file={fileUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={null}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "16px",
              }}
            >
              {Array.from({ length: numPages }, (_, index) => {
                const page = index + 1;
                return (
                  <div
                    key={page}
                    ref={(el) => setPageRef(page, el)}
                    style={{
                      boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3)",
                      backgroundColor: "white",
                    }}
                  >
                    <Page
                      pageNumber={page}
                      scale={scale}
                      width={containerWidth > 0 ? containerWidth - 48 : undefined}
                      renderTextLayer={true}
                      renderAnnotationLayer={true}
                      loading={
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            minHeight: "400px",
                            minWidth: containerWidth > 0 ? containerWidth - 48 : 400,
                          }}
                        >
                          <LoadingAnimation size={32} />
                        </div>
                      }
                    />
                  </div>
                );
              })}
            </div>
          </Document>
        )}
      </div>
    </div>
  );
}
