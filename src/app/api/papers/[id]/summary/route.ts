/**
 * Summary API Endpoint
 * TASK-012: 논문 요약 기능
 *
 * spec_refs:
 * - functional-spec.yaml#F-007 (논문 요약)
 * - technical-spec.yaml#api_spec.endpoints (POST /papers/{id}/analyze)
 *
 * Acceptance Criteria:
 * - AC-1: Given 논문이 뷰어에 로드되었을 때, When 요약 패널을 열면, Then 논문 전체 요약과 섹션별 요약이 표시된다
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getGeminiClient } from "@/lib/gemini/client";
import type { Section, SectionSummary, Json } from "@/types";

// Type for analysis row from database
interface AnalysisRow {
  id: string;
  paper_id: string;
  overall_summary: string | null;
  section_summaries: SectionSummary[] | null;
  highlights: unknown[];
  keywords: unknown[];
  status: string;
  created_at: string;
  updated_at: string;
}

// Error codes from functional-spec.yaml#F-007.error_cases
const ErrorCodes = {
  SUMMARY_GENERATION_FAILED: {
    code: "SUMMARY_GENERATION_FAILED",
    message: "요약을 생성할 수 없습니다.",
    recovery_action: "다시 시도해주세요.",
  },
  SECTION_PARSE_ERROR: {
    code: "SECTION_PARSE_ERROR",
    message: "섹션별 요약을 생성할 수 없습니다.",
    recovery_action: "전체 요약만 제공됩니다.",
  },
  CONTEXT_LENGTH_EXCEEDED: {
    code: "CONTEXT_LENGTH_EXCEEDED",
    message: "논문이 너무 길어 요약이 지연됩니다.",
    recovery_action: "섹션별로 나누어 요약을 생성합니다.",
  },
  PAPER_NOT_FOUND: {
    code: "PAPER_NOT_FOUND",
    message: "논문을 찾을 수 없습니다.",
    recovery_action: "올바른 논문 ID인지 확인해주세요.",
  },
  UNAUTHORIZED: {
    code: "UNAUTHORIZED",
    message: "로그인이 필요합니다.",
    recovery_action: "로그인 후 다시 시도해주세요.",
  },
};

interface SummaryRequest {
  type: "overall" | "section" | "all";
  sectionId?: string;
}

interface SummaryResponse {
  overall_summary: string | null;
  section_summaries: SectionSummary[];
  key_findings: string[];
}

/**
 * POST /api/papers/{id}/summary
 * Generate summary for a paper
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: paperId } = await params;
    const supabase = await createClient();

    // Auth check
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

    // Parse request body
    const body: SummaryRequest = await request.json();
    const { type = "all", sectionId } = body;

    // Fetch paper with sections
    const { data: paper, error: paperError } = await supabase
      .from("papers")
      .select("*")
      .eq("id", paperId)
      .eq("user_id", user.id)
      .single();

    if (paperError || !paper) {
      return NextResponse.json(
        { error: ErrorCodes.PAPER_NOT_FOUND },
        { status: 404 }
      );
    }

    // Fetch sections
    const { data: sections, error: sectionsError } = await supabase
      .from("sections")
      .select("*")
      .eq("paper_id", paperId)
      .order("order_index", { ascending: true });

    if (sectionsError) {
      console.error("Failed to fetch sections:", sectionsError);
      return NextResponse.json(
        { error: ErrorCodes.SECTION_PARSE_ERROR },
        { status: 500 }
      );
    }

    // Check for existing analysis
    const { data: existingAnalysisData } = await supabase
      .from("analysis")
      .select("*")
      .eq("paper_id", paperId)
      .single();

    const existingAnalysis = existingAnalysisData as unknown as AnalysisRow | null;

    // If we have cached summary, return it
    if (
      existingAnalysis &&
      existingAnalysis.overall_summary &&
      type === "all"
    ) {
      return NextResponse.json({
        overall_summary: existingAnalysis.overall_summary,
        section_summaries: existingAnalysis.section_summaries || [],
        key_findings: extractKeyFindings(existingAnalysis.overall_summary),
        cached: true,
      });
    }

    // Generate summary using Gemini
    const gemini = getGeminiClient();
    const response: SummaryResponse = {
      overall_summary: null,
      section_summaries: [],
      key_findings: [],
    };

    // Combine all section content for overall summary
    const fullContent = (sections as Section[])
      .map((s) => `## ${s.title}\n\n${s.content}`)
      .join("\n\n");

    // Generate overall summary
    if (type === "overall" || type === "all") {
      const overallResult = await gemini.summarize({
        text: fullContent,
        type: "overall",
      });

      if (overallResult.success && overallResult.data) {
        response.overall_summary = overallResult.data.summary;
        response.key_findings = extractKeyFindings(overallResult.data.summary);
      } else {
        console.error("Overall summary failed:", overallResult.error);
      }
    }

    // Generate section summaries
    if (type === "section" || type === "all") {
      const sectionSummaries: SectionSummary[] = [];

      // If specific section requested
      if (sectionId) {
        const section = (sections as Section[]).find((s) => s.id === sectionId);
        if (section) {
          const result = await gemini.summarize({
            text: section.content,
            type: "section",
            sectionTitle: section.title,
          });

          if (result.success && result.data) {
            sectionSummaries.push({
              sectionId: section.id,
              title: section.title,
              summary: result.data.summary,
            });
          }
        }
      } else {
        // Generate summaries for all sections (in parallel for speed)
        const summaryPromises = (sections as Section[]).map(async (section) => {
          const result = await gemini.summarize({
            text: section.content,
            type: "section",
            sectionTitle: section.title,
          });

          if (result.success && result.data) {
            return {
              sectionId: section.id,
              title: section.title,
              summary: result.data.summary,
            };
          }
          return null;
        });

        const results = await Promise.all(summaryPromises);
        sectionSummaries.push(
          ...(results.filter(Boolean) as SectionSummary[])
        );
      }

      response.section_summaries = sectionSummaries;
    }

    // Save to analysis table for caching
    if (type === "all" && response.overall_summary) {
      const analysisData = {
        paper_id: paperId,
        overall_summary: response.overall_summary,
        section_summaries: response.section_summaries as unknown as Json[],
        status: "completed",
        updated_at: new Date().toISOString(),
      };

      if (existingAnalysis) {
        await supabase
          .from("analysis")
          .update(analysisData)
          .eq("paper_id", paperId);
      } else {
        await supabase.from("analysis").insert({
          ...analysisData,
          highlights: [],
          keywords: [],
        });
      }
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Summary generation error:", error);
    return NextResponse.json(
      { error: ErrorCodes.SUMMARY_GENERATION_FAILED },
      { status: 500 }
    );
  }
}

/**
 * GET /api/papers/{id}/summary
 * Get existing summary for a paper
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: paperId } = await params;
    const supabase = await createClient();

    // Auth check
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

    // Verify paper ownership
    const { data: paper, error: paperError } = await supabase
      .from("papers")
      .select("id")
      .eq("id", paperId)
      .eq("user_id", user.id)
      .single();

    if (paperError || !paper) {
      return NextResponse.json(
        { error: ErrorCodes.PAPER_NOT_FOUND },
        { status: 404 }
      );
    }

    // Fetch analysis
    const { data: analysis, error: analysisError } = await supabase
      .from("analysis")
      .select("overall_summary, section_summaries")
      .eq("paper_id", paperId)
      .single();

    if (analysisError || !analysis) {
      return NextResponse.json({
        overall_summary: null,
        section_summaries: [],
        key_findings: [],
        exists: false,
      });
    }

    return NextResponse.json({
      overall_summary: analysis.overall_summary,
      section_summaries: analysis.section_summaries || [],
      key_findings: extractKeyFindings(analysis.overall_summary || ""),
      exists: true,
    });
  } catch (error) {
    console.error("Get summary error:", error);
    return NextResponse.json(
      { error: ErrorCodes.SUMMARY_GENERATION_FAILED },
      { status: 500 }
    );
  }
}

/**
 * Extract key findings from summary text
 * Looks for bullet points or numbered lists
 */
function extractKeyFindings(summaryText: string): string[] {
  if (!summaryText) return [];

  const findings: string[] = [];

  // Split by lines and look for bullet points or key sentences
  const lines = summaryText.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();

    // Match bullet points (-, *, •) or numbered lists
    if (/^[-*•]\s+/.test(trimmed)) {
      findings.push(trimmed.replace(/^[-*•]\s+/, ""));
    } else if (/^\d+[.)]\s+/.test(trimmed)) {
      findings.push(trimmed.replace(/^\d+[.)]\s+/, ""));
    }
  }

  // If no bullet points found, extract key sentences (first sentence of each paragraph)
  if (findings.length === 0) {
    const paragraphs = summaryText.split(/\n\n+/);
    for (const para of paragraphs.slice(0, 5)) {
      const firstSentence = para.split(/[.!?]/)[0];
      if (firstSentence && firstSentence.trim().length > 20) {
        findings.push(firstSentence.trim() + ".");
      }
    }
  }

  return findings.slice(0, 5); // Limit to 5 key findings
}
