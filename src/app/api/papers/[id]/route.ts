import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type PaperRow = Database["public"]["Tables"]["papers"]["Row"];

// GET /api/papers/[id] - Fetch paper with sections
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Fetch paper data
    const { data: paper, error: paperError } = await supabase
      .from("papers")
      .select("*")
      .eq("id", id)
      .single<PaperRow>();

    if (paperError || !paper) {
      return NextResponse.json(
        {
          error: {
            code: "PAPER_NOT_FOUND",
            message: "논문을 찾을 수 없습니다.",
          },
        },
        { status: 404 }
      );
    }

    // Generate signed URL for PDF file (valid for 1 hour)
    let fileUrl: string | null = null;
    if (paper.file_path) {
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from("papers")
        .createSignedUrl(paper.file_path, 3600); // 1 hour expiry

      if (signedUrlError) {
        console.error("Failed to generate signed URL:", signedUrlError);
      } else {
        fileUrl = signedUrlData.signedUrl;
      }
    }

    // Fetch sections for the paper
    const { data: sections, error: sectionsError } = await supabase
      .from("sections")
      .select("*")
      .eq("paper_id", id)
      .order("order_index", { ascending: true });

    if (sectionsError) {
      console.error("Failed to fetch sections:", sectionsError);
    }

    return NextResponse.json({
      paper: { ...paper, file_url: fileUrl },
      sections: sections || [],
    });
  } catch (error) {
    console.error("Error fetching paper:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "서버 오류가 발생했습니다.",
        },
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/papers/[id]
 * 논문 삭제 (파일 + DB 레코드)
 *
 * spec_refs:
 * - technical-spec.yaml#api_spec.endpoints[3]
 * - TASK-014
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // 1. Authentication check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "로그인이 필요합니다.",
          },
        },
        { status: 401 }
      );
    }

    // 2. Fetch paper to verify ownership and get file_path
    const { data: paper, error: paperError } = await supabase
      .from("papers")
      .select("id, user_id, file_path")
      .eq("id", id)
      .single<Pick<PaperRow, "id" | "user_id" | "file_path">>();

    if (paperError || !paper) {
      return NextResponse.json(
        {
          error: {
            code: "PAPER_NOT_FOUND",
            message: "논문을 찾을 수 없습니다.",
          },
        },
        { status: 404 }
      );
    }

    // 3. Verify ownership
    if (paper.user_id !== user.id) {
      return NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "이 논문을 삭제할 권한이 없습니다.",
          },
        },
        { status: 403 }
      );
    }

    // 4. Delete related records (cascade should handle this, but explicit for safety)
    // Delete translations
    await supabase.from("translations").delete().eq("paper_id", id);

    // Delete analysis
    await supabase.from("analysis").delete().eq("paper_id", id);

    // Delete sections
    await supabase.from("sections").delete().eq("paper_id", id);

    // 5. Delete the paper record
    const { error: deleteError } = await supabase
      .from("papers")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Error deleting paper:", deleteError);
      return NextResponse.json(
        {
          error: {
            code: "DELETE_FAILED",
            message: "논문 삭제에 실패했습니다.",
          },
        },
        { status: 500 }
      );
    }

    // 6. Delete file from storage
    if (paper.file_path) {
      const { error: storageError } = await supabase.storage
        .from("papers")
        .remove([paper.file_path]);

      if (storageError) {
        // Log but don't fail - DB record is already deleted
        console.error("Error deleting file from storage:", storageError);
      }
    }

    // 7. Return success (204 No Content)
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Error deleting paper:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "서버 오류가 발생했습니다.",
        },
      },
      { status: 500 }
    );
  }
}
