/**
 * Math Parser - Common module for parsing mathematical expressions
 *
 * Extracted from SectionRenderer.tsx for reuse in:
 * - PDF parser (markdown conversion)
 * - Section renderer (display)
 *
 * spec_refs:
 * - functional-spec.yaml#F-001.edge_cases (수식 포함 PDF)
 */

export type MathType = "math-block" | "math-inline";
export type ContentType = MathType | "text" | "highlight";

export interface ContentSegment {
  type: ContentType;
  content: string;
  reason?: string; // For highlights
}

// Math expression patterns
const MATH_PATTERNS = [
  { regex: /\$\$([\s\S]*?)\$\$/g, type: "math-block" as const },
  { regex: /\\\[([\s\S]*?)\\\]/g, type: "math-block" as const },
  { regex: /\$((?!\$)[^\$]*?)\$/g, type: "math-inline" as const },
  { regex: /\\\(([\s\S]*?)\\\)/g, type: "math-inline" as const },
];

interface MathExpression {
  start: number;
  end: number;
  content: string;
  type: MathType;
}

/**
 * Parse content to identify math expressions
 * Supports LaTeX delimiters: $...$ (inline) and $$...$$ (block)
 * Also supports \[...\] and \(...\) delimiters
 */
export function parseContentWithMath(content: string): ContentSegment[] {
  const segments: ContentSegment[] = [];

  // Find all math expressions with their positions
  const mathExpressions: MathExpression[] = [];

  for (const { regex, type } of MATH_PATTERNS) {
    let match;
    const re = new RegExp(regex.source, regex.flags);
    while ((match = re.exec(content)) !== null) {
      mathExpressions.push({
        start: match.index,
        end: match.index + match[0].length,
        content: match[1],
        type,
      });
    }
  }

  // Sort by position
  mathExpressions.sort((a, b) => a.start - b.start);

  // Remove overlapping expressions (keep first)
  const filteredExpressions = mathExpressions.filter((expr, idx) => {
    for (let i = 0; i < idx; i++) {
      if (expr.start < mathExpressions[i].end) {
        return false;
      }
    }
    return true;
  });

  // Build segments
  let lastEnd = 0;
  for (const expr of filteredExpressions) {
    // Add text before math
    if (expr.start > lastEnd) {
      const textContent = content.slice(lastEnd, expr.start);
      if (textContent.trim()) {
        segments.push({ type: "text", content: textContent });
      }
    }

    // Add math expression
    segments.push({ type: expr.type, content: expr.content });
    lastEnd = expr.end;
  }

  // Add remaining text
  if (lastEnd < content.length) {
    const textContent = content.slice(lastEnd);
    if (textContent.trim()) {
      segments.push({ type: "text", content: textContent });
    }
  }

  // If no math found, return original content as single text segment
  if (segments.length === 0 && content.trim()) {
    segments.push({ type: "text", content });
  }

  return segments;
}

/**
 * Convert segments back to text with math delimiters preserved
 * Useful for markdown output
 */
export function segmentsToText(segments: ContentSegment[]): string {
  return segments
    .map((seg) => {
      if (seg.type === "math-block") {
        return `$$${seg.content}$$`;
      }
      if (seg.type === "math-inline") {
        return `$${seg.content}$`;
      }
      return seg.content;
    })
    .join("");
}

/**
 * Convert segments to markdown format
 * Preserves math, wraps in appropriate markdown syntax
 */
export function segmentsToMarkdown(segments: ContentSegment[]): string {
  return segments
    .map((seg) => {
      if (seg.type === "math-block") {
        return `\n$$\n${seg.content}\n$$\n`;
      }
      if (seg.type === "math-inline") {
        return `$${seg.content}$`;
      }
      return seg.content;
    })
    .join("");
}

/**
 * Check if text contains any math expressions
 */
export function containsMath(text: string): boolean {
  return MATH_PATTERNS.some(({ regex }) => {
    const re = new RegExp(regex.source, regex.flags);
    return re.test(text);
  });
}

/**
 * Extract only math expressions from text
 */
export function extractMathExpressions(
  text: string
): Array<{ type: MathType; content: string }> {
  const expressions: Array<{ type: MathType; content: string }> = [];

  for (const { regex, type } of MATH_PATTERNS) {
    let match;
    const re = new RegExp(regex.source, regex.flags);
    while ((match = re.exec(text)) !== null) {
      expressions.push({
        type,
        content: match[1],
      });
    }
  }

  return expressions;
}
