import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parsePdf, PdfErrorCodes } from "@/lib/pdf/parser";
import type { Database } from "@/types/database";

/**
 * POST /api/papers/{id}/parse
 * PDF 파싱 및 섹션 추출
 *
 * spec_refs:
 * - functional-spec.yaml#F-001 (states: parsing)
 * - TASK-005
 *
 * This endpoint:
 * 1. Downloads PDF from Supabase Storage
 * 2. Parses the PDF to extract text and sections
 * 3. Saves sections to database
 * 4. Updates paper status to 'ready'
 */

const ErrorCodes = {
  UNAUTHORIZED: {
    code: "UNAUTHORIZED",
    message: "로그인이 필요합니다.",
    recovery_action: "로그인 후 다시 시도해주세요.",
  },
  PAPER_NOT_FOUND: {
    code: "PAPER_NOT_FOUND",
    message: "논문을 찾을 수 없습니다.",
    recovery_action: "올바른 논문 ID를 확인해주세요.",
  },
  ALREADY_PARSED: {
    code: "ALREADY_PARSED",
    message: "이미 파싱된 논문입니다.",
    recovery_action: null,
  },
  STORAGE_ERROR: {
    code: "STORAGE_ERROR",
    message: "파일을 불러오는 데 실패했습니다.",
    recovery_action: "다시 시도해주세요.",
  },
  DATABASE_ERROR: {
    code: "DATABASE_ERROR",
    message: "데이터베이스 오류가 발생했습니다.",
    recovery_action: "다시 시도해주세요.",
  },
} as const;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: paperId } = await params;
  const supabase = await createClient();

  // 1. Authentication check
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: ErrorCodes.UNAUTHORIZED }, { status: 401 });
  }

  // 2. Get paper from database
  const { data: paper, error: paperError } = await supabase
    .from("papers")
    .select("id, user_id, file_path, status")
    .eq("id", paperId)
    .eq("user_id", user.id)
    .single();

  if (paperError || !paper) {
    return NextResponse.json({ error: ErrorCodes.PAPER_NOT_FOUND }, { status: 404 });
  }

  // 3. Check if already parsed
  if (paper.status === "ready") {
    return NextResponse.json({ error: ErrorCodes.ALREADY_PARSED }, { status: 400 });
  }

  // 4. Download PDF from Supabase Storage
  const { data: fileData, error: downloadError } = await supabase.storage
    .from("papers")
    .download(paper.file_path);

  if (downloadError || !fileData) {
    console.error("Storage download error:", downloadError);
    return NextResponse.json({ error: ErrorCodes.STORAGE_ERROR }, { status: 500 });
  }

  // 5. Parse PDF
  const pdfBuffer = await fileData.arrayBuffer();
  const parseResult = await parsePdf(pdfBuffer);

  if (!parseResult.success) {
    // Update paper status to 'error' with the error code
    await supabase
      .from("papers")
      .update({ status: "error" })
      .eq("id", paperId);

    return NextResponse.json(
      { error: parseResult.error },
      { status: parseResult.error.code === "PDF_ENCRYPTED" ? 400 : 500 }
    );
  }

  // 6. Save sections to database
  type SectionInsert = Database["public"]["Tables"]["sections"]["Insert"];
  const sectionsToInsert: SectionInsert[] = parseResult.sections.map((section) => ({
    paper_id: paperId,
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
    return NextResponse.json({ error: ErrorCodes.DATABASE_ERROR }, { status: 500 });
  }

  // 7. Update paper with parsed data
  const { error: updateError } = await supabase
    .from("papers")
    .update({
      page_count: parseResult.pageCount,
      language: parseResult.metadata.language,
      status: "ready",
      // Update title from PDF metadata if available
      ...(parseResult.metadata.title && { title: parseResult.metadata.title }),
    })
    .eq("id", paperId);

  if (updateError) {
    console.error("Paper update error:", updateError);
    return NextResponse.json({ error: ErrorCodes.DATABASE_ERROR }, { status: 500 });
  }

  // 8. Return success response
  return NextResponse.json({
    id: paperId,
    status: "ready",
    page_count: parseResult.pageCount,
    language: parseResult.metadata.language,
    sections_count: parseResult.sections.length,
  });
}
