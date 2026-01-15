/**
 * GET /api/papers/{id}/keywords/{term}/explain
 * TASK-013: 키워드 추출 및 설명
 *
 * spec_refs:
 * - functional-spec.yaml#F-008
 * - technical-spec.yaml#api_spec.endpoints[7]
 *
 * Acceptance Criteria:
 * - AC-2: Given 키워드 목록이 표시되었을 때, When 키워드를 클릭하면, Then 논문 맥락 내에서의 키워드 설명이 표시된다
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getGeminiClient } from "@/lib/gemini/client";
import type { Database } from "@/types/database";

// Error codes from functional-spec.yaml#F-008.error_cases
const ErrorCodes = {
  KEYWORD_NOT_FOUND: {
    code: "KEYWORD_NOT_FOUND",
    message: "키워드를 찾을 수 없습니다.",
  },
  EXPLANATION_FAILED: {
    code: "EXPLANATION_FAILED",
    message: "키워드 설명을 생성할 수 없습니다.",
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

// Response type from technical-spec.yaml#api_spec.endpoints[7]
interface KeywordExplanationResponse {
  term: string;
  definition: string;
  context_in_paper: string;
  related_terms: string[];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; term: string }> }
) {
  try {
    const { id: paperId, term: rawTerm } = await params;
    const term = decodeURIComponent(rawTerm);

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
    const sections = paper.sections;

    if (sections.length === 0) {
      return NextResponse.json({ error: ErrorCodes.PAPER_NOT_FOUND }, { status: 404 });
    }

    // Find sections that contain the keyword
    const relevantContent: string[] = [];
    for (const section of sections) {
      if (section.content.toLowerCase().includes(term.toLowerCase())) {
        // Extract surrounding context (up to 500 chars around each occurrence)
        const content = section.content;
        const regex = new RegExp(term, "gi");
        let match;
        while ((match = regex.exec(content)) !== null) {
          const start = Math.max(0, match.index - 250);
          const end = Math.min(content.length, match.index + term.length + 250);
          const context = content.slice(start, end);
          if (!relevantContent.includes(context)) {
            relevantContent.push(`[${section.title}]\n${context}`);
          }
          // Limit to 5 contexts to avoid too much data
          if (relevantContent.length >= 5) break;
        }
        if (relevantContent.length >= 5) break;
      }
    }

    // If term not found in paper, return error
    if (relevantContent.length === 0) {
      return NextResponse.json({ error: ErrorCodes.KEYWORD_NOT_FOUND }, { status: 404 });
    }

    // Build paper context for Gemini
    const paperContext = relevantContent.join("\n\n---\n\n");

    // Initialize Gemini client
    const gemini = getGeminiClient();

    // Get detailed explanation from Gemini
    const result = await gemini.explainKeyword({
      term,
      paperContext,
    });

    if (!result.success || !result.data) {
      console.error("Keyword explanation failed:", result.error);
      return NextResponse.json({ error: ErrorCodes.EXPLANATION_FAILED }, { status: 500 });
    }

    // Return response matching technical-spec.yaml#api_spec.endpoints[7].response
    const response: KeywordExplanationResponse = {
      term: result.data.term,
      definition: result.data.definition,
      context_in_paper: result.data.contextInPaper,
      related_terms: result.data.relatedTerms,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Keyword explain API error:", error);
    return NextResponse.json({ error: ErrorCodes.EXPLANATION_FAILED }, { status: 500 });
  }
}
