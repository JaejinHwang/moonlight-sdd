import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parsePdf } from "@/lib/pdf/parser";
import { parseUrl, UrlErrorCodes, resolveDoiToPdf } from "@/lib/url";
import type { Database } from "@/types/database";

// Constants from functional-spec.yaml#F-002
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const DOWNLOAD_TIMEOUT = 20000; // 20 seconds (performance threshold from spec)

// Error codes from functional-spec.yaml#F-002 and technical-spec.yaml#api_spec.endpoints[1]
const ErrorCodes = {
  INVALID_URL: {
    code: "INVALID_URL",
    message: "올바른 URL을 입력해주세요.",
    recovery_action: "URL 형식을 확인해주세요.",
  },
  PDF_NOT_FOUND: {
    code: "PDF_NOT_FOUND",
    message: "해당 URL에서 PDF를 찾을 수 없습니다.",
    recovery_action: "직접 PDF 링크를 입력하거나 파일을 업로드해주세요.",
  },
  ACCESS_DENIED: {
    code: "ACCESS_DENIED",
    message: "해당 논문에 접근할 수 없습니다.",
    recovery_action: "직접 PDF를 다운로드하여 업로드해주세요.",
  },
  UNAUTHORIZED: {
    code: "UNAUTHORIZED",
    message: "로그인이 필요합니다.",
    recovery_action: "로그인 후 다시 시도해주세요.",
  },
  DOWNLOAD_FAILED: {
    code: "DOWNLOAD_FAILED",
    message: "PDF 다운로드에 실패했습니다.",
    recovery_action: "잠시 후 다시 시도해주세요.",
  },
  FILE_TOO_LARGE: {
    code: "FILE_TOO_LARGE",
    message: "파일 크기가 10MB를 초과합니다.",
    recovery_action: "더 작은 파일을 업로드해주세요.",
  },
  DATABASE_ERROR: {
    code: "DATABASE_ERROR",
    message: "데이터베이스 오류가 발생했습니다.",
    recovery_action: "다시 시도해주세요.",
  },
} as const;

/**
 * Downloads PDF from a URL with timeout
 */
async function downloadPdf(
  url: string
): Promise<{ buffer: ArrayBuffer; contentType: string } | { error: keyof typeof ErrorCodes }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; MoonlightBot/1.0; +https://moonlight.app)",
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 403 || response.status === 401) {
        return { error: "ACCESS_DENIED" };
      }
      if (response.status === 404) {
        return { error: "PDF_NOT_FOUND" };
      }
      return { error: "DOWNLOAD_FAILED" };
    }

    const contentType = response.headers.get("content-type") || "";

    // Check content length before downloading
    const contentLength = response.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > MAX_FILE_SIZE) {
      return { error: "FILE_TOO_LARGE" };
    }

    const buffer = await response.arrayBuffer();

    // Check actual size after download
    if (buffer.byteLength > MAX_FILE_SIZE) {
      return { error: "FILE_TOO_LARGE" };
    }

    return { buffer, contentType };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { error: "DOWNLOAD_FAILED" };
    }
    console.error("Download error:", error);
    return { error: "DOWNLOAD_FAILED" };
  }
}

/**
 * POST /api/papers/url
 * URL로 논문 다운로드 및 생성
 *
 * spec_refs:
 * - functional-spec.yaml#F-002
 * - technical-spec.yaml#api_spec.endpoints[1]
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // 1. Authentication check
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: ErrorCodes.UNAUTHORIZED },
      { status: 401 }
    );
  }

  // 2. Parse request body
  let body: { url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: ErrorCodes.INVALID_URL },
      { status: 400 }
    );
  }

  const { url } = body;

  // 3. Validate URL presence
  if (!url || typeof url !== "string" || !url.trim()) {
    return NextResponse.json(
      { error: ErrorCodes.INVALID_URL },
      { status: 400 }
    );
  }

  // 4. Parse URL to determine type and get PDF URL
  const parsedUrl = parseUrl(url.trim());

  // 5. Handle unknown URL type
  if (parsedUrl.type === "unknown") {
    return NextResponse.json(
      { error: ErrorCodes.INVALID_URL },
      { status: 400 }
    );
  }

  // 6. Get PDF download URL
  let pdfUrl = parsedUrl.pdfUrl;

  // 7. Handle DOI - requires resolution
  if (parsedUrl.type === "doi") {
    if (parsedUrl.identifier) {
      pdfUrl = await resolveDoiToPdf(parsedUrl.identifier);
    }
    if (!pdfUrl) {
      // DOI resolution not supported in MVP
      return NextResponse.json(
        {
          error: {
            ...ErrorCodes.PDF_NOT_FOUND,
            message: "DOI URL은 현재 지원하지 않습니다. arXiv URL이나 직접 PDF 링크를 사용해주세요.",
          },
        },
        { status: 400 }
      );
    }
  }

  // 8. Verify we have a PDF URL to download
  if (!pdfUrl) {
    return NextResponse.json(
      { error: ErrorCodes.PDF_NOT_FOUND },
      { status: 404 }
    );
  }

  // 9. Download PDF
  const downloadResult = await downloadPdf(pdfUrl);

  if ("error" in downloadResult) {
    const errorCode = downloadResult.error;
    const statusMap: Record<string, number> = {
      ACCESS_DENIED: 403,
      PDF_NOT_FOUND: 404,
      FILE_TOO_LARGE: 400,
      DOWNLOAD_FAILED: 502,
    };
    return NextResponse.json(
      { error: ErrorCodes[errorCode] },
      { status: statusMap[errorCode] || 500 }
    );
  }

  const { buffer } = downloadResult;

  // 10. Verify it's actually a PDF
  const uint8Array = new Uint8Array(buffer);
  const isPdf =
    uint8Array[0] === 0x25 && // %
    uint8Array[1] === 0x50 && // P
    uint8Array[2] === 0x44 && // D
    uint8Array[3] === 0x46; // F

  if (!isPdf) {
    return NextResponse.json(
      { error: ErrorCodes.PDF_NOT_FOUND },
      { status: 404 }
    );
  }

  // 11. Generate file path
  const timestamp = Date.now();
  const identifier = parsedUrl.identifier || "paper";
  const sanitizedId = identifier.replace(/[^a-zA-Z0-9.-]/g, "_");
  const filePath = `${user.id}/${timestamp}_${sanitizedId}.pdf`;

  // 12. Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from("papers")
    .upload(filePath, buffer, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (uploadError) {
    console.error("Storage upload error:", uploadError);
    return NextResponse.json(
      { error: ErrorCodes.DOWNLOAD_FAILED },
      { status: 500 }
    );
  }

  // 13. Extract title from identifier
  let title = `Paper ${identifier}`;
  if (parsedUrl.type === "arxiv") {
    title = `arXiv:${identifier}`;
  }

  // 14. Insert paper metadata into database
  type PaperInsert = Database["public"]["Tables"]["papers"]["Insert"];
  const insertData: PaperInsert = {
    user_id: user.id,
    title,
    source_url: parsedUrl.originalUrl,
    file_path: filePath,
    file_size: buffer.byteLength,
    page_count: 0,
    language: "en",
    status: "processing",
  };

  const { data: paper, error: dbError } = await supabase
    .from("papers")
    .insert(insertData)
    .select("id, title, source_url, status, created_at")
    .single();

  if (dbError || !paper) {
    console.error("Database insert error:", dbError);
    await supabase.storage.from("papers").remove([filePath]);
    return NextResponse.json(
      { error: ErrorCodes.DATABASE_ERROR },
      { status: 500 }
    );
  }

  // 15. Parse PDF and extract sections
  const parseResult = await parsePdf(buffer);

  if (!parseResult.success) {
    await supabase.from("papers").update({ status: "error" }).eq("id", paper.id);
    console.error("PDF parsing error:", parseResult.error);
    return NextResponse.json(
      {
        id: paper.id,
        title: paper.title,
        source_url: paper.source_url,
        status: "error",
        created_at: paper.created_at,
        error: parseResult.error,
      },
      { status: 201 }
    );
  }

  // 16. Save sections to database
  type SectionInsert = Database["public"]["Tables"]["sections"]["Insert"];
  const sectionsToInsert: SectionInsert[] = parseResult.sections.map((section) => ({
    paper_id: paper.id,
    title: section.title,
    level: section.level,
    order_index: section.orderIndex,
    content: section.content,
    page_start: section.pageStart,
    page_end: section.pageEnd,
  }));

  const { error: sectionsError } = await supabase.from("sections").insert(sectionsToInsert);

  if (sectionsError) {
    console.error("Sections insert error:", sectionsError);
    await supabase.from("papers").update({ status: "error" }).eq("id", paper.id);
  }

  // 17. Update paper with parsed metadata
  const finalStatus = sectionsError ? "error" : "ready";
  const finalTitle = parseResult.metadata.title || paper.title;

  const { error: updateError } = await supabase
    .from("papers")
    .update({
      title: finalTitle,
      page_count: parseResult.pageCount,
      language: parseResult.metadata.language,
      status: finalStatus,
    })
    .eq("id", paper.id);

  if (updateError) {
    console.error("Paper update error:", updateError);
  }

  // 18. Return success response (technical-spec.yaml#api_spec.endpoints[1].response.success)
  return NextResponse.json(
    {
      id: paper.id,
      title: finalTitle,
      source_url: paper.source_url,
      status: finalStatus,
      created_at: paper.created_at,
      page_count: parseResult.pageCount,
      sections_count: parseResult.sections.length,
    },
    { status: 201 }
  );
}
