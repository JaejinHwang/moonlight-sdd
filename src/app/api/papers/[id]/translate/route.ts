/**
 * POST /api/papers/{id}/translate
 * TASK-010: 자동 번역 기능
 *
 * spec_refs:
 * - functional-spec.yaml#F-005
 * - technical-spec.yaml#api_spec.endpoints[4]
 *
 * Acceptance Criteria:
 * - AC-1: Given 논문이 뷰어에 로드되었을 때, When 번역 언어를 선택하면, Then 전체 논문이 해당 언어로 번역되어 표시된다
 * - AC-2: Given 번역된 논문을 보고 있을 때, When 원문 보기를 클릭하면, Then 원문과 번역문을 함께 볼 수 있다
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getGeminiClient } from "@/lib/gemini/client";
import type { Database } from "@/types/database";

// Supported languages based on functional-spec.yaml#F-005
const SUPPORTED_LANGUAGES = [
  "ko", // Korean
  "en", // English
  "ja", // Japanese
  "zh", // Chinese
  "es", // Spanish
  "fr", // French
  "de", // German
  "pt", // Portuguese
];

// Error codes from functional-spec.yaml#F-005.error_cases
const ErrorCodes = {
  UNSUPPORTED_LANGUAGE: {
    code: "UNSUPPORTED_LANGUAGE",
    message: "해당 언어는 지원하지 않습니다.",
  },
  QUOTA_EXCEEDED: {
    code: "QUOTA_EXCEEDED",
    message: "일일 번역 한도에 도달했습니다.",
  },
  TRANSLATION_TIMEOUT: {
    code: "TRANSLATION_TIMEOUT",
    message: "번역이 지연되고 있습니다.",
  },
  PAPER_NOT_FOUND: {
    code: "PAPER_NOT_FOUND",
    message: "논문을 찾을 수 없습니다.",
  },
  UNAUTHORIZED: {
    code: "UNAUTHORIZED",
    message: "로그인이 필요합니다.",
  },
  AI_API_ERROR: {
    code: "AI_API_ERROR",
    message: "번역 중 오류가 발생했습니다.",
  },
};

interface TranslateRequestBody {
  target_lang: string;
  section_id?: string | null;
}

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

// Translation table row type
interface TranslationRow {
  id: string;
  paper_id: string;
  section_id: string | null;
  original_text: string;
  translated_text: string;
  source_lang: string;
  target_lang: string;
  created_at: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: paperId } = await params;
    const body: TranslateRequestBody = await request.json();
    const { target_lang, section_id } = body;

    // Validate target language
    if (!target_lang || !SUPPORTED_LANGUAGES.includes(target_lang)) {
      return NextResponse.json(
        { error: ErrorCodes.UNSUPPORTED_LANGUAGE },
        { status: 400 }
      );
    }

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

    // Check for existing translations in cache (database)
    let existingQuery = supabase
      .from("translations")
      .select("*")
      .eq("paper_id", paperId)
      .eq("target_lang", target_lang);

    // If section_id is specified, filter by it
    if (section_id) {
      existingQuery = existingQuery.eq("section_id", section_id);
    }

    const { data: existingTranslationsData } = await existingQuery;
    const existingTranslations = (existingTranslationsData || []) as unknown as TranslationRow[];

    // Determine which sections need translation
    const sections: SectionData[] = section_id
      ? paper.sections.filter((s) => s.id === section_id)
      : paper.sections;

    const existingTranslationMap = new Map<string | null, TranslationRow>(
      existingTranslations.map((t) => [t.section_id, t])
    );

    const sectionsToTranslate = sections.filter(
      (s) => !existingTranslationMap.has(s.id)
    );

    // If all translations already exist, return cached results
    if (sectionsToTranslate.length === 0 && existingTranslations && existingTranslations.length > 0) {
      return NextResponse.json({
        translations: existingTranslations.map((t) => ({
          id: t.id,
          section_id: t.section_id,
          original_text: t.original_text,
          translated_text: t.translated_text,
          source_lang: t.source_lang,
          target_lang: t.target_lang,
        })),
        cached: true,
      });
    }

    // Initialize Gemini client
    const gemini = getGeminiClient();

    // Translate each section that needs translation
    const newTranslations: Array<{
      paper_id: string;
      section_id: string;
      original_text: string;
      translated_text: string;
      source_lang: string;
      target_lang: string;
    }> = [];

    for (const section of sectionsToTranslate) {
      try {
        const result = await gemini.translate({
          text: section.content,
          sourceLang: paper.language,
          targetLang: target_lang,
        });

        if (result.success && result.data) {
          newTranslations.push({
            paper_id: paperId,
            section_id: section.id,
            original_text: section.content,
            translated_text: result.data.translatedText,
            source_lang: paper.language,
            target_lang: target_lang,
          });
        } else {
          // Handle AI API error
          if (result.error?.code === "QUOTA_EXCEEDED") {
            return NextResponse.json({ error: ErrorCodes.QUOTA_EXCEEDED }, { status: 429 });
          }
          if (result.error?.code === "TIMEOUT") {
            return NextResponse.json(
              { error: ErrorCodes.TRANSLATION_TIMEOUT },
              { status: 504 }
            );
          }

          console.error(`Translation error for section ${section.id}:`, result.error);
          return NextResponse.json({ error: ErrorCodes.AI_API_ERROR }, { status: 500 });
        }
      } catch (error) {
        console.error(`Translation error for section ${section.id}:`, error);
        return NextResponse.json({ error: ErrorCodes.AI_API_ERROR }, { status: 500 });
      }
    }

    // Save new translations to database for caching
    if (newTranslations.length > 0) {
      const { error: insertError } = await supabase
        .from("translations")
        .insert(newTranslations);

      if (insertError) {
        console.error("Failed to cache translations:", insertError);
        // Continue anyway - we have the translations, just not cached
      }
    }

    // Combine cached and new translations
    const allTranslations = [
      ...(existingTranslations || []).map((t) => ({
        id: t.id,
        section_id: t.section_id,
        original_text: t.original_text,
        translated_text: t.translated_text,
        source_lang: t.source_lang,
        target_lang: t.target_lang,
      })),
      ...newTranslations.map((t) => ({
        id: null, // Will be assigned by database
        section_id: t.section_id,
        original_text: t.original_text,
        translated_text: t.translated_text,
        source_lang: t.source_lang,
        target_lang: t.target_lang,
      })),
    ];

    return NextResponse.json({
      translations: allTranslations,
      cached: false,
    });
  } catch (error) {
    console.error("Translation API error:", error);
    return NextResponse.json({ error: ErrorCodes.AI_API_ERROR }, { status: 500 });
  }
}
