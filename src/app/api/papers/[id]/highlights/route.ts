/**
 * POST /api/papers/{id}/highlights
 * TASK-011: 핵심 하이라이트 기능
 *
 * spec_refs:
 * - functional-spec.yaml#F-006
 *
 * Acceptance Criteria:
 * - AC-1: Given 논문이 뷰어에 로드되었을 때, When AI 분석이 완료되면, Then 핵심 문장들이 하이라이트되어 표시된다
 * - AC-2: Given 하이라이트된 문장을 호버하면, When 툴팁이 표시되면, Then 하이라이트 이유가 표시된다
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getGeminiClient } from "@/lib/gemini/client";
import type { Database, Json } from "@/types/database";
import type { Highlight } from "@/types";

// Error codes from functional-spec.yaml#F-006.error_cases
const ErrorCodes = {
  AI_API_ERROR: {
    code: "AI_API_ERROR",
    message: "핵심 내용 분석에 실패했습니다.",
  },
  CONTENT_TOO_SHORT: {
    code: "CONTENT_TOO_SHORT",
    message: "분석할 내용이 충분하지 않습니다.",
  },
  LANGUAGE_DETECTION_FAILED: {
    code: "LANGUAGE_DETECTION_FAILED",
    message: "논문 언어를 감지할 수 없습니다.",
  },
  PAPER_NOT_FOUND: {
    code: "PAPER_NOT_FOUND",
    message: "논문을 찾을 수 없습니다.",
  },
  UNAUTHORIZED: {
    code: "UNAUTHORIZED",
    message: "로그인이 필요합니다.",
  },
};

// Section type for the query result
interface SectionData {
  id: string;
  paper_id: string;
  title: string;
  level: number;
  order_index: number;
  content: string;
  page_start: number;
  page_end: number;
}

// Paper with sections query result type
interface PaperWithSections {
  id: string;
  user_id: string;
  title: string;
  language: string;
  sections: SectionData[];
}

// Analysis row type for database
interface AnalysisRow {
  id: string;
  paper_id: string;
  overall_summary: string | null;
  section_summaries: Array<{ sectionId: string; title: string; summary: string }>;
  highlights: Highlight[];
  keywords: Array<{
    term: string;
    frequency: number;
    importance: "high" | "medium" | "low";
    definition: string;
    contextInPaper: string;
    relatedTerms: string[];
  }>;
  status: "pending" | "processing" | "completed" | "error";
  created_at: string;
  updated_at: string;
}

interface HighlightsRequestBody {
  section_id?: string | null;
  force_refresh?: boolean;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: paperId } = await params;
    const body: HighlightsRequestBody = await request.json();
    const { section_id, force_refresh } = body;

    // Create Supabase client
    const cookieStore = await cookies();
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Ignore cookie errors in middleware
            }
          },
        },
      }
    );

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: ErrorCodes.UNAUTHORIZED }, { status: 401 });
    }

    // Fetch paper with sections
    const { data: paperData, error: paperError } = await supabase
      .from("papers")
      .select("*, sections(*)")
      .eq("id", paperId)
      .eq("user_id", user.id)
      .single();

    if (paperError || !paperData) {
      return NextResponse.json({ error: ErrorCodes.PAPER_NOT_FOUND }, { status: 404 });
    }

    // Cast to our known type
    const paper = paperData as unknown as PaperWithSections;

    // Check for existing highlights in analysis table (unless force_refresh)
    if (!force_refresh) {
      const { data: analysisData } = await supabase
        .from("analysis")
        .select("*")
        .eq("paper_id", paperId)
        .single();

      const analysis = analysisData as unknown as AnalysisRow | null;

      if (analysis && analysis.highlights && analysis.highlights.length > 0) {
        // Filter by section_id if provided
        const highlights = section_id
          ? analysis.highlights.filter((h) => h.sectionId === section_id)
          : analysis.highlights;

        return NextResponse.json({
          highlights,
          cached: true,
        });
      }
    }

    // Determine which sections to analyze
    const sections: SectionData[] = section_id
      ? paper.sections.filter((s) => s.id === section_id)
      : paper.sections;

    if (sections.length === 0) {
      return NextResponse.json({ error: ErrorCodes.PAPER_NOT_FOUND }, { status: 404 });
    }

    // Check if content is too short (edge case from functional-spec.yaml#F-006)
    const totalContent = sections.map((s) => s.content).join(" ");
    if (totalContent.length < 100) {
      return NextResponse.json({ error: ErrorCodes.CONTENT_TOO_SHORT }, { status: 400 });
    }

    // Initialize Gemini client
    const gemini = getGeminiClient();

    // Extract highlights from each section
    const allHighlights: Highlight[] = [];
    let highlightIdCounter = 1;

    for (const section of sections) {
      // Skip very short sections
      if (section.content.length < 50) {
        continue;
      }

      try {
        const result = await gemini.extractHighlights({
          text: section.content,
          sectionId: section.id,
        });

        if (result.success && result.data) {
          // Map highlights to our format with unique IDs
          const sectionHighlights: Highlight[] = result.data.highlights.map((h) => ({
            id: `highlight-${paperId}-${highlightIdCounter++}`,
            text: h.text,
            sectionId: section.id,
            importance: h.importance,
            reason: h.reason,
          }));

          allHighlights.push(...sectionHighlights);
        } else {
          console.error(`Highlight extraction error for section ${section.id}:`, result.error);
          // Continue with other sections even if one fails
        }
      } catch (error) {
        console.error(`Highlight extraction error for section ${section.id}:`, error);
        // Continue with other sections
      }
    }

    // Save highlights to analysis table for caching
    // First check if analysis record exists
    const { data: existingAnalysis } = await supabase
      .from("analysis")
      .select("*")
      .eq("paper_id", paperId)
      .single();

    const existingAnalysisRow = existingAnalysis as unknown as AnalysisRow | null;

    if (existingAnalysisRow) {
      // Update existing analysis with new highlights
      const { error: updateError } = await supabase
        .from("analysis")
        .update({
          highlights: allHighlights as unknown as Json[],
          updated_at: new Date().toISOString(),
        })
        .eq("paper_id", paperId);

      if (updateError) {
        console.error("Failed to update highlights:", updateError);
        // Continue anyway - we have the highlights, just not cached
      }
    } else {
      // Create new analysis record
      const { error: insertError } = await supabase
        .from("analysis")
        .insert({
          paper_id: paperId,
          overall_summary: null,
          section_summaries: [],
          highlights: allHighlights as unknown as Json[],
          keywords: [],
          status: "completed",
        });

      if (insertError) {
        console.error("Failed to save highlights:", insertError);
        // Continue anyway - we have the highlights, just not cached
      }
    }

    return NextResponse.json({
      highlights: allHighlights,
      cached: false,
    });
  } catch (error) {
    console.error("Highlights API error:", error);
    return NextResponse.json({ error: ErrorCodes.AI_API_ERROR }, { status: 500 });
  }
}

// GET method to retrieve existing highlights
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: paperId } = await params;

    // Create Supabase client
    const cookieStore = await cookies();
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Ignore cookie errors in middleware
            }
          },
        },
      }
    );

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: ErrorCodes.UNAUTHORIZED }, { status: 401 });
    }

    // Check paper ownership
    const { data: paper, error: paperError } = await supabase
      .from("papers")
      .select("id")
      .eq("id", paperId)
      .eq("user_id", user.id)
      .single();

    if (paperError || !paper) {
      return NextResponse.json({ error: ErrorCodes.PAPER_NOT_FOUND }, { status: 404 });
    }

    // Fetch existing highlights from analysis
    const { data: analysisData } = await supabase
      .from("analysis")
      .select("highlights")
      .eq("paper_id", paperId)
      .single();

    const analysis = analysisData as unknown as { highlights: Highlight[] } | null;

    return NextResponse.json({
      highlights: analysis?.highlights || [],
    });
  } catch (error) {
    console.error("Get highlights error:", error);
    return NextResponse.json({ error: ErrorCodes.AI_API_ERROR }, { status: 500 });
  }
}
