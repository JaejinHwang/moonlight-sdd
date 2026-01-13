// Use legacy build for Node.js server environment
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

// For server-side usage, we need to disable the worker
// pdfjs-dist v5+ requires explicit worker configuration
if (typeof window === "undefined") {
  // Server-side: disable worker by setting to empty string
  // The library will use fake worker internally
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.mjs",
    import.meta.url
  ).toString();
}

/**
 * PDF Parser Service
 *
 * spec_refs:
 * - functional-spec.yaml#F-001
 * - TASK-005
 *
 * Responsibilities:
 * - PDF에서 텍스트 추출
 * - 섹션 구조 파싱
 * - 암호화된 PDF 감지
 */

// Error codes from functional-spec.yaml#F-001.error_cases
export const PdfErrorCodes = {
  PDF_ENCRYPTED: {
    code: "PDF_ENCRYPTED",
    message: "암호화된 PDF는 지원하지 않습니다.",
    recovery_action: "암호를 해제한 PDF를 업로드해주세요.",
  },
  PARSING_FAILED: {
    code: "PARSING_FAILED",
    message: "PDF 파싱에 실패했습니다.",
    recovery_action: "다시 시도해주세요.",
  },
  NO_TEXT_CONTENT: {
    code: "NO_TEXT_CONTENT",
    message: "PDF에서 텍스트를 추출할 수 없습니다.",
    recovery_action: "스캔된 이미지 PDF일 수 있습니다. 텍스트가 포함된 PDF를 업로드해주세요.",
  },
} as const;

export type PdfError = (typeof PdfErrorCodes)[keyof typeof PdfErrorCodes];

/**
 * Parsed section structure
 * Based on technical-spec.yaml#data_model.entities.Section
 */
export interface ParsedSection {
  title: string;
  level: number; // 1 = top level (e.g., "1. Introduction"), 2 = subsection, etc.
  orderIndex: number;
  content: string;
  pageStart: number;
  pageEnd: number;
}

/**
 * Result of PDF parsing
 */
export interface PdfParseResult {
  success: true;
  text: string;
  pageCount: number;
  sections: ParsedSection[];
  metadata: {
    title?: string;
    author?: string;
    language: string;
  };
}

export interface PdfParseError {
  success: false;
  error: PdfError;
}

export type ParsePdfResult = PdfParseResult | PdfParseError;

/**
 * Common section header patterns for academic papers
 * Supports numbered sections (1., 1.1, I., A.) and common section names
 */
const SECTION_PATTERNS = [
  // Numbered sections: "1. Introduction", "2.1 Methods", etc.
  /^(\d+(?:\.\d+)*)\s*\.?\s+(.+)$/,
  // Roman numerals: "I. Introduction", "II. Background"
  /^([IVX]+)\s*\.?\s+(.+)$/i,
  // Letter sections: "A. Overview", "B. Methods"
  /^([A-Z])\s*\.?\s+(.+)$/,
];

/**
 * Common academic paper section names
 */
const KNOWN_SECTION_NAMES = [
  "abstract",
  "introduction",
  "background",
  "related work",
  "methods",
  "methodology",
  "materials and methods",
  "experiments",
  "experimental setup",
  "results",
  "discussion",
  "conclusion",
  "conclusions",
  "future work",
  "references",
  "acknowledgments",
  "acknowledgements",
  "appendix",
];

/**
 * Detect language from text (simple heuristic)
 * Returns ISO 639-1 code
 */
function detectLanguage(text: string): string {
  // Korean characters
  if (/[\uAC00-\uD7AF]/.test(text)) {
    return "ko";
  }
  // Japanese characters (Hiragana, Katakana)
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) {
    return "ja";
  }
  // Chinese characters (simplified check - no Japanese kana)
  if (/[\u4E00-\u9FFF]/.test(text) && !/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) {
    return "zh";
  }
  // Default to English
  return "en";
}

/**
 * Calculate section level from numbering
 * "1" -> 1, "1.2" -> 2, "1.2.3" -> 3
 */
function getSectionLevel(numbering: string): number {
  // Roman numerals = level 1
  if (/^[IVX]+$/i.test(numbering)) {
    return 1;
  }
  // Single letter = level 1
  if (/^[A-Z]$/i.test(numbering)) {
    return 1;
  }
  // Dot-separated numbers
  const parts = numbering.split(".");
  return Math.min(parts.length, 3); // Cap at level 3 per ui-spec.yaml edge case
}

/**
 * Check if a line looks like a section header
 */
function isSectionHeader(line: string): { isHeader: boolean; title: string; level: number } {
  const trimmedLine = line.trim();

  // Check numbered patterns
  for (const pattern of SECTION_PATTERNS) {
    const match = trimmedLine.match(pattern);
    if (match) {
      const numbering = match[1];
      const title = match[2].trim();
      // Filter out lines that are too long (likely not headers)
      if (title.length > 100) continue;
      return {
        isHeader: true,
        title: `${numbering}. ${title}`,
        level: getSectionLevel(numbering),
      };
    }
  }

  // Check for known section names (without numbering)
  const lowerLine = trimmedLine.toLowerCase();
  for (const sectionName of KNOWN_SECTION_NAMES) {
    if (lowerLine === sectionName || lowerLine.startsWith(sectionName + ":")) {
      return {
        isHeader: true,
        title: trimmedLine,
        level: 1,
      };
    }
  }

  return { isHeader: false, title: "", level: 0 };
}

/**
 * Parse sections from extracted PDF text
 * Based on functional-spec.yaml#F-001.edge_cases (다중 컬럼 레이아웃, 섹션 구조)
 */
function parseSections(text: string, pageCount: number): ParsedSection[] {
  const lines = text.split("\n");
  const sections: ParsedSection[] = [];
  let currentSection: ParsedSection | null = null;
  let contentLines: string[] = [];
  let orderIndex = 0;

  // Estimate page from position in text (rough approximation)
  const totalLength = text.length;
  const getEstimatedPage = (position: number): number => {
    if (pageCount <= 1) return 1;
    return Math.min(Math.ceil((position / totalLength) * pageCount), pageCount);
  };

  let currentPosition = 0;

  for (const line of lines) {
    const headerInfo = isSectionHeader(line);

    if (headerInfo.isHeader) {
      // Save previous section
      if (currentSection) {
        currentSection.content = contentLines.join("\n").trim();
        currentSection.pageEnd = getEstimatedPage(currentPosition);
        if (currentSection.content.length > 0) {
          sections.push(currentSection);
        }
      }

      // Start new section
      orderIndex++;
      currentSection = {
        title: headerInfo.title,
        level: headerInfo.level,
        orderIndex,
        content: "",
        pageStart: getEstimatedPage(currentPosition),
        pageEnd: getEstimatedPage(currentPosition),
      };
      contentLines = [];
    } else if (currentSection) {
      contentLines.push(line);
    } else {
      // Content before first section (e.g., title, abstract without header)
      if (line.trim().length > 0) {
        // Create a "Preamble" section for content before first header
        if (!currentSection) {
          currentSection = {
            title: "Preamble",
            level: 1,
            orderIndex: 0,
            content: "",
            pageStart: 1,
            pageEnd: 1,
          };
        }
        contentLines.push(line);
      }
    }

    currentPosition += line.length + 1; // +1 for newline
  }

  // Don't forget the last section
  if (currentSection) {
    currentSection.content = contentLines.join("\n").trim();
    currentSection.pageEnd = pageCount;
    if (currentSection.content.length > 0) {
      sections.push(currentSection);
    }
  }

  // If no sections were found, create a single section with all content
  if (sections.length === 0) {
    sections.push({
      title: "Full Document",
      level: 1,
      orderIndex: 1,
      content: text.trim(),
      pageStart: 1,
      pageEnd: pageCount,
    });
  }

  return sections;
}

/**
 * Extract text from PDF using pdfjs-dist
 */
interface TextItem {
  str: string;
}

async function extractTextFromPdf(
  data: Uint8Array
): Promise<{ text: string; pageCount: number; metadata: { title?: string; author?: string } }> {
  const loadingTask = pdfjsLib.getDocument({
    data,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  });

  const pdfDoc = await loadingTask.promise;
  const pageCount = pdfDoc.numPages;
  const textParts: string[] = [];

  for (let i = 1; i <= pageCount; i++) {
    const page = await pdfDoc.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = (textContent.items as { str?: string }[])
      .filter((item): item is TextItem => typeof item.str === "string")
      .map((item) => item.str)
      .join(" ");
    textParts.push(pageText);
  }

  const metadata = await pdfDoc.getMetadata();
  const info = metadata?.info as Record<string, unknown> | undefined;

  return {
    text: textParts.join("\n\n"),
    pageCount,
    metadata: {
      title: typeof info?.Title === "string" ? info.Title : undefined,
      author: typeof info?.Author === "string" ? info.Author : undefined,
    },
  };
}

/**
 * Parse PDF buffer and extract text and structure
 *
 * @param buffer - PDF file as Buffer or ArrayBuffer
 * @returns ParsePdfResult - Either parsed result or error
 */
export async function parsePdf(buffer: Buffer | ArrayBuffer): Promise<ParsePdfResult> {
  const data = new Uint8Array(buffer instanceof ArrayBuffer ? buffer : buffer.buffer);

  try {
    const { text, pageCount, metadata } = await extractTextFromPdf(data);

    // Check for empty/unreadable content
    if (!text || text.trim().length === 0) {
      return {
        success: false,
        error: PdfErrorCodes.NO_TEXT_CONTENT,
      };
    }

    const sections = parseSections(text, pageCount);
    const language = detectLanguage(text);

    return {
      success: true,
      text,
      pageCount,
      sections,
      metadata: {
        title: metadata.title,
        author: metadata.author,
        language,
      },
    };
  } catch (error) {
    // Check for encrypted PDF
    if (error instanceof Error) {
      const errorMessage = error.message.toLowerCase();
      if (
        errorMessage.includes("encrypted") ||
        errorMessage.includes("password") ||
        errorMessage.includes("protected")
      ) {
        return {
          success: false,
          error: PdfErrorCodes.PDF_ENCRYPTED,
        };
      }
    }

    console.error("PDF parsing error:", error);
    return {
      success: false,
      error: PdfErrorCodes.PARSING_FAILED,
    };
  }
}
