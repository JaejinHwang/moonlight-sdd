import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

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

  // 10. Return success response (technical-spec.yaml#api_spec.endpoints[0].response.success)
  return NextResponse.json(
    {
      id: paper.id,
      title: paper.title,
      status: paper.status,
      created_at: paper.created_at,
    },
    { status: 201 }
  );
}
