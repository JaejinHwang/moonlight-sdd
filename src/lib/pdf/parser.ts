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
 * Reference: arXiv:1706.03762 "Attention Is All You Need"
 * Supports various numbering styles found in academic papers
 */
const SECTION_PATTERNS = [
  // Style 1: "1 Introduction", "3.2.1 Scaled Dot-Product Attention" (no dot after number)
  // This is the arXiv/NeurIPS style used in "Attention Is All You Need"
  /^(\d+(?:\.\d+)*)\s+([A-Z][^\d].*)$/,

  // Style 2: "1. Introduction", "2.1. Methods" (dot after number)
  /^(\d+(?:\.\d+)*)\.\s+(.+)$/,

  // Style 3: Combined - number with optional dot: "1 Intro" or "1. Intro"
  /^(\d+(?:\.\d+)*)\s*\.?\s+(.+)$/,

  // Roman numerals: "I. Introduction", "II Background", "III. Methods"
  /^([IVX]+)\s*\.?\s+(.+)$/i,

  // Letter sections: "A. Overview", "B Methods", "A Overview"
  /^([A-Z])\s*\.?\s+(.+)$/,
];

/**
 * Common academic paper section names (case-insensitive matching)
 * Extended based on arXiv:1706.03762 and common ML/AI papers
 */
const KNOWN_SECTION_NAMES = [
  // Standard sections
  "abstract",
  "introduction",
  "background",
  "related work",
  "related works",
  "preliminaries",
  "problem statement",
  "problem formulation",

  // Methods/Model sections (common in ML papers)
  "methods",
  "method",
  "methodology",
  "approach",
  "our approach",
  "proposed method",
  "proposed approach",
  "model",
  "model architecture",
  "architecture",
  "framework",
  "materials and methods",

  // Experiments sections
  "experiments",
  "experiment",
  "experimental setup",
  "experimental settings",
  "experimental results",
  "evaluation",
  "setup",
  "training",
  "implementation",
  "implementation details",

  // Results sections
  "results",
  "result",
  "results and discussion",
  "analysis",
  "ablation study",
  "ablation studies",
  "ablations",

  // Discussion/Conclusion
  "discussion",
  "conclusion",
  "conclusions",
  "conclusion and future work",
  "conclusions and future work",
  "future work",
  "limitations",
  "limitations and future work",
  "broader impact",
  "ethics statement",
  "societal impact",

  // End matter
  "references",
  "bibliography",
  "acknowledgments",
  "acknowledgements",
  "acknowledgment",
  "appendix",
  "appendices",
  "supplementary material",
  "supplementary materials",
  "supplemental material",
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
 * Improved detection based on arXiv:1706.03762 patterns
 */
function isSectionHeader(line: string): { isHeader: boolean; title: string; level: number } {
  const trimmedLine = line.trim();

  // Skip empty or very short lines
  if (trimmedLine.length < 2) {
    return { isHeader: false, title: "", level: 0 };
  }

  // Skip lines that are clearly not headers (too long, or look like sentences)
  if (trimmedLine.length > 100) {
    return { isHeader: false, title: "", level: 0 };
  }

  // Check numbered patterns first (most reliable)
  for (const pattern of SECTION_PATTERNS) {
    const match = trimmedLine.match(pattern);
    if (match) {
      const numbering = match[1];
      const title = match[2].trim();

      // Additional validation: title should start with capital letter or be a known name
      if (title.length === 0) continue;

      // Skip if the "title" looks like a number or equation
      if (/^[\d\s\.\,\-\+\=\*\/\(\)]+$/.test(title)) continue;

      // Skip very short titles that might be false positives (e.g., "1 A" could be "1. A")
      if (title.length < 3 && !/^[A-Z]{1,2}$/.test(title)) continue;

      return {
        isHeader: true,
        title: `${numbering} ${title}`, // Use space instead of dot for cleaner display
        level: getSectionLevel(numbering),
      };
    }
  }

  // Check for known section names (without numbering)
  const lowerLine = trimmedLine.toLowerCase();
  for (const sectionName of KNOWN_SECTION_NAMES) {
    // Exact match
    if (lowerLine === sectionName) {
      return {
        isHeader: true,
        title: trimmedLine,
        level: 1,
      };
    }
    // Match with colon (e.g., "Abstract:")
    if (lowerLine === sectionName + ":") {
      return {
        isHeader: true,
        title: trimmedLine.replace(/:$/, ""), // Remove trailing colon
        level: 1,
      };
    }
    // Match at start with space (e.g., "Abstract  " with extra spaces)
    if (lowerLine.replace(/\s+/g, " ").trim() === sectionName) {
      return {
        isHeader: true,
        title: trimmedLine.trim(),
        level: 1,
      };
    }
  }

  // Additional heuristic: ALL CAPS short lines could be headers
  // Common in some paper formats (e.g., "INTRODUCTION", "METHODS")
  if (
    trimmedLine === trimmedLine.toUpperCase() &&
    trimmedLine.length >= 4 &&
    trimmedLine.length <= 50 &&
    /^[A-Z\s]+$/.test(trimmedLine)
  ) {
    const normalizedName = trimmedLine.toLowerCase();
    if (KNOWN_SECTION_NAMES.includes(normalizedName)) {
      return {
        isHeader: true,
        title: trimmedLine.charAt(0) + trimmedLine.slice(1).toLowerCase(), // Title case
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

// Raw pdfjs TextItem interface
interface PdfjsTextItem {
  str: string;
  dir: string;
  transform: number[]; // [scaleX, skewX, skewY, scaleY, x, y]
  width: number;
  height: number;
  fontName: string;
  hasEOL?: boolean;
}

// Font style from pdfjs TextContent.styles
interface FontStyle {
  fontFamily: string;
  ascent: number;
  descent: number;
  vertical: boolean;
}

/**
 * Enhanced TextItem with font metadata for markdown conversion
 */
export interface EnhancedTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontName: string;
  fontFamily: string;
  isBold: boolean;
  isItalic: boolean;
  hasEOL: boolean;
}

/**
 * Column detection result
 */
interface ColumnResult {
  type: "single" | "two";
  left: EnhancedTextItem[];
  right: EnhancedTextItem[];
  span: EnhancedTextItem[]; // Full-width items (titles, captions)
}

/**
 * Detect and separate left/right columns based on page width
 * For two-column academic papers (e.g., arXiv, IEEE)
 *
 * Improved version that:
 * - Detects full-width span items (titles, captions)
 * - Determines if layout is actually two-column
 * - Handles edge cases better
 */
function detectColumnsEnhanced(
  items: EnhancedTextItem[],
  pageWidth: number
): ColumnResult {
  const midPoint = pageWidth / 2;
  const margin = pageWidth * 0.08; // 8% margin for better detection

  const leftItems: EnhancedTextItem[] = [];
  const rightItems: EnhancedTextItem[] = [];
  const spanItems: EnhancedTextItem[] = [];

  for (const item of items) {
    const itemLeft = item.x;
    const itemRight = item.x + item.width;

    // Full-width items (>60% of page width) are span items
    if (item.width > pageWidth * 0.6) {
      spanItems.push(item);
    }
    // Item entirely in left column area
    else if (itemRight < midPoint + margin) {
      leftItems.push(item);
    }
    // Item entirely in right column area
    else if (itemLeft > midPoint - margin) {
      rightItems.push(item);
    }
    // Item spans across center - treat as span
    else {
      spanItems.push(item);
    }
  }

  // Determine if this is actually a two-column layout
  // Need sufficient items on both sides
  const isTwoColumn = leftItems.length > 10 && rightItems.length > 10;

  if (!isTwoColumn) {
    // Single column: combine all items
    return {
      type: "single",
      left: [...spanItems, ...leftItems, ...rightItems].sort((a, b) => b.y - a.y),
      right: [],
      span: [],
    };
  }

  return {
    type: "two",
    left: leftItems,
    right: rightItems,
    span: spanItems,
  };
}

/**
 * Group enhanced text items into lines based on Y coordinate
 * Fixed version: lineStartY is only updated when starting a new line
 */
function groupEnhancedItemsIntoLines(items: EnhancedTextItem[]): EnhancedTextItem[][] {
  if (items.length === 0) return [];

  // Sort by Y coordinate (top to bottom, PDF Y-axis is bottom-up)
  const sorted = [...items].sort((a, b) => b.y - a.y);

  const lines: EnhancedTextItem[][] = [];
  let currentLine: EnhancedTextItem[] = [];

  // Calculate Y threshold based on average item height
  const avgHeight = items.reduce((sum, i) => sum + i.height, 0) / items.length || 10;
  const yThreshold = avgHeight * 0.6; // Slightly increased for better grouping

  // FIX: Use lineStartY instead of lastY to prevent gradual drift
  let lineStartY = sorted[0].y;

  for (const item of sorted) {
    const yDiff = Math.abs(item.y - lineStartY);

    // New line if Y coordinate differs significantly from line start
    if (yDiff > yThreshold && currentLine.length > 0) {
      // Sort current line by X coordinate (left to right)
      lines.push(currentLine.sort((a, b) => a.x - b.x));
      currentLine = [];
      lineStartY = item.y; // Only update when starting a new line
    }

    currentLine.push(item);
  }

  // Don't forget the last line
  if (currentLine.length > 0) {
    lines.push(currentLine.sort((a, b) => a.x - b.x));
  }

  return lines;
}

/**
 * Reconstruct text from enhanced items with improved paragraph detection
 */
function reconstructEnhancedColumnText(
  lines: EnhancedTextItem[][],
  avgHeight: number,
  leftMargin?: number
): string {
  if (lines.length === 0) return "";

  const result: string[] = [];
  let lastY = lines[0][0]?.y ?? 0;

  // FIX: Increased thresholds to reduce excessive line breaks
  const normalLineGap = avgHeight * 1.4;
  const paragraphThreshold = avgHeight * 2.2;

  // Calculate left margin if not provided
  const calculatedLeftMargin =
    leftMargin ?? Math.min(...lines.flat().map((item) => item.x));

  for (const line of lines) {
    const currentY = line[0]?.y ?? 0;
    const yGap = lastY - currentY;

    // Check for indentation (paragraph start hint)
    const firstItemX = line[0]?.x ?? 0;
    const isIndented = firstItemX > calculatedLeftMargin + avgHeight * 1.5;

    // FIX: More conservative paragraph detection
    const isParagraphBreak =
      yGap > paragraphThreshold || (yGap > normalLineGap && isIndented);

    // Insert empty line for paragraph breaks
    if (result.length > 0 && isParagraphBreak) {
      result.push("");
    }

    // Combine text items in line with appropriate spacing
    const lineText = buildLineText(line, avgHeight);
    result.push(lineText);
    lastY = currentY;
  }

  return result.join("\n");
}

/**
 * Build text from a single line of items with proper spacing
 */
function buildLineText(line: EnhancedTextItem[], avgHeight: number): string {
  const spaceWidth = avgHeight * 0.25;
  let text = "";

  for (let i = 0; i < line.length; i++) {
    const item = line[i];

    if (i > 0) {
      const prevItem = line[i - 1];
      const gap = item.x - (prevItem.x + prevItem.width);

      // Add space if gap is larger than typical space width
      if (gap > spaceWidth) {
        text += " ";
      }
    }

    text += item.str;
  }

  return text;
}

/**
 * Main function to reconstruct text with layout preservation (Enhanced version)
 * Handles two-column layouts with improved span item handling
 */
function reconstructTextWithLayoutEnhanced(
  items: EnhancedTextItem[],
  pageWidth: number
): string {
  if (items.length === 0) return "";

  const avgHeight = items.reduce((sum, i) => sum + i.height, 0) / items.length || 10;

  // Detect columns with enhanced logic
  const columnResult = detectColumnsEnhanced(items, pageWidth);

  if (columnResult.type === "single") {
    // Single column layout
    const lines = groupEnhancedItemsIntoLines(columnResult.left);
    return reconstructEnhancedColumnText(lines, avgHeight);
  }

  // Two-column layout: process span items first, then left, then right
  const parts: string[] = [];

  // Process span items (titles, full-width content) by Y position
  if (columnResult.span.length > 0) {
    const spanLines = groupEnhancedItemsIntoLines(columnResult.span);
    const spanText = reconstructEnhancedColumnText(spanLines, avgHeight);
    if (spanText.trim()) {
      parts.push(spanText);
    }
  }

  // Process left column
  const leftLines = groupEnhancedItemsIntoLines(columnResult.left);
  const leftText = reconstructEnhancedColumnText(leftLines, avgHeight);

  // Process right column
  const rightLines = groupEnhancedItemsIntoLines(columnResult.right);
  const rightText = reconstructEnhancedColumnText(rightLines, avgHeight);

  // Combine: span → left → right
  if (leftText.trim()) {
    parts.push(leftText);
  }
  if (rightText.trim()) {
    parts.push(rightText);
  }

  return parts.join("\n\n");
}

/**
 * Extract enhanced text items from a page with font metadata
 */
function extractEnhancedTextItems(
  textContent: { items: unknown[]; styles: Record<string, FontStyle> }
): EnhancedTextItem[] {
  const styles = textContent.styles || {};

  return (textContent.items as unknown[])
    .filter((item): item is PdfjsTextItem => {
      const ti = item as PdfjsTextItem;
      return (
        typeof item === "object" &&
        item !== null &&
        typeof ti.str === "string" &&
        // FIX: Filter out empty strings and invalid dimensions
        ti.str.trim().length > 0 &&
        Array.isArray(ti.transform) &&
        ti.transform.length >= 6 &&
        typeof ti.width === "number" &&
        ti.width > 0 &&
        typeof ti.height === "number" &&
        ti.height > 0
      );
    })
    .map((item): EnhancedTextItem => {
      const fontStyle = styles[item.fontName] || {};
      const fontFamily = fontStyle.fontFamily || item.fontName || "";

      return {
        str: item.str,
        x: item.transform[4],
        y: item.transform[5],
        width: item.width,
        height: item.height,
        fontName: item.fontName || "",
        fontFamily,
        isBold: /bold|heavy|black|demi/i.test(fontFamily),
        isItalic: /italic|oblique|slant/i.test(fontFamily),
        hasEOL: item.hasEOL || false,
      };
    });
}

/**
 * Extended extraction result with enhanced items
 */
interface ExtractedPageData {
  text: string;
  enhancedItems: EnhancedTextItem[];
}

async function extractTextFromPdf(
  data: Uint8Array
): Promise<{
  text: string;
  pageCount: number;
  metadata: { title?: string; author?: string };
  enhancedItems: EnhancedTextItem[];
}> {
  const loadingTask = pdfjsLib.getDocument({
    data,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  });

  const pdfDoc = await loadingTask.promise;
  const pageCount = pdfDoc.numPages;
  const textParts: string[] = [];
  const allEnhancedItems: EnhancedTextItem[] = [];

  for (let i = 1; i <= pageCount; i++) {
    const page = await pdfDoc.getPage(i);
    const viewport = page.getViewport({ scale: 1.0 });
    const textContent = await page.getTextContent();

    // Extract enhanced text items with font metadata
    const enhancedItems = extractEnhancedTextItems(
      textContent as { items: unknown[]; styles: Record<string, FontStyle> }
    );

    // Store enhanced items for markdown conversion
    allEnhancedItems.push(...enhancedItems);

    // Reconstruct text with improved layout preservation
    const pageText = reconstructTextWithLayoutEnhanced(enhancedItems, viewport.width);
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
    enhancedItems: allEnhancedItems,
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

// Import markdown converter for extended parsing
import {
  convertSectionsToMarkdown,
  type MarkdownSection,
  type MarkdownConverterOptions,
} from "./markdown-converter";

/**
 * Extended PDF parse result with markdown conversion
 */
export interface PdfParseResultWithMarkdown extends PdfParseResult {
  /** Complete markdown document */
  markdown: string;
  /** Individual sections as markdown */
  markdownSections: MarkdownSection[];
  /** Enhanced text items with font metadata (for further processing) */
  enhancedItems: EnhancedTextItem[];
}

export type ParsePdfWithMarkdownResult = PdfParseResultWithMarkdown | PdfParseError;

/**
 * Parse PDF buffer and extract text, structure, and markdown
 *
 * Extended version of parsePdf that also converts content to markdown format.
 *
 * @param buffer - PDF file as Buffer or ArrayBuffer
 * @param options - Markdown conversion options
 * @returns ParsePdfWithMarkdownResult - Either parsed result with markdown or error
 */
export async function parsePdfWithMarkdown(
  buffer: Buffer | ArrayBuffer,
  options?: Partial<MarkdownConverterOptions>
): Promise<ParsePdfWithMarkdownResult> {
  const data = new Uint8Array(buffer instanceof ArrayBuffer ? buffer : buffer.buffer);

  try {
    const { text, pageCount, metadata, enhancedItems } = await extractTextFromPdf(data);

    // Check for empty/unreadable content
    if (!text || text.trim().length === 0) {
      return {
        success: false,
        error: PdfErrorCodes.NO_TEXT_CONTENT,
      };
    }

    const sections = parseSections(text, pageCount);
    const language = detectLanguage(text);

    // Convert sections to markdown
    const { markdown, sections: markdownSections } = convertSectionsToMarkdown(
      sections,
      options
    );

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
      markdown,
      markdownSections,
      enhancedItems,
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
