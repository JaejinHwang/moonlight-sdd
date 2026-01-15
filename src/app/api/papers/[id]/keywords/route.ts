/**
 * POST /api/papers/{id}/keywords
 * GET /api/papers/{id}/keywords
 * TASK-013: 키워드 추출 및 설명
 *
 * spec_refs:
 * - functional-spec.yaml#F-008
 *
 * Acceptance Criteria:
 * - AC-1: Given 논문이 뷰어에 로드되었을 때, When AI 분석이 완료되면, Then 핵심 키워드 목록이 추출되어 표시된다
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getGeminiClient } from "@/lib/gemini/client";
import type { Database, Json } from "@/types/database";
import type { Keyword } from "@/types";

// Error codes from functional-spec.yaml#F-008.error_cases
const ErrorCodes = {
  KEYWORD_EXTRACTION_FAILED: {
    code: "KEYWORD_EXTRACTION_FAILED",
    message: "키워드를 추출할 수 없습니다.",
  },
  PAPER_NOT_FOUND: {
    code: "PAPER_NOT_FOUND",
    message: "논문을 찾을 수 없습니다.",
  },
  UNAUTHORIZED: {
    code: "UNAUTHORIZED",
    message: "로그인이 필요합니다.",
  },
  CONTENT_TOO_SHORT: {
    code: "CONTENT_TOO_SHORT",
    message: "분석할 내용이 충분하지 않습니다.",
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
  highlights: Array<{
    id: string;
    text: string;
    sectionId: string;
    importance: "high" | "medium" | "low";
    reason: string;
  }>;
  keywords: Keyword[];
  status: "pending" | "processing" | "completed" | "error";
  created_at: string;
  updated_at: string;
}

interface KeywordsRequestBody {
  force_refresh?: boolean;
  max_keywords?: number;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: paperId } = await params;
    const body: KeywordsRequestBody = await request.json();
    const { force_refresh, max_keywords = 15 } = body;

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

    // Check for existing keywords in analysis table (unless force_refresh)
    if (!force_refresh) {
      const { data: analysisData } = await supabase
        .from("analysis")
        .select("*")
        .eq("paper_id", paperId)
        .single();

      const analysis = analysisData as unknown as AnalysisRow | null;

      if (analysis && analysis.keywords && analysis.keywords.length > 0) {
        return NextResponse.json({
          keywords: analysis.keywords,
          cached: true,
        });
      }
    }

    // Combine all section content for keyword extraction
    const sections = paper.sections;

    if (sections.length === 0) {
      return NextResponse.json({ error: ErrorCodes.PAPER_NOT_FOUND }, { status: 404 });
    }

    const totalContent = sections.map((s) => s.content).join("\n\n");

    // Check if content is too short (edge case)
    if (totalContent.length < 100) {
      return NextResponse.json({ error: ErrorCodes.CONTENT_TOO_SHORT }, { status: 400 });
    }

    // Initialize Gemini client
    const gemini = getGeminiClient();

    // Extract keywords from the paper content
    const result = await gemini.extractKeywords({
      text: totalContent.slice(0, 50000), // Limit text length for API
    });

    if (!result.success || !result.data) {
      console.error("Keyword extraction failed:", result.error);
      return NextResponse.json(
        { error: ErrorCodes.KEYWORD_EXTRACTION_FAILED },
        { status: 500 }
      );
    }

    // Map keywords to our format with frequency count
    const keywords: Keyword[] = result.data.keywords.slice(0, max_keywords).map((k) => {
      // Count frequency of the term in the content
      const regex = new RegExp(k.term, "gi");
      const matches = totalContent.match(regex);
      const frequency = matches ? matches.length : 1;

      return {
        term: k.term,
        frequency,
        importance: k.importance,
        definition: k.definition,
        contextInPaper: k.contextInPaper,
        relatedTerms: [], // Will be filled when explaining
      };
    });

    // Save keywords to analysis table for caching
    const { data: existingAnalysis } = await supabase
      .from("analysis")
      .select("*")
      .eq("paper_id", paperId)
      .single();

    const existingAnalysisRow = existingAnalysis as unknown as AnalysisRow | null;

    if (existingAnalysisRow) {
      // Update existing analysis with new keywords
      const { error: updateError } = await supabase
        .from("analysis")
        .update({
          keywords: keywords as unknown as Json[],
          updated_at: new Date().toISOString(),
        })
        .eq("paper_id", paperId);

      if (updateError) {
        console.error("Failed to update keywords:", updateError);
      }
    } else {
      // Create new analysis record
      const { error: insertError } = await supabase
        .from("analysis")
        .insert({
          paper_id: paperId,
          overall_summary: null,
          section_summaries: [],
          highlights: [],
          keywords: keywords as unknown as Json[],
          status: "completed",
        });

      if (insertError) {
        console.error("Failed to save keywords:", insertError);
      }
    }

    return NextResponse.json({
      keywords,
      cached: false,
    });
  } catch (error) {
    console.error("Keywords API error:", error);
    return NextResponse.json(
      { error: ErrorCodes.KEYWORD_EXTRACTION_FAILED },
      { status: 500 }
    );
  }
}

// GET method to retrieve existing keywords
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

    // Fetch existing keywords from analysis
    const { data: analysisData } = await supabase
      .from("analysis")
      .select("keywords")
      .eq("paper_id", paperId)
      .single();

    const analysis = analysisData as unknown as { keywords: Keyword[] } | null;

    return NextResponse.json({
      keywords: analysis?.keywords || [],
    });
  } catch (error) {
    console.error("Get keywords error:", error);
    return NextResponse.json(
      { error: ErrorCodes.KEYWORD_EXTRACTION_FAILED },
      { status: 500 }
    );
  }
}
