/**
 * Gemini API Prompts
 * TASK-009: Gemini API 통합 - 프롬프트 템플릿 관리
 *
 * spec_refs:
 * - technical-spec.yaml#architecture.components (Gemini API)
 * - functional-spec.yaml#F-005 (번역)
 * - functional-spec.yaml#F-006 (하이라이트)
 * - functional-spec.yaml#F-007 (요약)
 * - functional-spec.yaml#F-008 (키워드)
 */

import type {
  TranslationInput,
  SummaryInput,
  HighlightInput,
  KeywordInput,
  KeywordExplainInput,
} from "./types";

/**
 * Translation prompt (F-005)
 */
export function buildTranslationPrompt(input: TranslationInput): string {
  const sourceInfo = input.sourceLang
    ? `from ${input.sourceLang} `
    : "";

  return `You are a professional academic translator specializing in scientific papers.

Translate the following text ${sourceInfo}to ${input.targetLang}.

Guidelines:
- Preserve academic terminology accurately
- Maintain the original meaning and nuance
- Keep mathematical formulas and symbols unchanged
- Preserve paragraph structure and formatting
- Translate technical terms with their standard ${input.targetLang} equivalents

Text to translate:
"""
${input.text}
"""

Provide only the translated text without any explanations or notes.`;
}

/**
 * Summary prompt (F-007)
 *
 * Enhanced for TASK-012:
 * - Overall summary: Structured output with key findings
 * - Section summary: Concise, context-aware summaries
 * - Supports Korean output for Korean papers
 */
export function buildSummaryPrompt(input: SummaryInput): string {
  const targetLang = input.targetLang || "ko";
  const langInstruction = targetLang === "ko"
    ? "응답은 한국어로 작성해주세요."
    : `Write the response in ${targetLang}.`;

  if (input.type === "overall") {
    return `You are an expert academic paper analyzer specializing in creating clear, insightful summaries.

${langInstruction}

Create a comprehensive summary of the following academic paper content.

## Guidelines:
1. **Structure**: Organize the summary into clear sections:
   - 연구 목적 (Research Objective): What problem does this paper address?
   - 방법론 (Methodology): How was the research conducted?
   - 주요 발견 (Key Findings): What are the main results?
   - 결론 및 시사점 (Conclusions): What are the implications?

2. **Key Findings**: After the summary, list 3-5 key findings as bullet points starting with "- "

3. **Tone**: Use clear, accessible language while maintaining academic accuracy

4. **Length**: Keep the summary concise but informative (3-5 paragraphs total)

5. **Differentiation**: If the paper has an abstract, provide insights beyond what the abstract covers

## Paper Content:
"""
${input.text}
"""

Provide the summary directly without any additional labels or markdown headers.`;
  }

  return `You are an expert academic paper analyzer.

${langInstruction}

Create a brief summary of the following section titled "${input.sectionTitle}".

## Guidelines:
- Summarize the key points of this section in 2-3 sentences
- Focus on the most important information and findings
- Use clear, concise language
- If this section contains methodology, highlight the key approach
- If this section contains results, highlight the key findings

## Section Content:
"""
${input.text}
"""

Provide only the summary without any additional formatting or labels.`;
}

/**
 * Highlight prompt (F-006)
 */
export function buildHighlightPrompt(input: HighlightInput): string {
  return `You are an expert academic paper analyzer.

Identify the most important sentences in the following text that deserve highlighting.

Guidelines:
- Select sentences that contain key findings, novel contributions, or crucial methodology
- Categorize each highlight by importance: "high", "medium", or "low"
- Provide a brief reason (1 sentence) explaining why each sentence is important
- Select 3-7 highlights maximum

Text to analyze:
"""
${input.text}
"""

Respond in valid JSON format:
{
  "highlights": [
    {
      "text": "The exact sentence to highlight",
      "importance": "high" | "medium" | "low",
      "reason": "Brief explanation of why this is important"
    }
  ]
}

Provide only the JSON response without any markdown formatting or code blocks.`;
}

/**
 * Keyword extraction prompt (F-008)
 */
export function buildKeywordPrompt(input: KeywordInput): string {
  return `You are an expert academic paper analyzer.

Extract the most important technical keywords and terms from the following academic text.

Guidelines:
- Focus on domain-specific technical terms, methodologies, and key concepts
- For each keyword, provide:
  - A brief general definition
  - How it is used specifically in this paper's context
- Categorize importance as "high", "medium", or "low" based on relevance to the paper
- Extract 5-15 keywords

Text to analyze:
"""
${input.text}
"""

Respond in valid JSON format:
{
  "keywords": [
    {
      "term": "keyword",
      "importance": "high" | "medium" | "low",
      "definition": "General definition of the term",
      "contextInPaper": "How this term is specifically used in this paper"
    }
  ]
}

Provide only the JSON response without any markdown formatting or code blocks.`;
}

/**
 * Keyword explanation prompt (F-008)
 */
export function buildKeywordExplainPrompt(input: KeywordExplainInput): string {
  return `You are an expert academic paper analyzer.

Provide a detailed explanation of the term "${input.term}" within the context of the following academic paper.

Guidelines:
- Provide a clear, comprehensive definition
- Explain how this term is used specifically in this paper
- List 3-5 related terms or concepts
- Use accessible language while maintaining academic accuracy

Paper context:
"""
${input.paperContext}
"""

Respond in valid JSON format:
{
  "term": "${input.term}",
  "definition": "Comprehensive definition of the term",
  "contextInPaper": "Detailed explanation of how this term is used in this paper",
  "relatedTerms": ["term1", "term2", "term3"]
}

Provide only the JSON response without any markdown formatting or code blocks.`;
}
