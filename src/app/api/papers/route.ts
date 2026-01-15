import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parsePdf } from "@/lib/pdf/parser";
import type { Database } from "@/types/database";

type PaperRow = Database["public"]["Tables"]["papers"]["Row"];

// Constants from functional-spec.yaml#F-001
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_MIME_TYPE = "application/pdf";

// Error codes from functional-spec.yaml#F-001
const ErrorCodes = {
  INVALID_FILE_TYPE: {
    code: "INVALID_FILE_TYPE",
    message: "PDF 파일만 업로드할 수 있습니다.",
    recovery_action: "올바른 PDF 파일을 선택해주세요.",
  },
  FILE_TOO_LARGE: {
    code: "FILE_TOO_LARGE",
    message: "파일 크기가 10MB를 초과합니다.",
    recovery_action: "더 작은 파일을 업로드하거나 파일을 압축해주세요.",
  },
  UNAUTHORIZED: {
    code: "UNAUTHORIZED",
    message: "로그인이 필요합니다.",
    recovery_action: "로그인 후 다시 시도해주세요.",
  },
  UPLOAD_FAILED: {
    code: "UPLOAD_FAILED",
    message: "파일 업로드에 실패했습니다.",
    recovery_action: "다시 시도해주세요.",
  },
  DATABASE_ERROR: {
    code: "DATABASE_ERROR",
    message: "데이터베이스 오류가 발생했습니다.",
    recovery_action: "다시 시도해주세요.",
  },
} as const;

/**
 * POST /api/papers
 * PDF 파일 업로드 및 논문 생성
 *
 * spec_refs:
 * - functional-spec.yaml#F-001
 * - technical-spec.yaml#api_spec.endpoints[0]
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

  // 2. Parse multipart form data
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: ErrorCodes.INVALID_FILE_TYPE },
      { status: 400 }
    );
  }

  const file = formData.get("file") as File | null;

  // 3. File validation - existence
  if (!file) {
    return NextResponse.json(
      { error: ErrorCodes.INVALID_FILE_TYPE },
      { status: 400 }
    );
  }

  // 4. File validation - type (functional-spec.yaml#F-001.inputs)
  if (file.type !== ACCEPTED_MIME_TYPE) {
    return NextResponse.json(
      { error: ErrorCodes.INVALID_FILE_TYPE },
      { status: 400 }
    );
  }

  // 5. File validation - size (functional-spec.yaml#F-001.inputs: "최대 10MB")
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: ErrorCodes.FILE_TOO_LARGE },
      { status: 400 }
    );
  }

  // 6. Generate unique file path
  const timestamp = Date.now();
  const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
  const filePath = `${user.id}/${timestamp}_${sanitizedFileName}`;

  // 7. Upload to Supabase Storage
  const fileBuffer = await file.arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from("papers")
    .upload(filePath, fileBuffer, {
      contentType: ACCEPTED_MIME_TYPE,
      upsert: false,
    });

  if (uploadError) {
    console.error("Storage upload error:", uploadError);
    return NextResponse.json(
      { error: ErrorCodes.UPLOAD_FAILED },
      { status: 500 }
    );
  }

  // 8. Extract title from filename (without extension)
  const title = file.name.replace(/\.pdf$/i, "");

  // 9. Insert paper metadata into database
  // Status: "processing" as per technical-spec.yaml#api_spec.endpoints[0].response.success
  type PaperInsert = Database["public"]["Tables"]["papers"]["Insert"];
  const insertData: PaperInsert = {
    user_id: user.id,
    title,
    file_path: filePath,
    file_size: file.size,
    page_count: 0, // Will be updated after parsing (TASK-005)
    language: "en", // Default, will be detected during parsing
    status: "processing",
  };

  const { data: paper, error: dbError } = await supabase
    .from("papers")
    .insert(insertData)
    .select("id, title, status, created_at")
    .single();

  if (dbError || !paper) {
    console.error("Database insert error:", dbError);
    // Cleanup: delete uploaded file on database error
    await supabase.storage.from("papers").remove([filePath]);
    return NextResponse.json(
      { error: ErrorCodes.DATABASE_ERROR },
      { status: 500 }
    );
  }

  // 10. Parse PDF and extract sections (TASK-005)
  // This implements the 'parsing' state from functional-spec.yaml#F-001
  const parseResult = await parsePdf(fileBuffer);

  if (!parseResult.success) {
    // Update paper status to 'error'
    await supabase.from("papers").update({ status: "error" }).eq("id", paper.id);

    // Don't fail the upload - the file is saved, parsing failed
    // User can retry parsing later or re-upload
    console.error("PDF parsing error:", parseResult.error);
    return NextResponse.json(
      {
        id: paper.id,
        title: paper.title,
        status: "error",
        created_at: paper.created_at,
        error: parseResult.error,
      },
      { status: 201 } // Still 201 because upload succeeded
    );
  }

  // 11. Save sections to database
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
    // Don't fail - file is uploaded, sections failed to save
    await supabase.from("papers").update({ status: "error" }).eq("id", paper.id);
  }

  // 12. Update paper with parsed metadata
  const finalStatus = sectionsError ? "error" : "ready";
  const { error: updateError } = await supabase
    .from("papers")
    .update({
      page_count: parseResult.pageCount,
      language: parseResult.metadata.language,
      status: finalStatus,
      ...(parseResult.metadata.title && { title: parseResult.metadata.title }),
    })
    .eq("id", paper.id);

  if (updateError) {
    console.error("Paper update error:", updateError);
  }

  // 13. Return success response (technical-spec.yaml#api_spec.endpoints[0].response.success)
  return NextResponse.json(
    {
      id: paper.id,
      title: parseResult.metadata.title || paper.title,
      status: finalStatus,
      created_at: paper.created_at,
      page_count: parseResult.pageCount,
      sections_count: parseResult.sections.length,
    },
    { status: 201 }
  );
}

/**
 * GET /api/papers
 * 사용자의 논문 목록 조회
 *
 * spec_refs:
 * - ui-spec.yaml#SCR-003
 * - TASK-014
 *
 * Query params:
 * - search: 제목 검색 (optional)
 * - status: 상태 필터 (optional)
 * - sort: 정렬 기준 (optional, default: created_at)
 * - order: 정렬 순서 (optional, default: desc)
 */
export async function GET(request: NextRequest) {
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

  // 2. Parse query parameters
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const status = searchParams.get("status");
  const sort = searchParams.get("sort") || "created_at";
  const order = searchParams.get("order") || "desc";

  // 3. Build query
  let query = supabase
    .from("papers")
    .select("*")
    .eq("user_id", user.id);

  // 4. Apply search filter (title search)
  if (search) {
    query = query.ilike("title", `%${search}%`);
  }

  // 5. Apply status filter
  if (status && ["processing", "ready", "error"].includes(status)) {
    query = query.eq("status", status);
  }

  // 6. Apply sorting
  const validSortFields = ["created_at", "updated_at", "title"];
  const sortField = validSortFields.includes(sort) ? sort : "created_at";
  const ascending = order === "asc";
  query = query.order(sortField, { ascending });

  // 7. Execute query
  const { data: papers, error: queryError } = await query.returns<PaperRow[]>();

  if (queryError) {
    console.error("Papers query error:", queryError);
    return NextResponse.json(
      { error: ErrorCodes.DATABASE_ERROR },
      { status: 500 }
    );
  }

  // 8. Return papers list
  return NextResponse.json({
    papers: papers || [],
    total: papers?.length || 0,
  });
}
