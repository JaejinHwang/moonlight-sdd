/**
 * Markdown Converter - Convert PDF parsed content to Markdown
 *
 * spec_refs:
 * - functional-spec.yaml#F-001
 *
 * Features:
 * - Section headers → # levels
 * - Bold/Italic detection via font metadata
 * - Math expression preservation
 * - Paragraph structure preservation
 */

import type { EnhancedTextItem } from "./parser";
import type { ParsedSection } from "./parser";
import { parseContentWithMath, segmentsToMarkdown } from "./math-parser";

/**
 * Options for markdown conversion
 */
export interface MarkdownConverterOptions {
  /** Preserve LaTeX math expressions (default: true) */
  preserveMath: boolean;
  /** Detect headers from font size (default: true) */
  detectHeaders: boolean;
  /** Convert bold/italic from font metadata (default: true) */
  detectEmphasis: boolean;
  /** Include page numbers in output (default: false) */
  includePageNumbers: boolean;
}

const DEFAULT_OPTIONS: MarkdownConverterOptions = {
  preserveMath: true,
  detectHeaders: true,
  detectEmphasis: true,
  includePageNumbers: false,
};

/**
 * Result of markdown conversion for a section
 */
export interface MarkdownSection {
  title: string;
  level: number;
  markdown: string;
  pageStart: number;
  pageEnd: number;
}

/**
 * Full markdown conversion result
 */
export interface MarkdownConversionResult {
  /** Complete markdown document */
  markdown: string;
  /** Individual sections as markdown */
  sections: MarkdownSection[];
}

/**
 * Convert a section title to markdown header
 */
export function convertSectionToHeader(title: string, level: number): string {
  const headerPrefix = "#".repeat(Math.min(level, 6));
  return `${headerPrefix} ${title}`;
}

/**
 * Wrap text with bold markers, preserving whitespace
 */
function wrapWithBold(text: string): string {
  const match = text.match(/^(\s*)(.*?)(\s*)$/);
  if (!match) return `**${text}**`;

  const [, leadingSpace, content, trailingSpace] = match;
  if (!content) return text;

  return `${leadingSpace}**${content}**${trailingSpace}`;
}

/**
 * Wrap text with italic markers, preserving whitespace
 */
function wrapWithItalic(text: string): string {
  const match = text.match(/^(\s*)(.*?)(\s*)$/);
  if (!match) return `*${text}*`;

  const [, leadingSpace, content, trailingSpace] = match;
  if (!content) return text;

  return `${leadingSpace}*${content}*${trailingSpace}`;
}

/**
 * Wrap text with bold+italic markers
 */
function wrapWithBoldItalic(text: string): string {
  const match = text.match(/^(\s*)(.*?)(\s*)$/);
  if (!match) return `***${text}***`;

  const [, leadingSpace, content, trailingSpace] = match;
  if (!content) return text;

  return `${leadingSpace}***${content}***${trailingSpace}`;
}

/**
 * Convert enhanced text items to markdown with emphasis detection
 */
export function convertEnhancedItemsToMarkdown(
  items: EnhancedTextItem[],
  options: Partial<MarkdownConverterOptions> = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  if (items.length === 0) return "";

  let result = "";
  let currentParagraph = "";

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    let text = item.str;

    // Apply emphasis if enabled
    if (opts.detectEmphasis) {
      if (item.isBold && item.isItalic) {
        text = wrapWithBoldItalic(text);
      } else if (item.isBold) {
        text = wrapWithBold(text);
      } else if (item.isItalic) {
        text = wrapWithItalic(text);
      }
    }

    // Add space between items if needed
    if (i > 0) {
      const prevItem = items[i - 1];
      const gap = item.x - (prevItem.x + prevItem.width);
      const avgHeight = (item.height + prevItem.height) / 2;

      if (gap > avgHeight * 0.25) {
        currentParagraph += " ";
      }
    }

    currentParagraph += text;

    // Check for end of line
    if (item.hasEOL) {
      result += currentParagraph + "\n";
      currentParagraph = "";
    }
  }

  // Don't forget remaining content
  if (currentParagraph) {
    result += currentParagraph;
  }

  return result;
}

/**
 * Convert a single parsed section to markdown
 */
export function convertSectionToMarkdown(
  section: ParsedSection,
  options: Partial<MarkdownConverterOptions> = {}
): MarkdownSection {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Create header
  const header = convertSectionToHeader(section.title, section.level);

  // Process content - preserve math if enabled
  let content = section.content;
  if (opts.preserveMath) {
    const segments = parseContentWithMath(content);
    content = segmentsToMarkdown(segments);
  }

  // Build final markdown
  let markdown = `${header}\n\n${content.trim()}`;

  // Add page numbers if enabled
  if (opts.includePageNumbers) {
    const pageInfo =
      section.pageStart === section.pageEnd
        ? `p. ${section.pageStart}`
        : `pp. ${section.pageStart}-${section.pageEnd}`;
    markdown += `\n\n<!-- ${pageInfo} -->`;
  }

  return {
    title: section.title,
    level: section.level,
    markdown,
    pageStart: section.pageStart,
    pageEnd: section.pageEnd,
  };
}

/**
 * Convert all parsed sections to a complete markdown document
 */
export function convertSectionsToMarkdown(
  sections: ParsedSection[],
  options: Partial<MarkdownConverterOptions> = {}
): MarkdownConversionResult {
  const markdownSections = sections.map((section) =>
    convertSectionToMarkdown(section, options)
  );

  // Join sections with horizontal rules for clarity
  const markdown = markdownSections.map((s) => s.markdown).join("\n\n---\n\n");

  return {
    markdown,
    sections: markdownSections,
  };
}

/**
 * Convert text with emphasis information to markdown
 * Used when we have font metadata per text segment
 */
export function applyEmphasisToText(
  text: string,
  isBold: boolean,
  isItalic: boolean
): string {
  if (isBold && isItalic) {
    return wrapWithBoldItalic(text);
  }
  if (isBold) {
    return wrapWithBold(text);
  }
  if (isItalic) {
    return wrapWithItalic(text);
  }
  return text;
}

/**
 * Build a line of markdown from enhanced items
 */
export function buildMarkdownLine(
  items: EnhancedTextItem[],
  avgHeight: number,
  options: Partial<MarkdownConverterOptions> = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const spaceWidth = avgHeight * 0.25;
  let text = "";

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    let itemText = item.str;

    // Apply emphasis
    if (opts.detectEmphasis) {
      itemText = applyEmphasisToText(itemText, item.isBold, item.isItalic);
    }

    // Add space if gap between items
    if (i > 0) {
      const prevItem = items[i - 1];
      const gap = item.x - (prevItem.x + prevItem.width);

      if (gap > spaceWidth) {
        text += " ";
      }
    }

    text += itemText;
  }

  return text;
}
