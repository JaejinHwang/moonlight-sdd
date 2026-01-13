/**
 * URL Parser Utility for Paper URLs
 * Parses arXiv and DOI URLs to extract PDF download links
 *
 * Based on functional-spec.yaml#F-002:
 * - edge_cases: arXiv URL, DOI URL handling
 * - error_cases: INVALID_URL, PDF_NOT_FOUND, ACCESS_DENIED
 */

// Error codes from functional-spec.yaml#F-002
export const UrlErrorCodes = {
  INVALID_URL: {
    code: "INVALID_URL",
    message: "올바른 URL을 입력해주세요.",
    recovery: "URL 형식을 확인해주세요.",
  },
  PDF_NOT_FOUND: {
    code: "PDF_NOT_FOUND",
    message: "해당 URL에서 PDF를 찾을 수 없습니다.",
    recovery: "직접 PDF 링크를 입력하거나 파일을 업로드해주세요.",
  },
  ACCESS_DENIED: {
    code: "ACCESS_DENIED",
    message: "해당 논문에 접근할 수 없습니다.",
    recovery: "직접 PDF를 다운로드하여 업로드해주세요.",
  },
} as const;

export type UrlErrorCode = keyof typeof UrlErrorCodes;

export interface ParsedUrl {
  type: "arxiv" | "doi" | "direct_pdf" | "unknown";
  originalUrl: string;
  pdfUrl: string | null;
  identifier?: string; // arXiv ID or DOI
}

/**
 * Validates if a string is a valid URL
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Parses arXiv URL and extracts paper ID
 * Supported formats:
 * - https://arxiv.org/abs/2301.00001
 * - https://arxiv.org/pdf/2301.00001.pdf
 * - https://arxiv.org/abs/hep-th/9905111
 * - http://arxiv.org/abs/2301.00001v2
 */
export function parseArxivUrl(url: string): ParsedUrl | null {
  const arxivPatterns = [
    // New format: arxiv.org/abs/YYMM.NNNNN or arxiv.org/pdf/YYMM.NNNNN
    /arxiv\.org\/(?:abs|pdf)\/(\d{4}\.\d{4,5}(?:v\d+)?)/i,
    // Old format: arxiv.org/abs/category/NNNNNNN
    /arxiv\.org\/(?:abs|pdf)\/([\w-]+\/\d{7}(?:v\d+)?)/i,
  ];

  for (const pattern of arxivPatterns) {
    const match = url.match(pattern);
    if (match) {
      const arxivId = match[1];
      // Remove version suffix for PDF URL if present, then add it back
      const baseId = arxivId.replace(/v\d+$/, "");
      return {
        type: "arxiv",
        originalUrl: url,
        pdfUrl: `https://arxiv.org/pdf/${baseId}.pdf`,
        identifier: arxivId,
      };
    }
  }

  return null;
}

/**
 * Parses DOI URL
 * Supported formats:
 * - https://doi.org/10.1000/xyz123
 * - https://dx.doi.org/10.1000/xyz123
 */
export function parseDoiUrl(url: string): ParsedUrl | null {
  const doiPatterns = [
    // doi.org or dx.doi.org
    /(?:dx\.)?doi\.org\/(10\.\d{4,}\/[^\s]+)/i,
  ];

  for (const pattern of doiPatterns) {
    const match = url.match(pattern);
    if (match) {
      const doi = match[1];
      // DOI URLs need to be resolved to find the actual PDF
      // We return the DOI URL which will be resolved later
      return {
        type: "doi",
        originalUrl: url,
        pdfUrl: null, // DOI needs resolution
        identifier: doi,
      };
    }
  }

  return null;
}

/**
 * Checks if URL points directly to a PDF file
 */
export function isDirectPdfUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return urlObj.pathname.toLowerCase().endsWith(".pdf");
  } catch {
    return false;
  }
}

/**
 * Main URL parser function
 * Attempts to parse URL as arXiv, DOI, or direct PDF
 */
export function parseUrl(url: string): ParsedUrl {
  // Trim and validate URL
  const trimmedUrl = url.trim();

  if (!isValidUrl(trimmedUrl)) {
    return {
      type: "unknown",
      originalUrl: trimmedUrl,
      pdfUrl: null,
    };
  }

  // Try arXiv first
  const arxivResult = parseArxivUrl(trimmedUrl);
  if (arxivResult) {
    return arxivResult;
  }

  // Try DOI
  const doiResult = parseDoiUrl(trimmedUrl);
  if (doiResult) {
    return doiResult;
  }

  // Check if it's a direct PDF link
  if (isDirectPdfUrl(trimmedUrl)) {
    return {
      type: "direct_pdf",
      originalUrl: trimmedUrl,
      pdfUrl: trimmedUrl,
    };
  }

  // Unknown URL type
  return {
    type: "unknown",
    originalUrl: trimmedUrl,
    pdfUrl: null,
  };
}

/**
 * Resolves DOI to actual PDF URL
 * This requires following redirects to the publisher page
 * Note: Many publishers require authentication, so this may fail
 */
export async function resolveDoiToPdf(doi: string): Promise<string | null> {
  // DOI resolution is complex as each publisher has different PDF locations
  // For MVP, we'll return null and show appropriate error message
  // In production, this could use Unpaywall API or similar services
  console.log(`DOI resolution not implemented for: ${doi}`);
  return null;
}
